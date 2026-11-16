import { fs, path } from "./cep/node";
import { csi } from "./utils/bolt";
import { buildGeneratedFileName, getGeneratedAudioDir, getDocumentsDir } from "./genAudioDir";
import { writeGenerationMetadata } from "./generationMetadata";
import { phonemizeEnglish, phonemizeTierA, TIER_A_LOCALES } from "./espeakPhonemize";
import { tr } from "./i18n";

// Kokoro-82M (Apache-2.0, hexgrad/kokoro), the bundled offline engine — no API
// key, no internet. Runs through @huggingface/transformers directly
// (StyleTextToSpeech2Model + AutoTokenizer) on the same onnxruntime-web/WASM
// backend silero.ts uses, not onnxruntime-node's native binding (see below).
//
// Phonemization (text -> phonemes) uses the bundled espeak-ng binary
// (GPL-3.0-or-later, github.com/espeak-ng/espeak-ng) as a separate OS
// subprocess, like FFmpeg and whisper.cpp (see espeakPath.ts and
// espeakPhonemize.ts); it ships with its own license text and NOTICE entry.
// The subprocess also gives the multilingual voices (Spanish, French, Italian,
// Portuguese, Hindi) their phonemes. This file has its own small equivalents of
// kokoro-js's generate_from_ids (generateAudio) and voice loader
// (loadVoiceStyle), instead of kokoro-js's English-only voice registry and its
// `<dirname>/../voices/<id>.bin` path resolution.
//
// --- device selection: why this forces "wasm" although CEP looks like Node ---
// transformers.js's onnx backend picks a runtime from `apis.IS_NODE_ENV`
// (`process.release.name === 'node'`), which is true in this panel
// (`--enable-nodejs`), and then only registers onnxruntime-node ("cpu").
// That native addon can't load inside Premiere on macOS: Premiere's Hardened
// Runtime library validation refuses native code not signed with Adobe's (or
// Apple's) Team ID, and re-signing can't change that. A native Node addon is a
// dead end here.
//
// So `process.release.name` is made not equal "node" for the single moment
// transformers' env.js first evaluates (its `IS_NODE_ENV` is computed once and
// frozen; see the try/finally in loadTTS). transformers.js then takes its
// browser branch with the bundled onnxruntime-web; WASM is data, not native
// code, so code signing doesn't apply. Only the `release` field is patched, and
// it is restored right after the dynamic import resolves.
//
// @huggingface/transformers is imported dynamically inside loadTTS(): a static
// import would run the whole heavy chain at panel load, and any throw there
// would leave the entire panel blank. The dynamic import defers that to the
// first loadTTS() call (when the user picks "Kokoro (offline)" on the AI Voice
// tab) and rejects into the try/catch, so a failure shows Kokoro's error
// banner instead (the build emits it as a separate lazy chunk).

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export interface KokoroVoice {
  id: string;
  name: string;
  language: string;
  gender: string;
}

export interface GenerateVoiceResult {
  filePath: string;
  bytesWritten: number;
  warnings: string[];
}

// This module's top-level code can run a second time in the same window: it
// is part of the entry chunk, loaded once by a `<script src>` tag (never via
// `require()`), while the dynamically imported transformers chunk contains a
// plain `require("./main-<hash>.cjs")` (a Rollup code-splitting artifact),
// which finds no cache entry and re-executes the file. A module-level
// `let`/`const` would then reset, and a reset `ttsPromise` would load the model
// a second time (another ~90 MB WASM/ORT session). `window` survives the
// re-execution, so values that must not reset are parked there in an object
// wrapper. See `main/index-react.tsx` for how the visible effects (duplicate
// React root, duplicate CEP menu listeners) are suppressed.
export const persistentRef = <T>(key: string, initial: T): { value: T } => {
  const w = window as unknown as Record<string, { value: T } | undefined>;
  if (!w[key]) w[key] = { value: initial };
  return w[key] as { value: T };
};

// Mirrors whisper.ts's diagnosticState pattern — the panel's own
// Diagnostics dump has no other way to see *why* Kokoro failed to load
// (console.warn only reaches DevTools, not the saved report).
const diagnosticStateRef = persistentRef("__kokoroDiagnosticState", {
  loadAttempted: false,
  loaded: false,
  lastError: null as string | null,
});

