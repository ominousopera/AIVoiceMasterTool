// After Effects side of the Premiere -> After Effects bridge. Built on the
// official, documented AE scripting DOM only (CompItem, Layer,
// Project.importFile): After Effects has no undocumented "QE"-style scripting
// surface the way Premiere does, so this file carries less API uncertainty
// than src/jsx/ppro/ppro.ts.
//
// Talks to ppro.ts's sendToAfterEffects() purely through a JSON file on disk
// (see BridgeManifest below): there is no live IPC between the two apps, and
// no OS/CEP clipboard bridge for timeline clips between separate host
// applications.

import { redactHomeFolder } from "../lib/redact";

interface BridgeSegment {
  start: number;
  end: number;
  /** 0 for a piece on the lowest-numbered track of its list in Premiere, 1
   *  for the next track number (J/L Pacing alternates pieces across two
   *  tracks: the next one is below on audio, above on video). Of two pieces
   *  that overlap in time and show a picture, the higher level ends up above
   *  in the layer stack, as a video piece is in Premiere (see stackingOrder;
   *  for audio the layer order does not change the sound). Optional: a
   *  segment without it counts as level 0. */
  stackLevel?: number;
  /** This piece's timeline position in Premiere (seconds), relative to the
   *  earliest selected piece of either list: audio and video share one base,
   *  so a video that starts earlier or later than the audio keeps its offset
   *  (see ppro.ts's sendToAfterEffects, which reads each clip's `.start`). */
  timelineStart: number;
  /** This piece's own current Premiere speed factor (1 = unchanged, matching
   *  TrackItem.getSpeed()'s own convention — NOT a percent). Reconstructed
   *  here via AVLayer.stretch (After Effects' own inverse-percent
   *  convention: 100 = unchanged, lower = faster) instead of requiring a
   *  pre-rendered file, since Speed alone never touches the source media
   *  reference itself. */
  speedFactor: number;
}

interface BridgeFile {
  path: string;
  durationSec: number;
  /**
   * Same meaning as BridgeSegment's field: where this piece starts on the
   * timeline, so "rendered" placement keeps J/L Pacing's overlapping layout
   * instead of placing pieces back to back.
   */
  timelineStart: number;
}

interface BridgeManifest {
  createdAt: string;
  sequenceName: string;
  audioMode: "segments" | "rendered";
  audioMediaPath?: string;
  audioSegments?: BridgeSegment[];
  audioFiles?: BridgeFile[];
  /**
   * Present only when the selected video needs its own placement: it comes
   * from a different file than the audio, or its pieces don't line up 1:1
   * with the audio pieces. A plain linked clip has no video entry; its audio
   * layers keep their picture instead. See `placeFromManifest`.
   */
  videoMediaPath?: string;
  videoSegments?: BridgeSegment[];
}

export interface PendingManifestInfo {
  exists: boolean;
  createdAt?: string;
  audioMode?: "segments" | "rendered";
  itemCount?: number;
  /** 0 when the last sent manifest had no linked video at all. */
  videoItemCount?: number;
  sequenceName?: string;
  /** Source media file name, so the panel's summary can be compared with what
   *  was really sent last. */
  mediaFileName?: string;
  /**
   * The absolute path this After Effects engine reads, always present whatever
   * `exists` says (ppro.ts's sendToAfterEffects reports the path it wrote as
   * SendToAEResult.manifestPath).
   * readManifest() has no in-memory caching (every call is a fresh
   * open/read/close), so if the panel ever shows stale info, comparing the two
   * paths shows whether the two apps disagree on where "Documents" is (e.g.
   * sandboxing or permission differences between Adobe apps on one machine).
   */
  manifestPath: string;
  /** The manifest file's own reported last-modified time (File.modified,
   *  ExtendScript's native `Date`, stringified) — only present when the
   *  file exists. Compare against when "Send to After Effects" in Premiere
   *  was actually last clicked: if this timestamp is old, the read really
   *  is stale (a caching/staleness issue in this engine's own file access,
   *  or the write never actually landed here); if it's fresh but the
   *  displayed sequenceName/mediaFileName still look wrong, the problem is
   *  somewhere else (a JS-side display bug, not the manifest read itself). */
  manifestModifiedAt?: string;
  /** Raw byte size at read time — a second, independent signal alongside
   *  manifestModifiedAt (a size that doesn't match what was just written
   *  would also point at a stale/incomplete read). */
  manifestSizeBytes?: number;
}

