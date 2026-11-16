// Limits for the bundled ffmpeg's child processes, and the messages for an
// input it can't read. A damaged or unusual file can make a decoder loop or
// wait forever; without a limit Scan or a Natural pitch render would never
// end. The audio-layout probe reads only the file's header, so it has a fixed
// time limit. The Scan decode and the Natural pitch render are limited by
// progress, not total time, so a long file on a slow drive keeps going as long
// as output keeps coming; each also has a size cap.

/** The audio-layout probe only reads the file's header and its first few
 *  megabytes, which takes well under a second on a local drive. */
export const FFMPEG_PROBE_LIMIT_SEC = 30;

/** A Scan decode or a Natural pitch render is stopped when its output hasn't
 *  grown for this long. */
export const FFMPEG_STALL_LIMIT_SEC = 60;

const fileName = (filePath: string): string => filePath.split(/[\\/]/).pop() || filePath;

export const ffmpegStuckMessage = (filePath: string): string =>
  `ffmpeg got stuck reading "${fileName(filePath)}" and was stopped. The file may be damaged, or on a slow or disconnected drive: copy it to a local drive, or export the voice as a WAV file, and try again.`;

/** The friendly message for ffmpeg's stderr when the file's container or its
 *  audio codec is one the bundled ffmpeg doesn't read (it opens only the
 *  formats Premiere Pro imports), or the file is not media at all. Null for
 *  any other failure, which keeps ffmpeg's own text. */
export const ffmpegUnreadableMessage = (filePath: string, stderr: string): string | null => {
  const noDecoder = stderr.match(/Decoding requested, but no decoder found for: ([\w-]+)/);
  if (!noDecoder && !/Error opening input[\s\S]*Invalid data found when processing input/.test(stderr)) return null;
  const codec = noDecoder ? ` (${noDecoder[1]})` : "";
  return `The plugin can't read the audio in "${fileName(filePath)}"${codec}. Export the voice as a WAV file (File > Export > Media, Format: Waveform Audio), import it and use that clip.`;
};

export interface FfmpegWatch {
  /** Why the process was stopped, or null while it runs on its own. */
  reason: () => string | null;
  /** Ends the watch; call it once the process has exited. */
  done: () => void;
}

/**
 * Stops `proc` (SIGKILL; TerminateProcess on Windows) when `progress()` has
 * not changed for `limitSec`, with reason "stuck", or when `check()` returns a
 * reason of its own. Checked once a second.
 */
export const watchFfmpeg = (
  proc: { kill: (signal?: any) => boolean },
  progress: () => number,
  limitSec: number,
  check?: () => string | null,
): FfmpegWatch => {
  let reason: string | null = null;
  let last = progress();
  let lastChange = Date.now();
  const timer = setInterval(() => {
    if (reason) return;
    const now = progress();
    if (now !== last) {
      last = now;
      lastChange = Date.now();
    }
    const own = check ? check() : null;
    if (own || Date.now() - lastChange >= limitSec * 1000) {
      reason = own || "stuck";
      try {
        proc.kill("SIGKILL");
      } catch (e) {
        // already gone
      }
    }
  }, 1000);
  return {
    reason: () => reason,
    done: () => clearInterval(timer),
  };
};