export const getKokoroDiagnostics = () => ({ ...diagnosticStateRef.value });

const getKokoroAssetDir = (...segments: string[]): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "assets", "kokoro", ...segments);
};

/**
 * Bundled voice `.bin` files live in the extension root's `voices/` folder
 * (see cep.config.ts's copyAssets), resolved directly via csi.getSystemPath,
 * independent of where the bundled chunk ends up.
 */
const getKokoroVoicesDir = (): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "voices");
};

const describeLoadError = (e: any): string => (e && e.message) || String(e);

// A synchronous, append-as-you-go load log: if loading the model crashes the
// panel below where JavaScript errors are reported, `fs.appendFileSync` has
// already flushed each step reached, unlike console output or a return value.
// It lives in the same Documents/AI Voice Master Tool/Diagnostics/ folder as
// ppro.ts's runDiagnostics() report, and `drainKokoroDiagnosticLog()` folds it
// into that report on every "Run Diagnostics" click and removes it, so the
// user only ever sees one diagnostics file.
const diagnosticLogPath = (): string => {
  // getDocumentsDir(), not os.homedir()+"Documents": with OneDrive's "Known
  // Folder Move" active (Documents redirected under OneDrive), the naive join
  // points to a different physical folder than ExtendScript's
  // Folder.myDocuments (which the Diagnostics report uses), so
  // drainKokoroDiagnosticLog() below would read the wrong log and always
  // report "(no entries since last Diagnostics run)".
  const dir = path.join(getDocumentsDir(), "AI Voice Master Tool", "Diagnostics");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "kokoro-diagnostic.txt");
};

// The panel logs two lines here on every launch (index-react.tsx and this
// module's evaluation) and the file is removed only when Diagnostics runs, so
// it is capped: past LOG_MAX_BYTES only the newest LOG_KEEP_BYTES are kept
// (cut at a line start).
const LOG_MAX_BYTES = 64 * 1024;
const LOG_KEEP_BYTES = 32 * 1024;

export const logDiagnosticStep = (msg: string): void => {
  try {
    const p = diagnosticLogPath();
    if (fs.existsSync(p) && fs.statSync(p).size > LOG_MAX_BYTES) {
      const tail = fs.readFileSync(p, "utf8").slice(-LOG_KEEP_BYTES);
      fs.writeFileSync(p, tail.slice(tail.indexOf("\n") + 1));
    }
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) {
    // best effort — never let logging itself be a new failure point
  }
};

/**
 * Called once per "Run Diagnostics" click (see main.tsx's
 * buildJsDiagnosticsSummary): reads the load log accumulated since the
 * previous click, folds it into the report, then removes the file. Removed, not
 * emptied, so no unexplained empty file stays in the Diagnostics folder;
 * `logDiagnosticStep` recreates it the next time Kokoro logs a step.
 */
export const drainKokoroDiagnosticLog = (): string => {
  // diagnosticLogPath() can throw (fs.mkdirSync inside it: permissions, a full
  // disk, a OneDrive sync lock), so it is inside the try block: a failure here
  // must not fail the whole Diagnostics report.
  try {
    const p = diagnosticLogPath();
    if (!fs.existsSync(p)) return "(no entries since last Diagnostics run)";
    const content = fs.readFileSync(p, "utf8").trim();
    fs.unlinkSync(p);
    return content || "(no entries since last Diagnostics run)";
  } catch (e) {
    return `(could not read kokoro step log: ${e instanceof Error ? e.message : String(e)})`;
  }
};

// A memory snapshot (`process.memoryUsage()`) at boot and right after a load,
// so the log shows whether repeated panel reloads leave model sessions
// resident: a reload starts a new JS context while the old one can keep
// running its loadTTS() to completion, and each leftover session holds
// ~90 MB.
const memSnapshotMB = (): string => {
  try {
    const m = process.memoryUsage();
    const mb = (n: number) => Math.round(n / (1024 * 1024));
    return `rss=${mb(m.rss)}MB heapUsed=${mb(m.heapUsed)}MB external=${mb(m.external)}MB`;
  } catch (e) {
    return "unavailable";
  }
};

