# Building the bundled third-party native binaries

GPLv3's Corresponding Source definition (§1) includes "the scripts used to control
compilation and installation of the executable." The source archives of the GPL/LGPL
components ship with the plugin (`src/assets/licenses/espeak-ng-1.52.0-source.tar.gz`,
`src/assets/licenses/ffmpeg-8.1.3.tar.xz`, and `src/assets/licenses/sonic-fbf75c3d.tar.gz`
for the Sonic library built into eSpeak NG) and bring each project's own build system.
This file lists the flags and steps used on top of it. The scripts in
`src/assets/licenses/build-scripts/` run the same steps.

All macOS binaries are built with `MACOSX_DEPLOYMENT_TARGET=13.0`, the oldest macOS the
plugin supports; without it the compiler targets the build machine's own
macOS version and the tools would not start on older systems.

## FFmpeg 8.1.3

The source is the unmodified official release,
`https://ffmpeg.org/releases/ffmpeg-8.1.3.tar.xz`, bundled as
`src/assets/licenses/ffmpeg-8.1.3.tar.xz`. Its PGP signature `ffmpeg-8.1.3.tar.xz.asc`
verifies against the FFmpeg release signing key named on ffmpeg.org/download.html,
fingerprint `FCF9 86EA 15E6 E293 A564 4F10 B432 2F04 D676 58D8`. The archive's contents
match the `n8.1.3` tag of FFmpeg's official GitHub mirror (github.com/FFmpeg/FFmpeg) file
for file, apart from the release's own `VERSION` file and git's
`.gitignore`/`.gitattributes` files. The configure lines below are the ones the shipped
binaries report in `ffmpeg -buildconf`.

On the input side the build holds only what the plugin reads: the containers and audio
codecs of files Premiere Pro imports, the parsers those containers need (MPEG-TS and MPEG-PS
use the H.264, HEVC, MPEG-1/2 and MPEG-4 video parsers for their timestamps when seeking), and
the raw video demuxers they use to identify a stream; video is never decoded. Only local files
and pipes can be opened, and no capture devices are built. `$INPUT` below stands for these
flags, the same on every platform:

```sh
INPUT="--disable-demuxers --disable-decoders --disable-parsers --disable-bsfs
  --disable-protocols --disable-devices
  --enable-demuxer=wav,aiff,mp3,aac,mov,mpegts,mpegps,mxf,avi,dv,asf,matroska,r3d,ac3,eac3,loas
  --enable-demuxer=mpegvideo,m4v,h264,hevc
  --enable-decoder=aac,aac_latm,ac3,eac3,mp2,mp3float,alac,wmav1,wmav2,wmapro,s302m,pcm_bluray,pcm_dvd
  --enable-decoder=pcm_s16le,pcm_s16be,pcm_s24le,pcm_s24be,pcm_s32le,pcm_s32be,pcm_f32le,pcm_f32be
  --enable-decoder=pcm_f64le,pcm_f64be,pcm_u8,pcm_s8,pcm_alaw,pcm_mulaw
  --enable-parser=aac,aac_latm,ac3,mpegaudio,h264,hevc,mpegvideo,mpeg4video
  --enable-protocol=file,pipe"
```

Where FFmpeg has two decoders for one format, the build keeps the one FFmpeg picks by default
(`mp2`, `mp3float`, `aac`, `ac3`).

```sh
tar xf ffmpeg-8.1.3.tar.xz
cd ffmpeg-8.1.3
export MACOSX_DEPLOYMENT_TARGET=13.0   # macOS builds only

# macOS arm64
./configure --prefix=<out-arm64> --disable-gpl --disable-nonfree --disable-version3 \
  --disable-shared --enable-static --disable-ffplay --disable-ffprobe \
  --enable-ffmpeg --disable-doc --disable-debug --disable-network \
  --disable-autodetect $INPUT --arch=arm64 --cc=clang
make -j"$(sysctl -n hw.ncpu)"
make distclean

# macOS x86_64, built separately and merged with the arm64 build into one
# universal binary
./configure --prefix=<out-x64> --disable-gpl --disable-nonfree --disable-version3 \
  --disable-shared --enable-static --disable-ffplay --disable-ffprobe \
  --enable-ffmpeg --disable-doc --disable-debug --disable-network \
  --disable-autodetect $INPUT --arch=x86_64 --cc='clang -arch x86_64' \
  --ld='clang -arch x86_64' --extra-ldflags='-arch x86_64'
make -j"$(sysctl -n hw.ncpu)"
make distclean

lipo -create -output ffmpeg <arm64-build>/ffmpeg <x64-build>/ffmpeg
codesign --force -s - ffmpeg   # the linker signs only the arm64 slice

# Windows x86_64 (mingw-w64 cross-compile from macOS or Linux)
./configure --prefix=<out-win64> --disable-gpl --disable-nonfree --disable-version3 \
  --disable-shared --enable-static --disable-ffplay --disable-ffprobe \
  --enable-ffmpeg --disable-doc --disable-debug --disable-network \
  --disable-autodetect $INPUT --arch=x86_64 --target-os=mingw32 \
  --cross-prefix=x86_64-w64-mingw32- --enable-cross-compile --pkg-config=false
make -j"$(nproc)"
```