export interface PlaceResult {
  placed: number;
  /** 0 when the placed manifest had no linked video at all. */
  videoPlaced: number;
  audioMode: "segments" | "rendered";
  warnings: string[];
  /** AE layer indices placeFromManifest just created via
   *  placeSegmentsReconstruction (empty for "rendered" audio mode with no
   *  linked video — placeRenderedFiles never populates this) — hand these
   *  straight to repositionStretchedLayers() as its own separate `evalTS`
   *  call. See placeSegmentsReconstruction's own doc comment for why. */
  stretchedLayerIndices: number[];
}

const errMsg = (e: any): string => (e && e.message ? e.message : String(e));

/**
 * AE-side twin of ppro.ts's getDocumentsFolderPath, for the same reason: on
 * Windows with OneDrive's "Known Folder Move" active, Node's
 * os.homedir()+"Documents" doesn't follow the redirect the way ExtendScript's
 * Folder.myDocuments does. The Bridge panel's JS side primes genAudioDir.ts's
 * documentsPathCache through evalTS("getDocumentsFolderPath"), so its
 * manifest-poll log lands in the real Documents folder.
 */
export const getDocumentsFolderPath = (): { path: string } => {
  return { path: Folder.myDocuments.fsName };
};

const getManifestFile = (): File => new File(Folder.myDocuments.fsName + "/AI Voice Master Tool/Bridge/manifest.json");

