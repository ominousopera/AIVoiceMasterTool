#!/usr/bin/env node
// Standalone development diagnostic (not part of the shipped panel). Runs the
// real pipeline (analyze.ts's computeSharedFrameSignals + buildSegmentsHmm +
// wordSnap.ts's snapSegmentsToWords, the same MODES/soft-EM/LLR/Viterbi
// decoder the panel uses) on ONE audio file for ONE mode and prints a
// readable trace:
//   - how many words whisper.cpp transcribed (--find=<word> prints each
//     occurrence of that word with its timestamps and a frame trace around
//     it; --trace=<t0>,<t1> prints a frame trace for a time range)
//   - every final (post-word-snap) kept segment
//   - any word a segment boundary still lands inside (mid-word clipping)
//   - any gap between two adjacent words that isn't covered by a cut (a
//     candidate "missed pause": silence between words that stayed in the kept
//     audio) with its duration, sorted longest first
//
// Usage (from the project root):
//   node scripts/inspect-cuts.mjs <audioFile> <modeName> [--min-gap=0.15]
//
// Example:
//   node scripts/inspect-cuts.mjs ~/voice.wav aggressive --min-gap=0.2

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const rawArgs = process.argv.slice(2);
const minGapArg = rawArgs.find((a) => a.startsWith("--min-gap="));
const minGap = minGapArg ? parseFloat(minGapArg.split("=")[1]) : 0.15;
const traceArg = rawArgs.find((a) => a.startsWith("--trace="));
const traceRange = traceArg ? traceArg.split("=")[1].split(",").map(Number) : null;
const biasOverrideArg = rawArgs.find((a) => a.startsWith("--bias-override="));
const biasOverride = biasOverrideArg ? parseFloat(biasOverrideArg.split("=")[1]) : null;
const findArg = rawArgs.find((a) => a.startsWith("--find="));
const findWord = findArg ? findArg.split("=")[1].toLowerCase() : null;
const positional = rawArgs.filter((a) => !a.startsWith("--"));
const [audioArg, modeNameArg] = positional;
if (!audioArg || !modeNameArg) {
  console.error("Usage: node scripts/inspect-cuts.mjs <audioFile> <modeName> [--min-gap=0.15]");
  process.exit(1);
}
const audioPath = path.resolve(process.cwd(), audioArg);
if (!existsSync(audioPath)) {
  console.error(`Not found: ${audioPath}`);
  process.exit(1);
}

const esbuild = await import("esbuild");
const analyzeSrc = path.join(ROOT, "src", "js", "lib", "analyze.ts");
const wordSnapSrc = path.join(ROOT, "src", "js", "lib", "wordSnap.ts");
const stamp = Date.now();
const analyzeBundlePath = path.join(ROOT, "scripts", `.tmp-inspect-analyze-${stamp}.mjs`);
const wordSnapBundlePath = path.join(ROOT, "scripts", `.tmp-inspect-wordsnap-${stamp}.mjs`);
await esbuild.build({
  entryPoints: [analyzeSrc],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: analyzeBundlePath,
  external: ["onnxruntime-web"],
});
await esbuild.build({ entryPoints: [wordSnapSrc], bundle: true, platform: "node", format: "esm", outfile: wordSnapBundlePath });

globalThis.window = {};
Object.defineProperty(globalThis, "navigator", {
  value: { appVersion: "MacIntel", userAgent: "Macintosh", platform: "MacIntel" },
  configurable: true,
});

const {
  SAMPLE_RATE,
  FRAME_MS,
  FRAME_STEP_SEC,
  WORD_SNAP_MAX_SEC,
  MODES,
  computeRmsFrames,
  computeWeightedRmsFrames,
  computeSharedFrameSignals,
  buildSegmentsHmm,
} = await import(analyzeBundlePath);
const { snapSegmentsToWords } = await import(wordSnapBundlePath);
const baseMode = MODES.find((m) => m.name === modeNameArg);
if (!baseMode) {
  console.error(`Unknown mode: ${modeNameArg}. Options: ${MODES.map((m) => m.name).join(", ")}`);
  process.exit(1);
}

