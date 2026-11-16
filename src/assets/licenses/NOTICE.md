# Third-Party Notices

AI Voice Master Tool itself is free software, Copyright (C) 2026 Nikita
Kolesov, licensed under the GNU General Public License version 3 or (at your
option) any later version — see `AI-VOICE-MASTER-TOOL-GPL3.txt`.

It bundles the following third-party components. Full license texts are in
this folder; the npm packages the plugin is built from are listed with their
licenses in `NPM-PACKAGES.txt`.

## FFmpeg (audio decoding and WAV writing) — LGPL v2.1 or later

Built from unmodified official source: https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz

Built specifically for this project with `--disable-gpl --disable-nonfree`
(FFmpeg's own build system refuses to build if any enabled component would
require a GPL or nonfree license — its self-reported license line for this
exact build was `License: LGPL version 2.1 or later`). Networking, GPL-only
and nonfree components are disabled, and no external libraries are linked
(`--disable-autodetect`). On the input side only the containers and audio
codecs of files Premiere Pro imports are built in: the WAV/BWF, AIFF, MP3,
AAC, AC-3, E-AC-3, LOAS, MOV/MP4/M4A, MPEG-TS, MPEG-PS, MXF, AVI, DV, ASF,
Matroska and R3D demuxers, plus the raw H.264, HEVC, MPEG video and MPEG-4
video demuxers that MPEG-TS and MPEG-PS use to identify a stream; the AAC,
AC-3, E-AC-3, MP2, MP3, ALAC, WMA, SMPTE 302M and PCM decoders; the parsers
those formats need; and the local `file` and `pipe` protocols only. Video
streams are identified but never decoded, and no capture devices are built.
Encoders, muxers and filters keep FFmpeg's defaults (with the bitstream
filters those muxers need). The plugin uses it to decode audio for analysis and, for Natural
pitch correction, to write WAV files.

- macOS: universal binary (arm64 + x86_64), built natively with Xcode's clang.
- Windows: x86_64, cross-compiled with mingw-w64 (x86_64-w64-mingw32-gcc).

Configure flags common to all builds (each platform adds its own `--prefix`,
architecture and cross-compile options; the full lines are in
`build-scripts/build-ffmpeg.sh`):
```
./configure --disable-gpl --disable-nonfree --disable-version3 \
  --disable-shared --enable-static --disable-ffplay --disable-ffprobe \
  --enable-ffmpeg --disable-doc --disable-debug --disable-network \
  --disable-autodetect \
  --disable-demuxers --disable-decoders --disable-parsers --disable-bsfs \
  --disable-protocols --disable-devices \
  --enable-demuxer=wav,aiff,mp3,aac,mov,mpegts,mpegps,mxf,avi,dv,asf,matroska,r3d,ac3,eac3,loas \
  --enable-demuxer=mpegvideo,m4v,h264,hevc \
  --enable-decoder=aac,aac_latm,ac3,eac3,mp2,mp3float,alac,wmav1,wmav2,wmapro,s302m,pcm_bluray,pcm_dvd \
  --enable-decoder=pcm_s16le,pcm_s16be,pcm_s24le,pcm_s24be,pcm_s32le,pcm_s32be,pcm_f32le,pcm_f32be \
  --enable-decoder=pcm_f64le,pcm_f64be,pcm_u8,pcm_s8,pcm_alaw,pcm_mulaw \
  --enable-parser=aac,aac_latm,ac3,mpegaudio,h264,hevc,mpegvideo,mpeg4video \
  --enable-protocol=file,pipe
```

