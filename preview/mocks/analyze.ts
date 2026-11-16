// Dev-only preview harness (see ../shims.js). main.tsx's import of
// "../lib/analyze" is redirected here: everything is the real module except
// scanAudioFile, which returns a synthetic, deterministic scan so the
// Silence Cut tab can be previewed without ffmpeg, Silero or whisper.
export * from "../../src/js/lib/analyze";
import { FRAME_STEP_SEC } from "../../src/js/lib/analyze";

const prng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

export const scanAudioFile = async (): Promise<any> => {
  const rand = prng(7);
  const duration = 64.2;
  const frames = Math.round(duration / FRAME_STEP_SEC);
  const rms = new Array(frames).fill(0);
  const speechRuns: { start: number; end: number }[] = [];
  const pauses: number[] = [];

  let t = 0.3;
  while (t < duration - 1) {
    const len = 0.5 + rand() * 2.2;
    const end = Math.min(duration - 0.4, t + len);
    speechRuns.push({ start: t, end });
    const pause = rand() < 0.45 ? 0.06 + rand() * 0.12 : 0.18 + rand() * 0.7;
    pauses.push(pause);
    t = end + pause;
  }
  for (let f = 0; f < frames; f++) {
    const sec = f * FRAME_STEP_SEC;
    const inSpeech = speechRuns.some((r) => sec >= r.start && sec < r.end);
    rms[f] = inSpeech ? 900 + rand() * 4200 * (0.5 + 0.5 * Math.sin(sec * 7)) : 60 + rand() * 90;
  }

  const forMode = (minPause: number, pad: number) => {
    const out: { start: number; end: number; confidence: number }[] = [];
    let cur = { ...speechRuns[0] };
    for (let i = 1; i < speechRuns.length; i++) {
      const gap = speechRuns[i].start - cur.end;
      if (gap < minPause) cur.end = speechRuns[i].end;
      else {
        out.push({ start: Math.max(0, cur.start - pad), end: cur.end + pad, confidence: rand() < 0.12 ? 0.05 : 0.6 });
        cur = { ...speechRuns[i] };
      }
    }
    out.push({ start: Math.max(0, cur.start - pad), end: Math.min(duration, cur.end + pad), confidence: 0.7 });
    return out;
  };
  const segmentsByMode = {
    aggressive: forMode(0.15, 0.07),
    normal: forMode(0.25, 0.08),
    gentle: forMode(0.5, 0.1),
  };
  const longest = Math.max(...pauses);
  const pauseStatsByMode = {
    aggressive: { detectedCount: pauses.length, longestSec: longest, minCuttableSec: 0.15 },
    normal: { detectedCount: pauses.length, longestSec: longest, minCuttableSec: 0.31 },
    gentle: { detectedCount: pauses.length, longestSec: longest, minCuttableSec: 0.6 },
  };

  return {
    durationSec: duration,
    frameCount: frames,
    floorDb: -52.4,
    speechDb: -17.8,
    overlap: false,
    scanTimingMs: { decode: 410, vad: 380, sharedSignals: 120, viterbi: 8, whisper: 900, wordSnap: 20, total: 1850 },
    segmentsByMode,
    pauseStatsByMode,
    pcm: new Uint8Array(0),
    rmsValues: rms,
    weightedRmsValues: rms,
    vadFlags: rms.map((v) => v > 400),
    vadReleaseFlags: null,
    sourceChannels: 2,
    // Words over every speech run, so the panel shows word-snap as on, as it
    // is with whisper.cpp present; their exact timing is not meaningful.
    words: speechRuns.flatMap((r) => {
      const out: { word: string; start: number; end: number }[] = [];
      for (let w = r.start; w + 0.2 < r.end; w += 0.32) out.push({ word: "word", start: w, end: Math.min(r.end, w + 0.28) });
      return out;
    }),
    segmentsByModeWordSnapped: null,
    wordSnapEnergyGate: 300,
    noiseFloorRms: 90,
    medianSnrDb: 24.1,
    gaussianSeparability: 0.84,
    noiseFraction: 0.21,
  };
};
