import { child_process } from "./cep/node";
import { getFfmpegPath } from "./ffmpegPath";
import { FFMPEG_PROBE_LIMIT_SEC, FFMPEG_STALL_LIMIT_SEC, ffmpegStuckMessage, ffmpegUnreadableMessage, watchFfmpeg } from "./ffmpegLimits";
import { computeVadProbs, smoothVadProbs, vadFlagsFromProbs } from "./silero";
import { transcribeWithWordTimestamps, WordTimestamp } from "./whisper";
import { snapSegmentsToWords, normalizeWordToken } from "./wordSnap";

// =========================
// BASE CONFIG (shared)
// =========================
export const SAMPLE_RATE = 16000;
export const FRAME_MS = 30;
const FRAME_SAMPLES = Math.round((SAMPLE_RATE * FRAME_MS) / 1000); // 480
const BYTES_PER_FRAME = FRAME_SAMPLES * 2; // 16-bit PCM
export const FRAME_STEP_SEC = FRAME_MS / 1000;
const FULL_SCALE = 32768;

export interface Segment {
  start: number;
  end: number;
  /** 0-1, how decisively the LLR signal (see computeSharedFrameSignals)
   *  flips across this segment's own two boundaries — the *worse* (lower)
   *  of the two edges, since a segment is only as trustworthy as its
   *  least-certain boundary. Undefined for segments that never went through
   *  the LLR pipeline (Advanced-tab segments, J/L Pacing's live-selected
   *  pieces) — see computeBoundaryConfidence. */
  confidence?: number;
  /**
   * True when this segment's spectral profile differs enough from the previous
   * kept segment's to look like a possible speaker or scene change (see
   * spectralProfileDistance). Diagnostic only: folded into `confidence`, never
   * used to change a threshold. Undefined for the first kept segment in a file
   * and for any segment that skipped this check.
   */
  possibleSpeakerChange?: boolean;
}

export interface ModeConfig {
  name: string;
  label: string;
  /**
   * One line for the mode picker card: what this mode is for, not how it
   * works, so choosing between the three doesn't depend on segment counts and
   * cut percentages alone.
   */
  description: string;
  pad: number;
  /**
   * Minimum length, in frames, of the Viterbi HMM's silence-chain state (`Ds`
   * in `viterbiDecode`): a segment can't end until this many consecutive frames
   * have passed through the silence chain. Interacts with `bias` and the shared
   * `VITERBI_LOG_P_STAY`.
   */
  minSilenceFrames: number;
  /** The speech-chain counterpart of `minSilenceFrames` (`Dv` in `viterbiDecode`). */
  minSpeechFrames: number;
  /**
   * The preset's sensitivity: added to each frame's fused log-likelihood score
   * (`emitV = baseLlr[t] + bias` in `viterbiDecode`). Negative values push the
   * decoder toward "silence" (more frames classed as pause, so it cuts more),
   * positive toward "speech" (gentler). Starting values come from the measured `baseLlr`
   * distribution (see `computeLLRDiagnostics`).
   */
  bias: number;
  /**
   * How much this mode's `bias` is damped or strengthened per file, by how well
   * speech and noise separate in it.
   *
   * One fixed bias is a compromise between clean synthetic narration (large
   * speech/noise separation, can be cut harder) and camera audio with room tone
   * (small separation, riskier). `fileCleanliness(gaussianSeparability)`
   * measures that per file before the decode runs.
   *
   * effective bias = bias * (1 + strength * fileCleanliness(gaussianSep)),
   * where fileCleanliness is a signed -1..+1 score (see that function).
   * 0 = no change. At 0.5 a preset cuts about 50% harder on the cleanest
   * material and about 50% gentler on the murkiest.
   */
  adaptiveBiasStrength: number;
  /**
   * Optional separate padding for a segment's leading edge (word onset);
   * `undefined` = same as `pad`. The shortest pause that can be cut at all is
   * padStart + pad: below that the padded edges meet and the gap is merged.
   * Lowering only the onset side lowers that floor while keeping the
   * trailing-decay protection.
   */
  padStart?: number;
  /**
   * Apply the extend-only safety pads (sentence pause, breath, mid-gap
   * retention) only at boundaries the decoder was unsure about, instead of
   * everywhere.
   *
   * Every pad costs compression at every boundary to buy safety at the few that
   * need it. Gating the pads on `computeBoundaryConfidence` spends that cost only
   * where the evidence is ambiguous: cut cleanly where the LLR flips decisively,
   * stay padded where it doesn't.
   *
   * `null` = pads everywhere. A number 0..1 = keep the padding only where
   * boundary confidence is below it. Aggressive keeps `null` because it runs
   * with every pad disabled, so there is nothing to gate.
   */
  confidenceGateThreshold: number | null;
  /**
   * Per-mode override of MERGE_SHORT_GAP_SEC. mergeShortGaps re-absorbs any gap
   * shorter than this into speech after the Viterbi decode, so this value, not
   * `minSilenceFrames` (Ds), is the real floor on how short a cut pause can be:
   * with the global 0.15 s floor, a smaller Ds changes nothing. A per-mode value
   * lets the aggressive preset catch shorter pauses; Normal and Gentle keep
   * MERGE_SHORT_GAP_SEC.
   */
  mergeShortGapSec: number;
  /**
   * A second axis for telling the presets apart: how much of an already-detected
   * pause remains once it is safely classified as a gap — not how short a pause
   * must be to be cut at all (the axis of `mergeShortGapSec` and `bias`, which
   * also moves where speech is judged to end). `null` = off; see
   * `applyMidGapRetention` for the mechanism and why `null` for every mode
   * leaves the output unchanged.
   */
  midGapRetentionSec: number | null;
  /**
   * Whether `applyBreathPad` runs for this mode. `false` for Aggressive, which
   * cuts breath-shaped gaps like any other short pause; `true` for Normal and
   * Gentle, whose more conservative character includes breath protection.
   */
  breathPadEnabled: boolean;
  /**
   * Whether `applySentencePausePad` (up to 0.15 s extra after sentence-ending
   * punctuation) runs for this mode. It keeps the read feeling natural rather
   * than preventing clipped words (word-snap does that), so Aggressive turns it
   * off; Normal and Gentle keep it.
   */
  sentencePausePadEnabled: boolean;
}

// The three presets drive one pipeline: soft-EM two-Gaussian fitting, a fused
// log-likelihood ratio and a Viterbi min-duration HMM decoder (see
// `fitTwoGaussians`, `computeBaseLLR`, `viterbiDecode`).
//
// Two properties shaped it: a densely narrated file with very little real
// silence can degenerate a statistical noise-pool estimate (hence
// `fitTwoGaussians`'s `effN < 0.02*T` guard), and settings tuned on one or a
// few files don't generalize.
//
// `minSilenceFrames`/`minSpeechFrames` (Ds/Dv, the Viterbi chain lengths)
// encode each mode's relative character. `bias` is the per-frame sensitivity.

// Declared here, not next to mergeShortGaps further down, so MODES below can
// use it at module load. See that section for why 150 ms.
export const MERGE_SHORT_GAP_SEC = 0.15;

// The three presets, from the tightest cut to the gentlest. The names and keys
// ("aggressive", "normal", "gentle") are what JLCutPreset, the default mode
// and every `mode.name` lookup use.
export const MODES: ModeConfig[] = [
  {
    name: "aggressive",
    label: "Mode 1 — Aggressive (recommended)",
    description:
      "Tightest cut: catches short pauses the other modes leave alone, for maximum pacing. Breaths between phrases are cut like any other pause; best for fast-cut, high-density content.",
    // Aggressive: the tightest cut. It differs from Normal by a more negative
    // `bias` (the per-frame decode calls brief quiet dips "silence" sooner) and
    // a smaller `mergeShortGapSec` (shorter pauses survive the merge step), with
    // the breath and sentence-pause pads off.
    //
    // `minSilenceFrames` has no effect here once `mergeShortGapSec` is the binding
    // floor. A negative `bias` acts on every frame, including inside words:
    // sibilants trail off quietly at word endings and are naturally low in
    // tonality (see computeBaseLLR's `tone` term), so they are the borderline case
    // a stronger bias tips into "silence" first. A fixed `pad` can't reliably
    // span a sibilant's variable length, and a word-recognition check still
    // accepts a slightly shortened sibilant, so word endings must be judged by
    // ear when this value changes. `pad` values around 0.06 make the lattice
    // clip words non-monotonically and are avoided.
    pad: 0.08,
    // Leading-edge padding is lower than the trailing edge (0.05 vs 0.08): the
    // shortest pause that can be cut at all is padStart + pad, so at 0.08/0.08
    // nothing under 160 ms could be cut. Clipping damage comes from the trailing
    // side only; the onset side can drop to 0.05 without clipping more words,
    // lowering the floor to 130 ms. Around 0.03 onsets start losing words.
    padStart: 0.05,
    minSilenceFrames: 3,
    minSpeechFrames: 3,
    bias: -4,
    adaptiveBiasStrength: 0,
    confidenceGateThreshold: null,
    mergeShortGapSec: 0.05,
    midGapRetentionSec: null,
    breathPadEnabled: false,
    sentencePausePadEnabled: false,
  },
  {
    name: "normal",
    label: "Mode 2 — Normal",
    description:
      "Tight, punchy cut — removes brief pauses for brisk pacing while keeping natural speech rhythm. A good middle ground for most content.",
    // 0.08 rather than 0.07: values in the 0.06-0.07 range clip far more word
    // endings (the same non-monotonic zone noted for Aggressive), at a negligible
    // gain in compression.
    pad: 0.08,
    // Same leading-edge padding as Aggressive: it adds compression without
    // clipping more words here. Gentle keeps the symmetric pad, because on Gentle
    // the lower onset pad clips more words — the trade the careful tier refuses.
    padStart: 0.05,
    minSilenceFrames: 3,
    minSpeechFrames: 3,
    bias: 0,
    adaptiveBiasStrength: 0,
    confidenceGateThreshold: 0.3,
    mergeShortGapSec: MERGE_SHORT_GAP_SEC,
    // Mid-gap retention is extend-only (a mode can only keep more than the
    // baseline, never less), so Aggressive stays at `null` and Normal and Gentle
    // get progressively more retention — the same ordering (Aggressive < Normal <
    // Gentle) reached entirely through the safe direction.
    midGapRetentionSec: 0.2,
    breathPadEnabled: true,
    sentencePausePadEnabled: true,
  },
  {
    name: "gentle",
    label: "Mode 3 — Gentle",
    description:
      "Balanced, moderate touch — removes clear dead air while preserving natural speech rhythm and breathing. Best for interviews/podcasts or careful content.",
    pad: 0.08,
    minSilenceFrames: 3,
    minSpeechFrames: 2,
    bias: 2,
    adaptiveBiasStrength: 0,
    confidenceGateThreshold: 0.3,
    mergeShortGapSec: MERGE_SHORT_GAP_SEC,
    // Same mechanism as Normal's, larger target: Gentle keeps the most. Larger
    // values such as 0.30 start clipping more words than Aggressive does.
    midGapRetentionSec: 0.25,
    breathPadEnabled: true,
    sentencePausePadEnabled: true,
  },
];

// The Advanced tab's manual-threshold path (estimateFloorAndSpeechDb in
// scanAudioFile, computeLocalThresholds/buildSegmentsAdvanced called from
// main.tsx) uses a plain hard-threshold VAD, not the LLR/Viterbi pipeline;
// these constants drive it.
const ADVANCED_VAD_THRESHOLD = 0.15;
const ADVANCED_VAD_RELEASE_RATIO = 0.8;
const ADVANCED_VAD_SMOOTH_RADIUS = 1;
export const ADVANCED_LOCAL_THRESHOLD_PARAMS: LegacyThresholdParams = {
  noisePct: 0.9,
  speechPct: 0.08,
  energyRatioFallback: 1.5,
};

/**
 * Per-phase timing of `scanAudioFile`: plain `Date.now()` deltas around each
 * major phase, so a report from a slower machine says where the time went.
 * Cheap, and never changes what is computed. Shown in the Diagnostics report.
 */
export interface ScanTimingMs {
  /** decodeToPCMAsync + computeRmsFrames + computeWeightedRmsFrames. */
  decode: number;
  /** computeVadProbs (Silero ONNX/WASM inference). */
  vad: number;
  /** computeSharedFrameSignals — the self-written per-frame FFT
   *  (computeSnrTonality), the soft-EM Gaussian fit, and the fused LLR
   *  (computeBaseLLR) all live inside this one call. */
  sharedSignals: number;
  /** The first MODES loop (buildSegmentsHmm + mergeShortGaps + confidence/
   *  speaker-change) — 3 Viterbi decodes over the already-computed baseLlr,
   *  should be cheap relative to the phases above. */
  viterbi: number;
  /** transcribeWithWordTimestamps (whisper-cli subprocess) — mirrors
   *  whisper.ts's own `lastTranscribeMs`, kept here too so every phase is
   *  visible from one place instead of two. */
  whisper: number;
  /** The second MODES loop (snapSegmentsToWords + applySentencePausePad +
   *  applyBreathPad + confidence/speaker-change) — only runs if whisper
   *  succeeded. applyBreathPad's own estimateF0Correlation calls are the
   *  one non-trivial cost in here. */
  wordSnap: number;
  /** Wall-clock total of the scanAudioFile call. Slightly more than the sum
   *  of the phases above, because probeAudioChannels, the Advanced-tab VAD
   *  flags and per-statement overhead are not timed separately. */
  total: number;
}

export interface ScanResult {
  durationSec: number;
  frameCount: number;
  floorDb: number;
  speechDb: number;
  overlap: boolean;
  scanTimingMs: ScanTimingMs;
  segmentsByMode: Record<string, Segment[]>;
  /**
   * Per preset: how many pauses the detector found before any padding, the
   * longest of them, and the shortest pause the preset can actually cut.
   * Read-only facts for the panel's hint when a preset finds pauses but cuts
   * none; nothing in the cut decision reads this.
   */
  pauseStatsByMode: Record<string, PauseStats>;
  /**
   * The decoded audio itself. `weightedRmsValues`/`rmsValues` carry no
   * waveform, but J/L Pacing's pitch-aware overlap stop (estimateF0Voicing)
   * needs real samples for autocorrelation. Kept from the decode Scan already
   * does for Silero and whisper.cpp, so it costs no extra peak memory.
   * `computeJLCutOverlaps` indexes it like `weightedRmsValues` (source-file
   * seconds).
   */
  pcm: Buffer;
  /** Raw (unweighted) per-frame RMS — this is what Waveform.tsx renders, so
   *  it must always represent the true, unweighted audio. Every silence/
   *  speech DECISION uses `weightedRmsValues` below instead — see that
   *  field's own comment. */
  rmsValues: number[];
  /** K-weighted counterpart to `rmsValues` (the ITU-R BS.1770 pre-filter:
   *  a +4 dB high-shelf at ~1500 Hz and a 38 Hz high-pass, plus an extra
   *  80 Hz high-pass against rumble; see computeWeightedRmsFrames) —
   *  identical frame count/timing, only the amplitude content differs.
   *  Feeds every silence/speech decision (adaptiveThreshold, buildSegments,
   *  wordSnap's energy gate, J/L Pacing's quiet-region measurement) so
   *  camera/mic rumble and handling noise don't inflate the noise floor or
   *  skew the adaptive percentiles.
   *  Deliberately NOT what the Waveform preview renders — that stays on
   *  `rmsValues` so the visual preview is never silently bass-attenuated. */
  weightedRmsValues: number[];
  /** Per-frame speech flag from Silero VAD, or null if it wasn't available (energy-only fallback was used instead). */
  vadFlags: boolean[] | null;
  /**
   * Same as `vadFlags` but thresholded at the release-side bar
   * (ADVANCED_VAD_THRESHOLD * ADVANCED_VAD_RELEASE_RATIO), so Advanced mode's
   * live re-snap (main.tsx) can give its manual dB threshold the same
   * asymmetric attack/release hysteresis instead of a single threshold. Null
   * under the same condition as `vadFlags` (no Silero signal available).
   */
  vadReleaseFlags: boolean[] | null;
  /** Channel count of the source file, or null if it couldn't be determined. */
  sourceChannels: number | null;
  /**
   * Per-word ASR timestamps, always attempted during Scan (the whisper.cpp
   * subprocess runs without blocking the panel). Null only if transcription
   * failed (whisper.ts never throws); Scan works without them, just without
   * the word-boundary validation pass.
   */
  words: WordTimestamp[] | null;
  /** Same shape as segmentsByMode, but with each mode's boundaries checked
   *  against real word timestamps and corrected wherever a cut looked like
   *  it accidentally split a word (see wordSnap.ts for the two-gate
   *  validation this applies) — null unless `words` is also non-null. */
  segmentsByModeWordSnapped: Record<string, Segment[]> | null;
  /** The energy threshold (linear RMS) word-snap's corroboration gate uses:
   *  one mode-independent, deliberately lenient value from the Gaussian fit
   *  (see SharedFrameSignals.wordSnapEnergyGate). Exposed so the Advanced
   *  tab's live re-snap (main.tsx) can reuse it instead of the user's own,
   *  possibly much stricter, dB threshold, which would stop word-snap from
   *  rescuing quiet word endings. */
  wordSnapEnergyGate: number;
  /**
   * The file's measured noise floor in linear RMS (exp of the fitted
   * noise-cluster mean, `shared.fit.muN`), in the same domain as
   * `weightedRmsValues`. Lets J/L Pacing's quiet bar (computeJLCutOverlaps)
   * floor at what a noisy camera recording can physically reach, instead of
   * only relative to each segment's median RMS.
   */
  noiseFloorRms: number;
  /**
   * Median of the file's per-frame broadband SNR (`computeSnrTonality`, dB): a
   * cheap "how clean or synthetic does this sound" measure, reused so
   * Aggressive's J/L overlap floor adapts to the source instead of being one
   * fixed constant.
   */
  medianSnrDb: number;
  /**
   * File-level reliability of the whole soft-EM/LLR fit this Scan's segments
   * are built on. Different from Segment.confidence (per-boundary LLR
   * contrast; see gaussianSeparability): a file can have locally confident
   * boundaries on top of a poorly separated file-wide fit. Below
   * RELIABILITY_SEPARABILITY_HIGH every segment's confidence is multiplied by
   * a factor that ramps linearly from RELIABILITY_MIN_FACTOR at
   * RELIABILITY_SEPARABILITY_LOW to 1 at HIGH; files below LOW sit at the
   * floor (see scanAudioFile).
   */
  gaussianSeparability: number;
  /** The noise cluster's own final effective weight (0-1) — see
   *  GaussFit.noiseFraction's own doc comment. Exposed alongside
   *  gaussianSeparability for the same file-level-reliability purpose. */
  noiseFraction: number;
}

/**
 * How far (seconds) a word-snap adjustment may move a segment boundary before
 * it is discarded in favour of the original energy-based one; see wordSnap.ts
 * for why (Whisper's word timestamps are imperfectly aligned).
 *
 * whisper.cpp's `-ml 1` word timestamps tile the timeline edge to edge: one
 * word's end and the next word's start almost always coincide, so they carry
 * no notion of the pause between words, and a large cap would let word-snap
 * swallow real short gaps. A word's trailing consonant can need ~140 ms to
 * reach silence, though, so the cap must allow that. 0.15 s is safe because
 * gate #2 (energy corroboration in wordSnap.ts) also checks each word against
 * its own peak RMS (RELATIVE_DECAY_RATIO). Larger caps split fewer words but
 * merge more real gaps; 0.15 s is the conservative middle.
 */
