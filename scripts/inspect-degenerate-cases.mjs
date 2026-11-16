#!/usr/bin/env node
// Standalone development diagnostic (not part of the shipped panel). What
// does the soft-EM do when one cluster is empty: an all-silence file, an
// all-speech file with no pause at all, a clip shorter than min-duration?
// These are synthetic PCM buffers built directly (no real recording has
// literally zero variation or zero silence), so this tests analyze.ts's
// robustness against inputs real audio can't provide. Pass/fail is "did it
// produce a sane result without throwing, NaN-ing or hanging", not a quality
// judgment: there is no "correct" cut for content this degenerate.
//
// Usage (from the project root):
//   node scripts/inspect-degenerate-cases.mjs

import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const esbuild = await import("esbuild");
const analyzeSrc = path.join(ROOT, "src", "js", "lib", "analyze.ts");
const stamp = Date.now();
const analyzeBundlePath = path.join(ROOT, "scripts", `.tmp-degen-analyze-${stamp}.mjs`);
await esbuild.build({
  entryPoints: [analyzeSrc],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: analyzeBundlePath,
  external: ["onnxruntime-web"],
});

globalThis.window = {};
Object.defineProperty(globalThis, "navigator", {
  value: { appVersion: "MacIntel", userAgent: "Macintosh", platform: "MacIntel" },
  configurable: true,
});

const { SAMPLE_RATE, FRAME_MS, MODES, computeWeightedRmsFrames, computeSharedFrameSignals, buildSegmentsHmm } = await import(
  analyzeBundlePath
);

const FRAME_SAMPLES = Math.round((SAMPLE_RATE * FRAME_MS) / 1000);

const makePcm = (numFrames, sampleFn) => {
  const numSamples = numFrames * FRAME_SAMPLES;
  const buf = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) buf.writeInt16LE(sampleFn(i), i * 2);
  return buf;
};

// No VAD available for synthetic PCM (no real Silero session needed for
// this check) — exercises the no-VAD fallback path (pseudoProbsFromLogE),
// itself a real, shipped code path (used whenever Silero fails to load).
const vadProbs = null;

const cases = [
  {
    name: "all-silence (6s, pure zero samples)",
    pcm: makePcm(200, () => 0),
  },
  {
    name: "all-speech-no-pause (6s, constant 8000-amplitude 220Hz tone — no quiet moment anywhere)",
    pcm: makePcm(200, (i) => Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE))),
  },
  {
    name: "sub-min-duration (3 frames = 90ms, loud tone)",
    pcm: makePcm(3, (i) => Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE))),
  },
  {
    name: "single-frame (30ms)",
    pcm: makePcm(1, (i) => Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE))),
  },
  {
    name: "half-silence-half-tone (3s silence then 3s constant tone, one hard transition)",
    pcm: Buffer.concat([makePcm(100, () => 0), makePcm(100, (i) => Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE)))]),
  },
];

let anyFailure = false;
for (const c of cases) {
  process.stdout.write(`[${c.name}] `);
  try {
    const weightedRmsValues = computeWeightedRmsFrames(c.pcm);
    const shared = computeSharedFrameSignals(c.pcm, weightedRmsValues, vadProbs);
    const fit = shared.fit;
    const fitHasNaN = [fit.muS, fit.vS, fit.muN, fit.vN].some((v) => Number.isNaN(v) || !Number.isFinite(v));
    const llrHasNaN = Array.from(shared.baseLlr).some((v) => Number.isNaN(v) || !Number.isFinite(v));
    let modeSummaries = [];
    for (const mode of MODES) {
      const segments = buildSegmentsHmm(shared, mode, weightedRmsValues.length);
      const segHasBadValue = segments.some(
        (s) => Number.isNaN(s.start) || Number.isNaN(s.end) || !Number.isFinite(s.start) || !Number.isFinite(s.end) || s.end < s.start,
      );
      modeSummaries.push(`${mode.name}=${segments.length}seg${segHasBadValue ? "[BAD VALUES]" : ""}`);
      if (segHasBadValue) anyFailure = true;
    }
    if (fitHasNaN || llrHasNaN) anyFailure = true;
    console.log(
      `frames=${weightedRmsValues.length} fit(muS=${fit.muS.toFixed(2)},vS=${fit.vS.toFixed(2)},muN=${fit.muN.toFixed(2)},vN=${fit.vN.toFixed(
        2,
      )},degenerate=${fit.noisePoolDegenerate})${fitHasNaN ? " [FIT HAS NaN/Inf]" : ""}${llrHasNaN ? " [LLR HAS NaN/Inf]" : ""} segments:[${modeSummaries.join(
        ", ",
      )}] -> OK (no throw, no hang)`,
    );
  } catch (e) {
    anyFailure = true;
    console.log(`THREW: ${e.message}\n${e.stack}`);
  }
}

console.log(
  `\n${anyFailure ? "FAIL — see issues above." : "PASS — every degenerate case produced a finite, well-formed result without throwing."}`,
);

try {
  const { unlinkSync } = await import("node:fs");
  unlinkSync(analyzeBundlePath);
} catch (e) {
  // best effort
}

process.exit(anyFailure ? 1 : 0);
