import { child_process, fs, os, path } from "./cep/node";
import { csi } from "./utils/bolt";
import { getDocumentsDir } from "./genAudioDir";

const macPreparedBinaries = new Set<string>();

// Disclosure log for prepareMacBinary's binary changes: written only when
// something was actually changed — `xattr -d` removed a real quarantine
// attribute, or an ad-hoc signature was re-applied because the existing one no
// longer verified. Logging every session's checks on an intact binary would
// only flood it. main.tsx (hasMacQuarantineEventEverLogged/appendLog) checks
// whether this file exists to decide whether to show a one-time notice. Its
// own file, since it covers ffmpeg, whisper-cli and espeak-ng alike.
const macQuarantineLogFile = (): string =>
  path.join(getDocumentsDir(), "AI Voice Master Tool", "Diagnostics", "macos-quarantine-clear.log");

const macQuarantineLogPath = (): string => {
  const file = macQuarantineLogFile();
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return file;
};

/** Read-only and macOS-only: it runs when the panel opens, before the real
 *  Documents folder is known (Windows can redirect it to OneDrive), so it must
 *  not create folders. */
export const hasMacQuarantineEventEverLogged = (): boolean => {
  if (os.platform() !== "darwin") return false;
  try {
    return fs.existsSync(macQuarantineLogFile());
  } catch (e) {
    return false;
  }
};

/**
 * macOS only, best effort, once per bundled binary per panel session: clears a
 * quarantine flag if the extension folder picked one up in transit (zip
 * download, e-mail and AirDrop often attach com.apple.quarantine, which then
 * blocks the first launch of an unsigned or ad-hoc-signed binary with a
 * Gatekeeper dialog), and re-applies an ad-hoc signature only if the existing
 * one no longer verifies. Never fatal; cutting proceeds either way.
 *
 * Uses spawnSync, unlike every other subprocess call here (see whisper.ts and
 * espeakPhonemize.ts for why media processing must not block the panel):
 * `xattr -d`/`codesign` take milliseconds, and the callers
 * (getFfmpegPath/getEspeakPath/getWhisperCppPath) return the path
 * synchronously, with the real subprocess call usually on the next line. A
 * fire-and-forget async version would race that call on a fresh install and
 * hit exactly the Gatekeeper block this prevents; awaiting it would make every
 * path getter and all of its callers async. A few milliseconds once per binary
 * is the safer trade.
 */
export const prepareMacBinary = (bin: string): void => {
  if (macPreparedBinaries.has(bin)) return;
  macPreparedBinaries.add(bin);
  try {
    const res = child_process.spawnSync("xattr", ["-d", "com.apple.quarantine", bin]);
    // status===0 means xattr found and removed a real quarantine attribute —
    // one of the two changes this log records (see macQuarantineLogFile).
    if (res.status === 0) {
      try {
        fs.appendFileSync(macQuarantineLogPath(), `[${new Date().toISOString()}] Cleared com.apple.quarantine from: ${bin}\n`);
      } catch (logErr) {
        // best effort — never let logging itself be a new failure point
      }
    }
  } catch (e) {
    // no quarantine attribute present, or xattr unavailable — fine either way
  }
  // Re-sign only when the existing signature no longer verifies. An intact
  // ad-hoc signature needs nothing, and re-signing unconditionally would
  // overwrite a Developer ID signature with an ad-hoc one and undo
  // notarization. Intact binaries pass `codesign --verify`; one damaged in
  // transit fails it and gets the ad-hoc self-heal.
  try {
    const verify = child_process.spawnSync("codesign", ["--verify", bin]);
    if (verify.status !== 0) {
      const res = child_process.spawnSync("codesign", ["--force", "--sign", "-", bin]);
      if (res.status === 0) {
        try {
          fs.appendFileSync(
            macQuarantineLogPath(),
            `[${new Date().toISOString()}] Existing code signature did not verify; re-applied an ad-hoc signature to: ${bin}\n`,
          );
        } catch (logErr) {
          // best effort — never let logging itself be a new failure point
        }
      }
    }
  } catch (e) {
    // best effort
  }
};

/**
 * Error text for a bundled command-line tool that isn't on disk. Releases ship
 * one package per platform, so the likeliest cause is that the other
 * platform's package was installed; say which one this machine needs before
 * falling back to "reinstall".
 */
export const missingBinaryMessage = (tool: string, bin: string, isWin: boolean): string =>
  `Bundled ${tool} binary not found at ${bin}. This computer needs the ${isWin ? "Windows" : "macOS"} package of the plugin — if the other one was installed, install this one instead; otherwise reinstall the plugin.`;

/**
 * Resolves the bundled ffmpeg binary for the current OS.
 * Binaries are copied into the extension by cep.config.ts's copyAssets
 * from src/assets/bin/{mac,win}. No system ffmpeg install is required, and
 * nothing here ever reaches out to the network.
 */
export const getFfmpegPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const isWin = os.platform() === "win32";
  const bin = isWin ? path.join(extRoot, "assets", "bin", "win", "ffmpeg.exe") : path.join(extRoot, "assets", "bin", "mac", "ffmpeg");

  if (!fs.existsSync(bin)) {
    throw new Error(missingBinaryMessage("ffmpeg", bin, isWin));
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