export const WORD_SNAP_MAX_SEC = 0.15;

// =========================
// 1. DECODE AUDIO (ffmpeg -> raw PCM, no temp files)
// =========================

/** Reads the source's audio layout straight from ffmpeg's own stream-info
 *  banner (stderr) — no ffprobe bundled, but ffmpeg always prints this even
 *  for a no-output invocation, which is all we need here. `streams`: how many
 *  audio streams the file has (camera files often keep each channel as its
 *  own stream); `channels`: the first audio stream's channel count, null when
 *  unknown. The panel refuses more than one stream or more than two channels
 *  before Scan and Natural pitch. Asynchronous, so a slow file never freezes
 *  the panel; stopped after FFMPEG_PROBE_LIMIT_SEC (see ffmpegLimits.ts). A
 *  probe that can't start reads as no streams; the Scan decode or Natural
 *  pitch render that follows then reports why. */
export const probeAudioLayout = (inputPath: string): Promise<{ streams: number; channels: number | null }> =>
  new Promise((resolve, reject) => {
    const proc = child_process.spawn(getFfmpegPath(), ["-i", inputPath]);
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, FFMPEG_PROBE_LIMIT_SEC * 1000);
    proc.stderr?.on("data", (d: Buffer) => {
      // The banner is a few kilobytes; past 10 MB something is wrong.
      if (stderr.length < 10 * 1024 * 1024) stderr += d.toString("utf-8");
      else proc.kill("SIGKILL");
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ streams: 0, channels: null });
    });
    proc.on("close", () => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(ffmpegStuckMessage(inputPath)));
        return;
      }
      const audioLines = stderr.split("\n").filter((line) => /Stream #\d+:\d+.*Audio:/.test(line));
      resolve({ streams: audioLines.length, channels: audioLines.length ? channelsFromAudioLine(audioLines[0]) : null });
    });
  });

/** The first audio stream's channel count (see probeAudioLayout). Reported in
 *  the Diagnostics report. */
export const probeAudioChannels = async (inputPath: string): Promise<number | null> => (await probeAudioLayout(inputPath)).channels;

const channelsFromAudioLine = (audioLine: string): number | null => {
  if (/\bmono\b/i.test(audioLine)) return 1;
  if (/\bstereo\b/i.test(audioLine)) return 2;
  const chMatch = audioLine.match(/\b(\d+)\s+channels?\b/i);
  if (chMatch) return parseInt(chMatch[1], 10);
  return channelsFromLayoutName(audioLine);
};

/** Channel counts of ffmpeg's named layouts that aren't written as numbers. */
const NAMED_LAYOUT_CHANNELS: Record<string, number> = {
  downmix: 2,
  binaural: 2,
  quad: 4,
  hexagonal: 6,
  octagonal: 8,
  cube: 8,
  hexadecagonal: 16,
};

/** ffmpeg names a known layout instead of printing "N channels": one of the
 *  comma-separated fields after "Audio:" is "5.1", "5.1(side)", "7.1.4",
 *  "22.2", "quad"... A numbered layout has as many channels as its parts add
 *  up to (5.1 = 6, 7.1.4 = 12). */
export const channelsFromLayoutName = (audioLine: string): number | null => {
  const at = audioLine.indexOf("Audio:");
  if (at < 0) return null;
  for (const field of audioLine.slice(at + "Audio:".length).split(",")) {
    const name = field
      .trim()
      .replace(/\([a-z-]+\)$/i, "")
      .toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_LAYOUT_CHANNELS, name)) return NAMED_LAYOUT_CHANNELS[name];
    if (/^\d+(\.\d+){1,2}$/.test(name)) return name.split(".").reduce((sum, part) => sum + parseInt(part, 10), 0);
  }
  return null;
};
/** Optional [startSec, endSec) window into the source file — used to scan only
 *  a clip's own trimmed range (see ClipInfo.sourceInPoint/sourceOutPoint,
 *  from ppro.ts's getSelectedClipInfo) instead of the whole underlying media
 *  file. */
export interface TrimRange {
  startSec: number;
  endSec: number;
}

const pcmDecodeArgs = (inputPath: string, trim?: TrimRange | null): string[] => {
  const args: string[] = ["-y"];
  // Input-side seek (-ss before -i) is both fast and sample-accurate for
  // audio decode (unlike stream-copy seeking, which only snaps to
  // keyframes) — exactly what's needed here since everything downstream is
  // already a fresh raw-PCM decode, not a copy.
  if (trim) args.push("-ss", String(Math.max(0, trim.startSec)));
  args.push("-i", inputPath);
  if (trim) args.push("-t", String(Math.max(0, trim.endSec - trim.startSec)));
  // Some camera and screen recordings start their audio stream later than the
  // file (and its video). Premiere places that audio at its own start time, so
  // the decode pads the gap with silence (first_pts=0) and every analysed
  // second stays file time. A stream that starts at 0 decodes unchanged.
  args.push("-af", "aresample=async=1:first_pts=0");
  args.push("-ac", "1", "-ar", String(SAMPLE_RATE), "-vn", "-f", "s16le", "pipe:1");
  return args;
};

export const decodeToPCM = (inputPath: string, trim?: TrimRange | null): Buffer => {
  const ffmpeg = getFfmpegPath();
  const args = pcmDecodeArgs(inputPath, trim);
  const result = child_process.spawnSync(ffmpeg, args, {
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`ffmpeg failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString("utf-8") : "";
    throw new Error(`ffmpeg exited with code ${result.status}: ${stderr}`);
  }
  return result.stdout as Buffer;
};

/** The same decode as decodeToPCM (same ffmpeg arguments, same bytes), without
 *  blocking the panel: Scan of a long file can decode for many seconds, and a
 *  blocked render thread freezes the panel. Stopped when no audio has arrived
 *  for FFMPEG_STALL_LIMIT_SEC, or when a trimmed decode passes twice its
 *  expected length plus a minute (a looping decoder would otherwise fill the
 *  panel's memory). */
export const decodeToPCMAsync = (inputPath: string, trim?: TrimRange | null): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let proc: any;
    try {
      proc = child_process.spawn(getFfmpegPath(), pcmDecodeArgs(inputPath, trim));
    } catch (e: any) {
      reject(new Error(`ffmpeg failed to start: ${e?.message || e}`));
      return;
    }
    const chunks: Buffer[] = [];
    let received = 0;
    const maxBytes = trim ? (2 * Math.max(0, trim.endSec - trim.startSec) + 60) * SAMPLE_RATE * 2 : Infinity;
    const watch = watchFfmpeg(
      proc,
      () => received,
      FFMPEG_STALL_LIMIT_SEC,
      () => (received > maxBytes ? "too-long" : null),
    );
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      chunks.push(d);
      received += d.length;
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf-8");
      if (stderr.length > 200000) stderr = stderr.slice(-100000);
    });
    proc.on("error", (e: any) => {
      watch.done();
      reject(new Error(`ffmpeg failed to start: ${e?.message || e}`));
    });
    proc.on("close", (code: number) => {
      watch.done();
      if (watch.reason()) {
        reject(new Error(ffmpegStuckMessage(inputPath)));
        return;
      }
      if (code !== 0) {
        reject(new Error(ffmpegUnreadableMessage(inputPath, stderr) || `ffmpeg exited with code ${code}: ${stderr}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });

// =========================
// 2. RMS ENERGY PER FRAME
// =========================
export const computeRmsFrames = (pcm: Buffer): number[] => {
  const numFrames = Math.floor(pcm.length / BYTES_PER_FRAME);
  const rms: number[] = new Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const base = f * BYTES_PER_FRAME;
    let sumSq = 0;
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const s = pcm.readInt16LE(base + i * 2);
      sumSq += s * s;
    }
    rms[f] = Math.sqrt(sumSq / FRAME_SAMPLES);
  }
  return rms;
};

// =========================
// 2b. K-WEIGHTED RMS (ITU-R BS.1770 loudness pre-filter, same technique EBU
// R128/broadcast normalization uses) — a SEPARATE array from computeRmsFrames'
// raw one above, never a replacement for it. Real camera+mic recordings carry
// a lot of sub-80Hz energy (HVAC rumble, handling noise, mic-stand
// transmission) that isn't speech but still inflates the noise floor and
// corrupts every adaptive percentile derived from raw RMS — this filter
// chain widens the real-silence/real-noise gap on that kind of source while
// barely touching clean synthetic AI voice, which has almost none of that
// low-frequency content to begin with. `computeWeightedRmsFrames` feeds every
// silence/speech DECISION (adaptiveThreshold, buildSegments, wordSnap's
// energy gate, J/L Pacing's quiet-region measurement) — `computeRmsFrames`'s
// raw array keeps feeding the Waveform preview the user actually sees, which
// must never be silently bass-attenuated.
//
// Frame-count identity with computeRmsFrames is guaranteed by construction
// (same Math.floor(sampleCount / FRAME_SAMPLES) math on an array of the same
// length), so nothing downstream needs any frame-index changes — only which
// array gets passed in changes.
// =========================

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ Audio EQ Cookbook high-shelf (public domain). S=1 (no resonance) —
 *  the standard choice absent a specific reason to peak the shelf. */
const highShelfCoeffs = (f0: number, dBgain: number, fs: number, S = 1): BiquadCoeffs => {
  const A = Math.pow(10, dBgain / 40);
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = (sinw0 / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2);
  const sqrtA2alpha = 2 * Math.sqrt(A) * alpha;
  const b0 = A * (A + 1 + (A - 1) * cosw0 + sqrtA2alpha);
  const b1 = -2 * A * (A - 1 + (A + 1) * cosw0);
  const b2 = A * (A + 1 + (A - 1) * cosw0 - sqrtA2alpha);
  const a0 = A + 1 - (A - 1) * cosw0 + sqrtA2alpha;
  const a1 = 2 * (A - 1 - (A + 1) * cosw0);
  const a2 = A + 1 - (A - 1) * cosw0 - sqrtA2alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
};

/** RBJ Audio EQ Cookbook 2nd-order high-pass (public domain). */
const highPassCoeffs = (f0: number, q: number, fs: number): BiquadCoeffs => {
  const w0 = (2 * Math.PI * f0) / fs;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * q);
  const b0 = (1 + cosw0) / 2;
  const b1 = -(1 + cosw0);
  const b2 = (1 + cosw0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosw0;
  const a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
};

// Explicit <ArrayBufferLike> generic throughout this block (not the bare
// `Float32Array`) — with both "DOM" and "ESNext" in tsconfig's `lib`, a bare
// `Float32Array` type annotation and a `new Float32Array(n)` constructor
// call resolve to different default generic instantiations in TS 5.9,
// which otherwise makes a same-shaped reassignment (`samples =
// applyBiquad(samples, c)`) a type error despite being runtime-identical.
const applyBiquad = (x: Float32Array<ArrayBufferLike>, c: BiquadCoeffs): Float32Array<ArrayBufferLike> => {
  const y = new Float32Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const yi = c.b0 * xi + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    y[i] = yi;
    x2 = x1;
    x1 = xi;
    y2 = y1;
    y1 = yi;
  }
  return y;
};

// Q = 1/sqrt(2) — standard Butterworth Q, no resonant peak at the cutoff.
const K_WEIGHT_Q = Math.SQRT1_2;
const K_WEIGHT_SHELF_FREQ = 1500;
const K_WEIGHT_SHELF_GAIN_DB = 4.0;
const K_WEIGHT_HPF1_FREQ = 38; // ITU-R BS.1770 stage 2
const K_WEIGHT_HPF2_FREQ = 80; // extra — rumble / handling-noise reject

/** Converts to Float32 on the NATIVE int16 scale (not normalized to ±1.0) —
 *  deliberate: keeps computeWeightedRmsFrames's output in the same
 *  FULL_SCALE=32768-relative universe as computeRmsFrames's raw output, so
 *  it's a drop-in substitute wherever it's used (rmsToDb, the Advanced
 *  path's percentile and ratio parameters, every RMS threshold) with zero
 *  rescaling needed anywhere else in this file.
 *  The +4dB shelf can push a filtered sample's magnitude slightly above
 *  32768 for full-scale high-frequency content — harmless for Float32 math
 *  and expected for a loudness weighting. */
const applyKWeighting = (pcm: Buffer): Float32Array<ArrayBufferLike> => {
  const n = Math.floor(pcm.length / 2);
  let samples: Float32Array<ArrayBufferLike> = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = pcm.readInt16LE(i * 2);
  const chain = [
    highShelfCoeffs(K_WEIGHT_SHELF_FREQ, K_WEIGHT_SHELF_GAIN_DB, SAMPLE_RATE),
    highPassCoeffs(K_WEIGHT_HPF1_FREQ, K_WEIGHT_Q, SAMPLE_RATE),
    highPassCoeffs(K_WEIGHT_HPF2_FREQ, K_WEIGHT_Q, SAMPLE_RATE),
  ];
  for (const c of chain) samples = applyBiquad(samples, c);
  return samples;
};

const computeRmsFramesFromFloat = (samples: Float32Array<ArrayBufferLike>): number[] => {
  const numFrames = Math.floor(samples.length / FRAME_SAMPLES);
  const rms: number[] = new Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    const base = f * FRAME_SAMPLES;
    let sumSq = 0;
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const s = samples[base + i];
      sumSq += s * s;
    }
    rms[f] = Math.sqrt(sumSq / FRAME_SAMPLES);
  }
  return rms;
};

/** Same (pcm: Buffer) => number[] shape as computeRmsFrames — a pure
 *  drop-in for any call site that needs the K-weighted array instead of the
 *  raw one. See this section's own header comment for what it's for and
 *  why the raw array still exists alongside it. */
export const computeWeightedRmsFrames = (pcm: Buffer): number[] => computeRmsFramesFromFloat(applyKWeighting(pcm));

// =========================
// 2c. PER-BAND SNR + TONALITY — raw per-frame signals feeding computeBaseLLR
// below (§2d), never a decision on their own. computeBaseLLR fuses `snrDb` and
// `tonality` as two independently weighted terms; fusing them into one scalar
// inside this stage and thresholding that scalar loses speech on synthetic
// voice, so this stage stays signals-only.
// =========================

const FFT_SIZE = 512;

/**
 * Iterative radix-2 Cooley-Tukey, in place. Self-written, like the other small
 * dependency-free DSP primitives in this file (see the K-weighting biquads),
 * rather than a package for one 512-point transform. Checked against a naive
 * O(n^2) DFT and Parseval's theorem (energy conservation) on DC, impulse,
 * single-bin sinusoid, white noise and Hann-windowed zero-padded signals.
 */
const fft512InPlace = (re: Float64Array, im: Float64Array): void => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len / 2;
    for (let i = 0; i < n; i += len) {
      let curWr = 1;
      let curWi = 0;
      for (let j = 0; j < half; j++) {
        const idx1 = i + j;
        const idx2 = i + j + half;
        const ur = re[idx1];
        const ui = im[idx1];
        const vr = re[idx2] * curWr - im[idx2] * curWi;
        const vi = re[idx2] * curWi + im[idx2] * curWr;
        re[idx1] = ur + vr;
        im[idx1] = ui + vi;
        re[idx2] = ur - vr;
        im[idx2] = ui - vi;
        const nextWr = curWr * wr - curWi * wi;
        const nextWi = curWr * wi + curWi * wr;
        curWr = nextWr;
        curWi = nextWi;
      }
    }
  }
};

/**
 * Hann window over the real 480 samples (FRAME_SAMPLES), computed once and
 * applied before zero-padding to FFT_SIZE=512. Zero-padding, instead of
 * borrowing 32 samples from the next frame, keeps every FFT frame aligned to
 * the non-overlapping 30 ms grid with no cross-frame coupling.
 */
const FFT_HANN_WINDOW: Float64Array = (() => {
  const w = new Float64Array(FRAME_SAMPLES);
  for (let i = 0; i < FRAME_SAMPLES; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME_SAMPLES - 1));
  return w;
})();

// 16 log-spaced bands from ~62.5Hz to Nyquist, computed once from
// FFT_SIZE/SAMPLE_RATE (not a hand-picked table) so it stays correct if
// either ever changes. Sub-62.5Hz (DC and the first FFT bin) is excluded
// entirely, not folded into band 0 — already squarely inside what the
// K-weighting high-passes above treat as pure rumble.
const NOISE_FLOOR_BANDS = 16;
const NOISE_FLOOR_MIN_HZ = 62.5;
const NOISE_FLOOR_MAX_HZ = SAMPLE_RATE / 2;
const FFT_BIN_HZ = SAMPLE_RATE / FFT_SIZE;

const BAND_BIN_RANGES: [number, number][] = (() => {
  const edgesHz: number[] = [];
  for (let i = 0; i <= NOISE_FLOOR_BANDS; i++) {
    edgesHz.push(NOISE_FLOOR_MIN_HZ * Math.pow(NOISE_FLOOR_MAX_HZ / NOISE_FLOOR_MIN_HZ, i / NOISE_FLOOR_BANDS));
  }
  const edgesBin = edgesHz.map((hz) => Math.round(hz / FFT_BIN_HZ));
  // Monotonicity guard: bump any duplicate/non-increasing edge forward by
  // one bin so no band is ever empty (only a risk for the lowest couple of
  // bands, where adjacent log-spaced edges can round to the same bin).
  for (let i = 1; i < edgesBin.length; i++) {
    if (edgesBin[i] <= edgesBin[i - 1]) edgesBin[i] = edgesBin[i - 1] + 1;
  }
  const ranges: [number, number][] = [];
  for (let i = 0; i < NOISE_FLOOR_BANDS; i++) {
    ranges.push([edgesBin[i], Math.min(edgesBin[i + 1], FFT_SIZE / 2 + 1)]);
  }
  return ranges;
})();

/** Per-frame band power (sum |X[k]|^2 per band) and spectral-flatness
 *  tonality, from ONE Hann-windowed, zero-padded 512-pt FFT of the frame's
 *  real (unweighted — NOT K-weighted) samples — shared between the
 *  noise-floor step (needs bandPow) and tonality (needs the same bandPow,
 *  no second FFT pass). Runs on raw PCM deliberately: per-band adaptive
 *  noise tracking is a strictly more powerful generalization of what
 *  K-weighting's fixed shape approximates — running it on the already
 *  K-weighted signal would double-apply a fixed correction on top of an
 *  adaptive one and waste the lowest band or two. */
