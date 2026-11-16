import { fs, os, path } from "./cep/node";
import { csi } from "./utils/bolt";
import { missingBinaryMessage, prepareMacBinary } from "./ffmpegPath";

/**
 * Resolves the bundled espeak-ng CLI binary for the current OS. Same pattern as
 * ffmpegPath.ts/whisperCppPath.ts: a portable, statically linked per-OS binary
 * built from the canonical espeak-ng source (github.com/espeak-ng/espeak-ng,
 * GPL-3.0-or-later), run as a separate OS subprocess. The macOS binary is a
 * universal arm64+x86_64 build (CMake, `-DBUILD_SHARED_LIBS=OFF
 * -DUSE_ASYNC=OFF -DUSE_MBROLA=OFF -DUSE_LIBPCAUDIO=OFF`, see
 * build-espeak-ng.sh); the Windows one is cross-compiled with
 * mingw-w64's x86_64-w64-mingw32-gcc, the toolchain used for ffmpeg.exe and
 * whisper-cli.exe.
 */
export const getEspeakPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const isWin = os.platform() === "win32";
  const bin = isWin ? path.join(extRoot, "assets", "bin", "win", "espeak-ng.exe") : path.join(extRoot, "assets", "bin", "mac", "espeak-ng");

  if (!fs.existsSync(bin)) {
    throw new Error(missingBinaryMessage("espeak-ng", bin, isWin));
  }

  if (!isWin) {
    try {
      fs.chmodSync(bin, 0o755);
    } catch (e) {
      // best effort — binary may already be executable or fs may be read-only
    }
    prepareMacBinary(bin);
  }

  return bin;
};

/**
 * Resolves the bundled espeak-ng-data directory, trimmed to the languages
 * this extension exposes (English, plus Spanish, French, Italian, Portuguese
 * and Hindi for the multilingual voices) rather than espeak-ng's full
 * ~100-language, ~25MB dataset.
 */
export const getEspeakDataPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "assets", "espeak-ng-data");
};