// Fires once per real script execution (see persistentRef above for why a
// panel boot can run this file's top-level code more than once). Keeps a boot
// counter and a memory snapshot for the diagnostics log.
const kokoroBootCount = (() => {
  const w = window as unknown as { __kokoroBootCount?: number };
  w.__kokoroBootCount = (w.__kokoroBootCount || 0) + 1;
  return w.__kokoroBootCount;
})();
logDiagnosticStep(`kokoro.ts: module evaluated (bootCount=${kokoroBootCount}), ${memSnapshotMB()}`);

// A non-throwing listener for unhandledRejection/uncaughtException: per
// Node's docs its presence suppresses the default fatal behaviour of either
// event, so an unhandled rejection anywhere can't silently take down the
// whole panel.
process.on("unhandledRejection", (reason: unknown) => {
  const detail = reason instanceof Error ? `${reason.name}: ${reason.message}\n${reason.stack}` : String(reason);
  logDiagnosticStep(`process: unhandledRejection caught (not fatal) — ${detail}`);
});
process.on("uncaughtException", (err: Error) => {
  logDiagnosticStep(`process: uncaughtException caught (not fatal) — ${err?.name}: ${err?.message}\n${err?.stack}`);
});

/**
 * English voices (American af_/am_, British bf_/bm_): a static copy of
 * Kokoro's voice list.
 */
const ENGLISH_VOICES: Record<string, { name: string; language: string; gender: string }> = {
  af_heart: { name: "Heart", language: "en-us", gender: "Female" },
  af_alloy: { name: "Alloy", language: "en-us", gender: "Female" },
  af_aoede: { name: "Aoede", language: "en-us", gender: "Female" },
  af_bella: { name: "Bella", language: "en-us", gender: "Female" },
  af_jessica: { name: "Jessica", language: "en-us", gender: "Female" },
  af_kore: { name: "Kore", language: "en-us", gender: "Female" },
  af_nicole: { name: "Nicole", language: "en-us", gender: "Female" },
  af_nova: { name: "Nova", language: "en-us", gender: "Female" },
  af_river: { name: "River", language: "en-us", gender: "Female" },
  af_sarah: { name: "Sarah", language: "en-us", gender: "Female" },
  af_sky: { name: "Sky", language: "en-us", gender: "Female" },
  am_adam: { name: "Adam", language: "en-us", gender: "Male" },
  am_echo: { name: "Echo", language: "en-us", gender: "Male" },
  am_eric: { name: "Eric", language: "en-us", gender: "Male" },
  am_fenrir: { name: "Fenrir", language: "en-us", gender: "Male" },
  am_liam: { name: "Liam", language: "en-us", gender: "Male" },
  am_michael: { name: "Michael", language: "en-us", gender: "Male" },
  am_onyx: { name: "Onyx", language: "en-us", gender: "Male" },
  am_puck: { name: "Puck", language: "en-us", gender: "Male" },
  am_santa: { name: "Santa", language: "en-us", gender: "Male" },
  bf_emma: { name: "Emma", language: "en-gb", gender: "Female" },
  bf_isabella: { name: "Isabella", language: "en-gb", gender: "Female" },
  bm_george: { name: "George", language: "en-gb", gender: "Male" },
  bm_lewis: { name: "Lewis", language: "en-gb", gender: "Male" },
  bf_alice: { name: "Alice", language: "en-gb", gender: "Female" },
  bf_lily: { name: "Lily", language: "en-gb", gender: "Female" },
  bm_daniel: { name: "Daniel", language: "en-gb", gender: "Male" },
  bm_fable: { name: "Fable", language: "en-gb", gender: "Male" },
};

/**
 * Multilingual voices (Spanish, French, Hindi, Italian, Brazilian
 * Portuguese): the languages espeak-ng phonemizes well enough for Kokoro.
 * Names and genders from Kokoro's VOICES.md
 * (huggingface.co/hexgrad/Kokoro-82M). Phonemization for all of them goes
 * through phonemizeForVoice's prefix dispatch (see TIER_A_LOCALES in
 * espeakPhonemize.ts); this registry adds their display metadata for the
 * voice picker. Japanese (jf_/jm_) and Mandarin (zf_/zm_) voice files also
 * ship in voices/ but are not exposed: eSpeak's generic ja/cmn support can't
 * phonemize raw kanji/hanzi without a dedicated analyzer in front of it
 * (pyopenjtalk for Japanese, hanzi->pinyin for Mandarin).
 */