const readManifest = (): BridgeManifest | null => {
  const file = getManifestFile();
  if (!file.exists) return null;
  file.encoding = "UTF-8";
  if (!file.open("r")) return null;
  // `file.read()` is guarded: manifest.json is written by Premiere's ExtendScript
  // engine (ppro.ts, a separate app) non-atomically (open("w") -> write ->
  // close, no temp-file-then-rename), while bridge/main.tsx polls it every 2 s
  // from AE's ExtendScript engine. If AE's read lands while Premiere is
  // mid-write, the read can throw (not just return truncated or empty content),
  // which from a background poll would surface as Adobe's generic "Failed to
  // run script" dialog. Every caller already treats a `null` return as a
  // normal "nothing to read yet" outcome (see checkPendingManifest/
  // placeFromManifest), so this failure folds into the same return value.
  // try/finally so a mid-read failure can't leak the open file handle.
  try {
    const raw = file.read();
    try {
      return JSON.parse(raw) as BridgeManifest;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  } finally {
    try {
      file.close();
    } catch (e) {
      // best effort — already have what we need (or don't) either way
    }
  }
};

/**
 * Reads the pending manifest (if any) and reports its headline info, without
 * acting on it.
 *
 * MUST NEVER THROW. `bridge/main.tsx` calls this from a 2-second
 * `setInterval` whenever the Bridge panel is open, so any uncaught
 * ExtendScript exception here would surface as Adobe's modal "Failed to run
 * script" dialog with no user action to explain it.
 *
 * `readManifest` guards its read against the cross-process write race; the
 * whole body is wrapped as well, because `getManifestFile()` (which
 * dereferences `Folder.myDocuments.fsName`) and the `diagFile.fsName` read can
 * throw when that folder is momentarily unavailable (plausible with
 * OneDrive/iCloud-redirected Documents). A background poll returning
 * stale-but-safe info is always better than a modal dialog.
 */
export const checkPendingManifest = (): PendingManifestInfo => {
  try {
    return checkPendingManifestUnsafe();
  } catch (e) {
    // Deliberately swallowed: the caller renders `exists: false` as "nothing
    // pending," which is the correct thing to show when we genuinely could
    // not read it. `manifestPath` is reported as unknown rather than
    // guessed, so a Diagnostics dump still shows something went wrong.
    return { exists: false, manifestPath: "(unavailable: the Documents folder could not be read)" };
  }
};

const checkPendingManifestUnsafe = (): PendingManifestInfo => {
  // Read fresh, independently of readManifest()'s own open/read/close — this
  // is purely diagnostic (path/mtime/size), see PendingManifestInfo's own
  // doc comments on why it exists. Deliberately a second, separate File
  // instance/exists check rather than reusing readManifest()'s internals,
  // so a parse failure there can never suppress this diagnostic info too.
  const diagFile = getManifestFile();
  const manifestPath = diagFile.fsName;
  let manifestModifiedAt: string | undefined;
  let manifestSizeBytes: number | undefined;
  try {
    if (diagFile.exists) {
      manifestModifiedAt = diagFile.modified ? diagFile.modified.toString() : undefined;
      manifestSizeBytes = diagFile.length;
    }
  } catch (e) {
    // best effort — a missing diagnostic value isn't worth failing this whole check over
  }

  const manifest = readManifest();
  if (!manifest) return { exists: false, manifestPath, manifestModifiedAt, manifestSizeBytes };
  const itemCount = manifest.audioMode === "segments" ? (manifest.audioSegments || []).length : (manifest.audioFiles || []).length;
  const videoItemCount = manifest.videoSegments ? manifest.videoSegments.length : 0;
  // The source file name lets the panel's summary (sequenceName/createdAt) be
  // compared directly with what was really sent last, rather than relying on
  // sequenceName alone.
  let mediaFileName: string | undefined;
  try {
    // displayName, not name: ExtendScript's File.name is URI-encoded
    // ("my%20clip.mp4"); displayName is the name as the Finder/Explorer shows it.
    if (manifest.audioMode === "segments" && manifest.audioMediaPath) {
      mediaFileName = new File(manifest.audioMediaPath).displayName;
    } else if (manifest.audioMode === "rendered" && manifest.audioFiles && manifest.audioFiles.length > 0) {
      mediaFileName = new File(manifest.audioFiles[0].path).displayName;
    } else if (manifest.videoMediaPath) {
      mediaFileName = new File(manifest.videoMediaPath).displayName;
    }
  } catch (e) {
    // best effort — a missing display name isn't worth failing this whole check over
  }
  return {
    exists: true,
    createdAt: manifest.createdAt,
    audioMode: manifest.audioMode,
    itemCount,
    videoItemCount,
    sequenceName: manifest.sequenceName,
    mediaFileName,
    manifestPath,
    manifestModifiedAt,
    manifestSizeBytes,
  };
};

/**
 * The order to place pieces in, which is their stack from the bottom up
 * (`comp.layers.add()` always inserts at the top): the earliest piece lowest
 * and each later one above it, so the pieces climb in a staircase. Where the
 * pieces show a picture, two that overlap in time keep Premiere's stacking:
 * the one on the higher track (`stackLevel`) above, and on the same level the
 * later one above. After J/L Pacing every other piece sits on the track above,
 * so neighbours there swap in pairs; a plain staircase would show the later
 * piece from its start at every second boundary, one overlap too early. Sound mixes
 * the same in any stacking, so pieces without a picture always form a clean
 * staircase.
 */
const stackingOrder = (segments: BridgeSegment[], showsPicture: boolean): number[] => {
  const count = segments.length;
  const startOf = (i: number): number => segments[i].timelineStart;
  const endOf = (i: number): number => {
    const speedFactor = segments[i].speedFactor > 0 ? segments[i].speedFactor : 1;
    return segments[i].timelineStart + (segments[i].end - segments[i].start) / speedFactor;
  };
  const levelOf = (i: number): number => segments[i].stackLevel || 0;
  // Whether piece a has to sit below piece b. Ordered by (level, start,
  // index), which can't loop back on itself, so the loop below always finds
  // a piece to place next.
  const mustBeBelow = (a: number, b: number): boolean => {
    if (!showsPicture || a === b) return false;
    if (!(startOf(a) < endOf(b) && startOf(b) < endOf(a))) return false;
    if (levelOf(a) !== levelOf(b)) return levelOf(a) < levelOf(b);
    if (startOf(a) !== startOf(b)) return startOf(a) < startOf(b);
    return a < b;
  };
  // waiting[b]: how many unplaced pieces still have to go below piece b.
  const waiting: number[] = [];
  const placed: boolean[] = [];
  for (let b = 0; b < count; b++) {
    let below = 0;
    for (let a = 0; a < count; a++) {
      if (mustBeBelow(a, b)) below++;
    }
    waiting.push(below);
    placed.push(false);
  }
  const order: number[] = [];
  for (let step = 0; step < count; step++) {
    // The earliest piece with nothing left to go below it.
    let next = -1;
    for (let i = 0; i < count; i++) {
      if (placed[i] || waiting[i] > 0) continue;
      if (next < 0 || startOf(i) < startOf(next)) next = i;
    }
    placed[next] = true;
    order.push(next);
    for (let b = 0; b < count; b++) {
      if (!placed[b] && mustBeBelow(next, b)) waiting[b]--;
    }
  }
  return order;
};

/**
 * Places one "segments" reconstruction: imports `mediaPath` fresh for every
 * segment (see below), applies `AVLayer.stretch` for Speed and each segment's
 * real `timelineStart` for position. Neither needs Premiere's playback
 * engine: Speed only changes how much timeline time a fixed span of source
 * takes, and J/L Pacing only repositions pieces, so both can be rebuilt from
 * the original source media. Segments reference the original media, so trim
 * points can still be nudged in AE.
 *
 * `keepVideo`/`keepAudio` turn off whichever half of this import another
 * placement already provides. Audio role: keepAudio=true, and keepVideo only
 * when the manifest has no separate video entry (a plain linked clip then
 * arrives as one layer with picture and sound; see `placeFromManifest`).
 * Video role: keepVideo=true, keepAudio=false, since the audio placement
 * provides the sound and this layer's embedded audio would double it.
 * `Layer.enabled` (video) and `AVLayer.audioEnabled` (audio) are independent
 * properties in After Effects, so both are set.
 *
 * Timing: this whole per-segment sequence (import, add, stretch, startTime,
 * inPoint, outPoint) runs in one synchronous ExtendScript call, without After
 * Effects' event loop running in between, and a stretched piece's audio can
 * then play at its original pace although its box (inPoint/outPoint/duration)
 * resized correctly. So `layerIndices` (an output parameter) hands every
 * created layer's `.index` back to `placeFromManifest`, which passes them to
 * `repositionStretchedLayers()` (below); `bridge/main.tsx`'s `handlePlace`
 * calls that as a separate `evalTS` right after placement, re-applying each
 * layer's startTime/inPoint/outPoint from a separate script execution.
 * (ppro.ts's segment capture also accounts for `TrackItem.inPoint`/`.outPoint`
 * being timeline-scaled, not source-scaled, once Speed != 100%.)
 *
 * Placement order decides the layer stack (`comp.layers.add()` always inserts
 * at the top); `stackingOrder` sets it. Every layer created here is final;
 * there is no template layer to remove.
 */
const placeSegmentsReconstruction = (
  comp: CompItem,
  baseTime: number,
  mediaPath: string,
  segments: BridgeSegment[],
  keepVideo: boolean,
  keepAudio: boolean,
  warnings: string[],
  layerIndices: number[],
): number => {
  const sourceFile = new File(mediaPath);
  if (!sourceFile.exists) {
    warnings.push(`Source media not found on disk: ${mediaPath}`);
    return 0;
  }

  // A fresh, independent `importFile()` per segment, not one shared import
  // reused across all of them (via `duplicate()` or `layers.add()` on one
  // FootageItem): After Effects' per-import audio-conform state isn't
  // invalidated by a later `.stretch` change on a shared item, only by importing
  // fresh. `importFile()` called repeatedly on the same path creates independent
  // footage items each time (Adobe's docs), not a deduplicated reference. Costs
  // one file read per segment, which correctness is worth. The first one is
  // imported here, because whether the file has a picture decides how the
  // pieces may be stacked; it then serves the first piece placed.
  let firstFootage: FootageItem | null = null;
  if (segments.length > 0) {
    try {
      firstFootage = app.project.importFile(new ImportOptions(sourceFile)) as FootageItem;
    } catch (e) {
      // The loop below imports again and reports the error for each piece.
    }
  }
  const showsPicture = keepVideo && (firstFootage === null || firstFootage.hasVideo);
  const order = stackingOrder(segments, showsPicture);

  let placedCount = 0;
  for (let k = 0; k < order.length; k++) {
    const i = order[k];
    const seg = segments[i];
    const speedFactor = seg.speedFactor > 0 ? seg.speedFactor : 1;
    // Same source-duration/speed relationship ppro.ts's own placement
    // math uses throughout (timelineDur = sourceDur / speedFactor) —
    // kept identical rather than re-derived, so a value that already
    // matches Premiere's own real placement stays trustworthy here too.
    const compTimeDur = (seg.end - seg.start) / speedFactor;
    const layerStart = baseTime + seg.timelineStart;
    try {
      let footageItem: FootageItem;
      if (firstFootage !== null) {
        footageItem = firstFootage;
        firstFootage = null;
      } else {
        footageItem = app.project.importFile(new ImportOptions(sourceFile)) as FootageItem;
      }
      const newLayer = comp.layers.add(footageItem) as AVLayer;
      // Order matters: `stretch` changes how source time maps to comp
      // time from `startTime` onward, so it's set first — `startTime`,
      // `inPoint`, and `outPoint` below are then computed against that
      // already-correct mapping, not against the layer's default
      // (unstretched) one.
      newLayer.stretch = 100 / speedFactor;
      const intendedStartTime = layerStart - seg.start / speedFactor;
      newLayer.startTime = intendedStartTime;
      const intendedInPoint = layerStart;
      newLayer.inPoint = intendedInPoint;
      const intendedOutPoint = layerStart + compTimeDur;
      newLayer.outPoint = intendedOutPoint;
      if (!keepVideo) newLayer.enabled = false;
      if (!keepAudio) newLayer.audioEnabled = false;
      placedCount++;
      // A new layer goes in at its index and pushes every layer at or below it
      // one index down, so the indices already recorded move with them; they
      // then still name the same layers when repositionStretchedLayers runs.
      const added = newLayer.index;
      for (let j = 0; j < layerIndices.length; j++) {
        if (layerIndices[j] >= added) layerIndices[j]++;
      }
      layerIndices.push(added);
    } catch (e) {
      warnings.push(`segment ${i + 1}: ${errMsg(e)}`);
    }
  }

  return placedCount;
};

/**
 * Places one "rendered" (pre-baked WAV) piece per file, at each file's real
 * `timelineStart`, which keeps J/L Pacing's overlapping layout. No trimming
 * math: each file's boundary is the segment boundary, and a rendered file has
 * no slack past its edges.
 */
const placeRenderedFiles = (comp: CompItem, baseTime: number, files: BridgeFile[], warnings: string[]): number => {
  let placedCount = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    try {
      const file = new File(f.path);
      if (!file.exists) {
        warnings.push(`file ${i + 1} ("${f.path}"): not found on disk.`);
        continue;
      }
      const footageItem = app.project.importFile(new ImportOptions(file)) as FootageItem;
      const newLayer = comp.layers.add(footageItem);
      const layerStart = baseTime + f.timelineStart;
      // Set inPoint/outPoint explicitly rather than relying on layers.add()'s
      // default trim relative to startTime.
      newLayer.startTime = layerStart;
      newLayer.inPoint = layerStart;
      newLayer.outPoint = layerStart + f.durationSec;
      placedCount++;
    } catch (e) {
      warnings.push(`file ${i + 1} ("${f.path}"): ${errMsg(e)}`);
    }
  }
  return placedCount;
};

