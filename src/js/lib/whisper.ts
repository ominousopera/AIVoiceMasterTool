import { child_process, fs, os, path } from "./cep/node";
import { getWhisperCppPath, getWhisperCppModelPath } from "./whisperCppPath";

// Word-level ASR (Whisper tiny, ggml/whisper.cpp, MIT; see NOTICE.md), so cut
// boundaries can snap to real word edges instead of relying on energy/VAD
// thresholds alone (see wordSnap.ts). Never allowed to break Scan: same
// never-throw contract as silero.ts's computeVadProbs.
//
// Runs `whisper-cli` (built from the official ggml-org/whisper.cpp source,
// MIT) as a bundled per-OS subprocess, like ffmpeg (see ffmpegPath.ts and
// whisperCppPath.ts). Running Whisper inside the panel (transformers.js +
// onnxruntime-web) blocks the panel's thread for many seconds (awaiting
// already-resolved promises never yields to the host's renderer loop, and
// there is no Web Worker here), and Premiere resets the panel. A separate OS
// process avoids that.
//
// The subprocess is spawned with `child_process.spawn` (async) and awaited via
// its `close` event, never `spawnSync`, which would block the panel's thread
// for the whole transcription. Scan's ffmpeg decode is asynchronous for the
// same reason (analyze.ts's decodeToPCMAsync).

const diagnosticState = {
  /** True once a transcription has been attempted this session. */
  loadAttempted: false,
  /** True once the bundled binary + model were both confirmed present. */
  loaded: false,
  lastError: null as string | null,
  lastTranscribeMs: null as number | null,
  lastWordCount: null as number | null,
  /**
   * Threads passed to whisper-cli (`-t`) on the last run. Whisper takes most of
   * Scan's time and this value follows the machine's core count, so it explains
   * "slow on weaker hardware" reports.
   */
  lastThreads: null as number | null,
};

export const getWhisperDiagnostics = () => ({ ...diagnosticState });

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

interface WhisperCppSegment {
  text: string;
  offsets: { from: number; to: number };
}

interface WhisperCppJson {
  transcription: WhisperCppSegment[];
}

/** Wraps raw PCM (mono, 16-bit signed LE) in a minimal 44-byte RIFF/WAVE
 *  header — whisper-cli reads WAV files, not bare PCM. */
const wrapPcmAsWav = (pcm: Buffer, sampleRate: number): Buffer => {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate (16-bit mono)
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
};

/**
 * How many threads to hand whisper-cli. Without `-t`, whisper.cpp uses
 * `min(4, hardware_concurrency())`, 4 threads even on a 14-core machine, and
 * Whisper is most of Scan's time (VAD and decode are much smaller).
 *
 * Leaves headroom rather than taking every core: this runs inside Premiere's
 * process tree, and starving the host's UI thread to save a second of Scan is
 * a bad trade. Caps at 8 because whisper.cpp's scaling flattens well before
 * that on a model this small (tiny-q5_1).
 */
const whisperThreadCount = (): number => {
  try {
    const cores = os.cpus()?.length ?? 0;
    if (!cores) return 4; // same as whisper.cpp's own default
    // Never below whisper.cpp's own default of min(4, cores): a naive
    // `cores - 1` would give a 4-core machine fewer threads than it already had.
    // Capped at 8 because the tiny model gains almost nothing past 8 threads.
    const defaultThreads = Math.min(4, cores);
    const headroomThreads = Math.min(8, cores - 1);
    return Math.max(1, defaultThreads, headroomThreads);
  } catch (e) {
    return 4;
  }
};

/**
 * Upper bound on one whisper-cli run, in milliseconds, for `audioDurationSec`
 * seconds of audio. The tiny model runs many times faster than real time on
 * any supported machine, so twice the audio length plus a fixed allowance for
 * model loading is generous; a run that is still going past it is stuck, and
 * Scan continues without the word check rather than waiting forever.
 */
const whisperTimeoutMs = (audioDurationSec: number): number => 60_000 + Math.max(0, audioDurationSec) * 2000;

