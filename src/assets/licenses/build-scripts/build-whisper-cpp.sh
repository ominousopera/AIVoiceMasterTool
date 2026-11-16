#!/usr/bin/env bash
# Builds whisper.cpp v1.9.5 (commit d1be6fde11ac6e0407606b4e42fe72d34add8037)
# for macOS (universal arm64+x86_64) and Windows x86_64 (mingw-w64
# cross-compile from macOS). whisper.cpp is MIT-licensed — this script exists
# for build reproducibility, not because GPL/LGPL requires it.
#
# Configuration of the shipped binaries:
#   -DBUILD_SHARED_LIBS=OFF    self-contained whisper-cli (CMake's default is
#                              ON on macOS)
#   -DGGML_OPENMP=OFF          no OpenMP runtime to ship next to the binary
#   -DWHISPER_BUILD_IS_DEV=OFF release version string (1.9.5, not 1.9.5-dev)
#   -DGGML_NATIVE=OFF          never tuned to the build machine's own CPU (a
#                              newer chip would add instructions older ones
#                              lack, such as SME on M4); arm64 gets the
#                              compiler's Apple silicon baseline
#   x86_64 only (Intel Mac and Windows): AVX, AVX2, FMA and F16C (ggml adds
#   BMI2 with them). Premiere Pro 2025 requires a CPU with AVX2 (Intel 6th
#   generation, AMD Ryzen 1000 or newer), and all of those have the others;
#   without these flags ggml builds generic x86 code.
#   macOS: MACOSX_DEPLOYMENT_TARGET=13.0, the minimum for current Premiere Pro
#   2025 releases. GGML_ACCELERATE and GGML_METAL keep their v1.9.5 default
#   (ON on Apple platforms); WHISPER_COREML/CURL/SDL2 default to OFF.
# The arm64 slice comes from one arm64+x86_64 build, where ggml uses its
# generic Apple silicon code (a separate arm64-only build picks different CPU
# kernels and gives slightly different word times when Metal is unavailable).
# The x86_64 slice comes from its own build with the flags above (they don't
# apply to arm64); lipo merges the two.
#
# Needs: macOS with Xcode command-line tools, cmake, git, and mingw-w64
# (x86_64-w64-mingw32-gcc/g++) for the Windows binary. Run
# scripts/scrub-build-paths.mjs on the binaries before shipping them.
#
# Usage: ./build-whisper-cpp.sh <output-dir>
#   writes <output-dir>/mac/whisper-cli and <output-dir>/win/whisper-cli.exe
set -euo pipefail

OUT_DIR="${1:?Usage: $0 <output-dir>}"
COMMIT="d1be6fde11ac6e0407606b4e42fe72d34add8037"
mkdir -p "$OUT_DIR/mac" "$OUT_DIR/win"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

if [[ "$(uname)" != "Darwin" ]]; then
  echo "This script runs on macOS (it builds the macOS binary natively)." >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git clone --branch v1.9.5 --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WORK/whisper.cpp"
cd "$WORK/whisper.cpp"
if [[ "$(git rev-parse HEAD)" != "$COMMIT" ]]; then
  echo "Tag v1.9.5 does not point to commit $COMMIT: stopping." >&2
  exit 1
fi

FLAGS=(-DCMAKE_BUILD_TYPE=Release -DBUILD_SHARED_LIBS=OFF -DGGML_OPENMP=OFF -DGGML_NATIVE=OFF -DWHISPER_BUILD_IS_DEV=OFF)
X86_FLAGS=(-DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON)
export MACOSX_DEPLOYMENT_TARGET=13.0

echo "=== macOS arm64 (from an arm64+x86_64 build) ==="
cmake -B build-universal -DCMAKE_OSX_ARCHITECTURES="arm64;x86_64" "${FLAGS[@]}"
cmake --build build-universal --target whisper-cli -j
lipo -thin arm64 -output "$WORK/whisper-cli-arm64" build-universal/bin/whisper-cli

echo "=== macOS x86_64 ==="
cmake -B build-x86_64 -DCMAKE_OSX_ARCHITECTURES=x86_64 "${FLAGS[@]}" "${X86_FLAGS[@]}"
cmake --build build-x86_64 --target whisper-cli -j

lipo -create -output "$OUT_DIR/mac/whisper-cli" "$WORK/whisper-cli-arm64" build-x86_64/bin/whisper-cli
# Ad hoc signature on both slices: the linker signs only the native (arm64) one.
codesign --force -s - "$OUT_DIR/mac/whisper-cli"

echo "=== Windows x86_64 (mingw-w64 cross-compile) ==="
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
# -static: the C++ and threading runtimes are linked in, so whisper-cli.exe
# needs only Windows' own DLLs.
cmake -B build-win -DCMAKE_TOOLCHAIN_FILE="$WORK/mingw-w64-toolchain.cmake" "${FLAGS[@]}" "${X86_FLAGS[@]}" \
  -DCMAKE_EXE_LINKER_FLAGS="-static"
cmake --build build-win --target whisper-cli -j
cp build-win/bin/whisper-cli.exe "$OUT_DIR/win/whisper-cli.exe"

echo "Wrote $OUT_DIR/mac/whisper-cli and $OUT_DIR/win/whisper-cli.exe."
echo "Verify: \"$OUT_DIR/mac/whisper-cli\" --version; file \"$OUT_DIR/win/whisper-cli.exe\""