/**
 * After Effects silently clamps a layer's `outPoint` to the composition's
 * `duration` rather than erroring, so a composition shorter than the
 * reconstructed span would truncate the pieces that cross its end. Computes
 * the span needed across every segment/file in the manifest (audio and video,
 * "segments" or "rendered") so `placeFromManifest` can extend the comp before
 * placing anything; it never shrinks it.
 */
const neededCompDurationFor = (baseTime: number, manifest: BridgeManifest): number => {
  let maxEnd = 0;
  const considerSegments = (segs: BridgeSegment[] | undefined) => {
    if (!segs) return;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const speedFactor = s.speedFactor > 0 ? s.speedFactor : 1;
      const end = s.timelineStart + (s.end - s.start) / speedFactor;
      if (end > maxEnd) maxEnd = end;
    }
  };
  const considerFiles = (files: BridgeFile[] | undefined) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const end = files[i].timelineStart + files[i].durationSec;
      if (end > maxEnd) maxEnd = end;
    }
  };
  considerSegments(manifest.audioSegments);
  considerFiles(manifest.audioFiles);
  considerSegments(manifest.videoSegments);
  return baseTime + maxEnd;
};

/**
 * Places the pending manifest's pieces onto the active composition's
 * timeline, starting at the current playhead, mirroring each piece's real
 * position from Premiere (including any J/L Pacing overlap).
 *
 * Audio and video are placed independently, each through its own call to
 * `placeSegmentsReconstruction`/`placeRenderedFiles`. Audio follows
 * `audioMode`: a "segments" reconstruction, or "rendered" pre-baked WAV files.
 * ppro.ts's sendToAfterEffects writes only "segments" (it refuses clips with
 * Pitch; "Render full timeline for AE" first bakes Pitch into a timeline
 * clip), but a "rendered" manifest is still placed correctly here.
 * Video is always a "segments" reconstruction: Pitch is an audio effect and
 * never touches video, so video is never baked or re-encoded (and a WAV has
 * nowhere for a picture to go).
 *
 * When the manifest has audio and video as separate entries, each one's
 * irrelevant half is turned off rather than doubled: the video
 * reconstruction's embedded audio is always off (`keepAudio=false`), since
 * sound comes from the audio placement; the audio reconstruction's picture is
 * hidden (`keepVideo=false`) whenever a video reconstruction is present, which
 * would otherwise show two copies of the same picture. See
 * `placeSegmentsReconstruction` for why that takes two independent properties
 * (`Layer.enabled`/`AVLayer.audioEnabled`).
 *
 * `hasVideo` is only true when ppro.ts's sendToAfterEffects decided video
 * needs its own entry. A plain linked audio+video clip (both pointing at the
 * same file, the common case) has no separate videoMediaPath/videoSegments,
 * so the single audio-mode placement runs with `keepVideo=true`: one linked
 * layer with picture and sound, as the clip sits in Premiere, instead of two
 * separately muted copies of the same source file.
 */