const computeBandPowerAndTonality = (pcm: Buffer, frameIndex: number): { bandPow: Float64Array; tonality: number } => {
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const base = frameIndex * BYTES_PER_FRAME;
  for (let i = 0; i < FRAME_SAMPLES; i++) {
    re[i] = pcm.readInt16LE(base + i * 2) * FFT_HANN_WINDOW[i];
  }
  fft512InPlace(re, im);
  const bandPow = new Float64Array(NOISE_FLOOR_BANDS);
  for (let b = 0; b < NOISE_FLOOR_BANDS; b++) {
    const [lo, hi] = BAND_BIN_RANGES[b];
    let sum = 0;
    for (let k = lo; k < hi; k++) sum += re[k] * re[k] + im[k] * im[k];
    bandPow[b] = sum;
  }
  // Tonality (spectral flatness = geometric mean / arithmetic mean of the
  // band powers — near 1 for broadband noise/hiss, low for voiced speech;
  // tonality = 1 - flatness). Excludes band 0 (~62.5-93.8Hz) specifically —
  // mains hum is itself narrowband/tonal and would otherwise spuriously
  // raise tonality during pure-hum/no-speech stretches, feeding a false
  // tonality bonus into what should stay classified as noise. Still
  // included in the SNR sum above, just not in this flatness measure.
  const FLATNESS_EPS = 1e-9;
  let logSum = 0;
  let sum = 0;
  for (let b = 1; b < NOISE_FLOOR_BANDS; b++) {
    logSum += Math.log(bandPow[b] + FLATNESS_EPS);
    sum += bandPow[b] + FLATNESS_EPS;
  }
  const n = NOISE_FLOOR_BANDS - 1;
  const gm = Math.exp(logSum / n);
  const am = sum / n;
  const tonality = 1 - gm / am;
  return { bandPow, tonality };
};

// Thin exported wrapper around computeBandPowerAndTonality's bandPow,
// L1-normalized (divided by its own sum) so comparing two profiles measures
// spectral shape (timbre), not loudness. Raw power would just re-detect
// "got louder or quieter", not "does this sound like a different speaker".
export const computeSpectralProfile = (pcm: Buffer, frameIndex: number): Float64Array => {
  const { bandPow } = computeBandPowerAndTonality(pcm, frameIndex);
  let sum = 0;
  for (let b = 0; b < bandPow.length; b++) sum += bandPow[b];
  const norm = new Float64Array(bandPow.length);
  if (sum <= 0) return norm;
  for (let b = 0; b < bandPow.length; b++) norm[b] = bandPow[b] / sum;
  return norm;
};

/** Mean of the normalized per-frame spectral profile across a segment's own
 *  frames — one 16-band "timbre fingerprint" per segment, for comparing
 *  adjacent kept segments (see spectralProfileDistance). */
export const segmentSpectralProfile = (pcm: Buffer, seg: { start: number; end: number }): Float64Array => {
  const startFrame = Math.max(0, Math.round(seg.start / FRAME_STEP_SEC));
  const endFrame = Math.max(startFrame + 1, Math.round(seg.end / FRAME_STEP_SEC));
  const sum = new Float64Array(NOISE_FLOOR_BANDS);
  let n = 0;
  for (let f = startFrame; f < endFrame; f++) {
    const base = f * BYTES_PER_FRAME;
    if (base + BYTES_PER_FRAME > pcm.length) break;
    const profile = computeSpectralProfile(pcm, f);
    for (let b = 0; b < NOISE_FLOOR_BANDS; b++) sum[b] += profile[b];
    n++;
  }
  if (n === 0) return sum;
  for (let b = 0; b < NOISE_FLOOR_BANDS; b++) sum[b] /= n;
  return sum;
};

/** Cosine distance (1 - cosine similarity) between two 16-band spectral
 *  profiles — 0 means identical shape, up to 2 for opposite shapes (never
 *  observed in practice since band powers are non-negative, so the real
 *  range is 0-1). Cheap, no numerical fragility near-zero bins the way
 *  KL-divergence has (a single near-empty band can blow up a KL term). */
export const spectralProfileDistance = (a: Float64Array, b: Float64Array): number => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA <= 0 || normB <= 0) return 0;
  const cosineSimilarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - cosineSimilarity;
};

// Minimum-statistics per-band noise floor (Martin's principle: over a window
// of continuous audio, the minimum of the smoothed power in a band is a biased
// estimate of that band's noise, since speech isn't present in every band all
// the time). Works on densely narrated files with no long silence, the case
// that breaks a single global percentile. Constants for this file's 30 ms hop
// (the usual V=15/U=8 assume 10 ms): V=5 frames per subwindow (150 ms), U=8
// subwindows (1.2 s), ALPHA 0.6 instead of 0.85 to keep a ~62 ms smoothing
// time constant at 3x the hop, BIAS 1.5 unchanged (no independent noise-floor
// ground truth to re-derive it against).
const NOISE_FLOOR_V = 5;
const NOISE_FLOOR_U = 8;
const NOISE_FLOOR_ALPHA = 0.6;
const NOISE_FLOOR_BIAS = 1.5;

class NoiseFloorTracker {
  private smoothedPow = new Float64Array(NOISE_FLOOR_BANDS);
  private subMin = new Float64Array(NOISE_FLOOR_BANDS).fill(Infinity);
  private ring: Float64Array[] = [];
  private k = 0;
  private seeded = false;
  noise = new Float64Array(NOISE_FLOOR_BANDS);

  /**
   * True once at least one real minimum-statistics rotation has completed
   * (ring.length >= 1); before that, `noise` is only this tracker's seed (a
   * recent frame's power, not a measured floor). A single-frame seed is almost
   * always smaller than a real multi-frame minimum, so a plain Math.min would
   * pick the meaningless seed over the real estimate. Callers min-combine only
   * two converged estimates, and otherwise use whichever one is converged.
   */
  converged = false;

  /** Seeds smoothedPow/noise from this tracker's own first real observation
   *  instead of a hardcoded near-zero placeholder: a placeholder such as
   *  `noise.fill(1e-9)` makes the first ~150 ms of either traversal
   *  (forward from file start, or backward from file end) report a spurious
   *  near-infinite SNR once combined with the other pass. This seed makes
   *  the pre-first-rotation estimate "this frame's own power" instead of a
   *  sentinel — safe on its own, but still not a real measured floor, which
   *  is exactly what `converged` above exists to flag to callers. */
  update(bandPow: Float64Array): void {
    if (!this.seeded) {
      this.smoothedPow.set(bandPow);
      this.noise.set(bandPow);
      this.seeded = true;
    }
    for (let b = 0; b < NOISE_FLOOR_BANDS; b++) {
      this.smoothedPow[b] = NOISE_FLOOR_ALPHA * this.smoothedPow[b] + (1 - NOISE_FLOOR_ALPHA) * bandPow[b];
      if (this.smoothedPow[b] < this.subMin[b]) this.subMin[b] = this.smoothedPow[b];
    }
    if (++this.k === NOISE_FLOOR_V) {
      this.ring.push(Float64Array.from(this.subMin));
      if (this.ring.length > NOISE_FLOOR_U) this.ring.shift();
      for (let b = 0; b < NOISE_FLOOR_BANDS; b++) {
        let m = Infinity;
        for (const s of this.ring) if (s[b] < m) m = s[b];
        this.noise[b] = NOISE_FLOOR_BIAS * m;
      }
      this.subMin.fill(Infinity);
      this.k = 0;
      this.converged = true;
    }
  }
}

const SNR_EPS = 1e-6;
// See NoiseFloorTracker: a band's noise estimate may never drift above a
// fraction of that band's whole-clip median power. Needed for densely
// narrated content, where minimum statistics finds no quiet moment within its
// window.
const NOISE_FLOOR_CAP_RATIO = 0.4;

export interface SnrTonalitySignals {
  /** Per-frame broadband SNR in dB — frame-aligned with weightedRmsValues. */
  snrDb: Float64Array;
  /** Per-frame spectral-flatness tonality, 0..1. */
  tonality: Float64Array;
  /**
   * One whole-file noise-floor estimate in the same domain as
   * logE = log(weightedRmsValues + LOG_EPSILON) (see computeBaseLLR and
   * fitTwoGaussians). Derived from weightedRmsValues and the per-frame SNR ratio
   * (`weightedRmsValues[f] / 10^(snrDb[f]/20)`, unitless), not from the FFT's
   * absolute power: converting bin power into an RMS-amplitude value would need
   * a Parseval/window coherent-gain correction, which the unitless ratio avoids.
   * Robust median over every frame where at least one noise-floor pass had
   * converged.
   */
  floorLogE: number;
  /**
   * Per-frame high-frequency SNR in dB: this frame's power in the top
   * `HF_RATIO_TOP_BANDS` log-spaced bands (~3.4-8 kHz at SAMPLE_RATE=16000,
   * NOISE_FLOOR_BANDS=16 — the sibilant/fricative region) against the same
   * per-band noise floor the broadband `snrDb` tracks.
   *
   * An SNR, not a share of the frame's total power: normalizing by the total
   * makes quiet broadband hiss look maximally "high-frequency" and drags voiced
   * speech down (its strong low fundamental), so the ratio separates word edges
   * from gaps the wrong way round. What distinguishes a sibilant from room tone
   * is whether its high-band energy stands above the room's own high-band floor.
   *
   * Why: `tonality` scores a sibilant as noise-like (it is broadband and flat),
   * so the `tone` term in computeBaseLLR pushes s/sh/f frames toward silence.
   * This term says "speech" on exactly those frames, instead of compensating
   * with pads or a global bias that cost compression everywhere.
   *
   * Free to compute: it reuses the per-frame FFT/`bandPow` the noise floor and
   * tonality already pay for.
   */
  hfSnrDb: Float64Array;
}

/**
 * How many of the top (highest-frequency) log-spaced bands count as "the
 * sibilant region" for SnrTonalitySignals.hfSnrDb: 3 of 16 log-spaced bands
 * between 62.5 Hz and 8 kHz ≈ 3.4-8 kHz, the standard fricative/sibilant
 * energy band.
 */
const HF_RATIO_TOP_BANDS = 3;

/**
 * Per-frame ±1 "whisper says there is a real word here" track, for the
 * `wWhisper` term in computeBaseLLR. Punctuation-only tokens are excluded via
 * the same `normalizeWordToken` filter word-snap uses: a bare "." carries a
 * real timestamp span but no speech, and counting it as coverage would count
 * non-speech as speech.
 *
 * Returns null when whisper produced nothing (it never throws, the same
 * never-block-Scan contract as silero.ts), so the term contributes 0.
 */
const buildWordCoverage = (words: WordTimestamp[] | null, frameCount: number, frameStepSec: number): Float64Array | null => {
  if (!words || words.length === 0) return null;
  const coverage = new Float64Array(frameCount).fill(-1);
  let any = false;
  for (const w of words) {
    if (normalizeWordToken(w.word).length === 0) continue;
    const lo = Math.max(0, Math.floor(w.start / frameStepSec));
    const hi = Math.min(frameCount - 1, Math.ceil(w.end / frameStepSec));
    for (let f = lo; f <= hi; f++) coverage[f] = 1;
    any = true;
  }
  return any ? coverage : null;
};

// Signed-normalization anchors for the `hf` term in computeBaseLLR, same shape
// as SNR_MID_DB/SNR_SCALE_DB: the midpoint and half-spread between word-edge
// frames (around +22 dB above the high-band floor) and gap frames (around
// 0 dB). Word edges sit as high as ordinary in-word speech, the property
// `tone` lacks.
const HF_SNR_MID_DB = 11;
const HF_SNR_SCALE_DB = 11;

/**
 * Frames whose samples are all exactly zero: digital silence (a muted
 * participant's own track, a gated voice track, empty padding). They hold no
 * room tone, so the noise estimates leave them out and the decode treats them
 * as silence: counted in, they pull the noise floor down to nothing and every
 * ordinary room-tone pause then reads as speech. Null when the clip has none,
 * which leaves every computation exactly as it is without this step.
 */
export const findDigitalSilenceFrames = (pcm: Buffer, numFrames: number): Uint8Array | null => {
  let mask: Uint8Array | null = null;
  for (let f = 0; f < numFrames; f++) {
    const base = f * BYTES_PER_FRAME;
    if (base + BYTES_PER_FRAME > pcm.length) break;
    let zero = true;
    for (let i = 0; i < BYTES_PER_FRAME; i++) {
      if (pcm[base + i] !== 0) {
        zero = false;
        break;
      }
    }
    if (zero) {
      if (!mask) mask = new Uint8Array(numFrames);
      mask[f] = 1;
    }
  }
  return mask;
};

/**
 * Forward + backward NoiseFloorTracker passes, per-band per-frame combine
 * (converged-aware, not a naive min; see NoiseFloorTracker, plus the
 * whole-clip-median cap), broadband SNR in dB, and spectral-flatness tonality
 * from the same per-frame FFT. `snrDb`/`tonality` are returned as two
 * separate arrays, never pre-fused into one scalar here (see this section's
 * header comment); computeBaseLLR fuses them.
 */
export const computeSnrTonality = (
  pcm: Buffer,
  weightedRmsValues: number[],
  digitalSilence: Uint8Array | null = null,
): SnrTonalitySignals => {
  // Digital-silence frames (findDigitalSilenceFrames) feed no noise estimate.
  const isSilent = (f: number): boolean => !!digitalSilence && digitalSilence[f] === 1;
  const numFrames = Math.floor(pcm.length / BYTES_PER_FRAME);
  const bandPowByFrame: Float64Array[] = new Array(numFrames);
  const tonality = new Float64Array(numFrames);
  const hfFirstBand = Math.max(0, NOISE_FLOOR_BANDS - HF_RATIO_TOP_BANDS);
  for (let f = 0; f < numFrames; f++) {
    const { bandPow, tonality: t } = computeBandPowerAndTonality(pcm, f);
    bandPowByFrame[f] = bandPow;
    tonality[f] = t;
  }

  const forwardNoise: Float64Array[] = new Array(numFrames);
  const forwardConverged: boolean[] = new Array(numFrames);
  const forwardTracker = new NoiseFloorTracker();
  for (let f = 0; f < numFrames; f++) {
    if (!isSilent(f)) forwardTracker.update(bandPowByFrame[f]);
    forwardNoise[f] = Float64Array.from(forwardTracker.noise);
    forwardConverged[f] = forwardTracker.converged;
  }

  const backwardNoise: Float64Array[] = new Array(numFrames);
  const backwardConverged: boolean[] = new Array(numFrames);
  const backwardTracker = new NoiseFloorTracker();
  for (let f = numFrames - 1; f >= 0; f--) {
    if (!isSilent(f)) backwardTracker.update(bandPowByFrame[f]);
    backwardNoise[f] = Float64Array.from(backwardTracker.noise);
    backwardConverged[f] = backwardTracker.converged;
  }

  const globalMedianBandPow = new Float64Array(NOISE_FLOOR_BANDS);
  {
    const perBandSorted: number[][] = Array.from({ length: NOISE_FLOOR_BANDS }, () => []);
    for (let f = 0; f < numFrames; f++) {
      if (isSilent(f)) continue;
      for (let b = 0; b < NOISE_FLOOR_BANDS; b++) perBandSorted[b].push(bandPowByFrame[f][b]);
    }
    for (let b = 0; b < NOISE_FLOOR_BANDS; b++) {
      perBandSorted[b].sort((a, c) => a - c);
      const mid = Math.floor(perBandSorted[b].length / 2);
      globalMedianBandPow[b] = perBandSorted[b].length
        ? perBandSorted[b].length % 2
          ? perBandSorted[b][mid]
          : (perBandSorted[b][mid - 1] + perBandSorted[b][mid]) / 2
        : 0;
    }
  }

  const snrDb = new Float64Array(numFrames);
  // High-frequency-band SNR, accumulated in the SAME loop from the SAME
  // per-band noise floors — see SnrTonalitySignals.hfSnrDb. No extra FFT,
  // no extra noise-tracking pass, just two more running sums.
  const hfSnrDb = new Float64Array(numFrames);
  const impliedNoiseFloorLogRms: number[] = [];
  for (let f = 0; f < numFrames; f++) {
    let sumBandPow = 0;
    let sumNoise = 0;
    let hfPow = 0;
    let hfNoise = 0;
    const fConv = forwardConverged[f];
    const bConv = backwardConverged[f];
    for (let b = 0; b < NOISE_FLOOR_BANDS; b++) {
      let noise: number;
      if (fConv && bConv) noise = Math.min(forwardNoise[f][b], backwardNoise[f][b]);
      else if (fConv) noise = forwardNoise[f][b];
      else if (bConv) noise = backwardNoise[f][b];
      else noise = bandPowByFrame[f][b];
      noise = Math.min(noise, NOISE_FLOOR_CAP_RATIO * globalMedianBandPow[b]);
      sumBandPow += bandPowByFrame[f][b];
      sumNoise += noise;
      if (b >= hfFirstBand) {
        hfPow += bandPowByFrame[f][b];
        hfNoise += noise;
      }
    }
    hfSnrDb[f] = 10 * Math.log10((hfPow + SNR_EPS) / (hfNoise + SNR_EPS));
    const db = 10 * Math.log10((sumBandPow + SNR_EPS) / (sumNoise + SNR_EPS));
    snrDb[f] = db;
    if ((fConv || bConv) && !isSilent(f)) {
      const impliedRms = weightedRmsValues[f] / Math.pow(10, db / 20);
      impliedNoiseFloorLogRms.push(Math.log(Math.max(impliedRms, 0) + LOG_EPSILON));
    }
  }

  let floorLogE: number;
  if (impliedNoiseFloorLogRms.length) {
    impliedNoiseFloorLogRms.sort((a, b) => a - b);
    const mid = Math.floor(impliedNoiseFloorLogRms.length / 2);
    floorLogE =
      impliedNoiseFloorLogRms.length % 2
        ? impliedNoiseFloorLogRms[mid]
        : (impliedNoiseFloorLogRms[mid - 1] + impliedNoiseFloorLogRms[mid]) / 2;
  } else {
    // Degenerate — no frame ever converged (a clip shorter than one
    // minimum-statistics subwindow). Fall back to the raw signal's own
    // lowest decile as a floor, better than an arbitrary constant.
    const heard = digitalSilence ? weightedRmsValues.filter((_, f) => !isSilent(f)) : weightedRmsValues;
    const sortedLogE = Array.from(heard.length ? heard : weightedRmsValues, (v) => Math.log(v + LOG_EPSILON)).sort((a, b) => a - b);
    floorLogE = percentileOf(sortedLogE, 0.1);
  }

  return { snrDb, tonality, floorLogE, hfSnrDb };
};

// =========================
// 2d. SOFT-EM TWO-GAUSSIAN FIT + LLR FUSION + VITERBI MIN-DURATION HMM — the
// segmentation of the three presets. adaptiveThreshold's percentile
// clustering and buildSegments' hysteresis loop serve only the Advanced tab's
// manual-threshold path (see the ADVANCED_* constants after MODES).
// =========================

// Variance floor for weightedMoments: an under-populated weight set (e.g. EM
// driving wN toward 0 on densely narrated AI voice) would otherwise give v≈0
// and send gaussLogPdf to ±Infinity.
const MIN_LOG_ENERGY_VARIANCE = 0.05;

const weightedMoments = (logE: Float64Array, w: Float64Array): { mu: number; v: number } => {
  let sumW = 0;
  let sumWX = 0;
  for (let t = 0; t < logE.length; t++) {
    sumW += w[t];
    sumWX += w[t] * logE[t];
  }
  const mu = sumW > 1e-9 ? sumWX / sumW : 0;
  let sumWX2 = 0;
  for (let t = 0; t < logE.length; t++) {
    const d = logE[t] - mu;
    sumWX2 += w[t] * d * d;
  }
  const v = sumW > 1e-9 ? Math.max(sumWX2 / sumW, MIN_LOG_ENERGY_VARIANCE) : 1;
  return { mu, v };
};

const gaussLogPdf = (x: number, mu: number, v: number): number => -0.5 * Math.log(2 * Math.PI * v) - ((x - mu) * (x - mu)) / (2 * v);

