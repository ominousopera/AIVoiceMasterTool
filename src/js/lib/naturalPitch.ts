import { child_process, fs } from "./cep/node";
import { getFfmpegPath } from "./ffmpegPath";
import { FFMPEG_STALL_LIMIT_SEC, ffmpegStuckMessage, ffmpegUnreadableMessage, watchFfmpeg } from "./ffmpegLimits";

// "Natural pitch" — the first (default) Pitch correction mode in the Pacing
// tab. Speed in Premiere resamples, so a faster clip is also higher; a pitch
// effect could pull it back down. This mode instead re-renders the source
// with ffmpeg's `atempo` (a pitch-preserving time-stretch, WSOLA) and puts the
// result on the timeline at 100% speed. At
// 115-130% speed, resampling raises the median pitch by roughly 14-30%;
// `atempo` keeps it within a few percent of the original at the same length.
//
// One file is rendered per (source file, speed), covering every selected piece
// plus a margin, not one file per piece: the pieces then share one source
// again, so Send to After Effects keeps its ordinary "segments" route and J/L
// Pacing has handles to extend into. `atempo` doesn't drift over a long file:
// on a click track every click stays within about 20 ms of t / factor (0.9 to
// 2.5x), the same at the end as at the start — well inside the padding Cut
// leaves around each boundary, which always sits in a pause.

/** atempo accepts 0.5-100 in this ffmpeg, but quality drops fast above 2.0
 *  (it starts skipping whole fragments). Chaining keeps every stage inside
 *  0.5-2.0, the range FFmpeg's own documentation recommends chaining for. */
export const buildAtempoChain = (factor: number): string => {
  if (!(factor > 0) || !isFinite(factor)) throw new Error(`Invalid speed factor: ${factor}`);
  const stages: number[] = [];
  let rest = factor;
  while (rest > 2.0) {
    stages.push(2.0);
    rest /= 2.0;
  }
  while (rest < 0.5) {
    stages.push(0.5);
    rest /= 0.5;
  }
  stages.push(rest);
  return stages.map((s) => `atempo=${s.toFixed(6)}`).join(",");
};

/**
 * ffmpeg arguments for one render. Input-side seek (-ss before -i) is
 * sample-accurate for an audio decode, as analyze.ts's decodeToPCM relies on.
 * -t is an input option too, so it limits the source read, not the stretched
 * output: after -i it would cut the output at the source length (a 7 s range
 * at 115% would come out 7.00 s instead of 6.09 s). The first audio stream
 * only, the one Premiere plays by default. 24-bit PCM WAV at the source's rate
 * and channel count, so nothing but the tempo changes.
 */
export const buildNaturalPitchArgs = (
  sourcePath: string,
  rangeStart: number,
  rangeEnd: number,
  factor: number,
  outPath: string,
): string[] => [
  "-hide_banner",
  "-nostdin",
  "-y",
  "-ss",
  Math.max(0, rangeStart).toFixed(6),
  "-t",
  Math.max(0, rangeEnd - rangeStart).toFixed(6),
  "-i",
  sourcePath,
  "-map",
  "0:a:0",
  "-vn",
  "-af",
  // aresample pads an audio stream that starts later than the file, so the
  // render's timing matches the file time Premiere uses (see analyze.ts's
  // decode); atempo then changes the tempo. apad fills the render with
  // silence up to the full stretched range: Premiere can count a file as
  // longer than its audio (an MP3 without a Xing header, such as an
  // ElevenLabs take, by about a second) and plays silence there, so a piece
  // that reaches the end of such a file still lies inside the render.
  ["aresample=async=1:first_pts=0", buildAtempoChain(factor), `apad=whole_dur=${(Math.max(0, rangeEnd - rangeStart) / factor).toFixed(6)}`]
    .filter(Boolean)
    .join(","),
  "-c:a",
  "pcm_s24le",
  outPath,
];

const WAV_MAX_BYTES = 4294967295;
export const NATURAL_PITCH_TOO_LARGE =
  "The rendered audio is larger than 4 GB, more than a WAV file can hold. Select fewer pieces from this source, or a shorter stretch, and try again.";

