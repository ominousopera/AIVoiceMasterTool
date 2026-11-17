# Building from source

## Requirements

- Node.js 20.19 or later, with npm.
- macOS or Windows. Release packages for both platforms are built on a Mac.
- To run the plugin: Adobe Premiere Pro 2025 or later (on a Mac, macOS 13 or later), and After Effects 2025 or later for Send to After Effects.

## 1. Install dependencies

```sh
npm ci
```

`.npmrc` sets `legacy-peer-deps`, which the CEP tooling needs.

## 2. Fetch the large files

The repository does not store models, voices or native binaries. `scripts/assets-manifest.json` lists each of them with a pinned source and its SHA-256:

- the Kokoro-82M model and its 54 voices: Hugging Face, `onnx-community/Kokoro-82M-v1.0-ONNX`, at a fixed commit;
- the whisper.cpp `ggml-tiny-q5_1` model: Hugging Face, `ggerganov/whisper.cpp`, at a fixed commit;
- the Silero VAD model: GitHub, `snakers4/silero-vad`, tag `v6.2.2`;
- the ONNX Runtime Web WebAssembly: copied from `node_modules/onnxruntime-web`;
- FFmpeg (with the `libwinpthread-1.dll` it needs on Windows), whisper-cli and eSpeak NG for macOS and Windows, with the source archives of FFmpeg, eSpeak NG and the Sonic library built into eSpeak NG: one archive attached to this repository's `third-party-v1` release (whisper.cpp is MIT; its source is on GitHub).

To download what is missing:

```sh
node scripts/fetch-assets.mjs
```

To only verify:

```sh
node scripts/fetch-assets.mjs --check
```

A file whose checksum does not match is rejected.

To use native tools you built yourself ([BUILDING-THIRD-PARTY.md](BUILDING-THIRD-PARTY.md)), run `fetch-assets.mjs` first and then copy your binaries into `src/assets/bin/`. `fetch-assets.mjs` replaces any file whose checksum differs from the manifest, and `--check` reports your own binaries as different.

## 3. Build

```sh
npm run build
```

This writes the plugin to `dist/cep/` and links it into Adobe's per-user extensions folder (`~/Library/Application Support/Adobe/CEP/extensions/` on macOS, `%APPDATA%\Adobe\CEP\extensions\` on Windows), so Premiere Pro loads it after a restart. `npm run dev` serves the plugin with hot reload.

An unsigned development build needs Adobe's `PlayerDebugMode`. Set it once, then restart the Adobe app; the signed release packages do not need it. On macOS, in Terminal:

```sh
defaults write com.adobe.CSXS.12 \
  PlayerDebugMode 1
```

On Windows, in Command Prompt (the `^` at a line end continues the command there):

```bat
reg add HKCU\Software\Adobe\CSXS.12 ^
  /v PlayerDebugMode /t REG_SZ /d 1 /f
```

To turn it off again, run the same commands with `0` in place of `1`.

## 4. Package

```sh
node scripts/release.mjs
```

This builds:

- the plugin folder, copied to `release/Extension (Unpacked)/`;
- one package per platform, with plain, readable ExtendScript (the plugin says "release build"), packed as `release/packages/AI-Voice-Master-Tool-macOS.zxp` and `AI-Voice-Master-Tool-Windows.zxp`. Each package carries only its own platform's native tools. `node scripts/release.mjs --jsxbin` builds the packages with ExtendScript compiled to Adobe's `.jsxbin` instead.

`RELEASE_OUT=<dir>` puts both folders somewhere other than `release/`.

Then it runs its checks:

- the ad-hoc signatures on the macOS binaries;
- the ExtendScript form in each package: plain text (`jsx/index.js`, no `.jsxbin`), or `.jsxbin` only with `--jsxbin`;
- no build-machine paths (user names, temp folders) inside the native binaries;
- no CEP `.debug` file in the packages (it would open remote-debugging ports);
- no Node.js networking module in the built plugin, and the network guard present;
- that each package holds its own binaries and none of the other platform's;
- no Cyrillic text in the source outside the Russian dictionary;
- no direct network calls in the source except the update notice's request in `src/js/lib/updateCheck.ts` (the AI providers are called through their official SDKs);
- no source maps in the packages;
- that each package's signature verifies and carries a timestamp.

It also prints the package sizes and regenerates `src/assets/licenses/NPM-PACKAGES.txt`, which lists the licenses of every npm package the plugin is built from.

By default the packages are signed with a self-signed certificate that the build generates anew each time. To sign them with a certificate of your own, set `ZXP_CERT` to its `.p12` file and `ZXP_CERT_PASSWORD_FILE` to a file that holds only its password, both kept outside the repository:

```sh
ZXP_CERT=/path/cert.p12 \
ZXP_CERT_PASSWORD_FILE=/path/pw.txt \
node scripts/release.mjs
```

The check then confirms that both packages carry that certificate (it reads the `.p12` with `openssl`). Signing timestamps each package through a public timestamp server, so this step needs a network connection.

## Checks

- `npx tsc -p tsconfig-build.json --noEmit`: type check.
- `npm run format:check`: Prettier formatting (`npm run format` fixes it).
- `node scripts/check-i18n.mjs`: every interface string has a Russian and a Spanish translation.
- `node scripts/check-api-requests.mjs`: the exact requests sent to OpenAI, Anthropic and ElevenLabs, checked against a fake network, so no keys are needed.
- `node scripts/check-update-check.mjs`: the update notice's request to GitHub and how it reads the answer, against a fake network.
- `node scripts/fetch-assets.mjs --check`: the large files are present and unmodified.
- `node scripts/check-extendscript.mjs` (after `npm run build`): the built ExtendScript parses as ES3, has no unescaped `/` in a regex literal and is ASCII only (the build writes every other character as a `\u` escape); `scripts/release.mjs` runs the same check on the packages.

`node scripts/inspect-cuts.mjs <audioFile> <mode> [--min-gap=<s>]` (macOS; `<mode>` is `aggressive`, `normal` or `gentle`) prints how Silence Cut decides on one audio file: how many words whisper.cpp found, words a cut lands inside, uncut pauses between words and the kept segments. `--find=<word>` traces one word frame by frame, `--trace=<t0>,<t1>` a time range.

`node scripts/inspect-degenerate-cases.mjs` runs the analysis on synthetic edge cases (silence, speech without pauses, very short input).

## Previewing the plugin in a browser

`preview/` runs the real plugin in an ordinary browser, with Premiere, After Effects and Node faked, and can screenshot it:

```sh
node preview/shoot.mjs \
  [outDir] [shotName…]
```

It needs a Chrome or Chrome headless shell binary: set `PREVIEW_CHROME` to its path (the default is one specific Puppeteer cache folder on Apple-silicon macOS). Without `outDir` the pictures go to `preview/out/`. Nothing under `preview/` is part of the build.

## Third-party binaries archive

When the native tools change, `node scripts/pack-third-party.mjs` packs them with their source archives into `release/third-party-v1.zip` and writes its checksum into the manifest; attach that file to a release with the matching tag.