export const placeFromManifest = (): PlaceResult => {
  const manifest = readManifest();
  if (!manifest) throw new Error("Nothing to place — send a cut from Premiere first.");

  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) {
    throw new Error("Open (or select) a composition in After Effects first.");
  }

  const warnings: string[] = [];
  let placed = 0;
  let videoPlaced = 0;
  const baseTime = comp.time;
  const hasVideo = !!(manifest.videoMediaPath && manifest.videoSegments && manifest.videoSegments.length > 0);
  // Collects every layer this call creates through placeSegmentsReconstruction
  // (not placeRenderedFiles: those are pre-baked at the right speed, nothing to
  // reposition); see placeSegmentsReconstruction's doc comment for why a
  // separate follow-up script call re-applies these layers'
  // startTime/inPoint/outPoint.
  const stretchedLayerIndices: number[] = [];

  // Checked before anything changes, so a refused manifest leaves the
  // composition exactly as it was (its duration included).
  if (manifest.audioMode === "segments") {
    if (!manifest.audioMediaPath)
      throw new Error("The data sent from Premiere is missing its source media path. Send it again from Premiere.");
    if ((manifest.audioSegments || []).length === 0)
      throw new Error("The data sent from Premiere has no segments. Send it again from Premiere.");
  } else if (manifest.audioMode === "rendered") {
    if ((manifest.audioFiles || []).length === 0)
      throw new Error("The data sent from Premiere has no rendered files. Send it again from Premiere.");
  } else {
    throw new Error(`The data sent from Premiere can't be read (unknown mode "${manifest.audioMode}"). Send it again from Premiere.`);
  }

  app.beginUndoGroup("AI Voice Master Tool — Receive from Premiere");
  try {
    // See neededCompDurationFor's own doc comment — must happen before any
    // layer is placed, since After Effects clamps outPoint to whatever
    // comp.duration already is at the moment it's set, not retroactively.
    // Inside the undo group, so one Undo in After Effects takes the whole
    // placement back, the longer composition included.
    const neededDuration = neededCompDurationFor(baseTime, manifest);
    if (neededDuration > comp.duration) {
      try {
        comp.duration = neededDuration;
      } catch (e) {
        warnings.push(
          `Could not make the composition longer (${neededDuration.toFixed(3)}s needed). Pieces near its end may be cut off: ${errMsg(e)}`,
        );
      }
    }

    if (manifest.audioMode === "segments") {
      const segments = manifest.audioSegments || [];
      placed = placeSegmentsReconstruction(
        comp,
        baseTime,
        manifest.audioMediaPath as string,
        segments,
        !hasVideo,
        true,
        warnings,
        stretchedLayerIndices,
      );
    } else {
      placed = placeRenderedFiles(comp, baseTime, manifest.audioFiles || [], warnings);
    }

    if (hasVideo) {
      // `keepAudio` is always false here: audio is always provided by the
      // separate placement above (segments or rendered, either way its own
      // dedicated layers/files) — this video reconstruction's own embedded
      // audio would otherwise double up with it.
      videoPlaced = placeSegmentsReconstruction(
        comp,
        baseTime,
        manifest.videoMediaPath as string,
        manifest.videoSegments as BridgeSegment[],
        true,
        false,
        warnings,
        stretchedLayerIndices,
      );
    }
  } finally {
    app.endUndoGroup();
  }

  return { placed, videoPlaced, audioMode: manifest.audioMode, warnings, stretchedLayerIndices };
};