const TIER_A_VOICES: Record<string, { name: string; language: string; gender: string }> = {
  ef_dora: { name: "Dora", language: "es", gender: "Female" },
  em_alex: { name: "Alex", language: "es", gender: "Male" },
  em_santa: { name: "Santa", language: "es", gender: "Male" },
  ff_siwis: { name: "Siwis", language: "fr", gender: "Female" },
  hf_alpha: { name: "Alpha", language: "hi", gender: "Female" },
  hf_beta: { name: "Beta", language: "hi", gender: "Female" },
  hm_omega: { name: "Omega", language: "hi", gender: "Male" },
  hm_psi: { name: "Psi", language: "hi", gender: "Male" },
  if_sara: { name: "Sara", language: "it", gender: "Female" },
  im_nicola: { name: "Nicola", language: "it", gender: "Male" },
  pf_dora: { name: "Dora", language: "pt-br", gender: "Female" },
  pm_alex: { name: "Alex", language: "pt-br", gender: "Male" },
  pm_santa: { name: "Santa", language: "pt-br", gender: "Male" },
};

const ALL_VOICES: Record<string, { name: string; language: string; gender: string }> = {
  ...ENGLISH_VOICES,
  ...TIER_A_VOICES,
};

const voiceStyleCache = new Map<string, Float32Array>();

/** Reads a bundled voice's style-embedding `.bin` file — same idea as
 *  kokoro-js's own internal voice loader, but resolved via
 *  getKokoroVoicesDir() (csi.getSystemPath-based, reliable regardless of
 *  where any bundled JS chunk ends up) instead of a `__dirname`-relative
 *  guess, and with no huggingface.co network-fetch fallback (this product
 *  is offline-only for Kokoro; a missing local file should fail loudly,
 *  not silently try the network). */
const loadVoiceStyle = async (voiceId: string): Promise<Float32Array> => {
  const cached = voiceStyleCache.get(voiceId);
  if (cached) return cached;
  const binPath = path.join(getKokoroVoicesDir(), `${voiceId}.bin`);
  const buf = fs.readFileSync(binPath);
  const style = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / Float32Array.BYTES_PER_ELEMENT);
  voiceStyleCache.set(voiceId, style);
  return style;
};

interface LoadedKokoro {
  model: any;
  tokenizer: any;
}

// Both refs on `window` (see persistentRef's own comment above) for the
// same reload-survival reason.
const ttsPromiseRef = persistentRef<Promise<LoadedKokoro | null> | null>("__kokoroTTSPromise", null);
const loadTTSEntryCountRef = persistentRef("__kokoroLoadTTSEntryCount", 0);