The results, `ffmpeg` (macOS universal) and `ffmpeg.exe` (Windows), are copied to
`src/assets/bin/{mac,win}/`. `ffmpeg.exe` also loads `libwinpthread-1.dll`, the
mingw-w64 runtime library, which is not part of Windows: copy it from the same mingw-w64
toolchain into `src/assets/bin/win/` next to `ffmpeg.exe`. `build-ffmpeg.sh` does not copy
it. `whisper-cli.exe` and `espeak-ng.exe` need only Windows' own DLLs.

## whisper.cpp 1.9.5

whisper.cpp is MIT-licensed, so there is no source-availability obligation for it; this
section is for reproducibility.

Tag `v1.9.5` (annotated tag object `d2a764c648779feb36d44363f212a29b00aad1af`) is commit
`d1be6fde11ac6e0407606b4e42fe72d34add8037`; `build-whisper-cpp.sh` (below) checks
the commit after cloning and stops if the tag points elsewhere.

- `-DBUILD_SHARED_LIBS=OFF`, so `whisper-cli` is self-contained (CMake's default is `ON`
  on macOS), and `-DGGML_OPENMP=OFF`, so no OpenMP runtime has to ship next to it.
- `-DWHISPER_BUILD_IS_DEV=OFF`, for the release version string `1.9.5`. By default
  whisper.cpp's CMake appends `-dev` to the version of any build from git (`1.9.5-dev`).
- `-DGGML_NATIVE=OFF`, so the build is not tuned to the build machine's own CPU. A native
  build of ggml on a newer Apple chip would use instructions that older chips lack (SME on
  M4, for example); with this flag the arm64 slice gets the compiler's Apple silicon
  baseline instead.
- x86_64 (Intel Mac and Windows): `-DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON
  -DGGML_F16C=ON` (ggml adds BMI2 with them). Premiere Pro 2025 requires a CPU with AVX2
  (Intel 6th generation or AMD Ryzen 1000 and newer), and all of those have the others.
  Without these flags ggml builds generic x86 code, which makes Scan's word check slower.
- `GGML_ACCELERATE` and `GGML_METAL` default to `ON` on Apple platforms (the Accelerate
  and Metal support `NOTICE.md` lists). `WHISPER_COREML`, `WHISPER_OPENVINO`,
  `WHISPER_CURL`, `WHISPER_SDL2` and the sanitizer options default to `OFF`.
- Windows links with `-static`, so `whisper-cli.exe` needs only Windows' own DLLs.
- The arm64 slice is taken from a combined arm64+x86_64 build, where ggml uses its
  generic Apple silicon code; a separate arm64-only build picks other CPU kernels and
  gives slightly different word times when Metal is unavailable.

`src/assets/licenses/build-scripts/build-whisper-cpp.sh <out>` runs every step on macOS:

```sh
git clone --branch v1.9.5 --depth 1 https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
export MACOSX_DEPLOYMENT_TARGET=13.0
FLAGS="-DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF \
  -DGGML_OPENMP=OFF -DGGML_NATIVE=OFF -DWHISPER_BUILD_IS_DEV=OFF"
X86="-DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON"

# macOS arm64: thinned from one arm64+x86_64 build
cmake -B build-universal $FLAGS \
  -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64"
cmake --build build-universal --target whisper-cli -j
lipo -thin arm64 -output whisper-cli-arm64 \
  build-universal/bin/whisper-cli

# macOS x86_64 with the x86 flags, then one universal binary
cmake -B build-x86_64 $FLAGS $X86 \
  -DCMAKE_OSX_ARCHITECTURES=x86_64
cmake --build build-x86_64 --target whisper-cli -j
lipo -create -output whisper-cli \
  whisper-cli-arm64 build-x86_64/bin/whisper-cli
codesign --force -s - whisper-cli   # the linker signs only the arm64 slice

# Windows: mingw-w64 cross-compile (toolchain file as in the script)
unset MACOSX_DEPLOYMENT_TARGET
cmake -B build-win -DCMAKE_TOOLCHAIN_FILE=mingw-w64-toolchain.cmake \
  $FLAGS $X86 -DCMAKE_EXE_LINKER_FLAGS=-static
cmake --build build-win --target whisper-cli -j
```

The model file, `ggml-tiny-q5_1.bin`, is downloaded unmodified from
`https://huggingface.co/ggerganov/whisper.cpp`, the source that whisper.cpp's own
`models/download-ggml-model.sh` uses.