/**
 * Re-applies each listed layer's current startTime/inPoint/outPoint in a
 * separate top-level script execution from the call that placed it (see
 * placeSegmentsReconstruction). Called by `bridge/main.tsx`'s `handlePlace`
 * right after `placeFromManifest`, as its own `evalTS` call; folding the two
 * into one call defeats its purpose. Best effort: returns an empty result if
 * the active item is no longer the same composition or an index no longer
 * resolves to an AVLayer.
 */
export const repositionStretchedLayers = (layerIndices: number[]): { repositioned: number; warnings: string[] } => {
  const warnings: string[] = [];
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) {
    warnings.push("Active item is no longer a composition — skipped repositioning.");
    return { repositioned: 0, warnings };
  }
  let repositioned = 0;
  for (let i = 0; i < layerIndices.length; i++) {
    try {
      const layer = comp.layer(layerIndices[i]);
      if (!(layer instanceof AVLayer)) {
        warnings.push(`Layer index ${layerIndices[i]} is no longer an audio/video layer — skipped.`);
        continue;
      }
      const startTime = layer.startTime;
      const inPoint = layer.inPoint;
      const outPoint = layer.outPoint;
      layer.startTime = startTime;
      layer.inPoint = inPoint;
      layer.outPoint = outPoint;
      repositioned++;
    } catch (e) {
      warnings.push(`Layer index ${layerIndices[i]}: ${errMsg(e)}`);
    }
  }
  return { repositioned, warnings };
};