const loadTTS = (): Promise<LoadedKokoro | null> => {
  if (ttsPromiseRef.value) {
    logDiagnosticStep(
      `loadTTS: called again while already in-flight/cached (entry #${loadTTSEntryCountRef.value}, returning existing promise)`,
    );
    return ttsPromiseRef.value;
  }
  loadTTSEntryCountRef.value++;
  diagnosticStateRef.value.loadAttempted = true;
  logDiagnosticStep(`loadTTS: start (entry #${loadTTSEntryCountRef.value})`);
  ttsPromiseRef.value = (async () => {
    // See this file's top comment: makes transformers.js's onnx backend treat this
    // as a non-Node (browser/WASM) environment for the moment its env.js first
    // evaluates and freezes IS_NODE_ENV. `process.release` is a frozen object in
    // CEP's embedded Node (assigning `process.release.name` throws), so the whole
    // `release` property slot is replaced with defineProperty; the slot itself
    // stays configurable. In try/catch: if even this fails, loading proceeds and
    // fails no worse than without the patch.
    let releasePatched = false;
    let originalRelease: any;
    if (typeof process !== "undefined") {
      originalRelease = process.release;
      try {
        Object.defineProperty(process, "release", {
          value: { name: "browser" },
          configurable: true,
          writable: true,
        });
        releasePatched = true;
      } catch (e) {
        console.warn("[kokoro] could not override process.release, proceeding anyway:", e);
      }
    }
    logDiagnosticStep(`loadTTS: process.release patched=${releasePatched}`);
    try {
      const modelDir = getKokoroAssetDir();
      const configPath = path.join(modelDir, MODEL_ID, "config.json");
      if (!fs.existsSync(configPath)) {
        diagnosticStateRef.value.lastError = `bundled model files missing at ${configPath}`;
        console.warn("[kokoro]", diagnosticStateRef.value.lastError);
        logDiagnosticStep(`loadTTS: ABORT — ${diagnosticStateRef.value.lastError}`);
        return null;
      }
      logDiagnosticStep(`loadTTS: bundled config found at ${configPath}`);

      // Dynamic import, deliberately; see this file's top comment.
      logDiagnosticStep("loadTTS: starting dynamic import of @huggingface/transformers");
      const { StyleTextToSpeech2Model, AutoTokenizer, env: hfEnv } = await import("@huggingface/transformers");
      logDiagnosticStep("loadTTS: dynamic import of @huggingface/transformers resolved OK");

      if (releasePatched) {
        try {
          Object.defineProperty(process, "release", { value: originalRelease, configurable: true, writable: true });
          // Cleared only after a successful restore (inside the `try`), so the
          // `finally` block below doesn't repeat the same defineProperty on `process`
          // right after a ~90 MB session was allocated, while a failed attempt still
          // falls through to the `finally` retry.
          releasePatched = false;
        } catch (e) {
          // best effort — see the finally block below for the guaranteed restore
        }
      }

      // Force fully-local, fully-offline loading — by default transformers.js
      // fetches from Hugging Face Hub and caches to a relative ./.cache/
      // directory, neither of which is acceptable here (no internet, and no
      // surprise writes into what may be a read-only install location once
      // packaged). allowLocalModels defaults to false when a `window` object
      // is present (it assumes browser = no local fs) — must be forced on
      // even though we do have real fs access here via CEP's Node integration.
      hfEnv.allowRemoteModels = false;
      hfEnv.allowLocalModels = true;
      hfEnv.localModelPath = modelDir;
      hfEnv.useFSCache = false;
      hfEnv.useBrowserCache = false;
      hfEnv.useCustomCache = false;

      // Same WASM settings silero.ts already uses (numThreads=1, proxy=false)
      // — multi-threaded WASM needs SharedArrayBuffer/cross-origin isolation
      // this CEP panel doesn't set up.
      try {
        (hfEnv.backends.onnx.wasm as any).numThreads = 1;
        (hfEnv.backends.onnx.wasm as any).proxy = false;
        // Sets transformers.js's env.wasmPaths directly.
        (hfEnv.backends.onnx.wasm as any).wasmPaths = getKokoroAssetDir("wasm") + path.sep;
      } catch (e) {
        // checked right below
      }
      // Fail closed: Transformers.js defaults wasmPaths to a CDN (cdn.jsdelivr.net)
      // when it is unset, so if setting it above failed, loading would quietly
      // download the runtime from the internet. Refuse instead (the network guard
      // would block that request anyway).
      if ((hfEnv.backends.onnx.wasm as any)?.wasmPaths !== getKokoroAssetDir("wasm") + path.sep || hfEnv.allowRemoteModels !== false) {
        throw new Error("Kokoro could not be set up to use its bundled files only, so it was not loaded.");
      }
      logDiagnosticStep(`loadTTS: env configured, wasmPaths=${(hfEnv.backends.onnx.wasm as any).wasmPaths}`);

      // `enableCpuMemArena`/`enableMemPattern` off and graph optimization disabled
      // trade a little inference speed for a smaller, more incremental memory
      // footprint while ORT creates the session for this ~92 MB graph, the step
      // where a renderer can run out of memory and crash below any try/catch.
      // No `progress_callback`: with one, transformers' hub.js reads the file through
      // `fs.createReadStream()` in 64 KB chunks (~1440 round trips for the onnx file,
      // most of the load time) instead of one `arrayBuffer()` read; the panel shows no
      // load progress anyway.
      logDiagnosticStep(
        "loadTTS: calling StyleTextToSpeech2Model.from_pretrained/AutoTokenizer.from_pretrained (ONNX Runtime session creation) ...",
      );
      const [model, tokenizer] = await Promise.all([
        StyleTextToSpeech2Model.from_pretrained(MODEL_ID, {
          dtype: "q8",
          device: "wasm",
          session_options: {
            graphOptimizationLevel: "disabled",
            enableCpuMemArena: false,
            enableMemPattern: false,
          },
        } as any),
        AutoTokenizer.from_pretrained(MODEL_ID, {}),
      ]);
      logDiagnosticStep(`loadTTS: from_pretrained RESOLVED — model loaded successfully, ${memSnapshotMB()}`);
      diagnosticStateRef.value.loaded = true;
      return { model, tokenizer };
    } catch (e) {
      diagnosticStateRef.value.lastError = describeLoadError(e);
      logDiagnosticStep(`loadTTS: CAUGHT error — ${diagnosticStateRef.value.lastError}`);
      console.warn("[kokoro] failed to load model:", e);
      return null;
    } finally {
      if (releasePatched) {
        try {
          Object.defineProperty(process, "release", { value: originalRelease, configurable: true, writable: true });
        } catch (e) {
          // nothing more to do — the process-wide release object may be
          // stuck patched for the rest of this session; not fatal, just a
          // cosmetic inaccuracy in anything else that reads it
        }
      }
    }
  })();
  // This promise never rejects: every failure path above resolves to `null`
  // (see the try/catch just above and the early `return null` for a missing
  // config file). A resolved promise is still truthy, so the
  // `if (ttsPromiseRef.value)` guard at the top would treat a failed load as
  // cached; clearing the ref on a `null` result (never on success) lets the
  // next call (Retry, a fresh voice-list load, Generate) start a fresh
  // attempt.
  ttsPromiseRef.value.then((result) => {
    if (result === null) ttsPromiseRef.value = null;
  });
  return ttsPromiseRef.value;
};