## eSpeak NG 1.52.0

The shipped binaries are configured with `-DBUILD_SHARED_LIBS=OFF -DUSE_ASYNC=OFF
-DUSE_MBROLA=OFF -DUSE_LIBPCAUDIO=OFF`; Klatt and speech-player keep their defaults.
`USE_MBROLA` and `USE_LIBPCAUDIO` are set off explicitly because eSpeak NG's
`cmake/deps.cmake` turns them on whenever it finds mbrola or libpcaudio on the build
machine. The plugin only uses eSpeak NG's IPA text output, never its audio output.

eSpeak NG 1.52.0's `cmake/deps.cmake` also builds in the Sonic library (Apache-2.0,
https://github.com/waywardgeek/sonic, commit
`fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104`), downloading it with CMake's FetchContent
when no system copy is installed. The build below uses the bundled
`src/assets/licenses/sonic-fbf75c3d.tar.gz` (a `git archive` of that commit) instead,
with downloads switched off, so it needs no network.

`src/assets/licenses/build-scripts/build-espeak-ng.sh` runs every step on macOS:

```sh
build-espeak-ng.sh espeak-ng-1.52.0-source.tar.gz \
  sonic-fbf75c3d.tar.gz <out>
```

In short, it runs:

```sh
tar xzf espeak-ng-1.52.0-source.tar.gz
tar xzf sonic-fbf75c3d.tar.gz
cd espeak-ng-1.52.0
FLAGS=(-DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF
  -DUSE_ASYNC=OFF -DUSE_MBROLA=OFF -DUSE_LIBPCAUDIO=OFF
  "-DFETCHCONTENT_SOURCE_DIR_SONIC-GIT=$PWD/../sonic-fbf75c3d"
  -DFETCHCONTENT_FULLY_DISCONNECTED=ON)
export MACOSX_DEPLOYMENT_TARGET=13.0   # macOS builds only

# macOS arm64: the binary and the compiled data
cmake -B build-arm64 -DCMAKE_OSX_ARCHITECTURES=arm64 "${FLAGS[@]}"
cmake --build build-arm64 -j

# macOS x86_64: the binary only, merged into one universal binary
cmake -B build-x86_64 -DCMAKE_OSX_ARCHITECTURES=x86_64 "${FLAGS[@]}"
cmake --build build-x86_64 --target espeak-ng-bin -j
lipo -create -output espeak-ng \
  build-arm64/src/espeak-ng build-x86_64/src/espeak-ng
codesign --force -s - espeak-ng   # the linker signs only the arm64 slice

# Windows x86_64: mingw-w64 with a CMake toolchain file (written by
# the script); the binary only, since compiling the data would need
# to run the Windows binary
unset MACOSX_DEPLOYMENT_TARGET
cmake -B build-win -DCMAKE_TOOLCHAIN_FILE=mingw-w64-toolchain.cmake \
  "${FLAGS[@]}"
cmake --build build-win --target espeak-ng-bin -j
```

`src/assets/espeak-ng-data` is the compiled data from the arm64 build
(`build-arm64/espeak-ng-data`), reduced to the languages the plugin uses: the phoneme
tables (`phondata`, `phonindex`, `phontab`, `intonations`), the `en`, `es`, `fr`, `hi`,
`it` and `pt` dictionaries (`*_dict`), and the `lang/gmw`, `lang/inc` and `lang/roa`
language-definition folders.

## Removing build-machine paths

Compilers embed the build folder in the binaries: FFmpeg's configure `--prefix` (printed by `ffmpeg -version`) and whisper.cpp's source paths in its assertion messages. In the shipped binaries those paths are replaced after building by a neutral `/build___…` placeholder of the same length:

```sh
node scripts/scrub-build-paths.mjs src/assets/bin/mac/* src/assets/bin/win/*
```

Only string bytes change, never code: on macOS the machine code of both architectures is identical before and after (`otool -t`), and the result is re-signed ad hoc. `scripts/release.mjs` and `scripts/pack-third-party.mjs` refuse binaries that still contain such a path. Building in a neutral folder (for example `/tmp/build`) with `--prefix=/usr/local` and `-ffile-prefix-map=$PWD=.` avoids the paths in the first place.

## Rebuilding to verify

`src/assets/bin/{mac,win}/*` and `src/assets/licenses/*` are the files that ship.
After rebuilding any of the three tools, replace the matching files in those
directories and re-run the version and configuration checks against the new binary
before shipping it: `ffmpeg -version` and `-buildconf` (configure line, `License: LGPL
version 2.1 or later`), `whisper-cli --version`, `espeak-ng --version`, `file`
(architectures) and, on macOS, `codesign -dv` (ad-hoc signature).