ffmpeg is invoked as a separate child process (never linked into this
plugin's own code), consistent with LGPL v2.1's terms for using the
library as a standalone tool. See `FFMPEG-LGPL-2.1.txt`.

**Corresponding Source (LGPL v2.1 §6):** this folder also includes
`ffmpeg-8.1.3.tar.xz`, the complete, unmodified official source archive for
the exact version compiled into the binaries bundled with this plugin,
fetched directly from https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz —
satisfying LGPL v2.1's requirement to accompany conveyed object code with
its corresponding source (or a written offer to provide it), as for eSpeak
NG below. No modifications of any kind were made to this source before
building — see the exact configure invocation above.

## winpthreads / libwinpthread-1.dll (Windows only, used by ffmpeg.exe) — MIT and BSD-3-Clause

Part of the mingw-w64 toolchain's runtime, https://www.mingw-w64.org —
Copyright (c) 2011 mingw-w64 project (MIT), with parts derived from the
Posix Threads library for Microsoft Windows, (C) 2010 Lockless Inc.
(BSD-3-Clause). Shipped next to the Windows `ffmpeg.exe`, which is the only
bundled executable that loads it; `whisper-cli.exe` and `espeak-ng.exe` do
not. Unmodified. Its license text, taken from the mingw-w64 source tree's
own `mingw-w64-libraries/winpthreads/COPYING`, is `WINPTHREADS-MIT-BSD3.txt`
in this folder, as BSD-3-Clause requires for binary redistribution.

## Silero VAD (voice activity detection model) — MIT

https://github.com/snakers4/silero-vad — Copyright (c) 2020-present Silero Team.
Model file used: `silero_vad_16k_op15.onnx` (16kHz-only export), unmodified.
See `SILERO-VAD-MIT.txt`.

## ONNX Runtime Web (runs the Silero VAD and Kokoro models, WASM backend) — MIT

https://github.com/microsoft/onnxruntime — Copyright (c) Microsoft Corporation.
See `ONNXRUNTIME-MIT.txt`.

## whisper.cpp (word timestamps for word-boundary snapping during Scan) — MIT

https://github.com/ggml-org/whisper.cpp — Copyright (c) 2023-2026 The ggml
authors. Built from unmodified official source, statically linked, no
external runtime dependencies beyond standard OS frameworks (Accelerate/
Metal on macOS; none beyond the C/C++ runtime on Windows).

- macOS: universal binary (arm64 + x86_64), built natively with Xcode's
  clang + CMake.
- Windows: x86_64, cross-compiled with mingw-w64 (x86_64-w64-mingw32-gcc) —
  same toolchain already used for ffmpeg's own Windows build above.

Invoked as a separate child process (never linked into this plugin's own
code), exactly like ffmpeg. See `WHISPERCPP-MIT.txt`.

Model file used: `ggml-tiny-q5_1.bin` (OpenAI Whisper "tiny," 5-bit
quantized ggml conversion), downloaded unmodified from the project's own
official model mirror, https://huggingface.co/ggerganov/whisper.cpp — the
exact source `whisper.cpp`'s own `models/download-ggml-model.sh` script
uses. Whisper's original weights are OpenAI's, MIT-licensed
(https://github.com/openai/whisper) — the ggml format conversion is a
mechanical operation, not a new creative work, and doesn't override that
upstream license. See `WHISPER-MIT.txt`.

## Kokoro-82M (offline AI Voice generation engine) — Apache-2.0

https://github.com/hexgrad/kokoro — Copyright (c) hexgrad. Model files used:
the `q8` (dynamic-quantized) ONNX export and voice presets from
`onnx-community/Kokoro-82M-v1.0-ONNX`, unmodified: English (American and
British), Spanish, French, Hindi, Italian and Brazilian Portuguese voices,
which the plugin offers, plus Japanese and Mandarin voice files, which it
doesn't use. See `KOKORO-APACHE2.txt`.

## @huggingface/transformers (runs the Kokoro model, WASM backend) — Apache-2.0

https://github.com/huggingface/transformers.js — Copyright (c) its authors.
See `TRANSFORMERSJS-APACHE2.txt`.

## eSpeak NG (text-to-phoneme conversion for Kokoro) — GPL-3.0-or-later

https://github.com/espeak-ng/espeak-ng — Copyright (c) the eSpeak NG
authors. Built from unmodified official source (tag `1.52.0`), statically
linked, without asynchronous playback, MBROLA or an audio-output library
(`-DUSE_ASYNC=OFF -DUSE_MBROLA=OFF -DUSE_LIBPCAUDIO=OFF`): only its IPA
text output is used, never audio synthesis or playback. Data reduced to the
phoneme tables, the dictionaries of the languages this plugin uses (en,
es, fr, hi, it, pt) and the gmw/inc/roa language-definition folders, instead
of the full ~100-language dataset.

- macOS: universal binary (arm64 + x86_64), built natively with CMake and
  Xcode's clang.
- Windows: x86_64, cross-compiled from macOS with mingw-w64
  (x86_64-w64-mingw32-gcc) and CMake.

Both binaries include the **Sonic** library
(https://github.com/waywardgeek/sonic, commit
`fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104`) — Apache-2.0, Copyright 2010 Bill
Cox — which eSpeak NG 1.52.0's build adds when no system copy is installed
(eSpeak NG uses it only for very fast speech audio, which this plugin
never produces). Unmodified. See `SONIC-APACHE2.txt`.

**Invoked as a separate child process (never linked into this plugin's
own code)** — the same pattern already used for ffmpeg/whisper.cpp above.
The plugin itself is GPL-3.0-or-later. See `ESPEAK-NG-GPL3.txt` for the
full license text.

**Corresponding Source (GPLv3 §6):** this folder also includes
`espeak-ng-1.52.0-source.tar.gz`, the complete, unmodified official source
archive for the exact version (tag `1.52.0`) of eSpeak NG compiled into the
binaries bundled with this plugin, fetched directly from
https://github.com/espeak-ng/espeak-ng/archive/refs/tags/1.52.0.tar.gz, and
`sonic-fbf75c3d.tar.gz`, the source of the Sonic library built into them
(`git archive` of the commit above) — satisfying GPLv3 §6(a)'s requirement
to accompany conveyed object code with its Corresponding Source. No
modifications of any kind were made to either source before building.
GPLv3 §1's definition of "Corresponding Source" also includes "the scripts
used to control compilation and installation of the executable" —
`build-espeak-ng.sh` (in the `build-scripts` folder next to this file) builds both binaries,
and the compiled data, from these two archives with eSpeak NG's own CMake
build system, without network access. See `docs/BUILDING-THIRD-PARTY.md` in
the source repository (https://github.com/ominousopera/AIVoiceMasterTool);
to run your own build of eSpeak NG instead, see `docs/REPLACING-ESPEAK-NG.md`
there. The equivalent scripts for FFmpeg (`build-ffmpeg.sh`) and whisper.cpp
(`build-whisper-cpp.sh`, not required by MIT but included for completeness)
are in the same folder.

## Code adapted from other projects

- **DeadAir** (https://github.com/nzalexgarciagil-ctrl/deadair-premiere) — MIT,
  Copyright (c) 2026 DeadAir Contributors. The razor-based clip cutting in
  `src/jsx/ppro/ppro.ts` (sequence-level razor calls, the timecode helper) is
  adapted from its `host/deadair.jsx`, which credits kinokit's
  removeTimeRanges. See `DEADAIR-MIT.txt`.
- **kokoro-js** (https://github.com/hexgrad/kokoro, `kokoro.js/`) — Apache-2.0.
  The English phonemization in `src/js/lib/espeakPhonemize.ts` is a port of its
  `m()` function, changed to call the bundled espeak-ng program. See
  `KOKORO-APACHE2.txt`.
- **misaki** (https://github.com/hexgrad/misaki) — Apache-2.0. The multilingual
  phonemization in `src/js/lib/espeakPhonemize.ts` follows its `EspeakG2P`
  pipeline (the E2M symbol table and punctuation handling). Same license text
  as `KOKORO-APACHE2.txt`.

## React / ReactDOM (the plugin UI) — MIT

https://github.com/react/react — Copyright (c) Meta Platforms, Inc. and affiliates. License text in
`NPM-PACKAGES.txt`.

## Bolt CEP (CEP extension scaffold this project is built on) — MIT

https://github.com/hyperbrew/bolt-cep — Copyright (c) Hyper Brew LLC. Helper
source files (e.g. `src/js/lib/cep/*`, `src/js/lib/utils/*`) ship as part of
this plugin. See `BOLT-CEP-MIT.txt`.

## CSInterface.js (Adobe's official CEP interop layer)

Copyright 2020 Adobe Systems Incorporated. Adobe permits using, modifying,
and distributing this file "in accordance with the terms of the Adobe
license agreement accompanying it" (the file's own header) — that
agreement is `GenSDK_IHC-en_US-20120323_1224.pdf`, bundled alongside this
notice (see `ADOBE-CEP-GenSDK_IHC-en_US.pdf` in this same folder), the
document named in the license section of Adobe's own
https://github.com/Adobe-CEP/CEP-Resources repository (where this exact
file also lives, at `CEP_11.x/CSInterface.js`, matching our bundled copy's
own internal version marker `v11.0.0`). Provenance chain: Adobe-CEP/
CEP-Resources → the Bolt CEP extension scaffold (hyperbrew/bolt-cep, MIT,
see above) → this project's `src/js/lib/cep/csinterface.js`, unmodified.

## openai (official OpenAI SDK, "Improve for voice" feature only) — Apache-2.0

https://github.com/openai/openai-node — bundled so the "Improve for voice"
feature can call OpenAI's API directly using a key you supply yourself; not
invoked at all unless you configure that provider.

## @anthropic-ai/sdk (official Anthropic SDK, "Improve for voice" feature only) — Apache-2.0

https://github.com/anthropics/anthropic-sdk-typescript — bundled so the
"Improve for voice" feature can call Anthropic's API directly using a key you
supply yourself; not invoked at all unless you configure that provider.

## @elevenlabs/elevenlabs-js (official ElevenLabs SDK, AI Voice tab only) — MIT

https://github.com/elevenlabs/elevenlabs-js — bundled so the AI Voice tab's
optional ElevenLabs path can call their API directly using a key you supply
yourself. See `src/js/lib/elevenlabs.ts`.

---

All components above are distributed under licenses that allow commercial
use and redistribution. Audio analysis (ffmpeg decode, Silero VAD inference,
the whisper.cpp word-timestamp pass) and the Kokoro offline voice-generation engine
all run entirely locally against these bundled files, with no network access
at all. The deliberate exceptions are the AI Voice tab's ElevenLabs path and
the "Improve for voice" feature's OpenAI/Anthropic paths: when a user opts into
one of these and supplies their own API key for that provider, this
plugin calls that provider's API directly from the user's own machine
using that key (never a key of this plugin's own, never proxied/resold —
see `src/js/lib/elevenlabs.ts` and `src/js/lib/scriptAssistant.ts`). Every
other feature, including the AI Voice tab's Kokoro path, stays fully
offline. This plugin performs no telemetry and no automatic update
checks of its own.