const logit = (p: number): number => Math.log(p / (1 - p));

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** No-VAD fallback seed for fitTwoGaussians' initial pSpeech weights, when
 *  Silero is unavailable — the same unsupervised 2-centroid iteration
 *  kmeans1D uses for the Advanced path's no-VAD split (clusterLogEnergy),
 *  adapted to return a soft per-frame probability (sigmoid of each frame's
 *  own relative distance to the two centroids) instead of a hard partition,
 *  so fitTwoGaussians' own EM iterations have something graded to refine
 *  from. */
const pseudoProbsFromLogE = (logE: Float64Array): Float64Array => {
  const values = Array.from(logE);
  const sorted = [...values].sort((a, b) => a - b);
  let c0 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  let c1 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  for (let it = 0; it < 20; it++) {
    let sumLow = 0;
    let countLow = 0;
    let sumHigh = 0;
    let countHigh = 0;
    for (const v of values) {
      if (Math.abs(v - c0) <= Math.abs(v - c1)) {
        sumLow += v;
        countLow++;
      } else {
        sumHigh += v;
        countHigh++;
      }
    }
    if (countLow) c0 = sumLow / countLow;
    if (countHigh) c1 = sumHigh / countHigh;
  }
  const lowC = Math.min(c0, c1);
  const highC = Math.max(c0, c1);
  const spread = Math.max(1e-6, highC - lowC);
  const probs = new Float64Array(values.length);
  for (let t = 0; t < values.length; t++) {
    const z = (values[t] - (lowC + highC) / 2) / (spread / 4);
    probs[t] = 1 / (1 + Math.exp(-z));
  }
  return probs;
};

export interface GaussFit {
  muS: number;
  vS: number;
  muN: number;
  vN: number;
  /**
   * True if the noise pool was too small for a real fit this round and
   * `muN`/`vN` fell back to `floorLogE` (see fitTwoGaussians). Densely narrated
   * AI voice often has no quiet moment at all, so this can be the common path on
   * such content, not a rare one; exposed so computeLLRDiagnostics can report
   * how often it happens.
   */
  noisePoolDegenerate: boolean;
  /**
   * The noise cluster's final effective weight (`effN / T`, T = total frames),
   * the file-level reliability signal's second input next to
   * gaussianSeparability. A small noise fraction on a file that didn't trip the
   * hard `noisePoolDegenerate` cutoff (2%) is still a thin, noisy fit; this is
   * the continuous signal under that binary flag.
   */
  noiseFraction: number;
}

/** Soft-EM two-Gaussian fit in log-energy — the presets' counterpart to
 *  adaptiveThreshold's hard-labeled percentile/k-means clustering (which only
 *  the Advanced path uses). Silero's own per-frame probability seeds the
 *  initial per-frame speech/noise WEIGHT (not a hard pool split), then 6 EM
 *  rounds refine muS/vS/muN/vN, blending each round's own model
 *  responsibility back with the VAD prior 50/50 so neither dominates. Degrades
 *  gracefully instead of collapsing: an under-populated noise pool (effN < 2%
 *  of frames) falls back to `floorLogE` (from minimum-statistics, always
 *  available) rather than fitting noise stats off a handful of unreliable
 *  frames. */
const fitTwoGaussians = (logE: Float64Array, pSpeech: Float64Array, floorLogE: number): GaussFit => {
  const T = logE.length;
  const wS = new Float64Array(T);
  const wN = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    wS[t] = pSpeech[t];
    wN[t] = 1 - pSpeech[t];
  }
  let muS = 0;
  let vS = 1;
  let muN = 0;
  let vN = 1;
  let noisePoolDegenerate = false;
  let noiseFraction = 0;
  for (let it = 0; it < 6; it++) {
    ({ mu: muS, v: vS } = weightedMoments(logE, wS));
    ({ mu: muN, v: vN } = weightedMoments(logE, wN));

    let effN = 0;
    for (let t = 0; t < T; t++) effN += wN[t];
    noiseFraction = T > 0 ? effN / T : 0;
    if (effN < 0.02 * T) {
      muN = floorLogE;
      vN = Math.max(vN, 0.25 * vS);
      noisePoolDegenerate = true;
      break;
    }
    for (let t = 0; t < T; t++) {
      const lS = gaussLogPdf(logE[t], muS, vS);
      const lN = gaussLogPdf(logE[t], muN, vN);
      const r = 1 / (1 + Math.exp(lN - lS));
      wS[t] = 0.5 * r + 0.5 * pSpeech[t];
      wN[t] = 1 - wS[t];
    }
  }
  return { muS, vS, muN, vN, noisePoolDegenerate, noiseFraction };
};

/**
 * Bhattacharyya distance between the fitted speech and noise Gaussians: one
 * number for how separable the two clusters are, accounting for both mean
 * separation and variance overlap (unlike d-prime, which ignores unequal
 * variances). Low separability means the LLR fusion on top of this fit
 * (computeBaseLLR) works from a weak signal for this file. A file-level
 * signal, distinct from computeBoundaryConfidence's per-boundary LLR contrast:
 * a file can have locally confident boundaries on top of a poorly separated
 * file-wide fit, which the per-boundary measure can't see.
 */
export const gaussianSeparability = (fit: GaussFit): number => {
  const { muS, vS, muN, vN } = fit;
  const meanTerm = Math.pow(muS - muN, 2) / (4 * (vS + vN));
  const varTerm = 0.25 * Math.log(0.25 * (vS / vN + vN / vS + 2));
  return meanTerm + varTerm;
};

// Anchors for fileCleanliness: gaussianSeparability spans roughly 0.04-3.56
// (a ~90x range), with p10 ≈ 0.17, p50 ≈ 0.44, p90 ≈ 2.6 on a broad set of
// recordings. RELIABILITY_SEPARABILITY_LOW/HIGH (0.17/0.44) are not reused:
// they saturate at 0.44, so a form built on them would do nothing on half of
// all files. Log scale because the distribution is strongly skewed.
const CLEANLINESS_LOG_MID = Math.log(0.44);
const CLEANLINESS_LOG_SCALE = 1.37; // (ln(2.63) - ln(0.17)) / 2

/**
 * Maps a file's speech/noise separability onto a signed -1..+1 "how
 * trustworthy is this file's fit" score: +1 on the cleanest material, 0 at the
 * median, -1 on the murkiest. Lets one preset behave sensibly across material
 * that differs ~90x in separability; see ModeConfig.adaptiveBiasStrength.
 */
export const fileCleanliness = (gaussianSep: number): number =>
  clamp((Math.log(Math.max(gaussianSep, 1e-6)) - CLEANLINESS_LOG_MID) / CLEANLINESS_LOG_SCALE, -1, 1);

// Confidence damping (see scanAudioFile): reliabilityFactor ramps linearly
// from RELIABILITY_MIN_FACTOR at RELIABILITY_SEPARABILITY_LOW to 1 at
// RELIABILITY_SEPARABILITY_HIGH. Files below LOW sit at the floor; above HIGH
// nothing is damped. It only scales Segment.confidence, which the waveform's
// low-confidence markers and Diagnostics read; no cut decision uses it. This
// catches poorly separated fits; a very short clip can still lose words for
// other reasons (a small-clip Viterbi/bias interaction) that neither
// confidence signal addresses.
const RELIABILITY_SEPARABILITY_LOW = 0.17;
const RELIABILITY_SEPARABILITY_HIGH = 0.44;
const RELIABILITY_MIN_FACTOR = 0.5;

interface FusionWeights {
  wGauss: number;
  wVad: number;
  wSnr: number;
  wTone: number;
  /**
   * Weight of an independent pitch/voicing term, from estimateF0Correlation's
   * raw autocorrelation `r`. 0 = no contribution, and the per-frame
   * autocorrelation is then not computed at all (see
   * computeSharedFrameSignals).
   */
  wPitch: number;
  /**
   * Weight of the high-frequency term (see SnrTonalitySignals.hfSnrDb), the
   * counterweight to `wTone` on one frame class: a sibilant is broadband (so
   * `tone` calls it noise) but its high band stands well above the room's
   * high-band floor (so this calls it speech).
   * 0.5 keeps more word endings on Aggressive without cutting less; higher
   * values give that gain back. The weight is global to the shared baseLlr (see
   * computeSharedFrameSignals); a per-mode weight would mean computing the fused
   * LLR three times.
   */
  wHf: number;
  /**
   * Weight of Whisper's word coverage as a speech/silence signal (see
   * `buildWordCoverage`). Whisper otherwise only moves boundaries onto word
   * edges after the decode (`snapSegmentsToWords`) and finds sentence-final
   * punctuation; its view of where there is no speech at all comes from a model
   * independent of Silero, so it adds an uncorrelated second opinion where the
   * energy and VAD signals are ambiguous. Coarse by design: `-ml 1` timestamps
   * are imprecise at the millisecond level, so this is a "speech in this
   * region" prior, not a boundary-precision source (word-snap keeps that job).
   * 0 = off; a failed transcription gives no coverage track, so the term adds 0.
   */
  wWhisper: number;
}

// Fusion weights. The no-VAD variant sets wVad to 0 and leans harder on SNR,
// tonality and the Gaussian fit — the same formula, no separate fallback path.
const LLR_WEIGHTS: FusionWeights = { wGauss: 0.6, wVad: 1.0, wSnr: 0.8, wTone: 0.4, wPitch: 0, wHf: 0.5, wWhisper: 0 };
const LLR_WEIGHTS_NO_VAD: FusionWeights = { wGauss: 0.6, wVad: 0, wSnr: 1.2, wTone: 0.4, wPitch: 0, wHf: 0.5, wWhisper: 0 };
// Starting values for the SNR term's centre and scale (dB).
const SNR_MID_DB = 8;
const SNR_SCALE_DB = 10;
// Centre for the pitch term. Over whole files, autocorrelation `r` separates
// VAD-speech frames from VAD-silence frames well (speech median ≈ 0.62,
// silence median ≈ 0.25); VOICING_THRESHOLD (0.4) sits close to the midpoint
// of the two, so it is reused rather than adding a second centring constant.
const pitchTermFromR = (r: number): number => r - VOICING_THRESHOLD;

/**
 * Per-frame fused log-likelihood ratio (evidence that this frame is speech,
 * in log-odds) from the Gaussian fit, Silero's probability, SNR, tonality and
 * pitch/voicing, each weighted independently. Doesn't depend on any preset's
 * `bias`/`minSilenceFrames`/`minSpeechFrames`: computed once per file and
 * shared by the three presets (only viterbiDecode's emission cost adds `bias`,
 * per mode). `pitchEvidence` is optional; undefined means `wPitch` adds 0.
 */
const computeBaseLLR = (
  logE: Float64Array,
  pSilero: number[] | null,
  snrDb: Float64Array,
  tonality: Float64Array,
  fit: GaussFit,
  w: FusionWeights,
  pitchEvidence?: Float64Array,
  hfSnrDb?: Float64Array,
  wordCoverage?: Float64Array | null,
): Float64Array => {
  const T = logE.length;
  const out = new Float64Array(T);
  for (let t = 0; t < T; t++) {
    const gauss = gaussLogPdf(logE[t], fit.muS, fit.vS) - gaussLogPdf(logE[t], fit.muN, fit.vN);
    const vad = pSilero ? logit(clamp(pSilero[t], 1e-4, 1 - 1e-4)) : 0;
    const snr = (snrDb[t] - SNR_MID_DB) / SNR_SCALE_DB;
    const tone = (tonality[t] - 0.5) * 2;
    const pitch = pitchEvidence ? pitchTermFromR(pitchEvidence[t]) : 0;
    // Same signed-normalization shape as `tone`/`snr` above: centred on
    // HF_SNR_MID_DB (halfway between gap frames near 0 dB and word-edge frames
    // near +22 dB) and scaled by HF_SNR_SCALE_DB, clamped to -1..+1, so a
    // sibilant whose high band stands far above the floor lands near +1.
    const hf = hfSnrDb ? clamp((hfSnrDb[t] - HF_SNR_MID_DB) / HF_SNR_SCALE_DB, -1, 1) : 0;
    const whisper = wordCoverage ? wordCoverage[t] : 0;
    out[t] = w.wGauss * gauss + w.wVad * vad + w.wSnr * snr + w.wTone * tone + w.wPitch * pitch + w.wHf * hf + w.wWhisper * whisper;
  }
  return out;
};

// Shared by all three modes: a target of ~20 frames (~0.6 s) of extra dwell
// beyond the Ds/Dv minimum, so p_stay = 1 - 1/20 = 0.95.
const VITERBI_LOG_P_STAY = Math.log(0.95);

/**
 * Two-state (silence/speech) HMM with explicit minimum-duration modeling,
 * decoded by Viterbi — used for the three presets instead of buildSegments'
 * asymmetric attack/release hysteresis loop (which only the Advanced path
 * uses). Each state is expanded into a forced chain of Ds (silence) / Dv
 * (speech) sub-states that must be traversed before the chain can exit,
 * subsuming minSilenceFrames/minSpeechFrames as literal model structure
 * rather than a post-hoc filter that can fight the detector, and making a
 * decaying word tail's survival an emergent property of state-transition
 * cost (logPSwitch) instead of a separate releaseRatio knob. It decodes the
 * whole file offline, so it has full lookahead (Scan always runs on a
 * complete recording, never live).
 * `bias` is added directly into the per-frame emission cost here, not
 * baked into `baseLlr` — that's what lets baseLlr be computed once and
 * reused across all 3 presets' own decode.
 */
// No "protect word endings" cost belongs in this decoder's transitions or
// states. Every path that ends a segment crosses the same speech->silence edge
// and the same entry states exactly once, so any cost there is a fixed charge
// per silence run, identical across competing paths and cancelled in the
// argmax: it can only decide "end this segment at all" against "never end
// it", which a long silence run's accumulated emission advantage wins anyway.
// What moves a boundary is the emission of the individual frames being
// compared (a transition at t vs t+1), i.e. content-dependent per-frame
// evidence such as FusionWeights.wHf. Word-ending protection belongs in the
// LLR terms.
export const viterbiDecode = (baseLlr: Float64Array, bias: number, Ds: number, Dv: number, logPStay: number): boolean[] => {
  const T = baseLlr.length;
  const N = Ds + Dv;
  const NEG = -1e30;
  const logPSwitch = Math.log(1 - Math.exp(logPStay));
  let prev = new Float64Array(N).fill(NEG);
  const bp = new Int32Array(T * N);
  prev[0] = 0;
  prev[Ds] = 0;

  for (let t = 0; t < T; t++) {
    const cur = new Float64Array(N).fill(NEG);
    const emitV = baseLlr[t] + bias;
    const emitS = -emitV;
    const relax = (to: number, from: number, add: number) => {
      const s = prev[from] + add;
      if (s > cur[to]) {
        cur[to] = s;
        bp[t * N + to] = from;
      }
    };
    for (let i = 0; i < Ds - 1; i++) relax(i + 1, i, 0);
    for (let i = 0; i < Dv - 1; i++) relax(Ds + i + 1, Ds + i, 0);
    relax(Ds - 1, Ds - 1, logPStay);
    relax(N - 1, N - 1, logPStay);
    // Silence-chain end -> speech-chain start: a segment BEGINS (word onset).
    relax(Ds, Ds - 1, logPSwitch);
    // Speech-chain end -> silence-chain start: a segment ENDS (word offset —
    // the trailing-consonant side).
    relax(0, N - 1, logPSwitch);
    for (let i = 0; i < Ds; i++) if (cur[i] > NEG / 2) cur[i] += emitS;
    for (let i = Ds; i < N; i++) if (cur[i] > NEG / 2) cur[i] += emitV;
    prev = cur;
  }

  let bestState = 0;
  let bestScore = NEG;
  for (let i = 0; i < N; i++) {
    if (prev[i] > bestScore) {
      bestScore = prev[i];
      bestState = i;
    }
  }
  const states = new Int32Array(T);
  let s = bestState;
  for (let t = T - 1; t >= 0; t--) {
    states[t] = s;
    s = bp[t * N + s];
  }
  const flags: boolean[] = new Array(T);
  for (let t = 0; t < T; t++) flags[t] = states[t] >= Ds;
  return flags;
};

/** Converts the Viterbi decoder's per-frame boolean speech/silence flags
 *  into padded, merged Segment[] — the same `pad`/merge-adjacent shape
 *  every other segment-building path in this file already produces. */
// `pad` is not a hidden gap-merge threshold. Clamping the padding at the
// midpoint of the adjacent gap (so padding narrows a pause but never deletes
// it) would keep the same audio: where padding closes a gap, the unclamped
// runs overlap and mergeSegments joins them; clamped runs would touch at the
// midpoint, and mergeSegments joins touching runs too (start <= previous end).
// So padding is applied unclamped.
const buildSegmentsFromSpeechFlags = (flags: boolean[], pad: number, frameCount: number, padStartOverride?: number): Segment[] => {
  const maxEndSec = frameCount * FRAME_STEP_SEC;
  // `padStart` guards a word's onset, `pad` its trailing decay. Separate values
  // matter because the shortest pause this pipeline can cut is padStart + pad:
  // below that the two edges meet and the gap is merged rather than cut.
  // Splitting them lowers that floor without giving up the trailing-consonant
  // protection.
  const padStart = padStartOverride ?? pad;
  const raw: [number, number][] = [];
  let start: number | null = null;
  for (let f = 0; f < flags.length; f++) {
    const t = f * FRAME_STEP_SEC;
    if (flags[f] && start === null) start = t;
    if (!flags[f] && start !== null) {
      raw.push([Math.max(0, start - padStart), Math.min(maxEndSec, t + pad)]);
      start = null;
    }
  }
  if (start !== null) {
    raw.push([Math.max(0, start - padStart), Math.min(maxEndSec, flags.length * FRAME_STEP_SEC + pad)]);
  }
  const merged = mergeSegments(raw);
  const segments: Segment[] = [];
  for (const [s2, e2] of merged) {
    if (e2 > s2) segments.push({ start: s2, end: e2 });
  }
  return segments;
};

export interface SharedFrameSignals {
  logE: Float64Array;
  baseLlr: Float64Array;
  fit: GaussFit;
  /**
   * Per-frame broadband SNR (dB) from computeSnrTonality, exposed for
   * ScanResult.noiseFloorRms/medianSnrDb instead of recomputed (it runs an FFT
   * per frame).
   */
  snrDb: Float64Array;
  /**
   * The word-snap energy gate, derived once from the mode-independent Gaussian
   * fit (exp(muN + 1.0*sqrt(vN)) - LOG_EPSILON), in the same linear-RMS domain
   * as weightedRmsValues (what wordSnap.ts receives as `rmsValues`). z = 1.0
   * keeps the gate deliberately lenient, not a strict noise ceiling.
   */
  wordSnapEnergyGate: number;
  /**
   * Per-frame high-frequency-band SNR (see SnrTonalitySignals.hfSnrDb). Exposed,
   * not only used inside computeBaseLLR, so diagnostics can measure its
   * distribution without recomputing the FFT pass.
   */
  hfSnrDb: Float64Array;
  /** findDigitalSilenceFrames' mask, null when the clip has no such frame. */
  digitalSilence: Uint8Array | null;
}

const NOISE_GATE_Z = 1.0;

