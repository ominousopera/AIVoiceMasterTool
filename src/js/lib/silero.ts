import * as ort from "onnxruntime-web";
import { fs, path } from "./cep/node";
import { csi } from "./utils/bolt";

// Silero VAD (MIT-licensed, https://github.com/snakers4/silero-vad), run
// locally via ONNX Runtime Web's WASM backend — no native addon (avoids any
// Node-ABI mismatch risk inside CEP's embedded Node), no network calls,
// single cross-platform .wasm file (no per-OS binaries).
//
// It supplies a real speech-activity flag to combine with RMS energy; without
// it the pipeline approximates one with k-means clustering. If the model or
// runtime can't load for any reason, computeVadProbs resolves to null and
// analyze.ts falls back to that energy-only approach automatically — this is
// never allowed to break Scan.

const NATIVE_SAMPLE_RATE = 16000;
const WINDOW_SAMPLES = 512; // Silero's fixed 16kHz window
const CONTEXT_SAMPLES = 64; // carried over from the previous window
const WINDOW_SEC = WINDOW_SAMPLES / NATIVE_SAMPLE_RATE; // 32ms

/**
 * Centred max-filter: `out[i] = max(probs[i-radius .. i+radius])` (radius in
 * analyze.ts's 30 ms frames). A max, never a mean, so it only pulls a frame's
 * probability up to match a confident neighbour and never dilutes a confident
 * frame — the same "can only rescue" contract as the other safety nets.
 * Wider radii start merging segments for reasons other than real word splits,
 * so the radius is the caller's choice: scanAudioFile uses
 * ADVANCED_VAD_SMOOTH_RADIUS for the Advanced path, and the presets take the
 * raw track. computeVadProbs returns the raw track.
 */
export const smoothVadProbs = (probs: number[], radius: number): number[] => {
  if (radius <= 0) return probs;
  const out = new Array(probs.length);
  for (let i = 0; i < probs.length; i++) {
    let m = probs[i];
    for (let d = 1; d <= radius; d++) {
      if (i - d >= 0 && probs[i - d] > m) m = probs[i - d];
      if (i + d < probs.length && probs[i + d] > m) m = probs[i + d];
    }
    out[i] = m;
  }
  return out;
};

let sessionPromise: Promise<ort.InferenceSession | null> | null = null;

// Mirrors whisper.ts's diagnosticState: the reason Silero didn't load (or
// "loaded") goes into the Diagnostics report, since a console warning is
// invisible in the shipped panel.
const diagnosticState = {
  loadAttempted: false,
  loaded: false,
  lastError: null as string | null,
};

export const getSileroDiagnostics = () => ({ ...diagnosticState });

const getAssetPath = (...segments: string[]): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "assets", "silero", ...segments);
};

/**
 * Runs one load step and labels any failure with the step's name, so a
 * Diagnostics report pins the exact failing call even when the minified bundle
 * only says "(void 0) is not a function". Awaits `fn()` inside the try, so an
 * async rejection (e.g. `InferenceSession.create` failing during fetch or
 * compile) is caught and labeled too, not just a synchronous throw.
 */
const step = async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    diagnosticState.lastError = `step=${label}: ${detail}`;
    throw e;
  }
};

/**
 * The CEP panel runs with real Node globals (`process`/`require`/`module`/
 * `global`) injected into the renderer (`--enable-nodejs`, mixed context; see
 * `cep/node.ts`). `onnxruntime-web`'s browser bundle checks `typeof process !==
 * 'undefined'` to detect Node and then takes its Node-specific wasm-loading
 * branch, which assumes `__dirname` — a per-module local that Node's
 * `require()` wrapper injects and a `<script>`-loaded bundle never has. Session
 * creation then fails ("__dirname is not defined", or a minified "(void 0) is
 * not a function"). Hiding those globals around only the `create()` call
 * restores the browser/fetch path.
 *
 * Safe for this one call: `cep/node.ts`'s `require(...)` calls all run once, at
 * module evaluation, long before any Scan, and nothing else calls `require()`
 * at arbitrary moments. Restored in `finally` whatever happens, since fs and
 * child_process depend on them.
 */
const createSessionWithoutNodeDetection = async (modelPath: string): Promise<ort.InferenceSession> => {
  const w = window as unknown as Record<string, unknown>;
  const hidden: Record<string, unknown> = {};
  for (const key of ["process", "require", "module", "global"]) {
    if (key in w) {
      hidden[key] = w[key];
      delete w[key];
    }
  }
  try {
    return await ort.InferenceSession.create(modelPath, { executionProviders: ["wasm"] });
  } finally {
    for (const key of Object.keys(hidden)) w[key] = hidden[key];
  }
};