const ffmpegBin = path.join(ROOT, "src", "assets", "bin", "mac", "ffmpeg");
const decodeToPCM = (inputPath) => {
  const res = spawnSync(ffmpegBin, ["-y", "-i", inputPath, "-ac", "1", "-ar", String(SAMPLE_RATE), "-vn", "-f", "s16le", "pipe:1"], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`ffmpeg failed: ${res.stderr?.toString("utf-8") ?? ""}`);
  return res.stdout;
};

const ort = await import("onnxruntime-web");
const WINDOW_SAMPLES = 512;
const CONTEXT_SAMPLES = 64;
const WINDOW_SEC = WINDOW_SAMPLES / SAMPLE_RATE;
const modelPath = path.join(ROOT, "src", "assets", "silero", "silero_vad_16k.onnx");
const wasmDir = path.join(ROOT, "src", "assets", "silero") + path.sep;
ort.env.wasm.wasmPaths = wasmDir;
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.wasm.proxy = false;
console.log("Loading Silero VAD session...");
const session = await ort.InferenceSession.create(modelPath, { executionProviders: ["wasm"] });

const computeRawVadProbs = async (pcm) => {
  const numSamples = Math.floor(pcm.length / 2);
  const samples = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;
  let state = new Float32Array(2 * 1 * 128);
  let context = new Float32Array(CONTEXT_SAMPLES);
  const windowProbs = [];
  let i = 0;
  while (i + WINDOW_SAMPLES <= numSamples) {
    const chunk = samples.subarray(i, i + WINDOW_SAMPLES);
    const inputArr = new Float32Array(CONTEXT_SAMPLES + WINDOW_SAMPLES);
    inputArr.set(context, 0);
    inputArr.set(chunk, CONTEXT_SAMPLES);
    const feeds = {
      input: new ort.Tensor("float32", inputArr, [1, CONTEXT_SAMPLES + WINDOW_SAMPLES]),
      state: new ort.Tensor("float32", state, [2, 1, 128]),
      sr: new ort.Tensor("int64", BigInt64Array.from([BigInt(SAMPLE_RATE)]), []),
    };
    const outputs = await session.run(feeds);
    windowProbs.push(outputs.output.data[0]);
    state = Float32Array.from(outputs.stateN.data);
    context = Float32Array.from(inputArr.subarray(inputArr.length - CONTEXT_SAMPLES));
    i += WINDOW_SAMPLES;
  }
  const frameSec = FRAME_MS / 1000;
  const totalFrames = Math.floor(numSamples / (SAMPLE_RATE * frameSec));
  const probs = new Array(totalFrames);
  for (let f = 0; f < totalFrames; f++) {
    const tSec = f * frameSec;
    const windowIdx = Math.min(windowProbs.length - 1, Math.round(tSec / WINDOW_SEC));
    probs[f] = windowProbs[windowIdx];
  }
  return probs;
};