/** Each render records the file it was rendered from in `<render>.source.json`
 *  next to it, so a render can be traced back to its recording after the panel
 *  forgets the run (a reload, a later Natural pitch run). J/L Pacing uses it to
 *  tell one Cut's pieces from clips of other files. A different name from the
 *  AI Voice tab's `<file>.meta.json`, which describes generated takes. */
const sourceRecordPathFor = (renderPath: string): string => `${renderPath}.source.json`;

/** Best effort: without the record, J/L Pacing treats the render as one of
 *  unknown source. */
export const writeRenderSource = (renderPath: string, sourcePath: string): void => {
  try {
    fs.writeFileSync(sourceRecordPathFor(renderPath), JSON.stringify({ source: sourcePath }), "utf-8");
  } catch (e) {
    // best effort, see above
  }
};

/** The recording a render was made from, or null when its record is missing
 *  or unreadable. */
export const readRenderSource = (renderPath: string): string | null => {
  try {
    const recordPath = sourceRecordPathFor(renderPath);
    if (!fs.existsSync(recordPath)) return null;
    const parsed = JSON.parse(fs.readFileSync(recordPath, "utf-8"));
    return parsed && typeof parsed.source === "string" && parsed.source ? parsed.source : null;
  } catch (e) {
    return null;
  }
};

/** Renders one natural-pitch file. Asynchronous spawn, not spawnSync: a long
 *  source can take several seconds, and spawnSync would freeze the panel for
 *  all of it (see whisper.ts for the same choice). Rejects if ffmpeg fails or
 *  leaves no file. Stopped, and its partial file deleted, when the file hasn't
 *  grown for FFMPEG_STALL_LIMIT_SEC or reaches the 4 GB a WAV can hold. */
export const renderNaturalPitch = (
  sourcePath: string,
  rangeStart: number,
  rangeEnd: number,
  factor: number,
  outPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const ffmpeg = getFfmpegPath();
    if (!fs.existsSync(sourcePath)) {
      reject(new Error(`Source media not found on disk: ${sourcePath}`));
      return;
    }
    const proc = child_process.spawn(ffmpeg, buildNaturalPitchArgs(sourcePath, rangeStart, rangeEnd, factor, outPath));
    const outSize = (): number => {
      try {
        return fs.statSync(outPath).size;
      } catch (e) {
        return 0;
      }
    };
    const watch = watchFfmpeg(proc, outSize, FFMPEG_STALL_LIMIT_SEC, () => (outSize() >= WAV_MAX_BYTES ? "too-large" : null));
    const removeOutput = (): void => {
      try {
        fs.unlinkSync(outPath);
      } catch (e) {
        // best effort
      }
    };
    let stderr = "";
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf-8");
      if (stderr.length > 20000) stderr = stderr.slice(-10000);
    });
    proc.on("error", (e) => {
      watch.done();
      reject(e);
    });
    proc.on("close", (code) => {
      watch.done();
      const stopped = watch.reason();
      if (stopped) {
        removeOutput();
        reject(new Error(stopped === "too-large" ? NATURAL_PITCH_TOO_LARGE : ffmpegStuckMessage(sourcePath)));
        return;
      }
      if (code !== 0) {
        reject(new Error(ffmpegUnreadableMessage(sourcePath, stderr) || `ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }
      let size = 0;
      try {
        size = fs.statSync(outPath).size;
      } catch (e) {
        // no file: reported below
      }
      // A WAV file holds at most 4 GB; past that its header is wrong and the
      // file won't import correctly. Long multichannel spans can get there.
      if (size >= WAV_MAX_BYTES) {
        removeOutput();
        reject(new Error(NATURAL_PITCH_TOO_LARGE));
        return;
      }
      if (size > 44) {
        writeRenderSource(outPath, sourcePath);
        resolve();
        return;
      }
      reject(new Error(`ffmpeg finished but wrote no audio to ${outPath}`));
    });
  });
