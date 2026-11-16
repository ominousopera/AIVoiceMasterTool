import { fs, os, path } from "./cep/node";
import { csi } from "./utils/bolt";
import { missingBinaryMessage, prepareMacBinary } from "./ffmpegPath";

/**
 * Resolves the bundled whisper.cpp CLI binary for the current OS.
 * Binaries are copied into the extension by cep.config.ts's copyAssets
 * from src/assets/bin/{mac,win}, same as ffmpeg. No system whisper.cpp
 * install is required, and nothing here ever reaches out to the network.
 */
export const getWhisperCppPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const isWin = os.platform() === "win32";
  const bin = isWin
    ? path.join(extRoot, "assets", "bin", "win", "whisper-cli.exe")
    : path.join(extRoot, "assets", "bin", "mac", "whisper-cli");

  if (!fs.existsSync(bin)) {
    throw new Error(missingBinaryMessage("whisper-cli", bin, isWin));
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

/** Resolves the bundled ggml word-timestamp model file. */
export const getWhisperCppModelPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  return path.join(extRoot, "assets", "whisper", "ggml-tiny-q5_1.bin");
};