const runWhisperCli = (bin: string, args: string[], timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    // stdout is discarded: with `-ml 1` whisper-cli prints one `[t0 --> t1]
    // token` line per token there even under `-np` (which only silences the
    // system info and timings), and the result is read from the JSON file.
    // Left as a pipe that nobody reads, the OS buffer fills after a few
    // thousand tokens (about twenty minutes of speech) and the child blocks in
    // its write forever; `close` then never fires.
    const proc = child_process.spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill("SIGKILL");
      } catch (e) {
        // already gone
      }
    }, timeoutMs);
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf-8");
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) reject(new Error(`whisper-cli did not finish within ${Math.round(timeoutMs / 1000)} s and was stopped`));
      else if (code === 0) resolve();
      else reject(new Error(`whisper-cli exited with code ${code}: ${stderr.slice(-500)}`));
    });
  });

/**
 * Transcribes PCM audio and returns per-word timestamps, or null if the
 * bundled binary/model is unavailable or transcription fails for any reason —
 * callers (analyze.ts) must treat null as "no word-snap signal available"
 * and fall back to energy/VAD-only segments, exactly like silero.ts's
 * contract for computeVadProbs. Never throws.
 *
 * `pcm` must be mono, 16-bit signed LE, matching what analyze.ts's
 * decodeToPCM already produces for RMS/Silero — no separate decode needed
 * upstream, just wrapped in a WAV header here.
 */
export const transcribeWithWordTimestamps = async (pcm: Buffer, audioDurationSec: number): Promise<WordTimestamp[] | null> => {
  diagnosticState.loadAttempted = true;
  const t0 = Date.now();
  let tmpWav: string | null = null;
  let tmpJson: string | null = null;
  try {
    const bin = getWhisperCppPath();
    const model = getWhisperCppModelPath();
    if (!fs.existsSync(model)) {
      throw new Error(`word-timestamp model missing at ${model}`);
    }
    diagnosticState.loaded = true;

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const outPrefix = path.join(os.tmpdir(), `aivsc-whisper-${stamp}`);
    tmpWav = outPrefix + ".wav";
    tmpJson = outPrefix + ".json";

    // 16000 matches analyze.ts's SAMPLE_RATE — not imported directly to
    // avoid a circular import (analyze.ts imports this module).
    fs.writeFileSync(tmpWav, wrapPcmAsWav(pcm, 16000));

    const threads = whisperThreadCount();
    diagnosticState.lastThreads = threads;

    await runWhisperCli(
      bin,
      [
        "-m",
        model,
        "-f",
        tmpWav,
        "-l",
        "auto", // multilingual model — don't assume English
        "-ml",
        "1", // max-len 1 => one word/token per segment
        "-t",
        String(threads), // see whisperThreadCount
        "-oj", // JSON output
        "-of",
        outPrefix,
        "-np", // no system info or timings on stderr; the result is read from the JSON file
      ],
      whisperTimeoutMs(audioDurationSec),
    );

    const parsed: WhisperCppJson = JSON.parse(fs.readFileSync(tmpJson, "utf-8"));

    // whisper.cpp's word-level alignment can overshoot the real audio bounds
    // slightly; clamp.
    const words = (parsed.transcription || [])
      .filter((seg) => seg.text && seg.text.trim().length > 0)
      .map((seg) => ({
        word: seg.text.trim(),
        start: Math.max(0, Math.min(seg.offsets.from / 1000, audioDurationSec)),
        end: Math.max(0, Math.min(seg.offsets.to / 1000, audioDurationSec)),
      }))
      .filter((w) => w.end > w.start);

    diagnosticState.lastTranscribeMs = Date.now() - t0;
    diagnosticState.lastWordCount = words.length;
    return words.length ? words : null;
  } catch (e) {
    diagnosticState.lastTranscribeMs = Date.now() - t0;
    const msg = e && (e as any).message ? (e as any).message : String(e);
    diagnosticState.lastError = msg;
    console.warn("[whisper] transcription failed, word-snap unavailable:", e);
    return null;
  } finally {
    try {
      if (tmpWav) fs.unlinkSync(tmpWav);
    } catch (e) {
      // best effort
    }
    try {
      if (tmpJson) fs.unlinkSync(tmpJson);
    } catch (e) {
      // best effort
    }
  }
};
