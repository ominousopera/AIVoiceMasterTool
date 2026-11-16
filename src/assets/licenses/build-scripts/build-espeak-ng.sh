#!/usr/bin/env bash
# Builds espeak-ng 1.52.0 for macOS (universal arm64+x86_64) and Windows x86_64
# (mingw-w64 cross-compile from macOS) from the source archives this project
# bundles: assets/licenses/espeak-ng-1.52.0-source.tar.gz and
# assets/licenses/sonic-fbf75c3d.tar.gz.
#
# Configuration of the shipped binaries:
#   -DBUILD_SHARED_LIBS=OFF                  self-contained binary
#   -DUSE_ASYNC=OFF                          no asynchronous playback thread
#   -DUSE_MBROLA=OFF -DUSE_LIBPCAUDIO=OFF    no MBROLA voices, no audio output library
# Klatt and speech-player keep their defaults (on). The extension only uses
# the IPA text output (--ipa), never audio.
#
# eSpeak NG 1.52.0's cmake/deps.cmake builds in the Sonic library (Apache-2.0,
# github.com/waywardgeek/sonic, commit fbf75c3d6d846bad3bb3d456cbc5d07d9fd8c104)
# when no system copy is installed, downloading it with FetchContent.
# FETCHCONTENT_SOURCE_DIR_SONIC-GIT points it at the bundled archive of that
# same commit instead, and FETCHCONTENT_FULLY_DISCONNECTED stops any download,
# so the build needs no network.
#
# Writes <output-dir>/mac/espeak-ng, <output-dir>/win/espeak-ng.exe and
# <output-dir>/espeak-ng-data (compiled by the native arm64 build; the
# extension ships a reduced copy, see docs/BUILDING-THIRD-PARTY.md). Run
# scripts/scrub-build-paths.mjs on the binaries before shipping them.
#
# Needs: macOS with Xcode command-line tools, cmake, and mingw-w64
# (x86_64-w64-mingw32-gcc/g++) for the Windows binary.
#
# Usage: ./build-espeak-ng.sh <espeak-ng-1.52.0-source.tar.gz> <sonic-fbf75c3d.tar.gz> <output-dir>
set -euo pipefail

USAGE="Usage: $0 <espeak-ng-1.52.0-source.tar.gz> <sonic-fbf75c3d.tar.gz> <output-dir>"
SRC_TARBALL="$(cd "$(dirname "${1:?$USAGE}")" && pwd)/$(basename "$1")"
SONIC_TARBALL="$(cd "$(dirname "${2:?$USAGE}")" && pwd)/$(basename "$2")"
OUT_DIR="${3:?$USAGE}"
mkdir -p "$OUT_DIR/mac" "$OUT_DIR/win"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script runs on macOS (it builds the macOS binary natively)." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar xzf "$SRC_TARBALL" -C "$WORK"
tar xzf "$SONIC_TARBALL" -C "$WORK"
SONIC_DIR="$WORK/sonic-fbf75c3d"
cd "$WORK/espeak-ng-1.52.0"

FLAGS=(
  -DCMAKE_BUILD_TYPE=Release
  -DBUILD_SHARED_LIBS=OFF
  -DUSE_ASYNC=OFF
  -DUSE_MBROLA=OFF
  -DUSE_LIBPCAUDIO=OFF
  "-DFETCHCONTENT_SOURCE_DIR_SONIC-GIT=$SONIC_DIR"
  -DFETCHCONTENT_FULLY_DISCONNECTED=ON
)

# The minimum macOS for current Premiere Pro 2025 releases (CMake and clang
# read it from the environment).
export MACOSX_DEPLOYMENT_TARGET=13.0

echo "=== macOS arm64 (binary and compiled data) ==="
cmake -B build-arm64 -DCMAKE_OSX_ARCHITECTURES=arm64 "${FLAGS[@]}"
cmake --build build-arm64 -j

echo "=== macOS x86_64 (binary only) ==="
cmake -B build-x86_64 -DCMAKE_OSX_ARCHITECTURES=x86_64 "${FLAGS[@]}"
cmake --build build-x86_64 --target espeak-ng-bin -j

lipo -create -output "$OUT_DIR/mac/espeak-ng" build-arm64/src/espeak-ng build-x86_64/src/espeak-ng
# Ad hoc signature on both slices: the linker signs only the native (arm64) one.
codesign --force -s - "$OUT_DIR/mac/espeak-ng"
rm -rf "$OUT_DIR/espeak-ng-data"
cp -R build-arm64/espeak-ng-data "$OUT_DIR/espeak-ng-data"

echo "=== Windows x86_64 (mingw-w64 cross-compile, binary only) ==="
unset MACOSX_DEPLOYMENT_TARGET
if ! command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1; then
  echo "x86_64-w64-mingw32-gcc not found: install mingw-w64 (e.g. brew install mingw-w64)." >&2
  exit 1
fi
cat > "$WORK/mingw-w64-toolchain.cmake" <<'EOF'
set(CMAKE_SYSTEM_NAME Windows)
set(CMAKE_SYSTEM_PROCESSOR x86_64)
set(CMAKE_C_COMPILER x86_64-w64-mingw32-gcc)
set(CMAKE_CXX_COMPILER x86_64-w64-mingw32-g++)
set(CMAKE_RC_COMPILER x86_64-w64-mingw32-windres)
set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
EOF
cmake -B build-win -DCMAKE_TOOLCHAIN_FILE="$WORK/mingw-w64-toolchain.cmake" "${FLAGS[@]}"
# Only the executable: compiling the data would need to run the Windows binary.
cmake --build build-win --target espeak-ng-bin -j
cp build-win/src/espeak-ng.exe "$OUT_DIR/win/espeak-ng.exe"

echo "Wrote $OUT_DIR/mac/espeak-ng, $OUT_DIR/win/espeak-ng.exe and $OUT_DIR/espeak-ng-data."
echo "Verify: \"$OUT_DIR/mac/espeak-ng\" --version; file \"$OUT_DIR/win/espeak-ng.exe\""
