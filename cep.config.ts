import type { CEP_Config } from "vite-cep-plugin";
import { version } from "./package.json";

// Never read `process.env` (or anything else Node-only) at this file's top
// level: `shared/shared.ts` imports this whole module by value (for `ns`
// etc.), and shared.ts is imported by the ExtendScript entry point too, so
// this file's top-level code ships inside the ExtendScript bundle, where
// `process` doesn't exist. Rollup can tree-shake a `process.env`-based const
// down to a bare, still-executed `process.env...` statement, which throws on
// every ExtendScript load before `host[ns]` is set and silently breaks every
// evalTS call. So jsxBin stays a static "off" below; `vite.config.ts` (never
// ExtendScript-reachable) overwrites `cepConfig.build.jsxBin`/
// `cepConfig.zxp.jsxBin` after import.

const config: CEP_Config = {
  version,
  // The Extension Bundle ID: the install-folder identity Adobe uses to tell
  // "an upgrade of the same extension" from "a different extension". Changing
  // it after real installs exist orphans them (old and new coexisting as two
  // Window > Extensions entries), so treat the display name and this ID as
  // independent decisions.
  id: "com.aivoicemastertool.pro",
  displayName: "AI Voice Master Tool",
  symlink: "local",
  port: 3000,
  servePort: 5000,
  startingDebugPort: 8860,
  extensionManifestVersion: 6.0,
  requiredRuntimeVersion: 9.0,
  // Premiere Pro 2025 (25.0) is the first with CEP 12 (Chromium 99): the panel's
  // ONNX models need WebAssembly SIMD (Chromium 91+), and its code uses
  // Array.prototype.at, Object.hasOwn and structuredClone (Chromium 92-98).
  // CEP 11 in Premiere 2021-2024 has Chromium 88. The After Effects Bridge
  // uses none of these, but it also requires After Effects 2025 (25.0), so
  // both hosts have the same minimum.
  hosts: [
    { name: "PPRO", version: "[25.0,99.9]" },
    { name: "AEFT", version: "[25.0,99.9]" },
  ],

  type: "Panel",
  iconDarkNormal: "./assets/light-icon.png",
  iconNormal: "./assets/dark-icon.png",
  iconDarkNormalRollOver: "./assets/light-icon.png",
  iconNormalRollOver: "./assets/dark-icon.png",
  parameters: ["--v=0", "--enable-nodejs", "--mixed-context"],
  width: 500,
  height: 550,

  panels: [
    {
      mainPath: "./main/index.html",
      name: "main",
      panelDisplayName: "AI Voice Master Tool",
      autoVisible: true,
      // Premiere only: this panel's UI and logic use Premiere's Sequence/QE DOM.
      host: "PPRO",
      width: 600,
      height: 650,
      // Panel is fully responsive (flex/percentage layout, canvas resize
      // observer on the waveform) — min just keeps controls from crushing
      // into each other at absurd sizes; no max, so it can grow freely when
      // docked wide/tall.
      minWidth: 320,
      minHeight: 380,
    },
    {
      mainPath: "./bridge/index.html",
      name: "bridge",
      panelDisplayName: "AI Voice Master Tool Bridge",
      autoVisible: true,
      // Scoped to After Effects only — the receiving half of "Send to After
      // Effects" (see the main panel's Send to AE tab / ppro.ts's
      // sendToAfterEffects, and src/jsx/aeft/aeft.ts).
      host: "AEFT",
      width: 340,
      height: 220,
      minWidth: 280,
      minHeight: 160,
    },
  ],
  build: {
    // Static default — see this file's top comment. vite.config.ts
    // conditionally overwrites this after import, never here.
    jsxBin: "off",
    sourceMap: true,
  },
  zxp: {
    // The throwaway self-signed certificate vite-cep-plugin makes on every
    // package build. It passes these values to ZXPSignCmd without quotes, so
    // none of them may contain a space. scripts/release.mjs can sign the
    // release packages with a certificate of your own instead (ZXP_CERT).
    country: "US",
    province: "CA",
    org: "AIVoiceMasterTool",
    password: "password",
    // Tried in this order on every platform until one signs (vite-cep-plugin's signZXP).
    tsa: ["http://timestamp.digicert.com/", "http://timestamp.apple.com/ts01"],
    allowSkipTSA: false,
    sourceMap: false,
    // Static default — see this file's top comment. vite.config.ts
    // conditionally overwrites this after import, never here.
    jsxBin: "off",
  },
  // No onnxruntime-node for Kokoro: Premiere's hardened runtime with library
  // validation refuses to load any native .node/.dylib not signed with Adobe's
  // own Team ID (dlopen fails with "different Team IDs"), and re-signing the
  // binary ourselves can't change that; it is a macOS security boundary. Kokoro
  // uses onnxruntime-web/WASM instead (see kokoro.ts's top comment for how it
  // forces that code path despite CEP's real Node environment), as silero.ts
  // does. Don't add a native Node addon dependency without solving this first.
  installModules: [],
  copyAssets: [
    "assets/bin/mac/ffmpeg",
    "assets/bin/win/ffmpeg.exe",
    // ffmpeg.exe (unlike whisper-cli.exe/espeak-ng.exe, which only need standard
    // api-ms-win-crt-*/KERNEL32/ADVAPI32 DLLs present on any Windows install) is
    // linked against libwinpthread-1.dll, a MinGW-w64 runtime shim that is not
    // part of Windows. Without it, ffmpeg.exe fails to start with
    // STATUS_DLL_NOT_FOUND (Windows error 0xC0000135 / spawnSync exit code
    // 3221225781). Windows' DLL search order checks the executable's own
    // directory first, so placing this next to ffmpeg.exe is enough; no
    // PATH/registry changes needed. objdump shows ffmpeg.exe imports only two
    // symbols from it (clock_gettime64, nanosleep64), both present in this file
    // at matching ordinals.
    "assets/bin/win/libwinpthread-1.dll",
    "assets/bin/mac/whisper-cli",
    "assets/bin/win/whisper-cli.exe",
    // Native espeak-ng CLI (GPL-3.0-or-later, github.com/espeak-ng/espeak-ng): a
    // portable, statically linked per-OS binary bundled and run as a separate
    // subprocess, like ffmpeg/whisper-cli above. See
    // espeakPath.ts/espeakPhonemize.ts.
    "assets/bin/mac/espeak-ng",
    "assets/bin/win/espeak-ng.exe",
    // Reduced to the phoneme and intonation tables, the dictionaries of the languages this
    // extension uses (en, es, fr, hi, it, pt) and the gmw/inc/roa
    // language-definition folders (~1.3 MB), rather than espeak-ng's full
    // ~100-language, ~25MB dataset.
    "assets/espeak-ng-data",
    "assets/dark-icon.png",
    "assets/light-icon.png",
    "assets/silero/silero_vad_16k.onnx",
    "assets/silero/ort-wasm-simd.wasm",
    "assets/whisper",
    "assets/kokoro",
    "assets/presets/wav-export.epr",
    "assets/licenses",
    // Sibling of main/bridge/jsx/assets at the extension root, not under assets/:
    // kokoro.ts resolves voice .bin paths directly via
    // csi.getSystemPath("extension") + "voices" (see getKokoroVoicesDir()), so
    // this location is a convention, independent of where any bundled JS chunk
    // ends up.
    "voices",
  ],
  // Not "assets/bin/..." here: copyZipAssets paths resolve relative to the
  // project root, not dist/cep — and the zip step archives the already-built
  // extension folder (which already has everything from copyAssets above).
  copyZipAssets: [],
};
export default config;