/**
 * Computes every signal the three presets' Viterbi decode needs, once per file
 * (mode-independent; see computeBaseLLR). `buildSegmentsHmm` is the only
 * per-mode step. `weightsOverride` replaces some of the fusion weights; the
 * panel never passes it, so LLR_WEIGHTS/LLR_WEIGHTS_NO_VAD decide.
 */
export const computeSharedFrameSignals = (
  pcm: Buffer,
  weightedRmsValues: number[],
  vadProbs: number[] | null,
  weightsOverride?: Partial<FusionWeights>,
  words?: WordTimestamp[] | null,
): SharedFrameSignals => {
  const logE = Float64Array.from(weightedRmsValues, (v) => Math.log(v + LOG_EPSILON));
  const digitalSilence = findDigitalSilenceFrames(pcm, logE.length);
  const { snrDb, tonality, floorLogE, hfSnrDb } = computeSnrTonality(pcm, weightedRmsValues, digitalSilence);
  const pSpeech = vadProbs ? Float64Array.from(vadProbs) : pseudoProbsFromLogE(logE);
  // The speech/noise fit sees only frames with sound in them: digital silence
  // sits far below any room tone and would become the "noise" cluster.
  let fit: GaussFit;
  {
    const heard: number[] = [];
    if (digitalSilence) for (let t = 0; t < logE.length; t++) if (digitalSilence[t] !== 1) heard.push(t);
    fit =
      digitalSilence && heard.length > 0
        ? fitTwoGaussians(
            Float64Array.from(heard, (t) => logE[t]),
            Float64Array.from(heard, (t) => pSpeech[t]),
            floorLogE,
          )
        : fitTwoGaussians(logE, pSpeech, floorLogE);
  }
  const weights: FusionWeights = { ...(vadProbs ? LLR_WEIGHTS : LLR_WEIGHTS_NO_VAD), ...weightsOverride };
  // Only computed when a nonzero wPitch needs it (the default is 0):
  // estimateF0Correlation costs ~0.2 ms per frame, and this runs once per Scan.
  let pitchEvidence: Float64Array | undefined;
  if (weights.wPitch !== 0) {
    pitchEvidence = new Float64Array(logE.length);
    for (let t = 0; t < logE.length; t++) pitchEvidence[t] = estimateF0Correlation(pcm, t).r;
  }
  // Only built when a nonzero wWhisper needs it (the default is 0, see
  // FusionWeights.wWhisper). `words` is optional at every call site, so a
  // whisper failure degrades to the no-whisper result.
  const wordCoverage = weights.wWhisper !== 0 ? buildWordCoverage(words ?? null, logE.length, FRAME_STEP_SEC) : null;
  const baseLlr = computeBaseLLR(logE, vadProbs, snrDb, tonality, fit, weights, pitchEvidence, hfSnrDb, wordCoverage);
  if (digitalSilence) {
    // A digital-silence frame scores at most as speech-like as the least
    // speech-like frame with sound, so the decoder treats it like the quietest
    // pause in the clip.
    let floor = Infinity;
    for (let t = 0; t < baseLlr.length; t++) if (digitalSilence[t] !== 1 && baseLlr[t] < floor) floor = baseLlr[t];
    if (isFinite(floor)) for (let t = 0; t < baseLlr.length; t++) if (digitalSilence[t] === 1 && baseLlr[t] > floor) baseLlr[t] = floor;
  }
  const wordSnapEnergyGate = Math.exp(fit.muN + NOISE_GATE_Z * Math.sqrt(fit.vN)) - LOG_EPSILON;
  return { logE, baseLlr, fit, snrDb, wordSnapEnergyGate, hfSnrDb, digitalSilence };
};

/**
 * What a preset's detector saw, for the "no pause long enough" hint.
 *
 * Every preset removes `padStart + pad` from each pause and then merges
 * whatever is left below `mergeShortGapSec`, so it can only cut a pause longer
 * than the sum of the three (about 0.18 / 0.28 / 0.31 s). Fast voice-overs can
 * have plenty of pauses, all shorter than that.
 *
 * `minCuttableSec` is that sum: a lower bound, not an exact rule (word-snap
 * and the later pads can still move a boundary), which is why the panel says
 * "about". Calls buildSegmentsHmm, which only reads `shared`, with the padding
 * set to zero, so the unpadded pauses are exactly what the detector decided
 * before any preset-specific shaping.
 */
export interface PauseStats {
  detectedCount: number;
  longestSec: number;
  minCuttableSec: number;
}

export const computePauseStats = (shared: SharedFrameSignals, mode: ModeConfig, frameCount: number, cleanliness: number): PauseStats => {
  const unpadded = buildSegmentsHmm(shared, { ...mode, pad: 0, padStart: 0 }, frameCount, cleanliness);
  let detectedCount = 0;
  let longestSec = 0;
  for (let i = 1; i < unpadded.length; i++) {
    const gap = unpadded[i].start - unpadded[i - 1].end;
    if (gap > 0.0005) {
      detectedCount++;
      if (gap > longestSec) longestSec = gap;
    }
  }
  return { detectedCount, longestSec, minCuttableSec: (mode.padStart ?? mode.pad) + mode.pad + mode.mergeShortGapSec };
};

/** The only per-mode step — decodes the shared, mode-independent `baseLlr`
 *  with this mode's own `bias`/minSilenceFrames(Ds)/minSpeechFrames(Dv). */
export const buildSegmentsHmm = (
  shared: SharedFrameSignals,
  mode: Pick<ModeConfig, "pad" | "minSilenceFrames" | "minSpeechFrames" | "bias"> &
    Partial<Pick<ModeConfig, "adaptiveBiasStrength" | "padStart">>,
  frameCount: number,
  cleanliness: number = 0,
): Segment[] => {
  const Ds = Math.max(1, mode.minSilenceFrames);
  const Dv = Math.max(1, mode.minSpeechFrames);
  // See ModeConfig.adaptiveBiasStrength: 0 (every mode's value) leaves `bias`
  // as it is. `cleanliness` is signed, so a nonzero strength scales bias both
  // ways: harder on unusually clean material, gentler on murky material.
  const strength = mode.adaptiveBiasStrength ?? 0;
  const effectiveBias = mode.bias * (1 + strength * clamp(cleanliness, -1, 1));
  const flags = viterbiDecode(shared.baseLlr, effectiveBias, Ds, Dv, VITERBI_LOG_P_STAY);
  return buildSegmentsFromSpeechFlags(flags, mode.pad, frameCount, mode.padStart);
};

// A pre-plosive closure is ~50-100 ms of real silence; cutting inside it turns
// "cap it" into "ap it". Raising minSilenceFrames doesn't fix that (Ds reshapes
// the whole Viterbi min-duration lattice non-monotonically, it isn't a
// "shortest cuttable pause" knob). Merging any gap the decoder produced
// shorter than MERGE_SHORT_GAP_SEC, on the raw HMM output before word-snap,
// does: fewer, safer cuts, with no extra clipped words. 150 ms rather than
// 200 ms (the textbook short-pause boundary): 200 ms clipped slightly fewer
// words but lost more speech. (MERGE_SHORT_GAP_SEC is declared near MODES,
// which needs it at module load.)

/** Merges any inter-segment gap shorter than `minGapSec` back into the
 *  surrounding kept segment — see MERGE_SHORT_GAP_SEC's own comment for
 *  why (protects likely articulatory closures the Viterbi decoder would
 *  otherwise cut). Assumes non-overlapping segments sorted by start (true
 *  of buildSegmentsHmm's own output); a no-op on an empty or single-element
 *  list. */
export const mergeShortGaps = (segments: Segment[], minGapSec: number): Segment[] => {
  if (segments.length < 2) return segments;
  const result: Segment[] = [{ ...segments[0] }];
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const last = result[result.length - 1];
    if (seg.start - last.end < minGapSec) last.end = seg.end;
    else result.push({ ...seg });
  }
  return result;
};

const LLR_DIAGNOSTIC_PERCENTILES = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95];

export interface LLRDiagnostics {
  logEPercentiles: Record<string, number>;
  baseLlrPercentiles: Record<string, number>;
  fit: GaussFit;
  wordSnapEnergyGate: number;
}

/**
 * Diagnostic only, not used by scanAudioFile: reports a file's baseLlr
 * distribution and the degenerate-noise-pool rate
 * (GaussFit.noisePoolDegenerate), for checking the bias/Ds/Dv values on a
 * file.
 */
export const computeLLRDiagnostics = (pcm: Buffer, weightedRmsValues: number[], vadProbs: number[] | null): LLRDiagnostics => {
  const shared = computeSharedFrameSignals(pcm, weightedRmsValues, vadProbs);
  const logESorted = Array.from(shared.logE).sort((a, b) => a - b);
  const llrSorted = Array.from(shared.baseLlr).sort((a, b) => a - b);
  const pct = (sorted: number[]) => {
    const out: Record<string, number> = {};
    for (const p of LLR_DIAGNOSTIC_PERCENTILES) out[`p${Math.round(p * 100)}`] = percentileOf(sorted, p);
    return out;
  };
  return {
    logEPercentiles: pct(logESorted),
    baseLlrPercentiles: pct(llrSorted),
    fit: shared.fit,
    wordSnapEnergyGate: shared.wordSnapEnergyGate,
  };
};

// Per-boundary confidence, derived from the same mode-independent baseLlr the
// Viterbi decoder uses — no new signal or model.
const CONFIDENCE_WINDOW_FRAMES = 3; // ~90ms either side of the boundary
const CONFIDENCE_LLR_SCALE = 3;

/**
 * Keeps each segment's padded end only where the original (pre-pad) boundary
 * was low-confidence; reverts to the unpadded end where the decoder was
 * decisive. See ModeConfig.confidenceGateThreshold. `threshold === null`
 * returns `afterPads` untouched.
 *
 * Confidence is measured at the pre-pad boundary: that is the decision whose
 * certainty is in question, not the padded position, which by construction
 * sits inside a gap the decoder already committed to.
 */
export const applyConfidenceGate = (
  beforePads: Segment[],
  afterPads: Segment[],
  baseLlr: Float64Array,
  frameStepSec: number,
  threshold: number | null,
): Segment[] => {
  if (threshold === null || beforePads.length !== afterPads.length) return afterPads;
  const maxFrame = Math.max(0, baseLlr.length - 1);
  return afterPads.map((seg, i) => {
    const frame = Math.max(0, Math.min(maxFrame, Math.round(beforePads[i].end / frameStepSec)));
    const conf = computeBoundaryConfidence(baseLlr, frame);
    return conf >= threshold ? { ...seg, end: beforePads[i].end } : seg;
  });
};

/** How decisively `baseLlr` flips across `boundaryFrame` — a large contrast
 *  between the mean LLR just before vs just after means a clean, confident
 *  transition; a small contrast means the boundary sits in a region where
 *  the LLR signal is roughly flat (ambiguous), regardless of which side of
 *  zero it happens to be on. Bounded 0-1, monotonic in |contrast|. */
export const computeBoundaryConfidence = (baseLlr: Float64Array, boundaryFrame: number): number => {
  const n = baseLlr.length;
  const beforeLo = Math.max(0, boundaryFrame - CONFIDENCE_WINDOW_FRAMES);
  const beforeHi = Math.max(beforeLo, Math.min(n, boundaryFrame));
  const afterLo = Math.max(0, Math.min(n, boundaryFrame));
  const afterHi = Math.min(n, boundaryFrame + CONFIDENCE_WINDOW_FRAMES);
  const meanOf = (lo: number, hi: number): number => {
    if (hi <= lo) return 0;
    let sum = 0;
    for (let f = lo; f < hi; f++) sum += baseLlr[f];
    return sum / (hi - lo);
  };
  const contrast = Math.abs(meanOf(afterLo, afterHi) - meanOf(beforeLo, beforeHi));
  return 1 - Math.exp(-contrast / CONFIDENCE_LLR_SCALE);
};

/**
 * Returns new Segment objects with `confidence` set to the worse of each
 * segment's two boundaries (see computeBoundaryConfidence): a segment is only
 * as trustworthy as its least certain edge. `reliabilityFactor` (from
 * gaussianSeparability, default 1 = no change) damps every segment's
 * confidence on a file whose whole fit is unreliable, however confident any
 * single boundary looks; see ScanResult.gaussianSeparability.
 */
const attachBoundaryConfidence = (segments: Segment[], baseLlr: Float64Array, reliabilityFactor: number = 1): Segment[] =>
  segments.map((seg) => {
    const startFrame = Math.round(seg.start / FRAME_STEP_SEC);
    const endFrame = Math.round(seg.end / FRAME_STEP_SEC);
    const confidence =
      Math.min(computeBoundaryConfidence(baseLlr, startFrame), computeBoundaryConfidence(baseLlr, endFrame)) * reliabilityFactor;
    return { ...seg, confidence };
  });

// Spectral distance above which a boundary is flagged as a possible speaker
// change. 0.25 flags only a few percent of boundaries on single-speaker
// material, so the flag stays rare; a lower value fires on ordinary
// segment-to-segment variation within one speaker. It has not been checked on
// real multi-speaker recordings, so it may miss some changes. Informational
// only: it never changes a threshold, it only damps `confidence` (shown with
// the same marker and tooltip).
const SPEAKER_CHANGE_DISTANCE_THRESHOLD = 0.25;
const SPEAKER_CHANGE_CONFIDENCE_DAMPEN = 0.5;

/** Flags a kept segment whose own spectral profile differs enough from the
 *  PREVIOUS kept segment's to look like a possible speaker/scene change,
 *  and dampens its confidence accordingly — see SPEAKER_CHANGE_* and
 *  Segment.possibleSpeakerChange's own doc comments. Purely additive on
 *  top of attachBoundaryConfidence's own output (call this after it). */
const flagPossibleSpeakerChanges = (segments: Segment[], pcm: Buffer): Segment[] => {
  let prevProfile: Float64Array | null = null;
  return segments.map((seg) => {
    const profile = segmentSpectralProfile(pcm, seg);
    let possibleSpeakerChange: boolean | undefined;
    let confidence = seg.confidence;
    if (prevProfile) {
      const distance = spectralProfileDistance(prevProfile, profile);
      possibleSpeakerChange = distance > SPEAKER_CHANGE_DISTANCE_THRESHOLD;
      if (possibleSpeakerChange && confidence !== undefined) confidence *= SPEAKER_CHANGE_CONFIDENCE_DAMPEN;
    }
    prevProfile = profile;
    return { ...seg, confidence, possibleSpeakerChange };
  });
};

// whisper.cpp's `-ml 1` mode emits sentence-ending punctuation (./?/!) as its
// own token, not attached to the preceding word: the punctuation token starts
// where the spoken word ends and its span absorbs the rest of the pause. So
// Whisper already says where a sentence ends, and punctuation-aware pause
// sizing needs no new signal.
const SENTENCE_END_TOKEN_RE = /^[.?!]+$/;
// Small tolerance for timestamp/frame-grid quantization only, not a
// signal-vs-noise threshold. Matching a boundary against a period token's
// `start` by proximity doesn't work: word-snap's energy-gate walk can land a
// boundary anywhere inside a pause, and the distances form a smooth continuum
// with no natural cutoff.
const SENTENCE_PAUSE_EPS_SEC = 0.02;

/**
 * True if the last transcript token whose own span has finished by `tSec`
 * (`token.end <= tSec`) is sentence-ending punctuation — a structural check
 * ("what is the most recent completed content at this cut point") instead
 * of a timestamp-proximity guess. Such boundaries have measurably longer
 * trailing gaps than mid-sentence ones. Assumes `words` is in chronological
 * order (true for whisper.cpp output, as wordSnap.ts also assumes).
 */
const isSentenceEndNear = (tSec: number, words: WordTimestamp[]): boolean => {
  let lastIdx = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].end <= tSec + SENTENCE_PAUSE_EPS_SEC) lastIdx = i;
    else break;
  }
  return lastIdx >= 0 && SENTENCE_END_TOKEN_RE.test(words[lastIdx].word.trim());
};

// Sentence-final trailing gaps typically run 10-700 ms (median ~310 ms).
// 0.15 s gives back roughly half a typical gap, safely under long pauses, and
// the min(maxEnd, …) clamp below covers the cases where the real gap is
// already shorter than the pad.
const SENTENCE_PAUSE_EXTRA_PAD_SEC = 0.15;

/**
 * Extends a kept segment's end further into its trailing gap when that gap
 * follows sentence-ending punctuation, so a finished sentence keeps a longer,
 * more natural breath than a mid-sentence pause instead of every removed
 * pause collapsing to the same fixed pad. Never extends past the next
 * segment's start: it only gives back part of a real, measured gap, never
 * invents silence or causes an overlap. Runs on the final (post-word-snap)
 * boundaries.
 */
export const applySentencePausePad = (segments: Segment[], words: WordTimestamp[]): Segment[] => {
  const result = segments.map((s) => ({ ...s }));
  for (let i = 0; i < result.length - 1; i++) {
    if (!isSentenceEndNear(result[i].end, words)) continue;
    const maxEnd = result[i + 1].start;
    result[i].end = Math.min(maxEnd, result[i].end + SENTENCE_PAUSE_EXTRA_PAD_SEC);
  }
  return result;
};

// A cheap breath-sound detector (not MFCC template matching, which would need
// labelled breath examples). It combines two signals this pipeline already
// computes: the RMS envelope shape (a "hump", more energy in the middle of
// the gap than at its edges, as breaths typically have) and
// estimateF0Correlation's voicing (a breath is turbulent airflow, not periodic
// vocal-fold vibration, so it reads as unvoiced). Synthetic voices rarely
// breathe, camera recordings often do. Not a "never cut this" rule — only a
// small, bounded extension of an already-kept segment's trailing edge, like
// applySentencePausePad: it gives back part of a real gap, never invents
// silence. Breath duration bounds 150-800 ms; BREATH_PAD_SEC is sized so the
// cost in compression stays small.
const BREATH_MIN_GAP_SEC = 0.15;
const BREATH_MAX_GAP_SEC = 0.8;
const BREATH_HUMP_RATIO = 1.3;
const BREATH_VOICING_CEILING = 0.25;
const BREATH_PAD_SEC = 0.12;

/** Extends a kept segment's own END a little further into its trailing gap
 *  when that gap's own shape matches the breath heuristic above. Runs on
 *  the FINAL (post-word-snap, post-sentence-pause-pad) boundaries, same
 *  reasoning as applySentencePausePad's own doc comment — sees the same
 *  positions every earlier stage already committed to, so this is a purely
 *  additive last step, not a competing decision. `weightedRmsValues`/
 *  `frameStepSec` must be the same K-weighted array/frame step every other
 *  decision in this file already shares (see ScanResult.weightedRmsValues's
 *  own doc comment on why K-weighting matters here). */
