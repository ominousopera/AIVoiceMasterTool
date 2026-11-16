#!/usr/bin/env bash
# Builds ffmpeg for both macOS (universal arm64+x86_64) and Windows (x86_64,
# mingw-w64 cross-compile) from the exact source this project bundles.
#
# These flags match the configure line in NOTICE.md and the bundled binaries'
# own `ffmpeg -buildconf` output. Run from anywhere; only needs the source
# tarball path below.
#
# Usage: ./build-ffmpeg.sh /path/to/ffmpeg-8.1.3.tar.xz /path/to/output-dir
set -euo pipefail

SRC_TARBALL="${1:?Usage: $0 <ffmpeg-8.1.3.tar.xz> <output-dir>}"
OUT_DIR="${2:?Usage: $0 <ffmpeg-8.1.3.tar.xz> <output-dir>}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$OUT_DIR"
tar xf "$SRC_TARBALL" -C "$WORK"
# The archive unpacks to ffmpeg-<version>/.
cd "$WORK"/ffmpeg-*/

COMMON_FLAGS=(
  --disable-gpl --disable-nonfree --disable-version3 --disable-shared
  --enable-static --disable-ffplay --disable-ffprobe --enable-ffmpeg
  --disable-doc --disable-debug --disable-network --disable-autodetect
)

# Input side: only the containers and audio codecs of files Premiere Pro
# imports, so a file can reach no other demuxer, parser or decoder. Video
# streams in a clip's file are identified (the raw h264, hevc, mpegvideo and
# m4v demuxers, which MPEG-PS and MPEG-TS use to tell what an untyped stream
# holds) and parsed where MPEG-PS and MPEG-TS need it for their timestamps
# when seeking (the h264, hevc, mpegvideo and mpeg4video parsers), but never
# decoded.
# Where FFmpeg has two decoders for one format, the one it picks by default is
# kept (mp2, mp3float, aac, ac3). Only local files and pipes can be opened,
# and no capture devices are built.
INPUT_FLAGS=(
  --disable-demuxers --disable-decoders --disable-parsers --disable-bsfs --disable-protocols
  --disable-devices
  --enable-demuxer=wav,aiff,mp3,aac,mov,mpegts,mpegps,mxf,avi,dv,asf,matroska,r3d,ac3,eac3,loas
  --enable-demuxer=mpegvideo,m4v,h264,hevc
  --enable-decoder=aac,aac_latm,ac3,eac3,mp2,mp3float,alac,wmav1,wmav2,wmapro,s302m,pcm_bluray,pcm_dvd
  --enable-decoder=pcm_s16le,pcm_s16be,pcm_s24le,pcm_s24be,pcm_s32le,pcm_s32be,pcm_f32le,pcm_f32be
  --enable-decoder=pcm_f64le,pcm_f64be,pcm_u8,pcm_s8,pcm_alaw,pcm_mulaw
  --enable-parser=aac,aac_latm,ac3,mpegaudio,h264,hevc,mpegvideo,mpeg4video
  --enable-protocol=file,pipe
)

if [[ "$(uname)" == "Darwin" ]]; then
  # The minimum macOS for current Premiere Pro 2025 releases. clang reads it
  # from the environment, so the configure line (ffmpeg -buildconf) stays the
  # same.
  export MACOSX_DEPLOYMENT_TARGET=13.0
  echo "=== macOS arm64 ==="
  ./configure --prefix="$WORK/out-arm64" "${COMMON_FLAGS[@]}" "${INPUT_FLAGS[@]}" --arch=arm64 --cc=clang
  make -j"$(sysctl -n hw.ncpu)"
  cp ffmpeg "$WORK/ffmpeg-arm64"
  make distclean

  echo "=== macOS x86_64 ==="
  ./configure --prefix="$WORK/out-x64" "${COMMON_FLAGS[@]}" "${INPUT_FLAGS[@]}" --arch=x86_64 \
    --cc='clang -arch x86_64' --ld='clang -arch x86_64' --extra-ldflags='-arch x86_64'
  make -j"$(sysctl -n hw.ncpu)"
  cp ffmpeg "$WORK/ffmpeg-x64"
  make distclean

  echo "=== lipo merge -> universal binary ==="
  lipo -create -output "$OUT_DIR/ffmpeg" "$WORK/ffmpeg-arm64" "$WORK/ffmpeg-x64"
  # Ad hoc signature on both slices: the linker signs only the native (arm64) one.
  codesign --force -s - "$OUT_DIR/ffmpeg"
  echo "Wrote $OUT_DIR/ffmpeg (universal). Verify: file \"$OUT_DIR/ffmpeg\" && \"$OUT_DIR/ffmpeg\" -version"
fi

# Windows x86_64, mingw-w64 cross-compile — run on macOS or Linux with
# x86_64-w64-mingw32-gcc/g++ installed (e.g. `brew install mingw-w64`).
if command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  echo "=== Windows x86_64 (mingw-w64 cross-compile) ==="
  ./configure --prefix="$WORK/out-win64" "${COMMON_FLAGS[@]}" "${INPUT_FLAGS[@]}" --arch=x86_64 \
    --target-os=mingw32 --cross-prefix=x86_64-w64-mingw32- \
    --enable-cross-compile --pkg-config=false
  make -j"$(nproc 2>/dev/null || sysctl -n hw.ncpu)"
  cp ffmpeg.exe "$OUT_DIR/ffmpeg.exe"
  make distclean
  echo "Wrote $OUT_DIR/ffmpeg.exe"
else
  echo "SKIPPED Windows build: x86_64-w64-mingw32-gcc not found on this machine." >&2
  echo "  (install via 'brew install mingw-w64' on macOS, or the equivalent on Linux)" >&2
fi