const loadSession = (): Promise<ort.InferenceSession | null> => {
  if (sessionPromise) return sessionPromise;
  sessionPromise = (async () => {
    diagnosticState.loadAttempted = true;
    try {
      const modelPath = await step("getAssetPath(model)", () => getAssetPath("silero_vad_16k.onnx"));
      const wasmDir = await step("getAssetPath(wasmDir)", () => getAssetPath() + path.sep);
      const exists = await step("fs.existsSync", () => fs.existsSync(modelPath));
      if (!exists) {
        diagnosticState.lastError = `model file missing: ${modelPath}`;
        console.warn("[silero] model file missing, falling back to energy-only VAD:", modelPath);
        return null;
      }
      await step("ort.env.wasm setup", () => {
        ort.env.wasm.wasmPaths = wasmDir;
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
        ort.env.wasm.proxy = false;
      });
      const session = await step("ort.InferenceSession.create", () => createSessionWithoutNodeDetection(modelPath));
      diagnosticState.loaded = true;
      return session;
    } catch (e) {
      // `step` already set a labeled `lastError` for anything that went
      // through it — only fall back to an unlabeled message here if
      // somehow nothing did (defensive, shouldn't normally happen).
      if (!diagnosticState.lastError) {
        diagnosticState.lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      }
      console.warn("[silero] failed to load model, falling back to energy-only VAD:", e);
      return null;
    }
  })();
  return sessionPromise;
};

/**
 * Runs Silero VAD over raw PCM (mono, 16-bit signed LE, NATIVE_SAMPLE_RATE)
 * and returns the raw per-`frameMs`-frame speech probability (0-1, on
 * analyze.ts's RMS frame grid) — the expensive part (the neural net). Returns
 * null if the model or runtime is unavailable; callers treat that as "no VAD
 * signal" and fall back.
 *
 * Separate from thresholding (see vadFlagsFromProbs) so scanAudioFile can run
 * inference once, feed the raw probabilities to the presets' LLR fusion, and
 * still derive the Advanced path's attack and release flag arrays from the
 * same track.
 */
export const computeVadProbs = async (pcm: Buffer, frameMs: number, sampleRate: number): Promise<number[] | null> => {
  if (sampleRate !== NATIVE_SAMPLE_RATE) {
    console.warn(`[silero] expected ${NATIVE_SAMPLE_RATE}Hz input, got ${sampleRate}Hz — skipping`);
    return null;
  }

  const session = await loadSession();
  if (!session) return null;

  try {
    const numSamples = Math.floor(pcm.length / 2);
    // Shorter than one model window: no probability at all, so the caller's
    // energy-only fallback applies (an empty track would read as `undefined`).
    if (numSamples < WINDOW_SAMPLES) return null;
    const samples = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) samples[i] = pcm.readInt16LE(i * 2) / 32768;

    let state = new Float32Array(2 * 1 * 128);
    let context = new Float32Array(CONTEXT_SAMPLES);
    const windowProbs: number[] = [];

    let i = 0;
    while (i + WINDOW_SAMPLES <= numSamples) {
      const chunk = samples.subarray(i, i + WINDOW_SAMPLES);
      const inputArr = new Float32Array(CONTEXT_SAMPLES + WINDOW_SAMPLES);
      inputArr.set(context, 0);
      inputArr.set(chunk, CONTEXT_SAMPLES);

      const feeds = {
        input: new ort.Tensor("float32", inputArr, [1, CONTEXT_SAMPLES + WINDOW_SAMPLES]),
        state: new ort.Tensor("float32", state, [2, 1, 128]),
        sr: new ort.Tensor("int64", BigInt64Array.from([BigInt(NATIVE_SAMPLE_RATE)]), []),
      };
      const outputs = await session.run(feeds);
      windowProbs.push(outputs.output.data[0] as number);
      state = Float32Array.from(outputs.stateN.data as ArrayLike<number>);
      context = Float32Array.from(inputArr.subarray(inputArr.length - CONTEXT_SAMPLES));
      i += WINDOW_SAMPLES;
    }

    // Resample the 32 ms native probability track onto the frameMs (30 ms) grid by
    // nearest-window lookup. Linear interpolation between neighbouring windows is
    // a weighted average that can pull a value down, breaking the max-filter's
    // "can only rescue" contract. Nearest-window lookup aliases against the
    // max-filter only at radius 2, so radius 2 is avoided
    // (ADVANCED_VAD_SMOOTH_RADIUS is 1).
    const frameSec = frameMs / 1000;
    const totalFrames = Math.floor(numSamples / (sampleRate * frameSec));
    const lastIdx = windowProbs.length - 1;
    const probs: number[] = new Array(totalFrames);
    for (let f = 0; f < totalFrames; f++) {
      const tSec = f * frameSec;
      const windowIdx = Math.min(lastIdx, Math.round(tSec / WINDOW_SEC));
      probs[f] = windowProbs[windowIdx];
    }
    return probs; // raw, unsmoothed — see smoothVadProbs (applied by the caller for the Advanced path only)
  } catch (e) {
    diagnosticState.lastError = e instanceof Error ? `inference: ${e.name}: ${e.message}` : `inference: ${String(e)}`;
    console.warn("[silero] inference failed, falling back to energy-only VAD:", e);
    return null;
  }
};

/** Thresholds raw per-frame speech probabilities (from computeVadProbs)
 *  into a boolean flag array — cheap, so it is fine to call once per
 *  threshold (scanAudioFile derives attack and release flags) rather than
 *  re-running inference. */
export const vadFlagsFromProbs = (probs: number[], threshold: number): boolean[] => probs.map((p) => p > threshold);
