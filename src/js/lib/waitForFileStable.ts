import { fs, os } from "./cep/node";

/**
 * Best-effort, never-throws check for whether Adobe Media Encoder appears to
 * be installed, so a render timeout without AME says so instead of pointing to
 * AME's Queue panel. A folder-existence heuristic, not a real install-state
 * query (no documented Premiere/CEP API reports this); a false negative (AME
 * installed somewhere non-standard) just falls back to the general message.
 */
const isMediaEncoderLikelyInstalled = (): boolean => {
  try {
    const isWin = os.platform() === "win32";
    const parentDir = isWin ? "C:\\Program Files\\Adobe" : "/Applications";
    if (!fs.existsSync(parentDir)) return false;
    const entries = fs.readdirSync(parentDir);
    return entries.some((entry: string) => /^Adobe Media Encoder/i.test(entry));
  } catch (e) {
    // Can't tell either way — don't claim AME is missing on a filesystem
    // read failure alone.
    return true;
  }
};

/**
 * Polls a file on disk until it looks like a freshly written render has
 * finished, then resolves. A render that went to Adobe Media Encoder (the
 * app.encoder.encodeSequence() fallback in ppro.ts's encodeWorkAreaToWav) may
 * still be writing for a few seconds after the call returns; Premiere's own
 * export is complete on return and passes once its size has held for the
 * stability window. A heuristic: Media Encoder offers no completion event here.
 *
 * `notBeforeMs` (`Date.now()` captured right before the render was queued) is
 * required: renderSelectedClipToWav deletes a stale leftover file before
 * queuing, but that delete can fail silently (locked by an antivirus scan, a
 * cloud-sync client, a handle from a prior job), and the old file's size then
 * looks "stable" from the first poll. Requiring the file's mtime to be at or
 * after `notBeforeMs` means only a genuinely new write can satisfy the check.
 */
export const waitForFileStable = async (
  filePath: string,
  notBeforeMs: number,
  opts: { pollMs?: number; timeoutMs?: number; renderedBy?: "premiere" | "media-encoder" } = {},
): Promise<void> => {
  const pollMs = opts.pollMs ?? 300;
  const timeoutMs = opts.timeoutMs ?? 25000;
  const start = Date.now();
  let lastSize = -1;
  let consecutiveMatches = 0;
  // Two identical size readings are not enough to call a render done: AME's
  // encode has brief pauses mid-write (buffer flush, mux step), easily longer
  // than one poll interval. Requiring the size to hold for a longer,
  // wall-clock-derived window makes a pause much less likely to be read as
  // completion, while still resolving promptly once the render finishes.
  const requiredStableMs = 1500;
  const requiredMatches = Math.max(1, Math.ceil(requiredStableMs / pollMs));

  // A file that was not there when the wait began is this render's, whatever
  // its modification time says. One that is already there (Premiere's own
  // export finishes inside the host call, before this wait starts) is accepted
  // with its time up to an hour before `notBeforeMs`: a network volume or
  // FAT32 can stamp files with a clock behind this machine's or rounded to
  // two seconds, which would otherwise make a finished render look stale until
  // the timeout. Every render has a unique name, so a stale file of the same
  // name would have to be hours old to pass.
  const CLOCK_TOLERANCE_MS = 60 * 60 * 1000;
  let existedAtStart = false;
  try {
    existedAtStart = fs.existsSync(filePath);
  } catch (e) {
    // treated as absent
  }
  while (Date.now() - start < timeoutMs) {
    let size = 0;
    let freshEnough = false;
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        size = stat.size;
        freshEnough = !existedAtStart || stat.mtimeMs >= notBeforeMs - CLOCK_TOLERANCE_MS;
      }
    } catch (e) {
      // treat a transient read error the same as "not there yet" and keep polling
    }
    if (freshEnough && size > 0 && size === lastSize) {
      consecutiveMatches++;
    } else {
      consecutiveMatches = 0;
    }
    lastSize = size;
    if (consecutiveMatches >= requiredMatches) return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  if (opts.renderedBy === "premiere") {
    throw new Error(
      `Render did not finish writing in time (${filePath}). Premiere reported the render as done, so check that folder: if the file is there and plays, the location is slow to report it — try again; otherwise render again.`,
    );
  }
  if (!isMediaEncoderLikelyInstalled()) {
    throw new Error(
      `Render did not finish writing in time (${filePath}). Premiere couldn't render it itself, so it went to Adobe Media Encoder, which doesn't appear to be installed on this machine. Install it (included with any Creative Cloud plan that has Premiere Pro), open it once, then in Media Encoder's own Preferences → General enable "Automatically start queue" — then try again.`,
    );
  }
  throw new Error(
    `Render did not finish writing in time (${filePath}). Premiere couldn't render it itself, so it went to Adobe Media Encoder: check Media Encoder's own Queue panel — the render may be waiting there for its "auto-start queue" preference to be enabled (a separate application, separate setting from Premiere's own preferences).`,
  );
};