const whisperBin = path.join(ROOT, "src", "assets", "bin", "mac", "whisper-cli");
const whisperModel = path.join(ROOT, "src", "assets", "whisper", "ggml-tiny-q5_1.bin");
const wrapPcmAsWav = (pcm, sampleRate) => {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
};
const tmpRoot = mkdtempSync(path.join(tmpdir(), "aivsc-inspect-"));
const transcribeWords = (pcm, durationSec) => {
  const outPrefix = path.join(tmpRoot, `w-${Date.now()}`);
  const wavPath = outPrefix + ".wav";
  const jsonPath = outPrefix + ".json";
  writeFileSync(wavPath, wrapPcmAsWav(pcm, SAMPLE_RATE));
  const res = spawnSync(whisperBin, ["-m", whisperModel, "-f", wavPath, "-l", "auto", "-ml", "1", "-oj", "-of", outPrefix, "-np"], {
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (res.status !== 0 || !existsSync(jsonPath)) return null;
  const parsed = JSON.parse(readFileSync(jsonPath, "utf-8"));
  return (parsed.transcription || [])
    .filter((seg) => seg.text && seg.text.trim().length > 0)
    .map((seg) => ({
      word: seg.text.trim(),
      start: Math.max(0, Math.min(seg.offsets.from / 1000, durationSec)),
      end: Math.max(0, Math.min(seg.offsets.to / 1000, durationSec)),
    }))
    .filter((w) => w.end > w.start);
};

console.log(`Decoding ${audioPath}...`);
const pcm = decodeToPCM(audioPath);
const rmsValues = computeRmsFrames(pcm);
// K-weighted counterpart — feeds every decision below, mirroring
// analyze.ts's real scanAudioFile; printed alongside raw rms= in the
// per-frame trace below so a developer debugging a specific cut can see
// what K-weighting actually changed.
const weightedRmsValues = computeWeightedRmsFrames(pcm);
const durationSec = (rmsValues.length * FRAME_MS) / 1000;
console.log(`Running Silero VAD (${rmsValues.length} frames, ${durationSec.toFixed(1)}s)...`);
const rawVadProbs = await computeRawVadProbs(pcm);
console.log("Transcribing with whisper.cpp...");
const words = transcribeWords(pcm, durationSec);
if (!words || !words.length) {
  console.error("No words transcribed — aborting.");
  process.exit(1);
}
console.log(`Got ${words.length} words.\n`);

// Real production pipeline: mode-independent soft-EM/LLR signals computed
// once (logE, baseLlr, the Gaussian fit, wordSnapEnergyGate), then this
// mode's own Viterbi min-duration decode (buildSegmentsHmm) — see
// computeSharedFrameSignals/buildSegmentsHmm's own doc comments in
// analyze.ts. --bias-override lets a developer probe a different bias value
// than the mode's own shipped default without editing analyze.ts.
const shared = computeSharedFrameSignals(pcm, weightedRmsValues, rawVadProbs);
const effectiveMode = biasOverride !== null ? { ...baseMode, bias: biasOverride } : baseMode;
const preSnapSegments = buildSegmentsHmm(shared, effectiveMode, weightedRmsValues.length);
const segments = snapSegmentsToWords(
  preSnapSegments,
  words,
  WORD_SNAP_MAX_SEC,
  weightedRmsValues,
  FRAME_STEP_SEC,
  shared.wordSnapEnergyGate,
);

console.log(`=== ${path.basename(audioPath)} / mode=${modeNameArg} (bias=${effectiveMode.bias}) ===`);
console.log(
  `fit: muS=${shared.fit.muS.toFixed(2)} vS=${shared.fit.vS.toFixed(3)} muN=${shared.fit.muN.toFixed(2)} vN=${shared.fit.vN.toFixed(3)} noisePoolDegenerate=${shared.fit.noisePoolDegenerate}\n` +
    `wordSnapEnergyGate=${shared.wordSnapEnergyGate.toFixed(1)} (linear RMS)\n`,
);

const isKept = (t) => segments.some((s) => t >= s.start && t <= s.end);

// ---------------------------------------------------------------
// 1. Words whose span isn't fully covered by kept audio (mid-word clip).
// ---------------------------------------------------------------
console.log("--- Words with a cut boundary landing inside them (post-word-snap) ---");
let anyMidWordCut = false;
for (const w of words) {
  const startKept = isKept(w.start + 0.005);
  const endKept = isKept(w.end - 0.005);
  if (startKept !== endKept || !startKept) {
    // Genuinely split: part of the word is kept, part isn't (not simply a
    // whole word sitting entirely in a cut region, which is expected/fine).
    const midKept = isKept((w.start + w.end) / 2);
    if (startKept || endKept || midKept) {
      anyMidWordCut = true;
      console.log(
        `  "${w.word}" [${w.start.toFixed(3)}-${w.end.toFixed(3)}]  startKept=${startKept} endKept=${endKept} midKept=${midKept}`,
      );
    }
  }
}
if (!anyMidWordCut) console.log("  (none found)");

// ---------------------------------------------------------------
// 2. Gaps between adjacent words that are NOT cut (candidate missed pauses).
// ---------------------------------------------------------------
console.log(`\n--- Gaps between adjacent words >= ${minGap}s that are NOT cut (kept as-is) ---`);
const gapRows = [];
for (let i = 0; i < words.length - 1; i++) {
  const a = words[i];
  const b = words[i + 1];
  const gap = b.start - a.end;
  if (gap < minGap) continue;
  const midT = a.end + b.end > a.end ? (a.end + b.start) / 2 : a.end;
  const stillKept = isKept(midT);
  if (stillKept) {
    gapRows.push({ gap, a: a.word, aEnd: a.end, b: b.word, bStart: b.start });
  }
}
gapRows.sort((x, y) => y.gap - x.gap);
if (!gapRows.length) console.log("  (none found)");
for (const r of gapRows) {
  console.log(
    `  ${r.gap.toFixed(3)}s gap between "${r.a}" (ends ${r.aEnd.toFixed(3)}) and "${r.b}" (starts ${r.bStart.toFixed(3)}) — NOT cut`,
  );
}

console.log(`\n--- Final kept segments (${segments.length}) ---`);
for (const s of segments) console.log(`  [${s.start.toFixed(3)} - ${s.end.toFixed(3)}]  (${(s.end - s.start).toFixed(3)}s)`);

if (findWord) {
  console.log(`\n--- Occurrences of "${findWord}" ---`);
  const hits = words.filter((w) => w.word.toLowerCase().replace(/[.,!?]/g, "") === findWord);
  if (!hits.length) console.log(`  (not found — nearby words: ${words.map((w) => w.word).join(" ")})`);
  for (const w of hits) {
    const startKept = isKept(w.start + 0.005);
    const endKept = isKept(w.end - 0.005);
    console.log(`  "${w.word}" [${w.start.toFixed(3)}-${w.end.toFixed(3)}]  startKept=${startKept} endKept=${endKept}`);
    const lo = Math.max(0, Math.floor((w.start - 0.15) / FRAME_STEP_SEC));
    const hi = Math.min(weightedRmsValues.length - 1, Math.ceil((w.end + 0.15) / FRAME_STEP_SEC));
    for (let f = lo; f <= hi; f++) {
      const t = f * FRAME_STEP_SEC;
      const kept = isKept(t) ? "KEPT" : "cut ";
      const scored = shared.baseLlr[f] + effectiveMode.bias;
      console.log(
        `    t=${t.toFixed(3)} rms=${rmsValues[f].toFixed(1).padStart(8)} wRms=${weightedRmsValues[f].toFixed(1).padStart(8)} ` +
          `logE=${shared.logE[f].toFixed(2).padStart(6)} baseLlr=${shared.baseLlr[f].toFixed(2).padStart(7)} +bias=${scored.toFixed(2).padStart(7)} ` +
          `lean=${scored > 0 ? "spch" : "sil "} [${kept}]`,
      );
    }
  }
}

if (traceRange) {
  const [t0, t1] = traceRange;
  console.log(`\n--- Frame trace [${t0}-${t1}]s (logE, baseLlr, mode-adjusted score, instantaneous lean, final decision) ---`);
  console.log(
    `    ("lean" is baseLlr+bias's own sign per frame — NOT the actual Viterbi decision, which also enforces Ds/Dv min-duration; "kept" below is the real final decision.)`,
  );
  for (let f = 0; f < weightedRmsValues.length; f++) {
    const t = f * FRAME_STEP_SEC;
    if (t < t0 || t > t1) continue;
    const kept = isKept(t) ? "KEPT" : "cut ";
    const scored = shared.baseLlr[f] + effectiveMode.bias;
    console.log(
      `  t=${t.toFixed(3)} rms=${rmsValues[f].toFixed(1).padStart(8)} wRms=${weightedRmsValues[f].toFixed(1).padStart(8)} ` +
        `logE=${shared.logE[f].toFixed(2).padStart(6)} baseLlr=${shared.baseLlr[f].toFixed(2).padStart(7)} +bias=${scored.toFixed(2).padStart(7)} ` +
        `lean=${scored > 0 ? "spch" : "sil "} [${kept}]`,
    );
  }
}

rmSync(tmpRoot, { recursive: true, force: true });
try {
  rmSync(analyzeBundlePath);
  rmSync(wordSnapBundlePath);
} catch (e) {
  // best effort
}