export const applyBreathPad = (segments: Segment[], pcm: Buffer, weightedRmsValues: number[], frameStepSec: number): Segment[] => {
  if (segments.length < 2) return segments;
  const result = segments.map((s) => ({ ...s }));
  for (let i = 0; i < result.length - 1; i++) {
    const gapStart = result[i].end;
    const gapEnd = result[i + 1].start;
    const gapDurSec = gapEnd - gapStart;
    if (gapDurSec < BREATH_MIN_GAP_SEC || gapDurSec > BREATH_MAX_GAP_SEC) continue;

    const runStart = Math.round(gapStart / frameStepSec);
    const runEnd = Math.round(gapEnd / frameStepSec);
    if (runEnd <= runStart) continue;
    const runLen = runEnd - runStart;
    const edgeLen = Math.max(1, Math.floor(runLen / 6));
    const midStart = runStart + edgeLen;
    const midEnd = runEnd - edgeLen;
    if (midEnd <= midStart) continue;

    const meanOf = (a: number, b: number): number => {
      let sum = 0;
      for (let f = a; f < b; f++) sum += weightedRmsValues[f] ?? 0;
      return sum / Math.max(1, b - a);
    };
    const edgeMean = (meanOf(runStart, runStart + edgeLen) + meanOf(runEnd - edgeLen, runEnd)) / 2;
    const midMean = meanOf(midStart, midEnd);
    if (!(edgeMean > 0 && midMean / edgeMean >= BREATH_HUMP_RATIO)) continue;

    let rSum = 0;
    let rCount = 0;
    for (let f = runStart; f < runEnd; f++) {
      const { r } = estimateF0Correlation(pcm, f);
      rSum += r;
      rCount++;
    }
    const meanR = rCount ? rSum / rCount : 1;
    if (meanR > BREATH_VOICING_CEILING) continue;

    result[i].end = Math.min(gapEnd, result[i].end + BREATH_PAD_SEC);
  }
  return result;
};

// Mid-gap retention: an axis for telling the presets apart by how much of an
// already-detected pause remains, instead of how short a pause must be to be
// cut (`mergeShortGapSec`/`bias`, which also move where speech is judged to
// end). Detection (buildSegmentsHmm/mergeShortGaps/`pad`) is untouched: like
// applySentencePausePad and applyBreathPad, this only extends a kept segment
// into a gap already decided to be non-speech. A smaller retention keeps less
// of the pause, a larger one keeps more — the same operation either way.
//
// `MID_GAP_CLASS_MIN_SEC` is the textbook 200 ms short/medium pause boundary.
// Typical voice-over pauses sit close to 200 ms, so a small change to it moves
// many of them between classes. Shorter gaps are left alone (the
// mergeShortGapSec/pad protection handles them). Only two classes: gaps over
// one second are too rare to tune a third class for.
const MID_GAP_CLASS_MIN_SEC = 0.2;

// How many multiples of a gap's own settled floor (its quietest frame, see
// applyMidGapRetention's walk) still count as quiet enough to keep extending.
// A per-gap margin, not the file-wide `energyGate`, which almost never fires
// inside a real pause. 1.5 stops the walk once the pause has clearly settled.
const MID_GAP_SETTLED_FLOOR_MARGIN = 1.5;

/**
 * `retentionSec === null` is a hard no-op: every mode at `null` gives exactly
 * the output without this step.
 *
 * The walk goes frame by frame and stops at the start of any real
 * (non-punctuation) word, never extending into one however quiet it is. A
 * gap between two kept segments isn't always silent all the way through, and
 * an energy check alone isn't enough: the walk can land inside a word's span
 * while the energy stays quiet (Whisper's timestamps can overreach), so word
 * boundaries are checked directly.
 */
export const applyMidGapRetention = (
  segments: Segment[],
  retentionSec: number | null,
  weightedRmsValues: number[],
  frameStepSec: number,
  energyGate: number,
  words: WordTimestamp[] | null,
  classMinSec: number = MID_GAP_CLASS_MIN_SEC,
): Segment[] => {
  if (retentionSec === null || segments.length < 2) return segments;
  const result = segments.map((s) => ({ ...s }));
  const frameAt = (t: number): number => Math.max(0, Math.min(weightedRmsValues.length - 1, Math.round(t / frameStepSec)));
  // Real (non-punctuation) word starts only, sorted — same normalization
  // wordSnap.ts's own snapSegmentsToWords already uses to exclude whisper
  // -ml1's punctuation-only segments from being treated as real content.
  const realWordStarts = words ? words.filter((w) => normalizeWordToken(w.word).length > 0).map((w) => w.start) : [];
  // `realWordStarts` is sorted and `result` is walked in increasing time, so the
  // nearest word start at or after a gap only moves forward: one shared cursor
  // (O(segments + words)) instead of rescanning every word for every segment.
  // Same output.
  let wordCursor = 0;
  for (let i = 0; i < result.length - 1; i++) {
    const gapEnd = result[i + 1].start;
    const gapDurSec = gapEnd - result[i].end;
    while (wordCursor < realWordStarts.length && realWordStarts[wordCursor] < result[i].end) wordCursor++;
    if (gapDurSec < classMinSec) continue;
    // The nearest real word starting at or after this gap's own start —
    // the walk below must never cross it, regardless of how far the energy
    // gate alone would allow.
    const nearestWordStart = wordCursor < realWordStarts.length ? realWordStarts[wordCursor] : Infinity;
    // Reclaim up to `retentionSec` of this gap as audible, like applyBreathPad
    // (extend forward by a fixed amount, capped at the gap's far edge), but walked
    // frame by frame, stopping at the first frame with real energy or the start
    // of a real word. A smaller retentionSec keeps more of the gap cut: this is
    // the one pad that can make a mode keep less of a mid-length pause than
    // another mode, so Aggressive keeps less of it than Gentle.
    const targetT = Math.min(gapEnd, nearestWordStart, result[i].end + retentionSec);
    // This gap's own settled floor: the quietest frame in its latter half. The
    // file-wide `energyGate` (noise mean + 1 SD) almost never trips inside a real
    // gap — a pause's own quiet point can sit far below the file's overall noise
    // estimate — so without this the walk would hold the full `retentionSec` even
    // after real silence started. `Math.min` with the existing gate means this can
    // only tighten the stop, never loosen it.
    const settledStart = result[i].end + gapDurSec * 0.5;
    let settledFloor = Infinity;
    for (let t2 = settledStart; t2 < gapEnd; t2 += frameStepSec) {
      settledFloor = Math.min(settledFloor, weightedRmsValues[frameAt(t2)]);
    }
    const stopThreshold = Number.isFinite(settledFloor) ? Math.min(energyGate, settledFloor * MID_GAP_SETTLED_FLOOR_MARGIN) : energyGate;
    let t = result[i].end;
    while (t < targetT) {
      const nextT = Math.min(targetT, t + frameStepSec);
      if (weightedRmsValues[frameAt(nextT)] > stopThreshold) break;
      t = nextT;
    }
    result[i].end = t;
  }
  return result;
};

// =========================
// 3. dB <-> linear RMS conversion (dBFS, 16-bit full scale)
// =========================
export const rmsToDb = (rms: number): number => {
  if (rms <= 0) return -99;
  return Math.max(-99, 20 * Math.log10(rms / FULL_SCALE));
};

export const dbToRms = (db: number): number => {
  return FULL_SCALE * Math.pow(10, db / 20);
};

// =========================
// 4. NOISE/SPEECH SEPARATION (1D k-means)
// =========================
// Without a per-frame speech label, frame log-energy is clustered into two
// groups (quiet / loud) with 1D k-means and percentiles are taken within each
// cluster, with the same downstream math (geometric-mean threshold or ratio
// fallback).
const kmeans1D = (values: number[], iterations = 20): { low: number[]; high: number[] } => {
  const sorted = [...values].sort((a, b) => a - b);
  let c0 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  let c1 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;

  for (let it = 0; it < iterations; it++) {
    let sumLow = 0,
      countLow = 0,
      sumHigh = 0,
      countHigh = 0;
    for (const v of values) {
      if (Math.abs(v - c0) <= Math.abs(v - c1)) {
        sumLow += v;
        countLow++;
      } else {
        sumHigh += v;
        countHigh++;
      }
    }
    if (countLow) c0 = sumLow / countLow;
    if (countHigh) c1 = sumHigh / countHigh;
  }

  const lowC = Math.min(c0, c1);
  const highC = Math.max(c0, c1);
  const low: number[] = [];
  const high: number[] = [];
  for (const v of values) {
    (Math.abs(v - lowC) <= Math.abs(v - highC) ? low : high).push(v);
  }
  return { low, high };
};

const percentileOf = (sortedAsc: number[], pct: number): number => {
  const idx = Math.min(Math.floor(sortedAsc.length * pct), sortedAsc.length - 1);
  return sortedAsc[Math.max(0, idx)];
};

interface ClusterStats {
  noiseMaxLog: number;
  speechMinLog: number;
  overlap: boolean;
}

const clusterLogEnergy = (logVals: number[], noisePct: number, speechPct: number): ClusterStats | null => {
  const { low, high } = kmeans1D(logVals);
  if (!low.length || !high.length) return null;
  const noiseSorted = [...low].sort((a, b) => a - b);
  const speechSorted = [...high].sort((a, b) => a - b);
  const noiseMaxLog = percentileOf(noiseSorted, noisePct);
  const speechMinLog = percentileOf(speechSorted, speechPct);
  return { noiseMaxLog, speechMinLog, overlap: speechMinLog <= noiseMaxLog };
};

/**
 * Splits log-energy by a real per-frame speech flag (Silero VAD): percentiles
 * taken from frames actually labeled silence or speech, rather than an
 * unsupervised guess at the split.
 */
const labeledLogEnergy = (logVals: number[], vadFlags: boolean[], noisePct: number, speechPct: number): ClusterStats | null => {
  const noiseSorted: number[] = [];
  const speechSorted: number[] = [];
  for (let i = 0; i < logVals.length; i++) {
    (vadFlags[i] ? speechSorted : noiseSorted).push(logVals[i]);
  }
  if (!noiseSorted.length || !speechSorted.length) return null;
  noiseSorted.sort((a, b) => a - b);
  speechSorted.sort((a, b) => a - b);
  const noiseMaxLog = percentileOf(noiseSorted, noisePct);
  const speechMinLog = percentileOf(speechSorted, speechPct);
  return { noiseMaxLog, speechMinLog, overlap: speechMinLog <= noiseMaxLog };
};

// Thresholds are combined in log space (so percentiles over a heavy-tailed
// energy distribution behave sensibly); this matches combining them in linear
// RMS space (sqrt(noiseMax * speechMin) for the geometric mean, noiseMax *
// ratio for the fallback) only if the log/exp round trip uses a negligible
// epsilon. An epsilon such as +1 is a huge relative error for quiet frames
// (RMS values run 0-32768, so RMS = 2 would become log(3)), biasing every mode
// toward keeping more exactly at the low-energy end where the decision
// matters most. A near-zero epsilon keeps log(0) safe without perturbing real
// values.
const LOG_EPSILON = 1e-6;

/**
 * Parameters of the Advanced tab's manual-threshold path
 * (`ADVANCED_LOCAL_THRESHOLD_PARAMS` near the top of this file, used from
 * main.tsx), which uses `adaptiveThreshold`/
 * `computeLocalThresholds` rather than the LLR/Viterbi pipeline. A type of its
 * own, independent of `ModeConfig`.
 */
export interface LegacyThresholdParams {
  noisePct: number;
  speechPct: number;
  energyRatioFallback: number;
}

export const adaptiveThreshold = (rmsValues: number[], mode: LegacyThresholdParams, vadFlags?: boolean[] | null): number => {
  const logVals = rmsValues.map((v) => Math.log(v + LOG_EPSILON));
  // labeledLogEnergy returns null when every frame lands on the same side of
  // vadFlags (no noise-labeled frames, or, rarer, no speech-labeled ones), as on
  // a densely narrated file where every frame passes ADVANCED_VAD_THRESHOLD. Returning 0
  // then would make every frame count as active and the whole file collapse into
  // one uncut segment. clusterLogEnergy (the k-means split also used when Silero
  // isn't available) doesn't depend on vadFlags, so it is the first fallback; 0
  // stays the last resort when even k-means can't find two non-empty clusters
  // (e.g. constant energy throughout).
  const stats = vadFlags
    ? (labeledLogEnergy(logVals, vadFlags, mode.noisePct, mode.speechPct) ?? clusterLogEnergy(logVals, mode.noisePct, mode.speechPct))
    : clusterLogEnergy(logVals, mode.noisePct, mode.speechPct);
  if (!stats) return 0;
  // The overlap fallback (noiseMax * energyRatioFallback, used when the noise
  // and speech percentiles overlap) has no ceiling of its own. On a recording
  // that is almost entirely speech, the "noise" pool shrinks to a handful of
  // frames, its percentile follows whichever frame is loudest, and the threshold
  // can land far above the speech floor, classing real speech as silence.
  // speechMinLog is a confirmed-speech percentile from many frames, so capping
  // the fallback there keeps it below energy real speech reaches; a threshold
  // above it would reject frames Silero labeled speech. Only lowers an unstable
  // estimate; the normal branch is unchanged.
  const thresholdLog = stats.overlap
    ? Math.min(stats.noiseMaxLog + Math.log(mode.energyRatioFallback), stats.speechMinLog)
    : (stats.noiseMaxLog + stats.speechMinLog) / 2; // log-domain geometric mean
  return Math.exp(thresholdLog) - LOG_EPSILON;
};

/**
 * Optional, opt-in safety net for clips where the noise floor drifts over
 * time (a music bed fading in, a recording-level change partway through —
 * not a concern for clean AI-generated voice, where levels don't drift).
 * Recomputes the adaptive threshold within a sliding window every `stepSec`
 * (held constant between recompute points — cheap, no interpolation
 * overshoot) instead of once globally.
 *
 * Deliberately NOT a replacement for the global threshold: buildSegments
 * ORs the two together (a frame counts as speech if EITHER the global or
 * the local threshold says so). That direction can only *rescue* audio a
 * global-only threshold would have wrongly cut in a drifting section — it
 * can never cause additional cutting, so enabling it can't make a good
 * result worse, only leave in a little extra quiet audio in the rare case
 * it disagrees with the global pass.
 */
export const computeLocalThresholds = (
  rmsValues: number[],
  windowSec: number,
  stepSec: number,
  mode: LegacyThresholdParams,
  vadFlags?: boolean[] | null,
): number[] => {
  const windowFrames = Math.max(10, Math.round(windowSec / FRAME_STEP_SEC));
  const stepFrames = Math.max(1, Math.round(stepSec / FRAME_STEP_SEC));
  const half = Math.floor(windowFrames / 2);

  const anchors: { frame: number; threshold: number }[] = [];
  for (let center = 0; center < rmsValues.length; center += stepFrames) {
    const lo = Math.max(0, center - half);
    const hi = Math.min(rmsValues.length, center + half);
    const windowRms = rmsValues.slice(lo, hi);
    const windowVad = vadFlags ? vadFlags.slice(lo, hi) : undefined;
    anchors.push({ frame: center, threshold: adaptiveThreshold(windowRms, mode, windowVad) });
  }
  if (!anchors.length) return [];

  const thresholds: number[] = new Array(rmsValues.length);
  let ai = 0;
  for (let i = 0; i < rmsValues.length; i++) {
    while (ai < anchors.length - 1 && anchors[ai + 1].frame <= i) ai++;
    thresholds[i] = anchors[ai].threshold;
  }
  return thresholds;
};

/** Representative floor/speech dB for the "Advanced" tab's threshold hint row. */
export const estimateFloorAndSpeechDb = (
  rmsValues: number[],
  vadFlags?: boolean[] | null,
): { floorDb: number; speechDb: number; overlap: boolean } => {
  const logVals = rmsValues.map((v) => Math.log(v + LOG_EPSILON));
  const stats = vadFlags ? labeledLogEnergy(logVals, vadFlags, 0.9, 0.15) : clusterLogEnergy(logVals, 0.9, 0.15);
  if (!stats) return { floorDb: -99, speechDb: -35, overlap: true };
  return {
    floorDb: rmsToDb(Math.exp(stats.noiseMaxLog) - LOG_EPSILON),
    speechDb: rmsToDb(Math.exp(stats.speechMinLog) - LOG_EPSILON),
    overlap: stats.overlap,
  };
};