// ============================================================
// Diagnostics: the AE Bridge panel's equivalent of the Premiere panel's
// gear-icon "Run Diagnostics" (ppro.ts's runDiagnostics). Read-only: reports
// AE's environment/state and the pending-manifest info from
// checkPendingManifest, writes it to a timestamped text file as the Premiere
// side does, and returns the path. Never modifies the user's project.
// ============================================================

const getAEDiagnosticsFolder = (): Folder => {
  const base = new Folder(Folder.myDocuments.fsName + "/AI Voice Master Tool");
  if (!base.exists) base.create();
  const folder = new Folder(base.fsName + "/Bridge Diagnostics");
  if (!folder.exists) folder.create();
  return folder;
};

const dumpLayerLine = (layer: Layer, index: number): string => {
  try {
    const isAV = layer instanceof AVLayer;
    let line = `  [${index}] "${layer.name}" enabled=${layer.enabled}`;
    if (isAV) {
      const av = layer as AVLayer;
      line += ` stretch=${av.stretch} startTime=${av.startTime.toFixed(3)} inPoint=${av.inPoint.toFixed(
        3,
      )} outPoint=${av.outPoint.toFixed(3)} audioEnabled=${av.audioEnabled}`;
      try {
        if (av.source) line += ` source="${av.source.name}" sourceDuration=${av.source.duration.toFixed(3)}`;
      } catch (e) {
        // best effort — some layer sources (solids, text) have no meaningful duration
      }
    }
    return line + "\n";
  } catch (e) {
    return `  [${index}] <could not read: ${errMsg(e)}>\n`;
  }
};