/**
 * English and multilingual voices (see ALL_VOICES above). Calls loadTTS()
 * first, so the panel's "Loading model…" state still covers the model load,
 * although the list itself is a static registry.
 */
export const listKokoroVoices = async (): Promise<KokoroVoice[]> => {
  logDiagnosticStep("listKokoroVoices: calling loadTTS()");
  const tts = await loadTTS();
  logDiagnosticStep(`listKokoroVoices: loadTTS() returned (tts=${tts ? "loaded" : "null"})`);
  if (!tts) return [];
  const result = Object.keys(ALL_VOICES).map((id) => ({ id, ...ALL_VOICES[id] }));
  logDiagnosticStep(`listKokoroVoices: returning ${result.length} voices (English + multilingual)`);
  return result;
};

/** Phonemizes `text` for the given Kokoro voice id, dispatching on its
 *  language-code prefix (full table: TIER_A_LOCALES in espeakPhonemize.ts):
 *  "a"/"b" -> English (American/British respectively,
 *  via phonemizeEnglish); any multilingual prefix listed in TIER_A_LOCALES
 *  -> the matching espeak-ng locale (via phonemizeTierA). Voice ids not matching
 *  either are rejected rather than guessed at. */
const phonemizeForVoice = async (text: string, voiceId: string): Promise<string> => {
  const prefix = voiceId.charAt(0);
  if (prefix === "a") return phonemizeEnglish(text, true);
  if (prefix === "b") return phonemizeEnglish(text, false);
  if (TIER_A_LOCALES[prefix]) return phonemizeTierA(text, prefix);
  throw new Error(`Unrecognized voice id "${voiceId}" — no phonemization path for language prefix "${prefix}".`);
};

/** Runs the model on already-tokenized input_ids — same math as kokoro-js's
 *  own generate_from_ids: slice the voice's style-embedding by however many
 *  real tokens are present (256 floats per token position, offset by 2 for
 *  the tokenizer's own start/end tokens, capped so very long inputs don't
 *  walk off the end of the 510-entry style table), feed
 *  {input_ids, style, speed} to the model, wrap the resulting waveform. */