// =========================
// 5. HYSTERESIS SEGMENT BUILDER
// =========================
export const mergeSegments = (segments: [number, number][]): [number, number][] => {
  if (!segments.length) return [];
  const merged: [number, number][] = [[segments[0][0], segments[0][1]]];
  for (let i = 1; i < segments.length; i++) {
    const [start, end] = segments[i];
    const last = merged[merged.length - 1];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
};

// How many consecutive frames below the full attack bar the release/hangover
// relaxation stays eligible for, counted from the last frame that cleared the
// real attack bar (not reset by a frame the release bar itself rescues; see
// buildSegments' `framesSinceStrongSpeech`). Bounds how far asymmetric
// hysteresis can bridge: without it, ambient noise and breaths between phrases
// can keep re-triggering "still speech" so minSilenceFrames never completes and
// a whole clip becomes one segment. A short fixed window still rescues a
// word's decaying tail; once it elapses, `active` reverts to the strict attack
// bar, so a real silence still accumulates minSilenceFrames and ends the
// segment.
export const RELEASE_GRACE_FRAMES = 3;

/**
 * Parameters of `buildSegments`, the Advanced tab's path
 * (`buildSegmentsAdvanced` builds this object from the values the user sets).
 * The presets get their segments from `viterbiDecode` instead, which has no
 * hysteresis/release concept.
 */
export interface LegacyHysteresisParams {
  pad: number;
  minSilenceFrames: number;
  minSpeechFrames: number;
  releaseRatio: number;
}

export const buildSegments = (
  rmsValues: number[],
  threshold: number,
  mode: LegacyHysteresisParams,
  vadFlags?: boolean[] | null,
  vadReleaseFlags?: boolean[] | null,
  localThresholds?: number[] | null,
): Segment[] => {
  // Looser bar (threshold * mode.releaseRatio; buildSegmentsAdvanced sets
  // releaseRatio) than `threshold`/`vadFlags`, only ever consulted once a
  // segment is already active AND still within RELEASE_GRACE_FRAMES of the
  // last real, full-bar speech frame — asymmetric attack/release hysteresis
  // so a word's naturally decaying tail can still register as speech a
  // little past the point where the *starting* bar would have called it
  // silence.
  const releaseThreshold = threshold * mode.releaseRatio;
  // A segment's end is clamped to the decoded length (maxEndSec), as its
  // start is clamped to >= 0 below. Speech that runs up to the last analysed
  // frame (common for tightly trimmed AI-voice clips) would otherwise end
  // past the decoded audio and give Cut placement and computeJLCutOverlaps
  // an out-of-range time.
  const maxEndSec = rmsValues.length * FRAME_STEP_SEC;

  let inSpeech = false;
  let start: number | null = null;
  let speechStartT: number | null = null;
  let silenceCount = 0;
  let speechCount = 0;
  let lastSpeechTime: number | null = null;
  let framesSinceStrongSpeech = 0;
  let t = 0;

  const segments: [number, number][] = [];

  for (let frameIdx = 0; frameIdx < rmsValues.length; frameIdx++) {
    const energy = rmsValues[frameIdx];
    const strongVad = vadFlags ? vadFlags[frameIdx] : true;
    const strongActive = energy > threshold && strongVad;
    // Tracks time since real, full-bar speech — NOT reset by a frame the
    // release bar alone rescues, which is exactly what keeps the grace
    // window from being extendable indefinitely by a string of merely-
    // borderline frames (see RELEASE_GRACE_FRAMES's own doc comment).
    framesSinceStrongSpeech = strongActive ? 0 : framesSinceStrongSpeech + 1;
    const withinReleaseGrace = inSpeech && framesSinceStrongSpeech <= RELEASE_GRACE_FRAMES;

    // OR, not AND: the local threshold (if enabled) can only rescue a frame
    // the global threshold would have cut, never cut one it would have kept.
    // Only within the bounded release-grace window do the energy and VAD
    // bars switch to their looser release variant (never the reverse) —
    // this can only extend an already-active segment a little further into
    // a genuinely decaying tail, it can never make it easier to *start* one
    // and can never bridge a stretch of real silence longer than the grace
    // window plus mode.minSilenceFrames.
    const overGlobal = withinReleaseGrace ? energy > releaseThreshold : energy > threshold;
    const overLocal = localThresholds ? energy > localThresholds[frameIdx] : false;
    const vadGate = withinReleaseGrace ? (vadReleaseFlags ? vadReleaseFlags[frameIdx] : strongVad) : strongVad;
    const active = (overGlobal || overLocal) && vadGate;

    if (active) {
      speechCount++;
      silenceCount = 0;

      if (!inSpeech) {
        if (speechCount === 1) speechStartT = t;
        if (speechCount >= mode.minSpeechFrames) {
          inSpeech = true;
          if (speechStartT === null) speechStartT = t;
          start = Math.max(0, speechStartT - mode.pad);
        }
      }
      lastSpeechTime = t;
    } else {
      if (inSpeech) {
        silenceCount++;
        if (silenceCount >= mode.minSilenceFrames) {
          if (start !== null && lastSpeechTime !== null) {
            segments.push([start, Math.min(maxEndSec, lastSpeechTime + FRAME_STEP_SEC + mode.pad)]);
          }
          inSpeech = false;
          start = null;
          speechStartT = null;
          speechCount = 0;
          silenceCount = 0;
          lastSpeechTime = null;
        }
      } else {
        speechCount = 0;
        speechStartT = null;
      }
    }
    t += FRAME_STEP_SEC;
  }

  if (inSpeech && start !== null && lastSpeechTime !== null) {
    // Same clamp as the in-loop push above: this branch (still "in speech" when
    // the clip ends) is the case the clamp exists for — speech continuing to the
    // last analyzed frame, the most common case for tightly trimmed AI-voice
    // clips. Without it this branch would produce an out-of-range end.
    segments.push([start, Math.min(maxEndSec, lastSpeechTime + FRAME_STEP_SEC + mode.pad)]);
  }

  return mergeSegments(segments)
    .filter(([s, e]) => e > s)
    .map(([s, e]) => ({ start: Math.round(s * 1000) / 1000, end: Math.round(e * 1000) / 1000 }));
};

/** Advanced-mode: user-supplied dB threshold + min-silence duration, bypassing the adaptive percentile calc.
 *  `localThresholds`, if passed (see computeLocalThresholds), is OR'd in as a rescue-only safety net.
 *  `releaseRatio`/`vadReleaseFlags` give the Advanced path asymmetric attack/release hysteresis: inside
 *  an active segment, a frame within RELEASE_GRACE_FRAMES of real speech only has to clear
 *  threshold * releaseRatio (default 0.5) and the release-side VAD flags. */
export const buildSegmentsAdvanced = (
  rmsValues: number[],
  cutThresholdDb: number,
  minSilenceSec: number,
  vadFlags?: boolean[] | null,
  localThresholds?: number[] | null,
  padSec = 0.08,
  minSpeechFrames = 2,
  vadReleaseFlags?: boolean[] | null,
  releaseRatio = 0.5,
): Segment[] => {
  const threshold = dbToRms(cutThresholdDb);
  const minSilenceFrames = Math.max(1, Math.round(minSilenceSec / FRAME_STEP_SEC));
  return buildSegments(
    rmsValues,
    threshold,
    { pad: padSec, minSilenceFrames, minSpeechFrames, releaseRatio },
    vadFlags,
    vadReleaseFlags,
    localThresholds,
  );
};

// =========================
// 6. TOP-LEVEL SCAN
// =========================
export const scanAudioFile = async (inputPath: string, trim?: TrimRange | null): Promise<ScanResult> => {
  const scanStartMs = Date.now();
  const pcm = await decodeToPCMAsync(inputPath, trim);
  const rmsValues = computeRmsFrames(pcm);
  // See ScanResult.weightedRmsValues's own doc comment — this feeds every
  // silence/speech decision below; `rmsValues` above stays raw and only
  // feeds the Waveform preview.
  const weightedRmsValues = computeWeightedRmsFrames(pcm);
  const durationSec = (rmsValues.length * FRAME_MS) / 1000;
  const decodeMs = Date.now() - scanStartMs;

  // Run Silero inference once (the expensive part); it returns the raw,
  // unsmoothed track. The LLR/Viterbi pipeline below takes it unsmoothed,
  // because the decoder's minimum-duration chains already give the temporal
  // memory a smoothing filter would add. Only the Advanced tab's
  // ADVANCED_VAD_* flags further down are smoothed.
  const vadStartMs = Date.now();
  const vadProbs = await computeVadProbs(pcm, FRAME_MS, SAMPLE_RATE);
  const vadMs = Date.now() - vadStartMs;

  // The presets' segmentation: soft-EM two-Gaussian fitting, LLR fusion and a
  // Viterbi min-duration HMM decoder (see computeSharedFrameSignals and
  // buildSegmentsHmm, §2d). baseLlr and the Gaussian fit are computed once here
  // for all three modes; only the final decode (and its `bias`) is per mode.
  //
  // Word timestamps are always attempted (the whisper.cpp subprocess never
  // blocks the panel). transcribeWithWordTimestamps never throws, like silero.ts:
  // on failure `words` stays null and Scan continues with energy-only segments.
  // Transcription runs before computeSharedFrameSignals because it only needs
  // `pcm`/`durationSec`, and running it first lets Whisper's view reach the LLR
  // when FusionWeights.wWhisper is nonzero (it is 0 in both shipped weight sets).
  const whisperStartMs = Date.now();
  const words: WordTimestamp[] | null = await transcribeWithWordTimestamps(pcm, durationSec);
  const whisperMs = Date.now() - whisperStartMs;

  const sharedSignalsStartMs = Date.now();
  const shared = computeSharedFrameSignals(pcm, weightedRmsValues, vadProbs, undefined, words);
  const sharedSignalsMs = Date.now() - sharedSignalsStartMs;

  // File-level reliability of the soft-EM fit the segments are built from,
  // computed before the MODES loop so attachBoundaryConfidence applies it to
  // every mode alike (see RELIABILITY_SEPARABILITY_*).
  const gaussianSep = gaussianSeparability(shared.fit);
  const reliabilityFactor =
    RELIABILITY_MIN_FACTOR +
    (1 - RELIABILITY_MIN_FACTOR) *
      clamp((gaussianSep - RELIABILITY_SEPARABILITY_LOW) / (RELIABILITY_SEPARABILITY_HIGH - RELIABILITY_SEPARABILITY_LOW), 0, 1);

  const viterbiStartMs = Date.now();
  const segmentsByMode: Record<string, Segment[]> = {};
  for (const mode of MODES) {
    const rawSegments = mergeShortGaps(
      buildSegmentsHmm(shared, mode, weightedRmsValues.length, fileCleanliness(gaussianSep)),
      mode.mergeShortGapSec,
    );
    const withConfidence = attachBoundaryConfidence(rawSegments, shared.baseLlr, reliabilityFactor);
    segmentsByMode[mode.name] = flagPossibleSpeakerChanges(withConfidence, pcm);
  }
  const viterbiMs = Date.now() - viterbiStartMs;
  // Separate pass, outside the Viterbi timing above, so that timing covers
  // only the per-mode decode loop.
  const pauseStatsByMode: Record<string, PauseStats> = {};
  for (const mode of MODES) {
    pauseStatsByMode[mode.name] = computePauseStats(shared, mode, weightedRmsValues.length, fileCleanliness(gaussianSep));
  }
  const wordSnapEnergyGate = shared.wordSnapEnergyGate;

  // Reuses signals already computed inside `shared` — no new decode or
  // inference. See ScanResult.noiseFloorRms/medianSnrDb.
  const noiseFloorRms = Math.exp(shared.fit.muN);
  // Digital silence has no SNR of its own; an all-silent clip keeps every frame.
  const heardSnrDb = Array.from(shared.snrDb).filter((_, f) => !shared.digitalSilence || shared.digitalSilence[f] !== 1);
  const sortedSnrDb = (heardSnrDb.length ? heardSnrDb : Array.from(shared.snrDb)).sort((a, b) => a - b);
  const medianSnrDb = percentileOf(sortedSnrDb, 0.5);
  const noiseFraction = shared.fit.noiseFraction;

  // ADVANCED_VAD_* (module-level, after MODES): used only by the Advanced
  // tab's manual-threshold path (estimateFloorAndSpeechDb's UI dB hint right
  // below, and computeLocalThresholds/buildSegmentsAdvanced called from
  // main.tsx), which works on a plain hard-threshold VAD flag array rather
  // than the LLR/Viterbi pipeline.
  const advSmoothedProbs = vadProbs ? smoothVadProbs(vadProbs, ADVANCED_VAD_SMOOTH_RADIUS) : null;
  const vadFlags = advSmoothedProbs ? vadFlagsFromProbs(advSmoothedProbs, ADVANCED_VAD_THRESHOLD) : null;
  const vadReleaseFlags = advSmoothedProbs
    ? vadFlagsFromProbs(advSmoothedProbs, ADVANCED_VAD_THRESHOLD * ADVANCED_VAD_RELEASE_RATIO)
    : null;

  const { floorDb, speechDb, overlap } = estimateFloorAndSpeechDb(weightedRmsValues, vadFlags);
  const sourceChannels = await probeAudioChannels(inputPath);

  const wordSnapStartMs = Date.now();
  let segmentsByModeWordSnapped: Record<string, Segment[]> | null = null;
  if (words) {
    segmentsByModeWordSnapped = {};
    for (const mode of MODES) {
      // Word-snap can nudge a boundary by up to WORD_SNAP_MAX_SEC (0.15s,
      // 5 frames) — re-derive confidence from the FINAL boundary position
      // rather than reusing segmentsByMode's pre-snap value, which could be
      // measuring the wrong frames after a real nudge.
      const snapped = snapSegmentsToWords(
        segmentsByMode[mode.name],
        words,
        WORD_SNAP_MAX_SEC,
        weightedRmsValues,
        FRAME_STEP_SEC,
        wordSnapEnergyGate,
      );
      const withSentencePause = mode.sentencePausePadEnabled ? applySentencePausePad(snapped, words) : snapped;
      const withBreathPad = mode.breathPadEnabled
        ? applyBreathPad(withSentencePause, pcm, weightedRmsValues, FRAME_STEP_SEC)
        : withSentencePause;
      const withMidGapRetention = applyMidGapRetention(
        withBreathPad,
        mode.midGapRetentionSec,
        weightedRmsValues,
        FRAME_STEP_SEC,
        wordSnapEnergyGate,
        words,
      );
      // See ModeConfig.confidenceGateThreshold: `null` (Aggressive) returns
      // withMidGapRetention untouched. `snapped` is the pre-pad reference;
      // everything between it and here is extend-only, so gating can only give
      // compression back, never cut further than the decoder decided. Mid-gap
      // retention is gated too: leaving it ungated spreads the presets further
      // apart on very clean files, but makes Gentle clip more words than Aggressive.
      const withConfidenceGate = applyConfidenceGate(
        snapped,
        withMidGapRetention,
        shared.baseLlr,
        FRAME_STEP_SEC,
        mode.confidenceGateThreshold,
      );
      const snappedWithConfidence = attachBoundaryConfidence(withConfidenceGate, shared.baseLlr, reliabilityFactor);
      segmentsByModeWordSnapped[mode.name] = flagPossibleSpeakerChanges(snappedWithConfidence, pcm);
    }
  }
  const wordSnapMs = Date.now() - wordSnapStartMs;

  const scanTimingMs: ScanTimingMs = {
    decode: decodeMs,
    vad: vadMs,
    sharedSignals: sharedSignalsMs,
    viterbi: viterbiMs,
    whisper: whisperMs,
    wordSnap: wordSnapMs,
    total: Date.now() - scanStartMs,
  };

  return {
    durationSec,
    frameCount: rmsValues.length,
    floorDb,
    speechDb,
    overlap,
    scanTimingMs,
    segmentsByMode,
    pauseStatsByMode,
    pcm,
    rmsValues,
    weightedRmsValues,
    vadFlags,
    vadReleaseFlags,
    sourceChannels,
    words,
    segmentsByModeWordSnapped,
    wordSnapEnergyGate,
    noiseFloorRms,
    medianSnrDb,
    gaussianSeparability: gaussianSep,
    noiseFraction,
  };
};

// =========================
// J/L-CUT PACING OVERLAP (J/L Pacing, the follow-up step after Cut)
// =========================
// Separate from everything above: this never runs during Scan/Cut itself,
// only afterwards, on demand, against the exact segments Cut used. Purpose
// is pacing, not the classic cinematic J/L cut (no second camera angle or
// B-roll involved): short-form voice-over wants its cut pieces to overlap
// slightly so the next line's audio is already under way before the previous
// one stops, tightening rhythm, plus a small always-on fade at every boundary
// so folding two clips together never produces an audible click. Reuses the
// weightedRmsValues and PCM Scan already holds; no new audio decode.
export type JLCutPreset = "gentle" | "normal" | "aggressive";

// Maximum overlap a preset may reach at a boundary. The amount used is this or
// less, capped by how far a quiet region actually measures on both sides (see
// computeJLCutOverlaps), so a high ceiling never on its own folds into louder
// content: it only lets a boundary with a long quiet run use more of it. Named
// like Silence Cut's presets (MODES): aggressive pushes hardest for pacing,
// gentle barely touches anything.
const JL_CUT_MAX_OVERLAP_SEC: Record<JLCutPreset, number> = {
  gentle: 0.25,
  normal: 0.4,
  aggressive: 0.6,
};

// Aggressive and Normal also get a guaranteed minimum overlap, whatever the
// quiet-region measurement finds. Voice-overs, synthetic ones especially, stay
// near full volume until close to where Cut trimmed them, so there is often no
// long quiet run to measure however generous the quiet bar is; on such
// material every boundary sits on this floor and the ceiling above never
// binds. Pushing past that means the overlap sometimes folds into the audible
// tail of the last word, as an editor's by-ear J/L cut does; the small native
// declick fade (see ppro.ts) covers the seam. Gentle has no floor: "don't
// overlap into real content" is the point of choosing it. Floors much above
// 0.2 s start folding audibly into word tails, which only listening shows.
const JL_CUT_MIN_OVERLAP_SEC: Partial<Record<JLCutPreset, number>> = {
  aggressive: 0.22,
  normal: 0.15,
};

// Scales the Aggressive J/L floor (JL_CUT_MIN_OVERLAP_SEC) by how clean this
// file's measured SNR is (ScanResult.medianSnrDb), instead of one constant for
// every source. The floor exists because synthetic voice rarely has a long
// quiet tail to measure; noisy real dialogue usually has real pauses and
// needs it less. It follows each file's measured SNR, not whether the voice is
// synthetic (the two overlap a lot). The ramp is narrow and low (14-18 dB), so
// only the noisiest files get relief and typical files keep the full floor; a
// wide ramp would weaken the floor on ordinary material too.
const AGGRESSIVE_FLOOR_SNR_NOISY_DB = 14;
const AGGRESSIVE_FLOOR_SNR_CLEAN_DB = 18;

// A frame counts as quiet enough to overlap into once it drops below this
// fraction of the segment's own typical RMS — relative to that segment's
// loudness, so it adapts to a shouted line and a quiet murmur alike. Per
// preset: the measured quiet region, not the ms ceiling or duration cap, is
// what limits the overlap in practice, so this is the direct lever for how
// far each preset reaches (Aggressive accepts a less strict bar).
export const JL_CUT_QUIET_FRAME_RATIO: Record<JLCutPreset, number> = {
  gentle: 0.4,
  normal: 0.55,
  aggressive: 0.7,
};

// JL_CUT_QUIET_FRAME_RATIO is relative to each segment's median RMS; on a noisy
// camera recording that can put the quiet bar below what is physically
// reachable (even silence sits at the room's noise floor), making the
// quiet-run measurement too strict. So the bar never drops below
// `noiseFloorRms * JL_CUT_NOISE_FLOOR_MARGIN`. One shared value: the noise
// floor sits only ~4-5x below the median RMS on noisy material but ~16-19x
// below on clean material, so 3.0 engages on noisy files and leaves clean
// ones alone.
export const JL_CUT_NOISE_FLOOR_MARGIN = 3.0;

/**
 * Typical RMS across a segment's frames: the loudness reference
 * countQuietFrames* compares frames against, so "quiet" is relative to that
 * piece of speech. Median rather than mean: one shouted word or a soft start
 * skews the mean, while the median is the level most frames sit at.
 */
export const segmentTypicalRms = (scanResult: ScanResult, seg: { start: number; end: number }): number => {
  const startFrame = Math.max(0, Math.round(seg.start / FRAME_STEP_SEC));
  const endFrame = Math.min(scanResult.weightedRmsValues.length, Math.round(seg.end / FRAME_STEP_SEC));
  if (endFrame <= startFrame) return 0;
  const values = scanResult.weightedRmsValues.slice(startFrame, endFrame);
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
};

// Lightweight normalized-autocorrelation pitch/voicing estimate — no new
// dependency or model, like this file's FFT. Runs only inside
// countQuietFramesBackward/Forward's walk (a few frames per J/L boundary), so
// it adds nothing to Scan.
const F0_WINDOW_FRAMES = 3; // ~90ms, centered-ish on frameIndex — enough periods for reliable autocorrelation down to F0_MIN_HZ
const F0_MIN_HZ = 70;
const F0_MAX_HZ = 400;
// Near J/L boundaries the autocorrelation r of quiet frames is unimodal (no
// voiced/unvoiced valley), so no cutoff separates them cleanly. At 0.4 a large
// share of quiet frames read as voiced on their own; the selectivity comes
// from requiring F0_SUSTAINED_STOP_FRAMES consecutive voiced, non-falling
// frames (see countQuietFramesBackward/Forward). Safe by construction: this
// can only shrink an overlap compared with pure amplitude, never grow it.
const VOICING_THRESHOLD = 0.4;

/**
 * Normalized autocorrelation over a small window centred near `frameIndex`,
 * returning the best-matching lag's correlation `r` (0-1) and the F0 it
 * implies. Never throws: returns `{ r: 0, f0Hz: 0 }` for a window outside the
 * file. Separate from estimateF0Voicing (which thresholds `r` against
 * VOICING_THRESHOLD) so the raw value is available to applyBreathPad and to
 * diagnostics.
 */
const computeBestLagCorrelation = (pcm: Buffer, frameIndex: number): { r: number; f0Hz: number } => {
  const windowSamples = F0_WINDOW_FRAMES * FRAME_SAMPLES;
  const startSample = (frameIndex - 1) * FRAME_SAMPLES;
  const startByte = startSample * 2;
  if (startByte < 0 || startByte + windowSamples * 2 > pcm.length) {
    return { r: 0, f0Hz: 0 };
  }
  const samples = new Float64Array(windowSamples);
  let mean = 0;
  for (let i = 0; i < windowSamples; i++) {
    samples[i] = pcm.readInt16LE(startByte + i * 2);
    mean += samples[i];
  }
  mean /= windowSamples;
  for (let i = 0; i < windowSamples; i++) samples[i] -= mean;

  const minLag = Math.round(SAMPLE_RATE / F0_MAX_HZ);
  const maxLag = Math.min(windowSamples - 1, Math.round(SAMPLE_RATE / F0_MIN_HZ));
  let bestLag = -1;
  let bestR = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const n = windowSamples - lag;
    let num = 0;
    let denomA = 0;
    let denomB = 0;
    for (let i = 0; i < n; i++) {
      num += samples[i] * samples[i + lag];
      denomA += samples[i] * samples[i];
      denomB += samples[i + lag] * samples[i + lag];
    }
    const denom = Math.sqrt(denomA * denomB);
    const r = denom > 0 ? num / denom : 0;
    if (r > bestR) {
      bestR = r;
      bestLag = lag;
    }
  }
  if (bestLag <= 0) return { r: 0, f0Hz: 0 };
  return { r: bestR, f0Hz: SAMPLE_RATE / bestLag };
};