/**
 * Mirrors ppro.ts's runDiagnostics (one troubleshooting report, saved to
 * Documents, path handed back to the panel), specialized for the AE side:
 * AE's version, the active comp's layer-by-layer state
 * (stretch/inPoint/outPoint/startTime, the properties
 * placeSegmentsReconstruction sets) and the pending-manifest info the panel
 * shows.
 */
export const runAEDiagnostics = (jsInfo?: string): { path: string } => {
  let log = "AI Voice Master Tool — AE Bridge Diagnostics\n" + new Date().toString() + "\n\n";
  if (jsInfo) log += jsInfo + "\n\n";

  log += `--- environment ---\n`;
  log += `app.version = ${app.version}\n`;
  try {
    log += `app.buildNumber = ${(app as any).buildNumber}\n`;
  } catch (e) {
    // not present on every AE version's own type surface — best effort
  }
  log += `Folder.userData = ${Folder.userData ? Folder.userData.fsName : "n/a"}\n\n`;

  const comp = app.project.activeItem;
  if (comp instanceof CompItem) {
    log += `--- active comp ---\n`;
    log += `name="${comp.name}" duration=${comp.duration.toFixed(3)}s frameRate=${comp.frameRate} numLayers=${
      comp.numLayers
    } time=${comp.time.toFixed(3)}s\n`;
    for (let i = 1; i <= comp.numLayers; i++) {
      log += dumpLayerLine(comp.layer(i), i);
    }
    log += "\n";
  } else {
    log += "--- no composition open/selected ---\n\n";
  }

  log += `--- pending manifest ---\n`;
  const info = checkPendingManifest();
  log += `exists=${info.exists} audioMode=${info.audioMode || "n/a"} itemCount=${
    info.itemCount ?? "n/a"
  } videoItemCount=${info.videoItemCount ?? "n/a"} sequenceName="${info.sequenceName || ""}" mediaFileName="${info.mediaFileName || ""}"\n`;
  log += `manifestPath=${info.manifestPath}\n`;
  log += `manifestModifiedAt=${info.manifestModifiedAt || "n/a"} manifestSizeBytes=${info.manifestSizeBytes ?? "n/a"}\n\n`;

  const now = new Date();
  const pad = (n: number): string => (n < 10 ? "0" + n : String(n));
  const stamp =
    now.getFullYear() +
    "-" +
    pad(now.getMonth() + 1) +
    "-" +
    pad(now.getDate()) +
    "_" +
    pad(now.getHours()) +
    "-" +
    pad(now.getMinutes()) +
    "-" +
    pad(now.getSeconds());
  const logFile = new File(getAEDiagnosticsFolder().fsName + "/ai-voice-master-tool-ae-diagnostics-" + stamp + ".txt");
  logFile.encoding = "UTF-8";
  // ExtendScript's default line ending on macOS is a lone CR, which some
  // viewers show as one long line.
  logFile.lineFeed = "Unix";
  if (!logFile.open("w")) {
    throw new Error(`Could not open ${logFile.fsName} for writing.`);
  }
  logFile.write(redactHomeFolder(log));
  logFile.close();

  return { path: logFile.fsName };
};