const generateAudio = async (
  loaded: LoadedKokoro,
  inputIds: any,
  voiceId: string,
  speed: number,
): Promise<{ toWav: () => ArrayBuffer }> => {
  const { Tensor, RawAudio } = await import("@huggingface/transformers");
  const numTokens = inputIds.dims.at(-1) - 2;
  const offset = 256 * Math.min(Math.max(numTokens, 0), 509);
  const fullStyle = await loadVoiceStyle(voiceId);
  const style = fullStyle.slice(offset, offset + 256);
  const inputs = {
    input_ids: inputIds,
    style: new Tensor("float32", style, [1, 256]),
    speed: new Tensor("float32", [speed], [1]),
  };
  const { waveform } = await loaded.model(inputs);
  return new RawAudio(waveform.data, 24000) as any;
};

/** The bundled tokenizer's model_max_length: the longest token sequence Kokoro
 *  takes in one pass. With `truncation: true` anything past it is cut off. */
const KOKORO_MAX_TOKENS = 512;
/** Longest text generated in one pass; anything longer is split into chunks
 *  of at most this size. Well below KOKORO_MAX_TOKENS on purpose: Kokoro's
 *  last words get quieter as one pass nears the limit (hexgrad/kokoro#249
 *  measured a median 86% level for the final word at 452 tokens, and a
 *  split into pieces of about 320 brought it back to normal). */
const KOKORO_CHUNK_TOKENS = 300;
/** Silence put between two generated chunks, in seconds. */
const KOKORO_CHUNK_GAP_SEC = 0.12;
const KOKORO_SAMPLE_RATE = 24000;

const tokenCount = (tts: LoadedKokoro, phonemes: string): number => {
  const { input_ids } = tts.tokenizer(phonemes, { truncation: false });
  return input_ids.dims.at(-1);
};

/** Splits text into sentences, keeping each one's closing punctuation; a line
 *  break also ends a sentence. */