/**
 * Raw correlation for callers that need more than estimateF0Voicing's boolean:
 * applyBreathPad uses it to judge whether a candidate gap is unvoiced and
 * aspirated (breath-shaped) rather than voiced speech.
 */
export const estimateF0Correlation = (pcm: Buffer, frameIndex: number): { r: number; f0Hz: number } =>
  computeBestLagCorrelation(pcm, frameIndex);

/** The entry point countQuietFramesBackward/Forward call — thresholds
 *  computeBestLagCorrelation's raw `r` against VOICING_THRESHOLD. Never
 *  throws (computeBestLagCorrelation returns { r: 0, f0Hz: 0 } outside the
 *  file); callers still wrap it in try/catch, in keeping with this
 *  mechanism's "never worse than amplitude-only" design. */
const estimateF0Voicing = (pcm: Buffer, frameIndex: number): { voiced: boolean; f0Hz: number } => {
  const { r, f0Hz } = computeBestLagCorrelation(pcm, frameIndex);
  return { voiced: r > VOICING_THRESHOLD, f0Hz };
};

// A short run of consecutive "not falling" frames, not just one, before
// treating it as a real sustained/rising tail — one noisy autocorrelation
// read shouldn't stop an otherwise-genuine quiet run early.
const F0_FALL_THRESHOLD_HZ = 5;
const F0_SUSTAINED_STOP_FRAMES = 2;

/**
 * Walks backward frame by frame from `fromFrame` (exclusive) and counts how
 * many consecutive frames stay at or below `quietLevel`, stopping at the first
 * loud frame (or at `minFrame`/`maxFrames`): a direct measurement of how far a
 * real quiet or decaying tail extends. Averaging over a fixed window instead
 * can credit a large overlap when only the last sliver of the window is quiet,
 * cutting into an unfinished word; checking every frame means the measured
 * length never extends past where the audio stops being quiet.
 */
const countQuietFramesBackward = (
  rmsValues: number[],
  pcm: Buffer,
  fromFrame: number,
  minFrame: number,
  quietLevel: number,
  maxFrames: number,
): number => {
  let count = 0;
  let f = fromFrame - 1;
  let prevF0: number | null = null;
  let sustainedCount = 0;
  while (f >= minFrame && count < maxFrames) {
    if (rmsValues[f] > quietLevel) break;
    // A second, pitch-based stop on top of the amplitude check: a sustained or
    // rising-intonation tail isn't a natural decay even if it is quiet enough by
    // amplitude. Wrapped defensively: it can only make the overlap more
    // conservative, and any failure falls back to the amplitude-only walk.
    try {
      const { voiced, f0Hz } = estimateF0Voicing(pcm, f);
      if (voiced && prevF0 !== null && f0Hz >= prevF0 - F0_FALL_THRESHOLD_HZ) {
        sustainedCount++;
        if (sustainedCount >= F0_SUSTAINED_STOP_FRAMES) break;
      } else {
        sustainedCount = 0;
      }
      prevF0 = voiced ? f0Hz : null;
    } catch (e) {
      prevF0 = null;
      sustainedCount = 0;
    }
    count++;
    f--;
  }
  return count;
};

/** Same as countQuietFramesBackward, walking forward instead — used on the
 *  incoming segment's head. */
const countQuietFramesForward = (
  rmsValues: number[],
  pcm: Buffer,
  fromFrame: number,
  maxFrame: number,
  quietLevel: number,
  maxFrames: number,
): number => {
  let count = 0;
  let f = fromFrame;
  let prevF0: number | null = null;
  let sustainedCount = 0;
  while (f < maxFrame && count < maxFrames) {
    if (rmsValues[f] > quietLevel) break;
    try {
      const { voiced, f0Hz } = estimateF0Voicing(pcm, f);
      if (voiced && prevF0 !== null && f0Hz >= prevF0 - F0_FALL_THRESHOLD_HZ) {
        sustainedCount++;
        if (sustainedCount >= F0_SUSTAINED_STOP_FRAMES) break;
      } else {
        sustainedCount = 0;
      }
      prevF0 = voiced ? f0Hz : null;
    } catch (e) {
      prevF0 = null;
      sustainedCount = 0;
    }
    count++;
    f++;
  }
  return count;
};

/** Per-boundary overlaps and fade sizes from computeJLCutOverlaps / getFallbackJLCutOverlaps. */
export interface JLCutOverlapResult {
  overlapsSec: number[];
  /**
   * The floor actually in force for this file and the 0..1 score that produced
   * it. The effective floor can be far below
   * `JL_CUT_MIN_OVERLAP_SEC.aggressive` on noisy material (for example 83 ms at
   * 15.5 dB median SNR, none at 13.8 dB), so the Diagnostics report shows it to
   * explain small overlaps. On the no-scan path (getFallbackJLCutOverlaps)
   * syntheticScore is 0 and effectiveFloorSec holds the flat overlap used at
   * every boundary.
   */
  syntheticScore: number;
  effectiveFloorSec: number;
  /**
   * Declick fade size (frames) for this boundary's outgoing clip (segments[i]'s
   * trailing edge) and incoming clip (segments[i+1]'s leading edge), sized from
   * the measured decay and rise (tailQuietFrames/headQuietFrames) instead of one
   * fixed size. Each is capped at the final overlapsSec[i] in frames: a fade
   * never outlasts the overlap window it sits in.
   */
  tailFadeFrames: number[];
  headFadeFrames: number[];
}

// Fade sizing: a fraction of the measured quiet run, clamped to 1-5 frames.
const FADE_SHAPE_RATIO = 0.2;
const MIN_FADE_FRAMES = 1; // never below the fixed 1-frame fade ppro.ts uses when nothing is measured
const MAX_FADE_FRAMES = 5;

/**
 * For each boundary between two adjacent segments in the list Cut was (or
 * will be) given, decides how much the later segment is pulled earlier so it
 * overlaps the one before it — the shared input of ppro.ts's
 * applyJLCutSmoothing (repositioning clips on two tracks) and its fade step.
 * One entry per boundary (segments.length - 1 entries).
 *
 * Per boundary: measures frame by frame how far a quiet region extends
 * backward from the outgoing segment's end and forward from the incoming
 * segment's start (countQuietFramesBackward/Forward, relative to each
 * segment's typical loudness; see segmentTypicalRms). The overlap is the
 * smaller of the two runs — both sides share the overlap window — capped by
 * the preset's budget and a fraction of each segment's duration (durCap). It
 * is not capped by how much silence Cut removed at that boundary: a J/L cut
 * overlaps real content at the edges, not only removed silence.
 *
 * Whisper word timestamps are not used to tighten this: the segments are
 * already word-snapped, so the last word ends at or past the segment end by
 * construction, and the timestamps are too approximate for frame-level
 * checks.
 *
 * No declick floor: declicking is ppro.ts's short native fade
 * (addNativeEdgeFades) on every piece, sized per boundary by tailFadeFrames/
 * headFadeFrames below, so a boundary with no quiet region can get zero pacing
 * overlap. Aggressive and Normal do have a pacing floor
 * (JL_CUT_MIN_OVERLAP_SEC); Gentle is purely measurement-driven.
 */
export const computeJLCutOverlaps = (
  scanResult: ScanResult,
  segments: { start: number; end: number }[],
  preset: JLCutPreset,
): JLCutOverlapResult => {
  const maxBudget = JL_CUT_MAX_OVERLAP_SEC[preset];
  const overlaps: number[] = [];
  const tailQuietFramesArr: number[] = [];
  const headQuietFramesArr: number[] = [];
  // Once per file, not per boundary (see AGGRESSIVE_FLOOR_SNR_*). 1 = clean
  // material, the full floor applies; 0 = noisy material, the floor relaxes to
  // the per-boundary measurement.
  const syntheticScore = clamp(
    (scanResult.medianSnrDb - AGGRESSIVE_FLOOR_SNR_NOISY_DB) / (AGGRESSIVE_FLOOR_SNR_CLEAN_DB - AGGRESSIVE_FLOOR_SNR_NOISY_DB),
    0,
    1,
  );

  for (let i = 0; i < segments.length - 1; i++) {
    const gap = segments[i + 1].start - segments[i].end;
    if (gap <= 0) {
      // No pause between the two pieces in the source (touching segments, or
      // a piece split by hand mid-phrase): there is nothing to pull earlier
      // into, so the boundary gets no overlap.
      overlaps.push(0);
      tailQuietFramesArr.push(0);
      headQuietFramesArr.push(0);
      continue;
    }

    // Capped by a fraction (40%) of either neighbouring segment's duration: this
    // protects a short word from losing most of its length and guarantees an
    // overlap never eats a whole segment (or, two hops later on the same
    // alternating track, collides with the next clip there — see
    // applyJLCutSmoothing in ppro.ts).
    const durCap = Math.min(segments[i].end - segments[i].start, segments[i + 1].end - segments[i + 1].start) * 0.4;
    const budget = Math.min(maxBudget, durCap);
    const maxFrames = Math.max(1, Math.round(budget / FRAME_STEP_SEC));

    const tailQuietLevel = Math.max(
      segmentTypicalRms(scanResult, segments[i]) * JL_CUT_QUIET_FRAME_RATIO[preset],
      scanResult.noiseFloorRms * JL_CUT_NOISE_FLOOR_MARGIN,
    );
    // Clamped to rmsValues.length like headEndFrame below: segments[i].end isn't
    // guaranteed to fall inside the analyzed range (buildSegments/wordSnap can
    // produce an end at or past the clip's last analyzed frame). Unclamped,
    // countQuietFramesBackward would start from an out-of-range index, where
    // rmsValues[f] is `undefined` and `undefined > quietLevel` is false, so
    // out-of-range frames would be counted as "quiet".
    const tailEndFrame = Math.min(scanResult.weightedRmsValues.length, Math.round(segments[i].end / FRAME_STEP_SEC));
    const tailStartFrame = Math.max(0, Math.round(segments[i].start / FRAME_STEP_SEC));
    const tailQuietFrames = countQuietFramesBackward(
      scanResult.weightedRmsValues,
      scanResult.pcm,
      tailEndFrame,
      tailStartFrame,
      tailQuietLevel,
      maxFrames,
    );

    const headQuietLevel = Math.max(
      segmentTypicalRms(scanResult, segments[i + 1]) * JL_CUT_QUIET_FRAME_RATIO[preset],
      scanResult.noiseFloorRms * JL_CUT_NOISE_FLOOR_MARGIN,
    );
    // Clamped to 0 like tailStartFrame above, as a defensive bound: unclamped,
    // a negative start would make countQuietFramesForward begin at a negative
    // index, where rmsValues[f] is `undefined` and `undefined > quietLevel` is
    // false, so phantom frames before index 0 would be counted as "quiet".
    const headStartFrame = Math.max(0, Math.round(segments[i + 1].start / FRAME_STEP_SEC));
    const headEndFrame = Math.min(scanResult.weightedRmsValues.length, Math.round(segments[i + 1].end / FRAME_STEP_SEC));
    const headQuietFrames = countQuietFramesForward(
      scanResult.weightedRmsValues,
      scanResult.pcm,
      headStartFrame,
      headEndFrame,
      headQuietLevel,
      maxFrames,
    );

    // The smaller of the two — both sides share the same overlap window, so
    // a short quiet run on either side caps how far it can safely extend.
    const measuredSec = Math.min(tailQuietFrames, headQuietFrames) * FRAME_STEP_SEC;

    // Aggressive and Normal floor at JL_CUT_MIN_OVERLAP_SEC, scaled by
    // syntheticScore (see that variable's own comment — full floor on
    // clean/synthetic content, relaxing toward the real measurement on
    // noisier content). Gentle has no floor here (`?? 0`), so it stays
    // purely measurement-driven regardless of syntheticScore. Never above `budget`
    // (the preset ceiling / duration-fraction cap) either way — a floor
    // doesn't override that.
    const floorSec = (JL_CUT_MIN_OVERLAP_SEC[preset] ?? 0) * syntheticScore;
    const overlapSec = Math.min(budget, Math.max(measuredSec, floorSec));
    overlaps.push(overlapSec);
    tailQuietFramesArr.push(tailQuietFrames);
    headQuietFramesArr.push(headQuietFrames);
  }

  // A short middle segment (shorter than both neighbours) can have up to
  // durCap's 40% pulled into overlap from each side independently: the loop
  // above looks at one boundary at a time. This pass caps the combined incoming
  // plus outgoing overlap any one segment absorbs, so it always keeps a solo
  // stretch of its own.
  //
  // Both contributing overlaps shrink proportionally, keeping each boundary
  // symmetric between the two clips that share it. Left to right, single pass:
  // shrinking overlaps[i-1] here can only help the cap already checked for
  // segment i-1, since every cap is a maximum.
  const TOTAL_OVERLAP_CAP_FRACTION = 0.6;
  for (let i = 1; i < segments.length - 1; i++) {
    const segDur = segments[i].end - segments[i].start;
    const capTotal = segDur * TOTAL_OVERLAP_CAP_FRACTION;
    const sum = overlaps[i - 1] + overlaps[i];
    if (sum > capTotal && sum > 0) {
      const scale = capTotal / sum;
      overlaps[i - 1] *= scale;
      overlaps[i] *= scale;
    }
  }

  // Derived after the combined-cap pass, from the final overlaps[]: a fade sized
  // from the raw decay shape alone could outlast an overlap that pass just
  // shrank.
  const tailFadeFrames: number[] = [];
  const headFadeFrames: number[] = [];
  for (let i = 0; i < overlaps.length; i++) {
    const overlapFrameCap = Math.max(0, Math.round(overlaps[i] / FRAME_STEP_SEC));
    // No real overlap at this boundary (a plain hard cut, or the gap<=0
    // defensive path): nothing to bound the fade against, so fall back to the
    // flat MIN_FADE_FRAMES value rather than sizing off shape data that has no
    // overlap window to fit inside.
    const sizeFade = (quietFrames: number): number => {
      if (overlapFrameCap <= 0) return MIN_FADE_FRAMES;
      const raw = clamp(Math.round(quietFrames * FADE_SHAPE_RATIO), MIN_FADE_FRAMES, MAX_FADE_FRAMES);
      return Math.min(raw, overlapFrameCap);
    };
    tailFadeFrames.push(sizeFade(tailQuietFramesArr[i]));
    headFadeFrames.push(sizeFade(headQuietFramesArr[i]));
  }

  return {
    overlapsSec: overlaps,
    tailFadeFrames,
    headFadeFrames,
    syntheticScore,
    effectiveFloorSec: (JL_CUT_MIN_OVERLAP_SEC[preset] ?? 0) * syntheticScore,
  };
};

/**
 * Flat, unmeasured overlap for when there is no Scan data to drive
 * `computeJLCutOverlaps` — for example J/L on already-cut pieces after a
 * Premiere restart cleared the panel's scan, when the original clip no longer
 * exists as one clip to re-scan.
 *
 * 25% of each preset's maximum overlap (`JL_CUT_MAX_OVERLAP_SEC`): conservative,
 * keeping each preset's character without claiming to know this audio's quiet
 * regions. Not the full preset floor: on noisy material the scanned path
 * scales its floor down (syntheticScore), and without a scan there is no SNR to
 * scale by, so a full floor would push overlaps into audible word tails on
 * exactly the material where the measured path backs off.
 */
export const FALLBACK_JL_CUT_OVERLAP_FRACTION = 0.25;
export const getFallbackJLCutOverlapSec = (preset: JLCutPreset): number =>
  JL_CUT_MAX_OVERLAP_SEC[preset] * FALLBACK_JL_CUT_OVERLAP_FRACTION;

/**
 * The active J/L Pacing preset's tuning constants, for the Diagnostics report
 * (the Silence Cut side reports its full ModeConfig the same way, see
 * main.tsx), so a report states which values actually ran.
 */
export const getJLCutPresetConfig = (preset: JLCutPreset) => ({
  minOverlapSec: JL_CUT_MIN_OVERLAP_SEC[preset] ?? 0,
  maxOverlapSec: JL_CUT_MAX_OVERLAP_SEC[preset],
  fallbackOverlapSec: getFallbackJLCutOverlapSec(preset),
});

/**
 * Full-array version of the fallback above, with the same per-piece duration
 * caps `computeJLCutOverlaps` applies to measured overlaps. A flat value alone
 * (`getFallbackJLCutOverlapSec`) knows nothing about piece length: a very
 * short piece (word-snapped cuts can leave pieces of 0.3-0.4 s) taking the
 * flat value on both sides could lose most of its length, and
 * `applyJLCutSmoothing` has no separate safeguard. Mirrors both caps exactly —
 * durCap (40% of the shorter neighbour), then the 60% combined pass — starting
 * from the flat value instead of a measurement.
 */
export const getFallbackJLCutOverlaps = (segments: { start: number; end: number }[], preset: JLCutPreset): JLCutOverlapResult => {
  const flat = getFallbackJLCutOverlapSec(preset);
  const overlaps: number[] = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const durCap = Math.min(segments[i].end - segments[i].start, segments[i + 1].end - segments[i + 1].start) * 0.4;
    overlaps.push(Math.min(flat, durCap));
  }
  const TOTAL_OVERLAP_CAP_FRACTION = 0.6;
  for (let i = 1; i < segments.length - 1; i++) {
    const segDur = segments[i].end - segments[i].start;
    const capTotal = segDur * TOTAL_OVERLAP_CAP_FRACTION;
    const sum = overlaps[i - 1] + overlaps[i];
    if (sum > capTotal && sum > 0) {
      const scale = capTotal / sum;
      overlaps[i - 1] *= scale;
      overlaps[i] *= scale;
    }
  }
  // No per-frame quiet-run measurement in this no-scanResult fallback path:
  // the flat MIN_FADE_FRAMES value for every boundary, for the same reason as
  // computeJLCutOverlaps' overlapFrameCap<=0 case.
  const flatFades = overlaps.map(() => MIN_FADE_FRAMES);
  // No scan data: no floor and no SNR scoring are involved on this path at
  // all — every boundary gets the same flat, un-measured value, which is
  // what `effectiveFloorSec` reports here. The session log labels this path
  // separately (see runSmoothCuts), so it is never mistaken for a measured
  // run.
  return {
    overlapsSec: overlaps,
    tailFadeFrames: flatFades,
    headFadeFrames: flatFades,
    syntheticScore: 0,
    effectiveFloorSec: getFallbackJLCutOverlapSec(preset),
  };
};