const splitIntoSentences = (text: string): string[] => {
  const sentences: string[] = [];
  let current = "";
  const normalized = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charAt(i);
    if (ch === "\n") {
      if (current.trim()) sentences.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
    const next = normalized.charAt(i + 1);
    if (".!?…。！？".indexOf(ch) !== -1 && (next === "" || /\s/.test(next))) {
      sentences.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) sentences.push(current.trim());
  return sentences;
};

/** Splits one over-long sentence at clause marks, then between words, into
 *  pieces that each fit KOKORO_CHUNK_TOKENS once phonemized. */
const splitLongSentence = async (tts: LoadedKokoro, sentence: string, voiceId: string): Promise<string[]> => {
  // split() with a capture group returns [text, mark, text, mark, ...].
  const rawClauses = sentence.split(/([,;:—–])\s+/);
  const clauses: string[] = [];
  for (let i = 0; i < rawClauses.length; i += 2) {
    const clause = rawClauses[i] + (rawClauses[i + 1] || "");
    if (clause.trim()) clauses.push(clause);
  }
  const pieces: string[] = [];
  for (const clause of clauses) {
    if (tokenCount(tts, await phonemizeForVoice(clause, voiceId)) <= KOKORO_CHUNK_TOKENS) {
      pieces.push(clause);
      continue;
    }
    let group = "";
    for (const word of clause.split(/\s+/)) {
      const candidate = group ? `${group} ${word}` : word;
      if (group && tokenCount(tts, await phonemizeForVoice(candidate, voiceId)) > KOKORO_CHUNK_TOKENS) {
        pieces.push(group);
        group = word;
      } else {
        group = candidate;
      }
    }
    if (group) pieces.push(group);
  }
  return pieces;
};

/** Phonemized chunks of `text`, each under KOKORO_CHUNK_TOKENS: whole sentences
 *  merged while they fit, an over-long sentence split further. */
const buildPhonemeChunks = async (tts: LoadedKokoro, text: string, voiceId: string): Promise<string[]> => {
  const units: string[] = [];
  for (const sentence of splitIntoSentences(text)) {
    const phonemes = await phonemizeForVoice(sentence, voiceId);
    if (tokenCount(tts, phonemes) <= KOKORO_CHUNK_TOKENS) {
      units.push(phonemes);
    } else {
      for (const piece of await splitLongSentence(tts, sentence, voiceId)) units.push(await phonemizeForVoice(piece, voiceId));
    }
  }
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    const candidate = current ? `${current} ${unit}` : unit;
    if (current && tokenCount(tts, candidate) > KOKORO_CHUNK_TOKENS) {
      chunks.push(current);
      current = unit;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
};

/** A take's highest allowed peak: -1 dBFS. */
const KOKORO_PEAK_LIMIT = Math.pow(10, -1 / 20);

/**
 * Some Kokoro voices (Adam, Fenrir, Puck) peak at about 0 dBFS, which can clip
 * once the file is converted or an effect raises it. A take whose peak is above
 * -1 dBFS is scaled down to exactly -1 dBFS; quieter takes are returned as they
 * are.
 */
const limitPeak = (samples: Float32Array): Float32Array => {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  if (peak <= KOKORO_PEAK_LIMIT) return samples;
  const k = KOKORO_PEAK_LIMIT / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * k;
  return out;
};

/**
 * Generates speech fully offline and writes it to a new WAV file under
 * Documents/AI Voice Master Tool/Generated/ (like elevenlabs.ts's
 * generateSpeech), so importAudioAndPlaceOnTimeline can pick it up by path.
 *
 * Doesn't use RawAudio's `.save(path)`: it picks its write strategy from
 * transformers' `apis.IS_BROWSER_ENV`, which is true in this panel (a real
 * `window`/`document` exist) despite the "wasm" patch above. `toWav()` just
 * encodes the samples; the bytes are written with `fs` as everywhere else.
 */
export const generateSpeech = async (
  text: string,
  voiceId: string,
  voiceName: string,
  projectFolderPath?: string | null,
): Promise<GenerateVoiceResult> => {
  const tts = await loadTTS();
  if (!tts) {
    throw new Error(
      `Kokoro model failed to load${diagnosticStateRef.value.lastError ? `: ${diagnosticStateRef.value.lastError}` : ""}. Check Diagnostics, and that the plugin installed correctly.`,
    );
  }
  const phonemes = await phonemizeForVoice(text, voiceId);
  const warnings: string[] = [];
  let wav: ArrayBuffer;
  const { RawAudio } = await import("@huggingface/transformers");
  if (tokenCount(tts, phonemes) <= KOKORO_CHUNK_TOKENS) {
    const { input_ids } = tts.tokenizer(phonemes, { truncation: true });
    const audio: any = await generateAudio(tts, input_ids, voiceId, 1);
    wav = new RawAudio(limitPeak(audio.audio as Float32Array), audio.sampling_rate || KOKORO_SAMPLE_RATE).toWav();
  } else {
    // Longer than KOKORO_CHUNK_TOKENS (about 18 seconds of speech): one pass
    // would fade at the end, and past KOKORO_MAX_TOKENS the tokenizer would
    // cut the rest off. Generate sentence chunks and join them, with a short
    // pause between.
    const chunks = await buildPhonemeChunks(tts, text, voiceId);
    const parts: Float32Array[] = [];
    const gap = new Float32Array(Math.round(KOKORO_CHUNK_GAP_SEC * KOKORO_SAMPLE_RATE));
    let total = 0;
    for (let i = 0; i < chunks.length; i++) {
      const { input_ids } = tts.tokenizer(chunks[i], { truncation: true });
      const audio: any = await generateAudio(tts, input_ids, voiceId, 1);
      if (i > 0) {
        parts.push(gap);
        total += gap.length;
      }
      parts.push(audio.audio as Float32Array);
      total += (audio.audio as Float32Array).length;
    }
    const joined = new Float32Array(total);
    let offset = 0;
    for (const part of parts) {
      joined.set(part, offset);
      offset += part.length;
    }
    wav = new RawAudio(limitPeak(joined), KOKORO_SAMPLE_RATE).toWav();
    warnings.push(
      tr("The text was too long for one Kokoro pass, so it was generated in {count} parts and joined into one file. Listen to the joins.", {
        count: String(chunks.length),
      }),
    );
  }

  const dir = getGeneratedAudioDir(projectFolderPath);
  const filePath = path.join(dir, buildGeneratedFileName("kokoro", voiceName, text, "wav"));
  fs.writeFileSync(filePath, Buffer.from(wav));
  const bytesWritten = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  writeGenerationMetadata(filePath, { engine: "kokoro", text, voiceId, voiceName });

  return { filePath, bytesWritten, warnings };
};
