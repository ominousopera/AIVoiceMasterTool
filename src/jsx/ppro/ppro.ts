import { secondsToTime, getItemFrameRate, qeGetClipAt } from "./ppro-utils";
import { redactHomeFolder } from "../lib/redact";

// =========================
// Types
// =========================
export interface ClipInfo {
  trackType: "video" | "audio";
  trackIndex: number;
  clipName: string;
  mediaPath: string;
  /** The selected clip's own nodeId at read time — lets a caller that holds
   *  onto this ClipInfo across an async gap (e.g. AI Voice's Replace, which
   *  awaits a network TTS call before placing) later verify the selection
   *  hasn't moved on to a different clip before mutating the timeline. See
   *  importAudioAndPlaceOnTimeline's own expectedClipNodeId param. */
  nodeId: string;
  sequenceName: string;
  sequenceFps: number;
  sourceFps: number;
  fpsMismatch: boolean;
  /** The selected clip's own trim range into the source media, in seconds
   *  (0 / full source duration for an untouched, freshly-dropped clip).
   *  Scan must only analyze this range — not the whole underlying file —
   *  or a boundary Silero/energy finds outside it can reintroduce content
   *  the user deliberately trimmed away when Cut razors the clip. */
  sourceInPoint: number;
  sourceOutPoint: number;
  /**
   * The selected clip's Speed factor at read time (1 = 100%). Scan's segment
   * boundaries are source-relative and Cut always reads the current speed, but a
   * speed change made in Premiere's own Speed/Duration dialog between Scan and
   * Cut is worth a visible warning (see main.tsx's scannedClipInfo/clipInfo
   * comparison).
   */
  speedFactor: number;
  /** Audio track numbers of other audio channels linked to this clip (see
   *  otherLinkedAudioTracks); Scan and Cut refuse such a clip. */
  otherLinkedAudioTracks: number[];
}

export interface CutSegment {
  start: number;
  end: number;
}

export interface CutResult {
  /** How many kept pieces `cutClipViaRazor` actually left on the audio
   *  track after razoring, removing silence, and closing gaps. */
  segmentsCut: number;
  /**
   * Whether `ensureSequenceStereo` switched the sequence from mono to stereo.
   * Premiere only allows that while the timeline has no audio, and
   * `cutClipViaRazor` never clears the track (the clip is split and trimmed in
   * place), so this is normally false; the real return value is passed
   * through.
   */
  stereoForced: boolean;
  /** Non-fatal problems encountered while cutting — e.g. a razor call that
   *  was rejected at one boundary, or a gap-closing move that failed. Empty
   *  on a fully clean cut. */
  warnings: string[];
  /**
   * Everything `undoCutViaRazor` needs to restore the original, uncut clip. It
   * is a from-scratch rebuild, not a Premiere undo-stack rewind, because
   * cutClipViaRazor's undo-stack footprint can't be counted reliably (see
   * undoCutViaRazor). Null only if building it failed (e.g. the clip had no
   * source media path); then the panel offers no Undo for this Cut.
   */
  undoInfo: CutUndoInfo | null;
}

/** See `CutResult.undoInfo` and `undoCutViaRazor`. */
export interface CutUndoInfo {
  trackIndex: number;
  /** null if the clip had no linked video. */
  videoTrackIndex: number | null;
  timelineStart: number;
  originalDuration: number;
  sourceInPoint: number;
  mediaPath: string;
  /**
   * The clip's Speed factor at Cut time (1 = 100%, TrackItem.getSpeed()'s
   * convention), restored on Undo too, so a clip sped up before Cut comes back
   * at its original speed (see undoCutViaRazor).
   */
  speedFactor: number;
  /** nodeId of the clip's own ProjectItem, so Undo finds that exact item
   *  even inside a bin or next to another item for the same file. */
  projectItemNodeId?: string;
  /** The Cut's sequence (Sequence.sequenceID and name), so Undo and the Speed
   *  rebuild refuse to work in a different sequence. */
  sequenceId?: string;
  sequenceName?: string;
}

/** Speed and Pitch report separately. Speed comes from the panel's Speed
 *  button (applySpeedToSelection, or rebuildCutFromOriginal right after a
 *  Cut). Pitch Shifter is put back by applyPitchToSelection after a rebuild
 *  of pieces that had it. Each has its own result and warnings, so a problem
 *  in one doesn't block or get mixed into the other. */
export interface ApplySpeedResult {
  clipsProcessed: number;
  warnings: string[];
  /** Per-clip diagnostic line — see types.ts's copy of this interface for
   *  the full explanation of why this exists. */
  debugInfo: string[];
}

export interface ApplyPitchResult {
  clipsProcessed: number;
  /** Subset of clipsProcessed that were left alone because that specific
   *  clip's own current speed was already ~100% — nothing to correct. */
  skippedNoSpeedChange: number;
  warnings: string[];
  debugInfo: string[];
  stereoForced: boolean;
}

/**
 * See types.ts's copy of this interface for why this exists (the Calculator
 * pitch mode shows the selection's real speed).
 */
export interface SelectedClipsSpeedInfo {
  speeds: number[];
  mixed: boolean;
}

export interface SendToAEResult {
  /**
   * How the audio is sent. Video is always sent separately (see
   * `videoItemCount`). sendToAfterEffects produces only "segments" (it refuses
   * on Pitch or any other unsupported effect instead of rendering);
   * "rendered" stays in the union for the Bridge panel's display.
   * renderFullTimelineForAE bakes a real timeline clip via
   * placeFullTimelineRender, so the Pitch case also goes through "segments".
   */
  audioMode: "segments" | "rendered";
  itemCount: number;
  /**
   * 0 when the selection has no linked video, or when the video is the same
   * source file as the audio (then counted in `itemCount`: one linked
   * audio+video piece per segment). Nonzero only when video needs its own
   * placement (a different source file). Video is always sent by
   * position/speed reconstruction, never rendered.
   */
  videoItemCount: number;
  /** Never set by sendToAfterEffects, which writes only "segments" manifests;
   *  see this same field's doc comment in src/js/lib/types.ts. */
  filePaths?: string[];
  /**
   * The absolute path this manifest was written to (always Documents, whatever
   * the "Next to project" setting; see getSubFolder). aeft.ts's
   * checkPendingManifest reports the same field from After Effects' side, so
   * what each app resolves "Documents" to can be compared when the Bridge
   * panel seems stale.
   */
  manifestPath: string;
  /**
   * Cross-check of each segment's reconstructed duration (start/end/speedFactor)
   * against its real Premiere timeline duration, reported when they disagree.
   */
  warnings: string[];
}

export interface ImportAudioResult {
  imported: boolean;
  trackIndex: number;
  placedAtSeconds: number;
  /** True when Replace disabled the previous take in place (the new take
   *  goes on the audio track below). False for an Insert, where nothing is
   *  replaced. */
  mutedInsteadOfRemoved: boolean;
  /**
   * Undo-stack steps this placement pushed: 1 import + 1 placement, +1 when
   * Replace disabled the original. Informational only; the panel's
   * Undo uses undoGeneratedPlacement.
   */
  undoSteps: number;
  warnings: string[];
  /** What the panel's Undo needs to reverse this placement exactly, without
   *  Premiere's undo stack (undoGeneratedPlacement): the placed clip, the
   *  file it plays, and the original take Replace muted ("" when none). */
  placedNodeId: string;
  filePath: string;
  mutedOriginalNodeId: string;
  /** Always false: without a free track below, Replace refuses instead of
   *  removing the original take (requireReplaceTracksReady). The panel doesn't
   *  read it. */
  removedOriginal: boolean;
  /** The sequence placed into (Sequence.sequenceID and name), so Undo refuses
   *  in any other sequence instead of finding nothing there. */
  sequenceId: string;
  sequenceName: string;
}

/** Result of importAudioAndPlaceSequentially, the Batch generation mode's
 *  placement step. `imported` counts how many of the given files were
 *  placed (ImportAudioResult.imported is a boolean for one clip). Batch
 *  placement never mutes or removes anything. The panel's Undo passes
 *  placedNodeIds/placedFilePaths to undoGeneratedPlacement; `undoSteps`
 *  (1 per import + 1 per placement) is informational. */
export interface BatchImportResult {
  imported: number;
  undoSteps: number;
  warnings: string[];
  /** The placed clips and the files they play, for undoGeneratedPlacement. */
  placedNodeIds: string[];
  placedFilePaths: string[];
  /** The sequence placed into (Sequence.sequenceID and name), so Undo refuses
   *  in any other sequence instead of finding nothing there. */
  sequenceId: string;
  sequenceName: string;
}

export interface UndoGeneratedResult {
  removed: number;
  unmuted: boolean;
  /** Placed clips still on the timeline after the attempt (a removal that
   *  failed or did nothing). While this is above zero the panel keeps its
   *  Undo record, and the muted original stays muted. */
  remaining: number;
  warnings: string[];
}

/** See this file's applyJLCutSmoothing for what this reports. */
export interface JLCutResult {
  clipsProcessed: number;
  /**
   * How many boundaries between the placed pieces got a nonzero overlap,
   * including those that only got the preset's minimum pacing overlap (see
   * analyze.ts's computeJLCutOverlaps). A boundary with zero overlap is not
   * counted; its pieces still get their edge fades.
   */
  overlapsApplied: number;
  /** How many pieces got at least one native edge fade (addNativeEdgeFades,
   *  Premiere's "Constant Power" transition). Every placed piece is
   *  attempted; 0 on Reset. */
  fadesApplied: number;
  warnings: string[];
  undoSteps: number;
}

// =========================
// Internal helpers
// =========================

const errMsg = (e: any): string => (e && e.message ? e.message : String(e));

/** The folder containing the currently open project file, or null if the
 *  project has never been saved (app.project.path is "" until the first
 *  save — a brand-new "Untitled" project has no path yet). Exposed to the
 *  JS side (evalTS) so it can resolve the same base folder for the AI
 *  Voice tab's Generated/ output, which is written directly by the JS side
 *  (ElevenLabs SDK / Kokoro, not ExtendScript) before ever calling into this file — see
 *  genAudioDir.ts. Wrapped in try/catch per a documented Adobe caveat
 *  (DVAPR-4242199): reading project.path can throw during app shutdown. */
export const getProjectFolderPath = (): { path: string | null } => {
  try {
    const projPath = app.project.path;
    if (!projPath) return { path: null };
    return { path: new File(projPath).parent.fsName };
  } catch (e) {
    return { path: null };
  }
};

/** Exposes ExtendScript's own native "Documents" special-folder resolution
 *  (Folder.myDocuments) to the JS side. The JS side has its own Node-based
 *  fallback (os.homedir()+"Documents", a naive string join) for use before
 *  this has ever been resolved — but that fallback does NOT follow Windows'
 *  "Known Folder Move" (OneDrive's default Documents-backup redirect,
 *  common on managed/consumer PCs), while this function's own
 *  Folder.myDocuments does. Left unreconciled, clearAllData below (which
 *  always uses Folder.myDocuments directly) and the JS side's own generated-
 *  file/diagnostics paths could point at two different physical folders on
 *  such a machine — "Clear all data" would report success while generated
 *  files sat untouched at the real, JS-resolved location. See
 *  genAudioDir.ts's primeDocumentsPathCache for how the JS side uses this. */
export const getDocumentsFolderPath = (): { path: string } => {
  return { path: Folder.myDocuments.fsName };
};

/** Resolves the base folder for renders/generated output: either the
 *  containing folder of the current project file (if `useProjectFolder` is
 *  true and the project has been saved at least once) or the OS Documents
 *  folder (the default). Falls back to Documents silently if
 *  the project isn't saved yet, same "never block on a nice-to-have"
 *  philosophy as ensureSequenceStereo elsewhere in this file. */
const getOutputBaseDir = (useProjectFolder: boolean): string => {
  if (useProjectFolder) {
    const project = getProjectFolderPath();
    if (project.path) return project.path;
  }
  return Folder.myDocuments.fsName;
};

/** Creates `folder` when it is missing and refuses when that fails (a read-only
 *  volume, a name the file system rejects): a render into a folder that isn't
 *  there would otherwise fail much later, with a message about the encoder. */
const requireFolder = (folder: Folder): void => {
  if (folder.exists) return;
  let created = false;
  try {
    created = !!folder.create();
  } catch (e) {
    created = false;
  }
  if (!created && !folder.exists) {
    throw new Error(`The folder ${folder.fsName} could not be created. Check that the location is writable, then try again.`);
  }
};

/** A clip or file name as a folder name: the characters no file system takes
 *  replaced, Windows' forbidden trailing dots and spaces trimmed, and the length
 *  capped (a long Cyrillic name is several bytes per letter; 255 bytes is the
 *  usual limit). */
const safeFolderName = (name: string): string => {
  let safe = String(name || "")
    .replace(/[\\\/:*?"<>|]/g, "_")
    .replace(/[. ]+$/, "");
  if (safe.length > 60) safe = safe.substring(0, 60);
  if (!safe) safe = "clip";
  return safe;
};

/**
 * Everything this extension writes to disk (renders, the AE hand-off
 * manifest, diagnostics reports) lives under one shared parent folder, in
 * named subfolders: one place to look, one place to clear (see clearAllData
 * below). That parent is Documents by default, or the current project's
 * folder if the user chose `useProjectFolder` (Renders, VoiceChanger and
 * Generated only: "Render full timeline for AE", Natural pitch and Voice
 * Changer renders, and AI Voice output written by the JS side). Bridge and
 * Diagnostics are transient hand-off/troubleshooting data, always in
 * Documents, and clearAllData only targets Documents, so project-folder
 * output survives "Clear all data" next to the project's autosaves. Creates
 * the parent explicitly before the subfolder rather than relying on
 * Folder.create() to make intermediate directories (undocumented either
 * way).
 */
const getSubFolder = (name: string, useProjectFolder: boolean = false): Folder => {
  const base = new Folder(getOutputBaseDir(useProjectFolder) + "/AI Voice Master Tool");
  requireFolder(base);
  const folder = new Folder(base.fsName + "/" + name);
  requireFolder(folder);
  return folder;
};

/** Finds the ProjectItem of a source file anywhere in the project: first the
 *  exact item `nodeId` names (the clip's own ProjectItem, recorded when the
 *  clip was read) as long as it still points at that file, so a file imported
 *  twice resolves to the copy the clip came from; then the first item for that
 *  file at the top level of the Project panel, then inside any bin,
 *  depth-first. `rootItem.children` lists only the top level, so bins are
 *  searched recursively. Paths compare case-insensitively, as everywhere else
 *  in this file. */
const findProjectItemForMedia = (mediaPath: string, nodeId?: string): ProjectItem | null => {
  const target = String(mediaPath || "").toLowerCase();
  if (!target) return null;
  const root = app.project.rootItem;
  const matchesPath = (item: ProjectItem): boolean => {
    try {
      return !!item.getMediaPath && String(item.getMediaPath()).toLowerCase() === target;
    } catch (e) {
      return false;
    }
  };
  const searchBins = (bin: ProjectItem, byNodeId: boolean, depth: number): ProjectItem | null => {
    if (depth > 64 || !bin.children) return null;
    for (let i = 0; i < bin.children.numItems; i++) {
      const item = bin.children[i];
      if (!item) continue;
      if (item.type === ProjectItemType.BIN) {
        const found = searchBins(item, byNodeId, depth + 1);
        if (found) return found;
      } else if (byNodeId) {
        if (item.nodeId === nodeId && matchesPath(item)) return item;
      } else if (depth > 0 && matchesPath(item)) {
        return item;
      }
    }
    return null;
  };
  if (nodeId) {
    for (let i = 0; i < root.children.numItems; i++) {
      const item = root.children[i];
      if (item && item.nodeId === nodeId && matchesPath(item)) return item;
    }
    const exact = searchBins(root, true, 0);
    if (exact) return exact;
  }
  for (let i = 0; i < root.children.numItems; i++) {
    if (matchesPath(root.children[i])) return root.children[i];
  }
  return searchBins(root, false, 0);
};

/**
 * Finds the Track a given TrackItem lives on, by nodeId (a documented, stable
 * identifier): safer than `===` on ExtendScript host objects or than
 * mediaType/parentTrackIndex strings.
 */
const locateTrackOfClip = (seq: Sequence, target: TrackItem): { track: Track; trackType: "video" | "audio"; trackIndex: number } | null => {
  for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
    const track = seq.videoTracks[vi];
    for (let ci = 0; ci < track.clips.numItems; ci++) {
      if (track.clips[ci].nodeId === target.nodeId) {
        return { track, trackType: "video", trackIndex: vi };
      }
    }
  }
  for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
    const track = seq.audioTracks[ai];
    for (let ci = 0; ci < track.clips.numItems; ci++) {
      if (track.clips[ci].nodeId === target.nodeId) {
        return { track, trackType: "audio", trackIndex: ai };
      }
    }
  }
  return null;
};

/**
 * Filters a selection down to the items on audio tracks. Cut leaves a clip's
 * linked video piece selected with its audio, and features that work on "the
 * pieces Cut just made" (render to WAV, Send to AE, Pitch) expect audio
 * items only.
 */
const audioOnly = (seq: Sequence, items: TrackItem[]): TrackItem[] => {
  const result: TrackItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const loc = locateTrackOfClip(seq, items[i]);
    if (loc && loc.trackType === "audio") result.push(items[i]);
  }
  return result;
};

/**
 * The video-side mirror of `audioOnly`: sendToAfterEffects sends a linked
 * clip's video pieces separately from its audio, always by position/speed
 * reconstruction in After Effects, never rendered (Pitch, the only thing that
 * forces an audio render, never touches video).
 */
const videoOnly = (seq: Sequence, items: TrackItem[]): TrackItem[] => {
  const result: TrackItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const loc = locateTrackOfClip(seq, items[i]);
    if (loc && loc.trackType === "video") result.push(items[i]);
  }
  return result;
};

/**
 * Finds the start time (seconds) of the nearest other clip on `track` starting
 * at or after `afterSeconds`, excluding every nodeId in `excludeNodeIds` (many
 * pieces, each its own overwriteClip() call, on two alternating tracks). Used
 * by `applyJLCutSmoothing`: `overwriteClip()` first places a clip spanning
 * the full source duration of its ProjectItem and only then gets trimmed to
 * the segment, and the trim does nothing to restore another clip the brief
 * full-length placement overwrote. Returns null if there is nothing to
 * collide with.
 */
const findNearestClipStartAfterExcludingAll = (
  track: Track,
  afterSeconds: number,
  excludeNodeIds: string[],
): { start: number; clip: TrackItem } | null => {
  let nearest: { start: number; clip: TrackItem } | null = null;
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    let excluded = false;
    for (let j = 0; j < excludeNodeIds.length; j++) {
      if (c.nodeId === excludeNodeIds[j]) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    const start = c.start.seconds;
    if (start >= afterSeconds - 0.0005 && (nearest === null || start < nearest.start)) {
      nearest = { start, clip: c };
    }
  }
  return nearest;
};

/** True for a clip of other media: it has a ProjectItem, and that ProjectItem is
 *  none of `ownProjectItemNodeIds`. A clip without a readable ProjectItem is not
 *  foreign, so the stray fragments overwriteClip() leaves behind are still
 *  cleaned up. Used to keep music, B-roll, titles and other
 *  content on the tracks J/L Pacing and the Speed rebuild work on out of their
 *  clear and sweep passes. */
const isForeignClip = (c: TrackItem, ownProjectItemNodeIds: string[]): boolean => {
  let projectItemNodeId = "";
  try {
    if (!c.projectItem) return false;
    projectItemNodeId = c.projectItem.nodeId;
  } catch (e) {
    return false;
  }
  for (let k = 0; k < ownProjectItemNodeIds.length; k++) {
    if (ownProjectItemNodeIds[k] === projectItemNodeId) return false;
  }
  return true;
};

/** A clip of a Cut's own media that is not one of that Cut's pieces, found in
 *  `tracks` among the clips starting between `windowStart` and `windowEnd`
 *  (a clip that starts at `windowEnd` itself is the next clip on the track:
 *  the callers' clear passes end there too).
 *  Each piece plays from inside one kept segment (`segments`, source-file
 *  seconds; segments that touch count as one), and no two pieces play the
 *  same stretch of the recording (a piece cut in two by hand plays two
 *  separate stretches). So a clip that plays from outside every segment, a
 *  cut-out pause or another part of the recording, is reported as
 *  "elsewhere"; one that plays a stretch another clip already plays is
 *  reported as a "copy". Clips no longer than
 *  `fragmentMax` seconds are skipped: repeated placements on one ProjectItem
 *  can leave such fragments, and the operations clear them. */
const findClipNotFromCut = (
  tracks: Track[],
  windowStart: number,
  windowEnd: number,
  ownProjectItemNodeIds: string[],
  segments: { start: number; end: number }[],
  fragmentMax: number,
): { clip: TrackItem; track: Track; reason: "elsewhere" | "copy" } | null => {
  const WINDOW_EPS = 0.001;
  const SOURCE_TOL = 0.25;
  const COPY_OVERLAP = 0.1;
  // Cut razors only where something is cut out, so two segments that touch
  // (no pause between them) stay one piece: they count as one stretch here.
  const sorted = segments.slice().sort((a, b) => a.start - b.start);
  const ranges: { start: number; end: number }[] = [];
  for (let k = 0; k < sorted.length; k++) {
    const last = ranges.length > 0 ? ranges[ranges.length - 1] : null;
    if (last && sorted[k].start - last.end <= WINDOW_EPS) {
      if (sorted[k].end > last.end) last.end = sorted[k].end;
    } else {
      ranges.push({ start: sorted[k].start, end: sorted[k].end });
    }
  }
  const claimedStart: number[] = [];
  const claimedEnd: number[] = [];
  for (let t = 0; t < tracks.length; t++) {
    const trk = tracks[t];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      if (isForeignClip(c, ownProjectItemNodeIds)) continue;
      const s = c.start.seconds;
      if (s < windowStart - WINDOW_EPS || s >= windowEnd - WINDOW_EPS) continue;
      const dur = c.end.seconds - s;
      if (dur <= fragmentMax) continue;
      let speed = 1;
      try {
        const sp = c.getSpeed();
        if (typeof sp === "number" && sp > 0) speed = sp;
      } catch (e) {
        // treated as 100%
      }
      const srcStart = c.inPoint.seconds * speed;
      const srcEnd = srcStart + dur * speed;
      let inSegment = false;
      for (let k = 0; k < ranges.length; k++) {
        if (srcStart >= ranges[k].start - SOURCE_TOL && srcEnd <= ranges[k].end + SOURCE_TOL) {
          inSegment = true;
          break;
        }
      }
      if (!inSegment) return { clip: c, track: trk, reason: "elsewhere" };
      for (let k = 0; k < claimedStart.length; k++) {
        if (Math.min(srcEnd, claimedEnd[k]) - Math.max(srcStart, claimedStart[k]) > COPY_OVERLAP) {
          return { clip: c, track: trk, reason: "copy" };
        }
      }
      claimedStart.push(srcStart);
      claimedEnd.push(srcEnd);
    }
  }
  return null;
};

/** Adds `projectItem`'s nodeId to `ids` once (no-op for a missing item). */
const addProjectItemNodeId = (ids: string[], projectItem: any): void => {
  if (!projectItem) return;
  let id = "";
  try {
    id = projectItem.nodeId;
  } catch (e) {
    return;
  }
  for (let k = 0; k < ids.length; k++) if (ids[k] === id) return;
  ids.push(id);
};

/** The first foreign clip (see isForeignClip) on `track`, other than
 *  `excludeNodeIds`, that starts before `atSeconds` and still runs past
 *  `atSeconds + tolerance`: a clip that a placement at `atSeconds` would cut
 *  into. findNearestClipStartAfterExcludingAll only sees clips starting at or
 *  after a position, so a music bed or an adjustment layer spanning it needs
 *  this check. */
const findForeignClipRunningInto = (
  track: Track,
  atSeconds: number,
  tolerance: number,
  ownProjectItemNodeIds: string[],
  excludeNodeIds: string[],
): TrackItem | null => {
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (c.start.seconds >= atSeconds - 0.0005) continue;
    if (c.end.seconds <= atSeconds + tolerance) continue;
    let excluded = false;
    for (let j = 0; j < excludeNodeIds.length; j++) {
      if (c.nodeId === excludeNodeIds[j]) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;
    if (isForeignClip(c, ownProjectItemNodeIds)) return c;
  }
  return null;
};

/** The first foreign clip (see isForeignClip) on `track` that overlaps
 *  [start, end) by more than `tolerance` at either edge. */
const findForeignClipOverlapping = (
  track: Track,
  start: number,
  end: number,
  tolerance: number,
  ownProjectItemNodeIds: string[],
): TrackItem | null => {
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (c.start.seconds < end - tolerance && c.end.seconds > start + tolerance && isForeignClip(c, ownProjectItemNodeIds)) {
      return c;
    }
  }
  return null;
};

/** True when Premiere reports `track` as locked (Track.isLocked(); false when
 *  that call isn't available in this Premiere version). */
const isTrackLocked = (track: Track | null): boolean => {
  if (!track) return false;
  try {
    return typeof (track as any).isLocked === "function" && !!(track as any).isLocked();
  } catch (e) {
    return false;
  }
};

/** Files whose guarded placement left no copy elsewhere, in the current
 *  operation (see overwriteOnly). */
let cleanPlacements: { [key: string]: boolean } = {};
const clearPlacementCache = (): void => {
  cleanPlacements = {};
};

/**
 * Places `item` on `track` and keeps every copy that overwriteClip() lays
 * down elsewhere off the sequence. overwriteClip() of a file with video and
 * audio also lays the other half down, on the track of the other kind with
 * the same number, over whatever is there (camera audio on audio track 2 puts
 * its video over video track 2: a title, B-roll), and a file whose audio
 * Premiere shows as several mono channels lays every channel down, on the
 * audio tracks below (over the pieces J/L Pacing alternates there). The
 * plugin's pieces are one channel (Scan refuses a clip that still has the
 * others), so those copies are never wanted. Only `partner`, when given, may
 * take a copy: the track of the other kind with the same number, which holds
 * or is about to receive this piece's other half. Every other track
 * holding a clip is locked for the placement, the copies land on an empty
 * spot or a new track, and the clips the placement created there are removed
 * right after. A file whose guarded placement left no such copy has one audio
 * channel and nothing more to lay down (no video, or video only on the
 * partner), so its later placements of the same kind, with or without a
 * partner as before, in the same operation skip the locking and go straight
 * through overwriteClip(); each operation
 * starts with clearPlacementCache(), so a file whose audio channels changed in
 * between is guarded again. Returns overwriteClip()'s own result.
 */
const overwriteOnly = (
  seq: Sequence,
  track: Track,
  item: any,
  atSeconds: number,
  warnings: string[],
  placing: "audio" | "video",
  partner: Track | null,
): boolean => {
  const kinds: { kind: "audio" | "video"; list: () => any }[] = [
    { kind: "audio", list: () => seq.audioTracks },
    { kind: "video", list: () => seq.videoTracks },
  ];
  let cleanKey = "";
  try {
    cleanKey = `${item.nodeId}|${placing}|${partner !== null ? "partner" : "alone"}`;
  } catch (e) {
    cleanKey = "";
  }
  if (cleanKey && cleanPlacements[cleanKey]) return track.overwriteClip(item, atSeconds);
  // Tracks compare by id: every read of seq.audioTracks[i] returns a new object.
  const keep = (t: Track, kind: "audio" | "video"): boolean =>
    kind === placing ? t.id === track.id : partner !== null && t.id === partner.id;
  const before: { [nodeId: string]: boolean } = {};
  const lockedHere: { track: Track; kind: string; number: number }[] = [];
  for (let q = 0; q < kinds.length; q++) {
    const tracks = kinds[q].list();
    for (let v = 0; v < tracks.numTracks; v++) {
      const t: Track = tracks[v];
      if (keep(t, kinds[q].kind)) continue;
      for (let k = 0; k < t.clips.numItems; k++) before[t.clips[k].nodeId] = true;
      if (t.clips.numItems > 0 && !isTrackLocked(t)) {
        try {
          (t as any).setLocked(1);
          lockedHere.push({ track: t, kind: kinds[q].kind, number: v + 1 });
        } catch (e) {
          // a track that can't be locked is left as it is
        }
      }
    }
  }
  let placedOk = false;
  try {
    placedOk = track.overwriteClip(item, atSeconds);
  } finally {
    for (let i = 0; i < lockedHere.length; i++) {
      try {
        (lockedHere[i].track as any).setLocked(0);
      } catch (e) {
        warnings.push(
          `Could not unlock ${lockedHere[i].kind} track ${lockedHere[i].number} after placing ${placing} (${errMsg(e)}). Unlock it by hand.`,
        );
      }
    }
  }
  let copiesFound = false;
  for (let q = 0; q < kinds.length; q++) {
    const tracks = kinds[q].list();
    for (let v = 0; v < tracks.numTracks; v++) {
      const t: Track = tracks[v];
      if (keep(t, kinds[q].kind)) continue;
      for (let k = t.clips.numItems - 1; k >= 0; k--) {
        const c = t.clips[k];
        if (before[c.nodeId]) continue;
        copiesFound = true;
        try {
          c.remove(false, false);
        } catch (e) {
          if (kinds[q].kind === placing) {
            warnings.push(
              `Placing the ${placing} also added a copy of another of its channels on ${placing} track ${v + 1} at ${atSeconds.toFixed(
                2,
              )}s, and it could not be removed (${errMsg(e)}). Delete that clip by hand.`,
            );
          } else {
            warnings.push(
              `Placing the ${placing} also added a copy of its ${kinds[q].kind} at ${atSeconds.toFixed(2)}s, and it could not be removed (${errMsg(
                e,
              )}). Delete that ${kinds[q].kind} clip by hand.`,
            );
          }
        }
      }
    }
  }
  if (placedOk && !copiesFound && cleanKey) cleanPlacements[cleanKey] = true;
  return placedOk;
};

/** overwriteOnly for audio with no partner: the file's video and its other channels stay off the sequence. */
const overwriteAudioOnly = (seq: Sequence, track: Track, item: any, atSeconds: number, warnings: string[]): boolean =>
  overwriteOnly(seq, track, item, atSeconds, warnings, "audio", null);

/** Links each audio piece to the video piece placed at the same start, where
 *  the two are not linked: pieces placed one half at a time (a layout whose
 *  audio and video tracks have different numbers) are not linked by Premiere,
 *  and removing the copies of a file's other audio channels (overwriteOnly) can
 *  leave a pair unlinked. J/L Pacing and Speed find a piece's video through
 *  that link. Returns how many pairs could not be linked. Changes the
 *  selection. */
const linkPiecesByStart = (
  seq: Sequence,
  audio: (TrackItem | null)[],
  audioStarts: number[],
  video: (TrackItem | null)[],
  videoStarts: number[],
): number => {
  let failed = 0;
  for (let p = 0; p < video.length; p++) {
    const v = video[p];
    if (!v) continue;
    let a: TrackItem | null = null;
    for (let q = 0; q < audio.length; q++) {
      if (audio[q] && Math.abs(audioStarts[q] - videoStarts[p]) < 0.0005) {
        a = audio[q];
        break;
      }
    }
    if (!a || isLinkedTo(a, v)) continue;
    if (!relinkToVideo(seq, a, [v.nodeId])) failed++;
  }
  return failed;
};

const unlinkedPiecesWarning = (count: number): string =>
  `${count} piece(s) could not be linked to their video again. Select each one with its video and use Clip > Link.`;

/** True if `item`'s own getLinkedItems() includes `other` — used to tell a
 *  genuinely linked audio+video pair (one user-perceived "clip," reported by
 *  Premiere's scripting as 2 separate TrackItems) apart from two unrelated
 *  clips the user happened to multi-select. Never throws: a clip with no
 *  link (or an ExtendScript engine that can't enumerate it) just reports no
 *  match, same as if the collection were empty. */
const isLinkedTo = (item: TrackItem, other: TrackItem): boolean => {
  try {
    const linked = item.getLinkedItems();
    if (!linked) return false;
    for (let i = 0; i < linked.numItems; i++) {
      if ((linked as any)[i].nodeId === other.nodeId) return true;
    }
  } catch (e) {
    // best effort
  }
  return false;
};

/** Finds the single selected TrackItem and the concrete Track it lives on.
 *  A linked audio+video clip (any clip with synced audio — an MP4 with an
 *  avatar/talking-head video is the common real-world case) selects as 2
 *  separate TrackItems even though the user only clicked one thing on the
 *  timeline once. Rather than reject that outright, resolve a genuinely
 *  linked 2-item selection down to its audio half — every caller of this
 *  function (Scan, Cut, Replace Voice, Voice Changer's render) ultimately
 *  works with the clip's *audio*. */
const getSelectedTrackItem = (seq: Sequence): { clip: TrackItem; track: Track; trackType: "video" | "audio"; trackIndex: number } => {
  const sel = seq.getSelection();
  if (!sel || sel.length === 0) {
    throw new Error("Please select exactly one clip on the timeline.");
  }
  if (sel.length === 2 && isLinkedTo(sel[0], sel[1])) {
    const loc0 = locateTrackOfClip(seq, sel[0]);
    const loc1 = locateTrackOfClip(seq, sel[1]);
    // Built explicitly, not via `{ clip: sel[0], ...loc0 }`: object spread
    // compiles to a Babel `_objectSpread` helper that needs Object.keys, which
    // this ExtendScript engine doesn't have (see the same note below).
    if (loc0 && loc0.trackType === "audio") {
      return { clip: sel[0], track: loc0.track, trackType: loc0.trackType, trackIndex: loc0.trackIndex };
    }
    if (loc1 && loc1.trackType === "audio") {
      return { clip: sel[1], track: loc1.track, trackType: loc1.trackType, trackIndex: loc1.trackIndex };
    }
    // Linked pair found, but neither half is on an audio track (unusual —
    // e.g. two video angles) — fall through to the normal "too many
    // selected" error below rather than guess.
  }
  if (sel.length > 1) {
    throw new Error(
      `Please select exactly one clip (currently ${sel.length} selected). For a clip with several linked audio channels, Alt/Option-click one audio clip to select it alone.`,
    );
  }
  const located = locateTrackOfClip(seq, sel[0]);
  if (!located) throw new Error("Could not locate the selected clip on any track.");
  // Built explicitly rather than `{ clip: sel[0], ...located }`: object spread
  // compiles to a Babel `_objectSpread` helper that calls `Object.keys` /
  // `Object.getOwnPropertySymbols` / `Object.getOwnPropertyDescriptors`, which
  // this ExtendScript engine doesn't all have ("Object.keys is not a
  // function").
  return { clip: sel[0], track: located.track, trackType: located.trackType, trackIndex: located.trackIndex };
};

/** Audio track numbers (1-based) of the other audio channels linked to `clip`,
 *  e.g. a camera clip with two mono channels shown as A1 + A2. Cut works on the
 *  selected channel only, so any other channel would drift out of sync. */
const otherLinkedAudioTracks = (seq: Sequence, clip: TrackItem, trackIndex: number): number[] => {
  const result: number[] = [];
  try {
    const linked = clip.getLinkedItems();
    if (!linked) return result;
    for (let i = 0; i < linked.numItems; i++) {
      const loc = locateTrackOfClip(seq, (linked as any)[i] as TrackItem);
      if (loc && loc.trackType === "audio" && loc.trackIndex !== trackIndex) result.push(loc.trackIndex + 1);
    }
  } catch (e) {
    // links not readable: nothing to report
  }
  return result;
};

/**
 * Finds the TrackItem whose start is closest to `seconds` on this track
 * (standard DOM): nearest match, not an epsilon cutoff. Premiere snaps inserted
 * clips to the nearest frame, which at low frame rates (24 fps ≈ 42 ms) is
 * well past a millisecond epsilon; since clips are inserted in increasing
 * order and nothing else edits the track meanwhile, "nearest" always finds a
 * match.
 *
 * Optional `minDuration` (seconds), used where many placements from one
 * shared ProjectItem sit close together (applyJLCutSmoothing and
 * rebuildCutFromOriginal, when capturing a just-placed piece and on later
 * refreshes): they leave ~1-frame stray slivers right at the edge of real
 * pieces, and a plain nearest-start search can't prefer the real piece over a
 * sliver almost as close. With `minDuration`, only candidates at least that
 * long are considered first, falling back to the plain nearest search if none
 * qualify. The other callers omit it: the Cut Undo restore, generated-audio
 * and Batch placement, the full-timeline render and Revert to segments, and
 * Natural pitch placement and its revert.
 */
const findClipNear = (track: Track, seconds: number, minDuration?: number): TrackItem | null => {
  let best: TrackItem | null = null;
  let bestDist = Infinity;
  let bestQualified: TrackItem | null = null;
  let bestQualifiedDist = Infinity;
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    const dist = Math.abs(c.start.seconds - seconds);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
    if (minDuration !== undefined && c.end.seconds - c.start.seconds >= minDuration && dist < bestQualifiedDist) {
      bestQualifiedDist = dist;
      bestQualified = c;
    }
  }
  return bestQualified || best;
};

/**
 * Finds a clip by nodeId on a track. A position search, even with a duration
 * floor, can lock onto the wrong one of several real pieces sitting close
 * together, and that piece then drops out of the keep-list. A held reference's
 * `.nodeId` value is reliable even when its JS wrapper isn't, so it is checked
 * first. nodeId is not unique, though: the shared-ProjectItem side effect can
 * give a stray sliver the same nodeId as the real piece. So among every clip
 * sharing the nodeId, the longest wins: a real piece is many frames long, a
 * stray sliver about one frame.
 */
const findClipByNodeId = (track: Track, nodeId: string): TrackItem | null => {
  let best: TrackItem | null = null;
  let bestDur = -1;
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (c.nodeId !== nodeId) continue;
    const dur = c.end.seconds - c.start.seconds;
    if (dur > bestDur) {
      bestDur = dur;
      best = c;
    }
  }
  return best;
};
// Re-finds a held piece on the live track. With many placements from one
// shared ProjectItem, nodeId lookups often fail or hit a sliver, so after the
// nodeId check (longest match, at least `minDuration`) the fallback searches
// near `expectedStart` — the intended placement computed once from the pacing
// math, never read back from a possibly stale reference. Those misses are
// normal and not reported. With `label` and `diag`, a "Diagnostic:" line (kept
// out of the panel's banner, included in the Diagnostics report) notes a nodeId
// or position match more than REFRESH_SANITY_DIST from its intended start, or a
// position search that finds nothing.
const REFRESH_SANITY_DIST = 0.5;
const refreshClipRef = (
  track: Track,
  held: TrackItem,
  expectedStart: number,
  minDuration: number,
  label?: string,
  diag?: string[],
): TrackItem => {
  let heldNodeId: string | null = null;
  try {
    heldNodeId = held.nodeId;
  } catch (e) {
    // best effort — falls straight through to the position-based search
    // below, which doesn't need this at all
  }
  if (heldNodeId) {
    const exact = findClipByNodeId(track, heldNodeId);
    if (exact && exact.end.seconds - exact.start.seconds >= minDuration) {
      const dist = Math.abs(exact.start.seconds - expectedStart);
      if (dist > REFRESH_SANITY_DIST && label && diag) {
        diag.push(
          `Diagnostic: ${label}: nodeId match resolved to a clip ${dist.toFixed(3)}s away from this piece's own intended ${expectedStart.toFixed(
            3,
          )}s (duration ${(exact.end.seconds - exact.start.seconds).toFixed(
            3,
          )}s) — likely a different piece sharing this held reference's nodeId.`,
        );
      }
      return exact;
    }
  }
  const near = findClipNear(track, expectedStart, minDuration);
  if (!near && label && diag) {
    diag.push(
      `Diagnostic: ${label}: position search near this piece's originally-intended ${expectedStart.toFixed(
        3,
      )}s also found nothing qualifying — keeping the stale held reference (its own duration ${(held.end.seconds - held.start.seconds).toFixed(3)}s).`,
    );
  } else if (near && label && diag) {
    const dist = Math.abs(near.start.seconds - expectedStart);
    if (dist > REFRESH_SANITY_DIST) {
      diag.push(
        `Diagnostic: ${label}: position search near this piece's own intended ${expectedStart.toFixed(3)}s instead landed on a clip ${dist.toFixed(
          3,
        )}s away (duration ${(near.end.seconds - near.start.seconds).toFixed(3)}s) — likely grabbed a neighboring piece's clip.`,
      );
    }
  }
  return near || held;
};

/** Finds the ordinal (Clip-type-only index, matching qeGetClipAt) of the QE
 *  clip whose start is closest to `seconds` on this QE track — same
 *  nearest-match reasoning as findClipNear. -1 only if the track has no
 *  clips at all. */
const qeFindOrdinalAt = (qeTrack: any, seconds: number): number => {
  let best = -1;
  let bestDist = Infinity;
  let ordinal = -1;
  for (let i = 0; i < qeTrack.numItems; i++) {
    const item = qeTrack.getItemAt(i);
    if (item && item.type === "Clip") {
      ordinal++;
      const startSec = item.start && typeof item.start.secs === "number" ? item.start.secs : NaN;
      if (!isNaN(startSec)) {
        const dist = Math.abs(startSec - seconds);
        if (dist < bestDist) {
          bestDist = dist;
          best = ordinal;
        }
      }
    }
  }
  return best;
};

/**
 * Source-file seconds where a clip's content ends: its true source start
 * (`inPoint * speed`) plus its timeline length times its speed, which is what
 * the clip plays. `outPoint` can't be used for this: once a script changes a
 * clip's `.end`, Premiere Pro keeps reporting the earlier `outPoint` (at 100%
 * as well), and at other speeds `outPoint * speed` then runs long by up to
 * (speed - 1) times the clip's length. For a clip trimmed in the timeline both
 * give the same value.
 */
const clipSourceEndSec = (clip: TrackItem, speed: number): number =>
  clip.inPoint.seconds * speed + (clip.end.seconds - clip.start.seconds) * speed;

/** Length of one frame of the sequence's video frame rate, 1/25 s if unreadable. */
const sequenceFrameSec = (seq: Sequence): number => {
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0 && vfr.seconds < 1) return vfr.seconds;
  } catch (e) {
    // fall through to the default
  }
  return 1 / 25;
};

/** How close the speed Premiere applied must be to the one asked for. */
const SPEED_MATCH_EPS = 0.0005;
/** Upper bound on repeated setSpeed() calls for one clip (see setSpeedFully). */
const SPEED_MAX_CALLS = 200;

const readClipSpeed = (clip: TrackItem, fallback: number): number => {
  try {
    const s = clip.getSpeed();
    if (typeof s === "number" && s > 0) return s;
  } catch (e) {
    // fall through
  }
  return fallback;
};

/**
 * Sets a clip's speed with QE's setSpeed() (no ripple) and returns the speed
 * Premiere actually applied. One setSpeed() call never takes a clip past
 * (media length) / (its timeline-scaled out-point: the source in-point / speed
 * plus its timeline length), so a sped-up clip whose source ends near the end
 * of its file comes back slower than asked, at little more than 100% for the
 * last piece of a file. Each further call starts from the smaller scaled
 * out-point the last one left, and a clip shortened to one frame leaves almost
 * only the source in-point / speed in it. So a capped clip is shortened to one
 * frame and the call repeated until the speed is reached, a call makes no
 * progress, or SPEED_MAX_CALLS is used up.
 * Shortening a clip only moves its out-point within its own media; the caller
 * sets its final `.end` from the returned speed, which brings the source end
 * back to where it was. Slowing down is never capped this way.
 *
 * `findQeItem` looks the clip's QE item up again before each repeat, since a
 * `.end` change can leave an earlier QE reference pointing at stale data.
 */
const setSpeedFully = (qeItem: any, clip: TrackItem, factor: number, frameSec: number, findQeItem?: () => any): number => {
  qeItem.setSpeed(factor, "", false, false, false);
  let actual = readClipSpeed(clip, factor);
  if (factor <= 1 || Math.abs(actual - factor) <= SPEED_MATCH_EPS) return actual;
  try {
    clip.end = secondsToTime(clip.start.seconds + frameSec);
  } catch (e) {
    // still repeat: each call gets a little further even at full length
  }
  for (let i = 0; i < SPEED_MAX_CALLS && Math.abs(actual - factor) > SPEED_MATCH_EPS; i++) {
    let item = qeItem;
    if (findQeItem) {
      try {
        item = findQeItem() || qeItem;
      } catch (e) {
        item = qeItem;
      }
    }
    item.setSpeed(factor, "", false, false, false);
    const next = readClipSpeed(clip, factor);
    if (next <= actual + 0.000001) {
      actual = next;
      break;
    }
    actual = next;
  }
  return actual;
};

/** setSpeedFully's `findQeItem` for a clip on a known QE track. */
const qeItemFinder =
  (qeTrack: any, clip: TrackItem): (() => any) =>
  (): any => {
    const ordinal = qeFindOrdinalAt(qeTrack, clip.start.seconds);
    return ordinal >= 0 ? qeGetClipAt(qeTrack, ordinal) : null;
  };

/** A speed factor as the panel shows it: a percentage to one decimal at most. */
const speedPercentText = (factor: number): string => String(Math.round(factor * 1000) / 10);

/** Message for pieces Premiere wouldn't take to the full speed. */
const speedShortfallWarning = (count: number, lowestFactor: number, factor: number): string =>
  `Premiere Pro applied less than ${speedPercentText(factor)}% to ${count} piece(s) (lowest ${speedPercentText(
    lowestFactor,
  )}%). They still play all of their audio, at that lower speed.`;

/** One parameter to set on an effect — {@link setEffectParamsOnClip}. */
export interface EffectParamValue {
  paramName: string;
  value: number;
}

/** Sets one or more named params on the clip's first component whose display
 *  name is `effectName` (case-insensitive, whole name: a third-party effect
 *  whose name contains the same words, such as kHs Pitch Shifter, does not
 *  match), via the standard (documented) Component/ComponentParam DOM.
 *  Works for Premiere's own effects and any installed third-party VST/AU
 *  exposed the same way in Premiere's DOM, as long as the effect was already
 *  added to the clip
 *  (standard DOM can configure an existing effect's params but can't add a
 *  new one to a clip — that part needs the QE DOM, see
 *  applyPitchToSelection). A bad parameter name in one entry doesn't
 *  block the rest: each missing or rejected parameter becomes its own
 *  warning.
 *  Returns per-parameter warnings; throws only if the effect itself isn't
 *  found on the clip at all. */
const setEffectParamsOnClip = (clip: TrackItem, effectName: string, params: EffectParamValue[]): string[] => {
  const components: any = clip.components;
  if (!components) throw new Error("Premiere couldn't read this clip's effects.");
  const needle = effectName.toLowerCase();
  for (let i = 0; i < components.numItems; i++) {
    const comp = components[i];
    const name = comp && comp.displayName ? String(comp.displayName).toLowerCase() : "";
    if (name === needle) {
      const warnings: string[] = [];
      for (let p = 0; p < params.length; p++) {
        const { paramName, value } = params[p];
        const param = comp.properties && comp.properties.getParamForDisplayName(paramName);
        if (!param) {
          // List every real parameter name this component has, so the error says
          // which names exist instead of needing a separate Diagnostics round trip.
          let available = "";
          try {
            const names: string[] = [];
            const props = comp.properties;
            for (let pi = 0; pi < props.numItems; pi++) {
              const prop = props[pi];
              if (prop && prop.displayName) names.push(String(prop.displayName));
            }
            available = names.length ? ` Available parameters: ${names.join(", ")}.` : "";
          } catch (e) {
            // best effort — the warning below is still useful without this
          }
          warnings.push(`"${effectName}" added, but its "${paramName}" parameter was not found.${available}`);
          continue;
        }
        try {
          param.setValue(value, true);
        } catch (e) {
          warnings.push(`"${effectName}": its "${paramName}" setting could not be changed (${errMsg(e)}).`);
        }
      }
      return warnings;
    }
  }
  throw new Error(`"${effectName}" was added but can't be found on the clip. Add it again by hand in Effect Controls.`);
};

/** Best effort: switches the sequence's audio channel type from mono to
 *  stereo before a Cut or before Pitch Shifter is added. Some stereo-only
 *  audio plug-ins (for example a third-party pitch VST3 a user adds instead
 *  of Pitch Shifter) don't instantiate on a mono-configured sequence. This
 *  is the one *documented*, standard-DOM lever for sequence-level audio
 *  channel type (SequenceSettings.audioChannelType, 0 = Mono, 1 = Stereo),
 *  as opposed to the undocumented QE surface much of this file relies on.
 *  Never throws: it is not a precondition for either operation. */
const ensureSequenceStereo = (seq: Sequence): boolean => {
  try {
    const settings = seq.getSettings();
    if ((settings as any).audioChannelType === 0) {
      (settings as any).audioChannelType = 1;
      seq.setSettings(settings);
      return true;
    }
  } catch (e) {
    // best effort — leave the sequence as-is
  }
  return false;
};

// =========================
// Public API (called from the panel via evalTS)
// =========================

/** Reads the single selected timeline clip: source media path + fps-mismatch check. */
export const getSelectedClipInfo = (): ClipInfo => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");

  const { clip, trackType, trackIndex } = getSelectedTrackItem(seq);

  // Audio-only sequences (e.g. a sequence auto-created by dropping a voice
  // MP3 straight onto a new timeline, with no video track at all) can leave
  // videoFrameRate unset in scripting even though Premiere accepts them —
  // fps is meaningless for audio anyway, so fall back rather than crash.
  let sequenceFps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) {
      sequenceFps = 1 / vfr.seconds;
    }
  } catch (e) {
    // leave the fallback in place
  }
  let sourceFps = sequenceFps;
  let mediaPath = "";
  if (clip.projectItem) {
    mediaPath = clip.projectItem.getMediaPath() || "";
  }
  // `TrackItem.inPoint`/`.outPoint` are timeline-scaled, not source time, once
  // the clip's Speed is not 100% (the same undocumented behaviour
  // sendToAfterEffects handles). scanAudioFile passes these to ffmpeg's
  // `-ss`/`-t` as seconds into the source file (see analyze.ts's TrimRange), so
  // they must be source time; otherwise an already sped-up clip would be
  // analysed over the wrong span.
  let speedFactor = 1;
  try {
    const s = clip.getSpeed();
    if (typeof s === "number" && s > 0) speedFactor = s;
  } catch (e) {
    // leave at 1 — treated as unchanged rather than guessing
  }
  const sourceInPoint = clip.inPoint.seconds * speedFactor;
  const sourceOutPoint = clipSourceEndSec(clip, speedFactor);

  // Frame-rate drift only means anything for a clip with a video stream. For an
  // audio-only source (the main case, voice tracks),
  // "Column.Intrinsic.MediaTimebase" is the audio clock (e.g. 44100), not a
  // video frame rate, and would report a "44100 fps" frame rate. Only check
  // clips selected on a video track.
  let fpsMismatch = false;
  if (trackType === "video" && clip.projectItem) {
    const fps = getItemFrameRate(clip.projectItem);
    if (fps) {
      sourceFps = fps;
      fpsMismatch = Math.abs(sequenceFps - sourceFps) > 0.05;
    }
  }

  return {
    trackType,
    trackIndex,
    clipName: clip.name,
    mediaPath,
    nodeId: clip.nodeId,
    sequenceName: seq.name,
    sequenceFps,
    sourceFps,
    fpsMismatch,
    sourceInPoint,
    sourceOutPoint,
    speedFactor,
    otherLinkedAudioTracks: trackType === "audio" ? otherLinkedAudioTracks(seq, clip, trackIndex) : [],
  };
};

/** Same as getSelectedClipInfo, but returns null instead of throwing when
 *  there isn't exactly one clip selected (no active sequence, nothing
 *  selected, or a multi-selection) — for the AI Voice tab's background
 *  "does the current selection look like something I generated before?"
 *  check, which must stay silent when the answer is just "no selection
 *  right now," not surface an error banner for a completely normal state. */
export const getSelectedClipInfoIfAny = (): ClipInfo | null => {
  try {
    return getSelectedClipInfo();
  } catch (e) {
    return null;
  }
};

/** Premiere's scripting tick resolution (ticks per second, a documented
 *  Adobe constant). QE DOM's razor() takes a plain string argument, and one
 *  of its accepted forms is a tick count as a string; this converts a plain
 *  seconds value into that form. */
const PREMIERE_TICKS_PER_SECOND = 254016000000;

/**
 * `ProjectItem.setInPoint()`/`setOutPoint()`'s required second parameter (calls
 * without it throw "Not Enough Parameters"): an integer media-type selector —
 * 1 = video only, 2 = audio only, 4 = all media types. 4 is used even for
 * audio-only calls, so the video side of a ProjectItem shared by a linked
 * audio+video pair is narrowed as well.
 */
const PROJECT_ITEM_ALL_MEDIA = 4;

/** seconds -> "HH:MM:SS:FF" timecode string. ppro-utils.ts's own
 *  secondsToTime() builds a standard-DOM Time object, which QE DOM's
 *  razor() can't take — it wants a string. The format follows the secsToTC
 *  helper of the MIT-licensed "DeadAir" Premiere extension
 *  (github.com/nzalexgarciagil-ctrl/deadair-premiere, host/deadair.jsx; see
 *  NOTICE.md); the frame rounding is described below. */
// Rounds to the NEAREST frame through a single frame count, rather than flooring
// each field separately. Razor cut times are continuous-time gap boundaries that
// often land close to a half frame; flooring would put every cut up to a frame
// early, and a kept piece could then start with a sliver of the silence before
// it. Deriving h/m/s/f from one frame count also handles rounding up to a full
// second/minute/hour with plain div/mod.
//
// The frame count uses the true fractional `fps` (e.g. 29.97, from
// `seq.getSettings().videoFrameRate`); `wholeFps` only splits that count into
// HH:MM:SS:FF fields. Converting with the rounded rate would make NTSC footage
// (23.976/29.97/59.94) drift about 0.1%, an error that grows with timeline
// position until later cuts fall outside cutClipViaRazor's boundary tolerance.
const secondsToTimecodeString = (totalSeconds: number, fps: number): string => {
  const clamped = totalSeconds < 0 ? 0 : totalSeconds;
  const wholeFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.round(clamped * fps);
  const f = totalFrames % wholeFps;
  const totalWholeSeconds = Math.floor(totalFrames / wholeFps);
  const h = Math.floor(totalWholeSeconds / 3600);
  const m = Math.floor((totalWholeSeconds % 3600) / 60);
  const s = totalWholeSeconds % 60;
  const pad = (n: number): string => (n < 10 ? "0" + n : String(n));
  return pad(h) + ":" + pad(m) + ":" + pad(s) + ":" + pad(f);
};

/**
 * Locks every unlocked track except `audioTrack` and `videoTrack` (matched by
 * id within their kind) and returns the tracks it locked, for
 * unlockTracks. QE's sequence razor splits every unlocked track at the given
 * time, so this keeps a music bed or a title on another track free of extra
 * edit points.
 */
const lockOtherTracks = (seq: Sequence, audioTrack: Track, videoTrack: Track | null): Track[] => {
  const locked: Track[] = [];
  const lock = (t: Track): void => {
    if (isTrackLocked(t)) return;
    try {
      (t as any).setLocked(1);
      locked.push(t);
    } catch (e) {
      // a track that can't be locked keeps the extra edit points, nothing worse
    }
  };
  for (let v = 0; v < seq.videoTracks.numTracks; v++) {
    const t = seq.videoTracks[v];
    if (!videoTrack || t.id !== videoTrack.id) lock(t);
  }
  for (let a = 0; a < seq.audioTracks.numTracks; a++) {
    const t = seq.audioTracks[a];
    if (t.id !== audioTrack.id) lock(t);
  }
  return locked;
};

/** Unlocks the tracks lockOtherTracks locked. */
const unlockTracks = (locked: Track[], warnings: string[]): void => {
  for (let i = 0; i < locked.length; i++) {
    try {
      (locked[i] as any).setLocked(0);
    } catch (e) {
      warnings.push(`Could not unlock track "${locked[i].name}" after cutting (${errMsg(e)}). Unlock it by hand.`);
    }
  }
};

/**
 * Cuts the selected clip in place via razor + delete + move. `cutSelectedClip`
 * uses this for every clip, audio-only or with linked video (`videoTrack` is
 * null for an audio-only clip).
 *
 * It never calls overwriteClip() or touches a ProjectItem. overwriteClip()
 * briefly places a clip spanning its ProjectItem's whole source duration, which
 * can overwrite a neighbouring clip, and on a linked pair it also disturbs the
 * video track. This function only splits and repositions TrackItems that are
 * already on the timeline at their own bounds, so neither risk applies.
 *
 * Adapted from the MIT-licensed "DeadAir" Premiere extension
 * (github.com/nzalexgarciagil-ctrl/deadair-premiere, host/deadair.jsx, itself
 * credited to kinokit's removeTimeRanges), narrowed from "every track of the
 * sequence" to this one clip's original timeline span:
 *
 * 1. QE DOM's razor() signature is undocumented and differs between Premiere
 *    versions, so the working form is discovered at run time from 6 candidates
 *    (razor/razorAt x timecode / ticks / seconds string), by razoring at cut
 *    times inside the clip and checking that a split appeared there.
 * 2. Razors at the sequence level (`qeSeq.razor(...)`), the call pattern DeadAir
 *    uses. That splits every unlocked track, so every other track is locked
 *    for the razor and unlocked right after (lockOtherTracks): a music bed or a
 *    title elsewhere gets no extra edit points. The delete and move phases
 *    below only act on this clip's own tracks.
 * 3. Collects every resulting piece on this clip's audio track (and video track,
 *    if any) that lies mostly inside a silence gap and removes them with
 *    `.remove(false, false)`, which doesn't ripple, so batching is safe.
 * 4. On each track, takes the surviving pieces within the clip's original span,
 *    sorts them by position and walks a cursor from the clip's original start,
 *    calling `.move(-gap)` to close every gap larger than ~0.4 frames. Each move
 *    is small and local, and nothing past the clip's original end moves.
 * 5. With linked video, both tracks are cut at the same positions and closed with
 *    the same math, so audio and video stay in sync without relying on
 *    Premiere's clip linking (which QE's razor() breaks anyway).
 *
 * Never throws for an expected failure (QE unavailable, no working razor method,
 * a rejected razor/remove/move call): it degrades to a warning and returns what
 * is left, since a half-finished cut has no clean rollback.
 */
const cutClipViaRazor = (
  seq: Sequence,
  clip: TrackItem,
  track: Track,
  videoTrack: Track | null,
  segments: CutSegment[],
): { clips: TrackItem[]; videoClips: TrackItem[]; warnings: string[] } => {
  const warnings: string[] = [];
  const timelineStart = clip.start.seconds;
  const originalDuration = clip.end.seconds - clip.start.seconds;
  const originalEnd = timelineStart + originalDuration;
  const EPS = 0.001;

  // `segments[].start`/`.end` are SOURCE-media seconds (Scan decodes the clip's
  // source file), while everything below works in timeline seconds. At speed
  // factor S a source offset x covers x/S seconds of timeline. `sourceToTimeline()`
  // is the one conversion point: everything downstream of `gaps` (frame math,
  // razor calls, the gap-closing sweep) already works in timeline seconds. At
  // 100% speed it changes nothing.
  let speedFactor = 1;
  let rawGetSpeed: number | null = null;
  try {
    const s = clip.getSpeed();
    if (typeof s === "number") rawGetSpeed = s;
    if (typeof s === "number" && s > 0) speedFactor = s;
  } catch (e) {
    // leave at 1 — treated as unchanged rather than guessing
  }
  const sourceToTimeline = (sourceRelativeSeconds: number): number => timelineStart + sourceRelativeSeconds / speedFactor;

  // The speed model above assumes one flat multiplier for the whole clip
  // (`clip.getSpeed()`), which is right for a plain Speed/Duration change. Time
  // Remapping (keyframed, variable speed) is not modelled: if getSpeed() doesn't
  // reflect a time-remapped clip's real speed, cut points could land outside the
  // clip's span and every razor call would miss. This only detects whether a Time
  // Remapping component is present (best effort, never throws), so the warning
  // can report it.
  let hasTimeRemapping = false;
  try {
    const comps = (clip as any).components;
    if (comps && typeof comps.numItems === "number") {
      for (let ci = 0; ci < comps.numItems; ci++) {
        const dn = String(comps[ci]?.displayName || "");
        if (/time\s*remap/i.test(dn)) {
          hasTimeRemapping = true;
          break;
        }
      }
    }
  } catch (e) {
    // best effort — never let diagnostic capture break the real cut
  }

  // `segments` are the KEPT ranges (source-media-relative, sorted by Scan) —
  // the silence to cut is everything *between* them, plus a possible
  // leading/trailing sliver. Convert to absolute timeline seconds.
  const sortedSegs = segments.slice().sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = [];
  let prevEnd = 0;
  for (let i = 0; i < sortedSegs.length; i++) {
    if (sortedSegs[i].start > prevEnd + EPS) {
      gaps.push({ start: sourceToTimeline(prevEnd), end: sourceToTimeline(sortedSegs[i].start) });
    }
    if (sortedSegs[i].end > prevEnd) prevEnd = sortedSegs[i].end;
  }
  // prevEnd is still source-relative here — compare against originalDuration
  // (a timeline quantity) in the same units by dividing first, not by
  // comparing the two mismatched units directly.
  if (prevEnd / speedFactor < originalDuration - EPS) {
    gaps.push({ start: sourceToTimeline(prevEnd), end: originalEnd });
  }

  if (gaps.length === 0) {
    // No silence found inside this clip at all — nothing to cut, leave
    // it (and its linked video, if any) completely untouched.
    return { clips: [clip], videoClips: [], warnings };
  }

  let fps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
  } catch (e) {
    // leave the fallback in place
  }

  // Every unique cut boundary between a kept segment and a silence gap,
  // excluding the clip's own original start/end (nothing to cut there).
  const rawCutTimes: number[] = [];
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i].start > timelineStart + EPS) rawCutTimes.push(gaps[i].start);
    if (gaps[i].end < originalEnd - EPS) rawCutTimes.push(gaps[i].end);
  }
  rawCutTimes.sort((a, b) => a - b);
  const cutTimes: number[] = [];
  for (let i = 0; i < rawCutTimes.length; i++) {
    if (i === 0 || rawCutTimes[i] - cutTimes[cutTimes.length - 1] > EPS) cutTimes.push(rawCutTimes[i]);
  }
  if (cutTimes.length === 0) {
    return { clips: [clip], videoClips: [], warnings };
  }

  if (typeof qe === "undefined") app.enableQE();
  if (!qe) {
    warnings.push(
      "Cannot cut this clip: Premiere's editing interface isn't available in this session. Restart Premiere Pro and try again; the clip was left untouched.",
    );
    return { clips: [clip], videoClips: [], warnings };
  }
  let qeSeq: any;
  try {
    qeSeq = qe.project.getActiveSequence();
  } catch (e) {
    qeSeq = null;
  }
  if (!qeSeq) {
    warnings.push(
      "Cannot cut this clip: no active sequence. Open the sequence in the Timeline and try again; the clip was left untouched.",
    );
    return { clips: [clip], videoClips: [], warnings };
  }

  const toArg = (time: number, kind: "tc" | "ticks" | "secs"): string => {
    if (kind === "tc") return secondsToTimecodeString(time, fps);
    if (kind === "ticks") return String(Math.round(time * PREMIERE_TICKS_PER_SECOND));
    return String(time);
  };
  // "tc" (an HH:MM:SS:FF timecode string) is tried first: the QE type
  // declarations (types-for-adobe-extras, Premiere/12.0/qeDom.d.ts) declare
  // `Sequence.razor(timecode: string, p1: boolean, p2: boolean)`, so a timecode
  // string matches the declared shape. "ticks" (a tick-count string) and "secs"
  // (a decimal-seconds string) don't; a malformed argument can still split the
  // track somewhere else, so trying them first can lock discovery onto an
  // encoding that cuts at the wrong positions. Discovery below therefore also
  // checks where each split landed.
  const candidates: { fn: string; kind: "tc" | "ticks" | "secs" }[] = [
    { fn: "razor", kind: "tc" },
    { fn: "razor", kind: "ticks" },
    { fn: "razor", kind: "secs" },
    { fn: "razorAt", kind: "tc" },
    { fn: "razorAt", kind: "ticks" },
    { fn: "razorAt", kind: "secs" },
  ];

  // Discovery: every cutTime falls strictly inside this clip's still-unbroken span
  // at this point (rawCutTimes only holds points strictly between timelineStart
  // and originalEnd), so cutTimes[0] is always a valid test point.
  //
  // A candidate is accepted only when a split appears AT the tested time (the same
  // tolerance-based boundary match as the final check below), not merely when the
  // track's clip count grows: a wrong encoding can split somewhere else.
  const firstCutTime = cutTimes[0];
  const hasBoundaryNear = (time: number, tol: number): boolean => {
    for (let i = 0; i < track.clips.numItems; i++) {
      if (Math.abs(track.clips[i].start.seconds - time) < tol) return true;
    }
    return false;
  };
  // 0.55/fps rather than 0.5/fps: `secondsToTimecodeString` rounds to the nearest
  // frame, so the worst case lands exactly half a frame from the continuous-time
  // value (e.g. 1.980 s at 25 fps = frame 49.5). A tolerance of exactly 0.5/fps
  // with a strict `<` would reject that legitimate tie. The small buffer covers
  // the tie plus floating-point noise and stays far below a full frame, so a cut
  // that misses by about a frame or more is still caught.
  const discoveryTol = 0.55 / fps;
  // A candidate must verify at the first cut point and also at a second and a
  // middle one before it is trusted for the whole clip: one success only shows it
  // did something plausible once, and a candidate that works by coincidence on the
  // first call would otherwise wreck most of the file. Points verified here are
  // real cuts, kept even if a later candidate wins; the main loop revisiting them
  // is a no-op.
  // Manual loop, not Array.from(new Set(...).filter(...)): this ExtendScript
  // engine has no Array.from, Set or Array.prototype.filter
  // (src/jsx/ppro/tsconfig.json catches these, which is why it is type-checked
  // separately from the panels).
  const rawSampleCandidates = [0, cutTimes.length > 1 ? 1 : 0, Math.floor(cutTimes.length / 2)];
  const sampleIndices: number[] = [];
  for (let si = 0; si < rawSampleCandidates.length; si++) {
    const candIdx = rawSampleCandidates[si];
    if (candIdx >= cutTimes.length) continue;
    let alreadyIncluded = false;
    for (let sj = 0; sj < sampleIndices.length; sj++) {
      if (sampleIndices[sj] === candIdx) {
        alreadyIncluded = true;
        break;
      }
    }
    if (!alreadyIncluded) sampleIndices.push(candIdx);
  }
  let workingMethod: { fn: string; kind: "tc" | "ticks" | "secs" } | null = null;
  // Every candidate tried, reported in the warning below if none works.
  const candidateLog: string[] = [];
  // Snapshot before any candidate is tried: a candidate can make a few real
  // splits before it is rejected; if all candidates fail, this tells the
  // warning below whether the clip really was left untouched.
  const discoveryStartCount = track.clips.numItems;
  // Only this clip's own tracks take the razor: lockOtherTracks locks the
  // others, and they are unlocked again once razoring is over, also when it
  // throws.
  const lockedForRazor = lockOtherTracks(seq, track, videoTrack);
  try {
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const label = `${cand.fn}/${cand.kind}`;
      if (typeof qeSeq[cand.fn] !== "function") {
        candidateLog.push(`${label}: not a function`);
        continue;
      }
      let allSamplesOk = true;
      let sampleReport = "";
      for (const sampleIdx of sampleIndices) {
        const sampleTime = cutTimes[sampleIdx];
        // If an EARLIER candidate in this same discovery loop already split
        // this exact position successfully before being rejected at a LATER
        // sample, there's nothing left here for the CURRENT candidate to
        // split — calling it again would be a guaranteed no-op regardless of
        // whether this candidate is actually fine, wrongly rejecting it.
        // Skip re-verifying an already-satisfied position; the real signal
        // is in the sample(s) still unresolved.
        if (hasBoundaryNear(sampleTime, discoveryTol)) {
          sampleReport += ` [${sampleIdx}]already-split`;
          continue;
        }
        const beforeSample = track.clips.numItems;
        try {
          qeSeq[cand.fn](toArg(sampleTime, cand.kind));
        } catch (e) {
          sampleReport += ` [${sampleIdx}]threw(${errMsg(e)})`;
          allSamplesOk = false;
          break;
        }
        const gotBoundary = hasBoundaryNear(sampleTime, discoveryTol);
        const countChanged = track.clips.numItems > beforeSample;
        // Require both a new boundary (not one that existed before this call) and
        // that it lands at the right position.
        if (!countChanged || !gotBoundary) {
          sampleReport += ` [${sampleIdx}]no-op(countChanged=${countChanged} boundaryFound=${gotBoundary})`;
          allSamplesOk = false;
          break;
        }
        sampleReport += ` [${sampleIdx}]OK`;
      }
      if (allSamplesOk) {
        workingMethod = cand;
        candidateLog.push(`${label}: OK (verified at ${sampleIndices.length} points:${sampleReport})`);
        break;
      }
      candidateLog.push(`${label}: rejected —${sampleReport}`);
    }
    if (!workingMethod) {
      const partialSplits = track.clips.numItems - discoveryStartCount;
      const untouchedNote =
        partialSplits > 0
          ? `${partialSplits} split(s) may already be on the track. Check the clip before trying again.`
          : "left untouched.";
      warnings.push(
        `Cannot cut this clip: Premiere didn't split it — ${untouchedNote} If its track is locked, unlock it and try again; otherwise run Diagnostics from the gear menu and add the report to a bug report. ` +
          `[diagnostic: fps=${fps.toFixed(3)} speedFactor=${speedFactor} rawGetSpeed=${rawGetSpeed} hasTimeRemapping=${hasTimeRemapping} ` +
          `firstCutTime=${firstCutTime.toFixed(3)}s timelineStart=${timelineStart.toFixed(3)}s originalEnd=${originalEnd.toFixed(3)}s ` +
          `sequenceName="${(seq as any).name || "?"}" candidates=[${candidateLog.join("; ")}]]`,
      );
      return { clips: [clip], videoClips: [], warnings };
    }
    for (let i = 1; i < cutTimes.length; i++) {
      try {
        qeSeq[workingMethod.fn](toArg(cutTimes[i], workingMethod.kind));
      } catch (e) {
        warnings.push(`Razoring at ${cutTimes[i].toFixed(3)}s failed (${errMsg(e)}).`);
      }
    }
  } finally {
    unlockTracks(lockedForRazor, warnings);
  }

  // The standard DOM's `track.clips` collection doesn't reliably reflect a
  // QE-side razor checked right after the call, so this checks once, after the
  // whole razoring loop, whether every intended cutTime has a matching clip
  // boundary. A cutTime with none means that razor call silently did nothing
  // (landed exactly on an existing boundary, drifted off the frame grid, etc.)
  // and its silence gap was never split out.
  {
    const actualStarts: number[] = [];
    for (let i = 0; i < track.clips.numItems; i++) actualStarts.push(track.clips[i].start.seconds);
    // Same 0.55/fps reasoning as discoveryTol above — a cutTime sitting
    // exactly on a frame's half-point rounds correctly but lands exactly
    // 0.5/fps away from its own target, which a tolerance of exactly
    // 0.5/fps (with strict `<`) would wrongly flag as a miss.
    const tol = 0.55 / fps;
    // A cutTime within one frame of the clip's original start or end is a
    // sub-frame sliver with nothing to split away, so it isn't reported as
    // "didn't actually split". This only changes the report, not the cut: the razor
    // loop above still tries every cutTime.
    const edgeTol = 1 / fps;
    const missing: string[] = [];
    for (let i = 0; i < cutTimes.length; i++) {
      if (cutTimes[i] - timelineStart < edgeTol || originalEnd - cutTimes[i] < edgeTol) continue;
      let found = false;
      for (let j = 0; j < actualStarts.length; j++) {
        if (Math.abs(actualStarts[j] - cutTimes[i]) < tol) {
          found = true;
          break;
        }
      }
      if (!found) missing.push(cutTimes[i].toFixed(3));
    }
    if (missing.length > 0) {
      // A few missing points (isolated, sub-frame-close cutTime pairs; see edgeTol
      // above) are expected and harmless. When many fail, the warning carries
      // diagnostic data (frame rate, speed, Time Remapping, the razor method in use).
      const failureRate = missing.length / cutTimes.length;
      let msg = `${missing.length} of ${cutTimes.length} cut points didn't actually split the clip (at ${missing.join(", ")}s) — that silence may not have been fully removed.`;
      if (failureRate > 0.3) {
        msg += ` [diagnostic: fps=${fps.toFixed(3)} speedFactor=${speedFactor} rawGetSpeed=${rawGetSpeed} hasTimeRemapping=${hasTimeRemapping} sequenceName="${(seq as any).name || "?"}" workingMethod=${workingMethod.fn}/${workingMethod.kind}]`;
      }
      warnings.push(msg);
    }
  }

  // Collect every resulting silence piece on this clip's own audio and video
  // tracks (never any other track) whose span is mostly inside a silence gap, then
  // batch-remove: remove(false,false) doesn't ripple, so collecting references
  // first and removing afterwards is safe.
  //
  // A piece counts as silence when gaps cover more than half of its duration.
  // Gaps and kept segments tile the clip's whole span, so an unshifted piece is
  // ~100% on one side, and frame-snap drift can only nudge that a little either
  // way. A midpoint check with a fixed tolerance breaks down when many short
  // segments are packed tightly; the majority rule needs no tolerance at all.
  const gapOverlapSeconds = (start: number, end: number): number => {
    let overlap = 0;
    for (let i = 0; i < gaps.length; i++) {
      const overlapStart = Math.max(start, gaps[i].start);
      const overlapEnd = Math.min(end, gaps[i].end);
      if (overlapEnd > overlapStart) overlap += overlapEnd - overlapStart;
    }
    return overlap;
  };
  // Any piece under 2 frames long that touches a gap at all is removed as debris,
  // regardless of the 50% rule. Two razor cuts meant for the same boundary can
  // snap to adjacent frames and leave a ~1-frame sliver between them at 25-50%
  // gap overlap; that is never real content (kept segments are far longer).
  const minMeaningfulDuration = 2 / fps;
  const isMostlyGap = (start: number, end: number): boolean => {
    const dur = end - start;
    if (dur <= 0) return false;
    const overlap = gapOverlapSeconds(start, end);
    if (dur < minMeaningfulDuration && overlap > 0) return true;
    return overlap > dur / 2;
  };
  // Only clips within this clip's original span `[timelineStart, originalEnd)` are
  // considered, the same scope `sweepTrack` uses. `isMostlyGap` only compares
  // timeline positions, so without this a touching neighbour's tail could fall
  // inside this clip's leading gap window (which starts exactly at the neighbour's
  // end) and be deleted. Razor only splits, never moves, so every fragment of this
  // clip starts at least a frame before `originalEnd`; a clip that starts at
  // `originalEnd` itself is the next clip on the track, so the upper bound is
  // `originalEnd - EPS`, not `+ EPS`.
  const toRemove: TrackItem[] = [];
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    const s = c.start.seconds;
    if (s < timelineStart - EPS || s >= originalEnd - EPS) continue;
    if (isMostlyGap(s, c.end.seconds)) toRemove.push(c);
  }
  if (videoTrack) {
    for (let i = 0; i < videoTrack.clips.numItems; i++) {
      const c = videoTrack.clips[i];
      const s = c.start.seconds;
      if (s < timelineStart - EPS || s >= originalEnd - EPS) continue;
      if (isMostlyGap(s, c.end.seconds)) toRemove.push(c);
    }
  }
  for (let i = 0; i < toRemove.length; i++) {
    try {
      toRemove[i].remove(false, false);
    } catch (e) {
      warnings.push(`Removing a silence piece failed (${errMsg(e)}).`);
    }
  }

  // Close the remaining gaps independently on each track, bounded to this
  // clip's own original span: pieces of other clips elsewhere on the same
  // track stay where they are, so Cut never ripples later content. The same
  // `originalEnd - EPS` bound as the removal pass above: a clip that starts
  // exactly at `originalEnd` is the next clip, touching this one, and is not
  // swept (it would be moved left by the width of the last gap and selected
  // as part of the result).
  const minGapSeconds = 0.4 / fps;
  const sweepTrack = (trk: Track): TrackItem[] => {
    const items: { obj: TrackItem; start: number; dur: number }[] = [];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      const s = c.start.seconds;
      if (s >= timelineStart - EPS && s < originalEnd - EPS) {
        items.push({ obj: c, start: s, dur: c.end.seconds - c.start.seconds });
      }
    }
    items.sort((a, b) => a.start - b.start);
    let cursor = timelineStart;
    for (let i = 0; i < items.length; i++) {
      const gap = items[i].start - cursor;
      if (gap > minGapSeconds) {
        try {
          items[i].obj.move(-gap);
        } catch (e) {
          warnings.push(`Closing a gap failed (${errMsg(e)}).`);
        }
      }
      cursor += items[i].dur;
    }
    // Plain loop, not `.map()`: this ExtendScript engine has no
    // Array.prototype.map.
    const result: TrackItem[] = [];
    for (let i = 0; i < items.length; i++) result.push(items[i].obj);
    return result;
  };

  const newAudioClips = sweepTrack(track);
  const newVideoClips = videoTrack ? sweepTrack(videoTrack) : [];

  // `warnings` stays empty on a clean cut, which lets the panel show a green
  // success banner instead of an amber warning one. Undo for this Cut is
  // offered by the panel (CutResult.undoInfo), not reported here.
  return { clips: newAudioClips, videoClips: newVideoClips, warnings };
};

/**
 * Rebuilds the selected clip from a list of speech segments (source-media
 * seconds), removing everything else: the silence cut, and nothing more. Speed
 * is a separate step, run afterwards on the pieces this leaves selected
 * (rebuildCutFromOriginal right after a Cut, applySpeedToSelection otherwise).
 *
 * Always delegates to `cutClipViaRazor` (razor + delete + move), which never
 * calls overwriteClip() or touches a ProjectItem, so neighbouring clips need no
 * pre-flight collision check.
 *
 * Trade-off: razor/delete/move pushes an unpredictable number of undo-stack
 * entries, and counting them is unsafe, so `CutResult` has no undo-step count
 * and the panel's Undo never uses Premiere's undo stack. `undoCutViaRazor`
 * rebuilds the original clip from `undoInfo` instead. `ensureSequenceStereo` is
 * still called (best effort, see `stereoForced` on `CutResult`), but it only
 * works while the timeline has no audio, and this mechanism never clears the
 * track (the clip is split and trimmed in place), so it isn't expected to take
 * effect.
 */
export const cutSelectedClip = (
  segments: CutSegment[],
  expectedNodeId?: string,
  expectedSourceInPoint?: number,
  expectedSourceOutPoint?: number,
  expectedSpeedFactor?: number,
): CutResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!segments || segments.length === 0) {
    throw new Error("No segments to cut — scan the clip first.");
  }

  const { clip, track, trackType, trackIndex } = getSelectedTrackItem(seq);
  // Only the audio part of a clip can be cut: with the video part selected on
  // its own (Linked Selection off, or Alt/Option-click), the razor and the
  // sweep would run on the video track while the audio keeps its pauses, and
  // Undo would look for the original on an audio track of the video's number.
  if (trackType !== "audio") {
    throw new Error(
      "Cut works on the audio part of a clip. Select the audio clip (click it with Linked Selection on, or Alt/Option-click the audio part), then Scan and Cut again. Nothing was changed.",
    );
  }

  const otherChannels = otherLinkedAudioTracks(seq, clip, trackIndex);
  if (otherChannels.length > 0) {
    throw new Error(
      `This clip has more linked audio channels on audio track(s) ${otherChannels.join(", ")}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan and Cut again. Nothing was changed.`,
    );
  }

  // The segments belong to the scanned clip: refuse, before anything changes,
  // when the selection is another clip of the same file (another soundbite, a
  // piece of an earlier Cut) or the scanned clip trimmed since Scan, at either
  // edge. The out-point is checked here, not only by the panel's selection
  // poll: a clip extended at its end and cut before the next poll would have
  // its new, unscanned tail removed as a trailing pause. Same tolerances as the
  // panel's isOtherClipOfScannedFile: a Speed change since Scan moves
  // outPoint * speed slightly, so the out-point tolerance is wider then.
  if (expectedNodeId || typeof expectedSourceInPoint === "number" || typeof expectedSourceOutPoint === "number") {
    let selectedSpeed = 1;
    try {
      const sp = clip.getSpeed();
      if (typeof sp === "number" && sp > 0) selectedSpeed = sp;
    } catch (e) {
      // treated as 100%, the same fallback as below
    }
    const otherClip = !!expectedNodeId && clip.nodeId !== expectedNodeId;
    const trimmed =
      typeof expectedSourceInPoint === "number" && Math.abs(clip.inPoint.seconds * selectedSpeed - expectedSourceInPoint) > 0.01;
    let trimmedEnd = false;
    if (typeof expectedSourceOutPoint === "number") {
      const speedChanged = typeof expectedSpeedFactor === "number" && Math.abs(selectedSpeed - expectedSpeedFactor) > 0.001;
      const outTolerance = speedChanged ? 0.25 : 0.01;
      trimmedEnd = Math.abs(clipSourceEndSec(clip, selectedSpeed) - expectedSourceOutPoint) > outTolerance;
    }
    if (otherClip || trimmed || trimmedEnd) {
      throw new Error(
        "The selected clip isn't the one that was scanned. Select it again, or Scan this clip, before cutting. Nothing was changed.",
      );
    }
  }
  const projectItem = clip.projectItem;
  if (!projectItem) throw new Error("Selected clip has no source media.");

  // getSelectedTrackItem resolved a linked audio+video clip (e.g. an MP4
  // avatar/talking-head video) down to its audio half — find its video
  // counterpart too, if any, so cutClipViaRazor can keep it in sync.
  let videoTrack: Track | null = null;
  let videoTrackIndex: number | null = null;
  let videoClip: TrackItem | null = null;
  try {
    const linked = clip.getLinkedItems();
    if (linked && linked.numItems > 0) {
      for (let i = 0; i < linked.numItems; i++) {
        const candidate = (linked as any)[i] as TrackItem;
        const loc = locateTrackOfClip(seq, candidate);
        if (loc && loc.trackType === "video" && candidate.projectItem) {
          videoTrack = loc.track;
          videoTrackIndex = loc.trackIndex;
          videoClip = candidate;
          break;
        }
      }
    }
  } catch (e) {
    // best effort — proceed audio-only if the linked video can't be resolved
  }
  // The video part is swept from the audio's start and comes back from Undo
  // with the audio's bounds, so a video part trimmed differently from its audio
  // (a J- or L-cut made by hand before Cut) would be shifted out of sync.
  if (videoClip) {
    let cutFps = 25;
    try {
      const vfr = seq.getSettings().videoFrameRate;
      if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) cutFps = 1 / vfr.seconds;
    } catch (e) {
      // keep the 25 fps fallback used elsewhere in this file
    }
    const boundsTol = 0.5 / cutFps;
    let startDiff = 0;
    let endDiff = 0;
    try {
      startDiff = Math.abs(videoClip.start.seconds - clip.start.seconds);
      endDiff = Math.abs(videoClip.end.seconds - clip.end.seconds);
    } catch (e) {
      // unreadable: treated as aligned
    }
    if (startDiff > boundsTol || endDiff > boundsTol) {
      throw new Error(
        "Cut works on a clip whose video and audio start and end together. This clip's video part is trimmed differently from its audio (a J- or L-cut made by hand): unlink the two and cut the audio on its own, or trim both to the same bounds, then Scan and Cut again. Nothing was changed.",
      );
    }
  }

  // Captured before razoring (reading afterwards would read an already-split
  // clip): everything undoCutViaRazor needs to rebuild the original clip from
  // scratch without touching Premiere's undo stack (see CutResult.undoInfo).
  // `sourceInPoint` is converted to true source-media time and `speedFactor` is
  // kept, so a clip sped up before Cut comes back on Undo with the right span of
  // the source file and its original Speed.
  let speedFactor = 1;
  try {
    const s = clip.getSpeed();
    if (typeof s === "number" && s > 0) speedFactor = s;
  } catch (e) {
    // leave at 1 — treated as unchanged rather than guessing
  }
  let undoInfo: CutUndoInfo | null = null;
  try {
    const mediaPath = projectItem.getMediaPath();
    if (mediaPath) {
      undoInfo = {
        trackIndex,
        videoTrackIndex,
        timelineStart: clip.start.seconds,
        originalDuration: clip.end.seconds - clip.start.seconds,
        sourceInPoint: clip.inPoint.seconds * speedFactor,
        mediaPath,
        speedFactor,
        projectItemNodeId: projectItem.nodeId,
        sequenceId: String(seq.sequenceID || ""),
        sequenceName: String(seq.name || ""),
      };
    }
  } catch (e) {
    // best effort — Undo just won't be offered for this Cut if this failed
  }

  // A locked track can't be razored or have pieces removed; refuse before
  // anything changes rather than leave a half-made cut.
  if (isTrackLocked(track)) {
    throw new Error(`Cannot cut: audio track ${trackIndex + 1} is locked. Unlock it, then try again. Nothing was changed.`);
  }
  if (videoTrack && videoTrackIndex !== null && isTrackLocked(videoTrack)) {
    throw new Error(`Cannot cut: video track ${videoTrackIndex + 1} is locked. Unlock it, then try again. Nothing was changed.`);
  }

  // Best effort (see this function's doc comment). Called before razoring
  // starts; the real return value is passed through.
  const stereoForced = ensureSequenceStereo(seq);

  const { clips: newClips, videoClips: newVideoClips, warnings } = cutClipViaRazor(seq, clip, track, videoTrack, segments);

  // Warning at Cut time. When narrowing a ProjectItem's In/Out doesn't take
  // effect (narrowingTakesEffect), J/L Pacing's collision guard
  // (applyJLCutSmoothing) keeps a safety margin against another file's clip equal
  // to this file's full media duration, because overwriteClip() then needs the
  // whole file for a moment. A second file cut close by on the same track would
  // otherwise only show up much later, as a blocked Pacing run. The check puts
  // the ProjectItem's marks back; it never blocks or changes the Cut.
  try {
    const myFullDuration = projectItem.getOutPoint().seconds - projectItem.getInPoint().seconds;
    const narrowingWorks = narrowingTakesEffect(projectItem, 0, Math.min(1, myFullDuration / 2));
    const cutStart = undoInfo ? undoInfo.timelineStart : clip.start.seconds;
    const cutEnd = newClips.length > 0 ? newClips[newClips.length - 1].end.seconds : cutStart;
    const findForeignNeighborName = (trackToCheck: Track | null): string | null => {
      if (!trackToCheck) return null;
      for (let ci = 0; ci < trackToCheck.clips.numItems; ci++) {
        const other = trackToCheck.clips[ci];
        if (!other.projectItem || other.projectItem.nodeId === projectItem.nodeId) continue;
        let dist = 0;
        if (other.start.seconds >= cutEnd) dist = other.start.seconds - cutEnd;
        else if (other.end.seconds <= cutStart) dist = cutStart - other.end.seconds;
        if (dist < myFullDuration) return other.name;
      }
      return null;
    };
    const foreignNeighbor = narrowingWorks
      ? null
      : findForeignNeighborName(track) || (videoTrack ? findForeignNeighborName(videoTrack) : null);
    if (foreignNeighbor) {
      warnings.push(
        `Note: a clip from another file ("${foreignNeighbor}") is close to this Cut on the same track. J/L Pacing on either file may be blocked later as a safety measure. If you plan to use J/L Pacing on either one, do it now, before cutting anything else nearby, or leave more space between the files' cuts (or use a different track).`,
      );
    }
  } catch (e) {
    // best effort — purely informational, never worth failing the Cut over
  }

  // Select every newly cut audio piece and its linked video piece, so Pacing can
  // run right away without re-selecting by hand. Video is selected explicitly
  // rather than relying on Premiere's Linked Selection toggle: with it off,
  // applyJLCutSmoothing's `seq.getSelection()` would come back audio-only and
  // skip all of its video handling (collision guard, sweep, cleanup).
  const allNewClips: TrackItem[] = [];
  for (let i = 0; i < newClips.length; i++) allNewClips.push(newClips[i]);
  for (let i = 0; i < newVideoClips.length; i++) allNewClips.push(newVideoClips[i]);
  for (let i = 0; i < allNewClips.length; i++) {
    try {
      allNewClips[i].setSelected(true, i === allNewClips.length - 1);
    } catch (e) {
      // non-fatal — selection is a convenience, not required for the cut itself
    }
  }

  return {
    segmentsCut: newClips.length,
    stereoForced,
    warnings,
    undoInfo,
  };
};

/**
 * Undoes a Cut deterministically, without touching Premiere's undo stack.
 * Cut's undo-stack footprint (a razor and a delete per boundary, a move per
 * surviving piece, on up to two tracks) can't be predicted, and undoing a wrong
 * count silently reverts the wrong amount. Instead this rebuilds the original,
 * uncut clip:
 *
 * 1. Finds the original ProjectItem (findProjectItemForMedia, bins included)
 *    before changing anything.
 * 2. Refuses, before anything changes, when a clip of other media now
 *    overlaps the original span `[timelineStart, timelineStart +
 *    originalDuration)` or a target track is locked. Then clears every clip
 *    of this source media that starts within that span, by position rather
 *    than remembered nodeIds, so it works however many pieces Cut left. Clips
 *    of other media are never removed.
 * 3. Sets the ProjectItem's in/out to the clip's original source range before
 *    placing it, so overwriteClip() places exactly the final span and doesn't
 *    reach into a neighbouring clip.
 * 4. Places it on the audio track, and on the video track if the clip had
 *    linked video (a linked pair shares one ProjectItem), then restores the
 *    exact bounds and the original Speed.
 *
 * Once the span is cleared, only a rejected audio placement throws; a rejected
 * video placement or a failed bounds/Speed write becomes a warning.
 */
export const undoCutViaRazor = (info: CutUndoInfo, segments?: { start: number; end: number }[]): { warnings: string[] } => {
  clearPlacementCache();
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (info.sequenceId && String(seq.sequenceID || "") !== info.sequenceId) {
    throw new Error(
      `Cannot undo: this Cut was made in the sequence "${info.sequenceName || ""}". Open that sequence, then try again. Nothing was changed.`,
    );
  }
  const warnings: string[] = [];
  const EPS = 0.001;
  const originalEnd = info.timelineStart + info.originalDuration;

  if (info.trackIndex < 0 || info.trackIndex >= seq.audioTracks.numTracks) {
    throw new Error("Cannot undo: the original audio track no longer exists.");
  }
  const track = seq.audioTracks[info.trackIndex];
  let videoTrack: Track | null = null;
  if (info.videoTrackIndex !== null) {
    if (info.videoTrackIndex >= 0 && info.videoTrackIndex < seq.videoTracks.numTracks) {
      videoTrack = seq.videoTracks[info.videoTrackIndex];
    } else {
      warnings.push("The original video track no longer exists — only the audio was restored.");
    }
  }

  // Found before anything is removed: if the source can't be found, Undo
  // stops here with the timeline untouched.
  const projectItem = findProjectItemForMedia(info.mediaPath, info.projectItemNodeId);
  if (!projectItem) {
    throw new Error("Cannot undo: could not find the original source media in the Project panel. Nothing was changed.");
  }

  // Only this Cut's own pieces (clips of its source media) are cleared. Refuse,
  // before anything is removed, when a clip of other media now sits in the span
  // the original clip goes back into (e.g. after a ripple delete moved the next
  // clip left), or when a track it goes back onto is locked.
  const ownProjectItemNodeIds: string[] = [];
  addProjectItemNodeId(ownProjectItemNodeIds, projectItem);
  if (info.projectItemNodeId) addProjectItemNodeId(ownProjectItemNodeIds, { nodeId: info.projectItemNodeId });
  if (isTrackLocked(track) || (videoTrack && isTrackLocked(videoTrack))) {
    throw new Error("Cannot undo: a track the original clip goes back onto is locked. Unlock it, then try again. Nothing was changed.");
  }
  let restoreFps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) restoreFps = 1 / vfr.seconds;
  } catch (e) {
    // keep the 25 fps fallback used elsewhere in this file
  }
  const restoreTol = 0.5 / restoreFps;
  const blocking =
    findForeignClipOverlapping(track, info.timelineStart, originalEnd, restoreTol, ownProjectItemNodeIds) ||
    (videoTrack ? findForeignClipOverlapping(videoTrack, info.timelineStart, originalEnd, restoreTol, ownProjectItemNodeIds) : null);
  if (blocking) {
    throw new Error(
      `Cannot undo: "${blocking.name}" now sits where the original clip goes back (${info.timelineStart.toFixed(2)}s–${originalEnd.toFixed(
        2,
      )}s). Move it to free space, then try again. Nothing was changed.`,
    );
  }

  // A sped-up original goes back at 100% speed first and gets its Speed after
  // (applyRestoredSpeed below), so for a moment it reaches past originalEnd by
  // originalDuration × (speedFactor − 1). A clip there that clearSpan leaves on
  // the timeline would be overwritten: refuse before anything is removed.
  const reachEnd = info.timelineStart + info.originalDuration * Math.max(1, info.speedFactor);
  if (reachEnd > originalEnd + restoreTol) {
    const clipInReach = (trk: Track): TrackItem | null => {
      for (let i = 0; i < trk.clips.numItems; i++) {
        const c = trk.clips[i];
        const s = c.start.seconds;
        const cleared = !isForeignClip(c, ownProjectItemNodeIds) && s >= info.timelineStart - EPS && s < originalEnd - EPS;
        if (!cleared && s < reachEnd - restoreTol && c.end.seconds > originalEnd + restoreTol) return c;
      }
      return null;
    };
    const reached = clipInReach(track) || (videoTrack ? clipInReach(videoTrack) : null);
    if (reached) {
      const extra = (reachEnd - originalEnd).toFixed(2);
      throw new Error(
        `Cannot undo: the original clip goes back at 100% speed for a moment before its Speed is set again, so it needs ${extra}s of free space after ${originalEnd.toFixed(
          2,
        )}s, where "${reached.name}" sits. Move that clip ${extra}s later, then try again. Nothing was changed.`,
      );
    }
  }

  // A clip of the same media in the span that isn't one of this Cut's pieces
  // (an excerpt or a copy put there after Cut) is refused rather than removed:
  // see findClipNotFromCut. Checked on the audio track, where every excerpt
  // with sound sits. Without the Cut's segments, the whole original source
  // range counts as one.
  const ownSegments =
    segments && segments.length > 0
      ? segments
      : [{ start: info.sourceInPoint, end: info.sourceInPoint + info.originalDuration * info.speedFactor }];
  const notFromCut = findClipNotFromCut([track], info.timelineStart, originalEnd, ownProjectItemNodeIds, ownSegments, 3 / restoreFps);
  if (notFromCut) {
    const c = notFromCut.clip;
    const span = `${c.start.seconds.toFixed(2)}s–${c.end.seconds.toFixed(2)}s`;
    if (notFromCut.reason === "copy") {
      throw new Error(
        `Cannot undo: "${c.name}" (${span}) plays the same part of the recording as another of this Cut's pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.`,
      );
    }
    throw new Error(
      `Cannot undo: "${c.name}" (${span}) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.`,
    );
  }
  // The video track in a call of its own (see rebuildCutFromOriginal): a
  // video-only copy of a piece has no sound and would otherwise be cleared.
  const videoNotFromCut = videoTrack
    ? findClipNotFromCut([videoTrack], info.timelineStart, originalEnd, ownProjectItemNodeIds, ownSegments, 3 / restoreFps)
    : null;
  if (videoNotFromCut) {
    const c = videoNotFromCut.clip;
    const span = `${c.start.seconds.toFixed(2)}s–${c.end.seconds.toFixed(2)}s`;
    if (videoNotFromCut.reason === "copy") {
      throw new Error(
        `Cannot undo: "${c.name}" on the video track (${span}) shows the same part of the recording as one of this Cut's pieces, so it looks like a copy. Move it to free space, then try again. Nothing was changed.`,
      );
    }
    throw new Error(
      `Cannot undo: "${c.name}" on the video track (${span}) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again. Nothing was changed.`,
    );
  }

  // Pieces of this Cut that now run past the original clip's end (a Speed
  // below 100% made the run longer than the original) start outside the span
  // the clear below covers: they would stay on the timeline next to the
  // restored original and play its last words twice. Refused before anything
  // is removed; a piece that starts where the last cleared piece ends is one.
  {
    let chainEnd = -1;
    for (let i = 0; i < track.clips.numItems; i++) {
      const c = track.clips[i];
      if (isForeignClip(c, ownProjectItemNodeIds)) continue;
      const s = c.start.seconds;
      if (s >= info.timelineStart - EPS && s < originalEnd - EPS && c.end.seconds > chainEnd) chainEnd = c.end.seconds;
    }
    let continues = false;
    if (chainEnd > originalEnd + restoreTol) {
      for (let i = 0; i < track.clips.numItems; i++) {
        const c = track.clips[i];
        if (isForeignClip(c, ownProjectItemNodeIds)) continue;
        if (Math.abs(c.start.seconds - chainEnd) <= restoreTol) {
          continues = true;
          break;
        }
      }
    }
    // A piece can also start exactly at the original clip's end (a piece
    // boundary that lands there after a Speed below 100%). It is outside the
    // span cleared below, like the next clip on the track; the two are told
    // apart by the part of the recording they play: a piece plays from inside
    // one of this Cut's segments, the next clip (the recording going on, or
    // anything else) doesn't.
    if (!continues) {
      for (let i = 0; i < track.clips.numItems; i++) {
        const c = track.clips[i];
        if (isForeignClip(c, ownProjectItemNodeIds)) continue;
        if (Math.abs(c.start.seconds - originalEnd) > restoreTol) continue;
        let speed = 1;
        try {
          const sp = c.getSpeed();
          if (typeof sp === "number" && sp > 0) speed = sp;
        } catch (e) {
          // treated as 100%
        }
        const srcStart = c.inPoint.seconds * speed;
        const srcEnd = srcStart + (c.end.seconds - c.start.seconds) * speed;
        for (let k = 0; k < ownSegments.length; k++) {
          if (srcStart >= ownSegments[k].start - 0.25 && srcEnd <= ownSegments[k].end + 0.25) {
            continues = true;
            break;
          }
        }
        if (continues) break;
      }
    }
    if (continues) {
      throw new Error(
        `Cannot undo: pieces of this Cut now run past the original clip's end (${originalEnd.toFixed(
          2,
        )}s), most likely after a Speed below 100%. Set Speed back to 100% in the Pacing tab, then undo. Nothing was changed.`,
      );
    }
  }

  const clearSpan = (trk: Track) => {
    const toRemove: TrackItem[] = [];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      if (isForeignClip(c, ownProjectItemNodeIds)) continue;
      const s = c.start.seconds;
      if (s >= info.timelineStart - EPS && s < originalEnd - EPS) toRemove.push(c);
    }
    for (let i = 0; i < toRemove.length; i++) {
      try {
        toRemove[i].remove(false, false);
      } catch (e) {
        warnings.push(`Removing a piece failed (${errMsg(e)}).`);
      }
    }
  };
  clearSpan(track);
  if (videoTrack) clearSpan(videoTrack);

  // True source-media span the original clip covered — NOT `originalDuration`
  // alone (that's the *timeline* duration, already compressed by
  // speedFactor). See the QE speed-restore block below for why this
  // matters: while the restored clip briefly sits at its default 100%
  // speed (before speedFactor is reapplied), 1 source-second == 1
  // timeline-second, so it needs to be trimmed to the FULL true source
  // span up front for the post-speed-change compression to land back on
  // `originalDuration` exactly.
  const sourceSpan = info.originalDuration * info.speedFactor;

  // The master clip's own In/Out are narrowed for the placement and put back at
  // the end (as the Speed rebuild and J/L Pacing do), so the Project panel's
  // clip doesn't keep a few seconds marked.
  let masterBounds: { inPoint: number; outPoint: number } | null = null;
  try {
    masterBounds = { inPoint: projectItem.getInPoint().seconds, outPoint: projectItem.getOutPoint().seconds };
  } catch (e) {
    masterBounds = null;
  }
  try {
    setProjectItemInOut(projectItem, info.sourceInPoint, info.sourceInPoint + sourceSpan);
  } catch (e) {
    // best effort — overwriteClip below just uses whatever range the
    // ProjectItem currently has if this fails
  }

  // Restore the clip's original Speed too, with the same QE call
  // applySpeedToSelection uses (qeItem.setSpeed(factor, "", false, false, false),
  // no ripple). setSpeed() alone doesn't resize the clip's timeline duration, so
  // `.end` is set explicitly afterwards. Skipped at 100% speed. The
  // inPoint/outPoint writes run first, while the clip is still at 100% speed and
  // "seconds" unambiguously means source time; at any other speed Premiere reads
  // them as timeline-scaled. Returns the speed Premiere actually applied
  // (setSpeedFully), which the `.end` below is derived from, so the clip shows
  // its whole source even where Premiere wouldn't take it all the way.
  const applyRestoredSpeed = (trk: Track, atSeconds: number, clip: TrackItem): number => {
    if (Math.abs(info.speedFactor - 1) < 0.0001) return 1;
    try {
      if (typeof qe === "undefined") app.enableQE();
      if (!qe) {
        warnings.push(
          "Restored the clip's position, but couldn't restore its original Speed (Premiere's editing interface was not available).",
        );
        return 1;
      }
      const qeSeq = qe.project.getActiveSequence();
      if (!qeSeq) {
        warnings.push("Restored the clip's position, but couldn't restore its original Speed (no active sequence).");
        return 1;
      }
      const qeTrack = trk === track ? qeSeq.getAudioTrackAt(info.trackIndex) : qeSeq.getVideoTrackAt(info.videoTrackIndex as number);
      const ordinal = qeFindOrdinalAt(qeTrack, atSeconds);
      const qeItem = ordinal >= 0 ? qeGetClipAt(qeTrack, ordinal) : null;
      if (!qeItem) {
        warnings.push("Restored the clip's position, but couldn't find it in Premiere's editing interface to restore its original Speed.");
        return 1;
      }
      const applied = setSpeedFully(qeItem, clip, info.speedFactor, sequenceFrameSec(seq), qeItemFinder(qeTrack, clip));
      if (Math.abs(applied - info.speedFactor) > SPEED_MATCH_EPS)
        warnings.push(
          `Premiere Pro restored the clip at ${speedPercentText(applied)}% instead of ${speedPercentText(
            info.speedFactor,
          )}%. It still plays all of its audio, at that lower speed.`,
        );
      return applied;
    } catch (e) {
      warnings.push(`Restored the clip's position, but restoring its original Speed failed (${errMsg(e)}).`);
      return readClipSpeed(clip, 1);
    }
  };

  // Audio and video on tracks with the same number take each other's copy
  // from overwriteClip() (the partner track in overwriteOnly) and Premiere
  // links them; on any other layout each half is placed alone. Either way a
  // pair left unlinked is linked below.
  const pairedTracks = videoTrack !== null && info.videoTrackIndex === info.trackIndex;
  const placedOk = overwriteOnly(seq, track, projectItem, info.timelineStart, warnings, "audio", pairedTracks ? videoTrack : null);
  if (!placedOk) {
    throw new Error("Premiere rejected restoring the original clip — the track may not be clear at that position.");
  }

  // Place both clips (audio, then video) before configuring either one's in/out,
  // speed or end. Placing a second clip from the same ProjectItem at the same
  // position makes Premiere re-link the pair, which can snap an already
  // configured partner back to its just-placed state. With both placed up front,
  // linking happens while both are still in that default state, so neither one's
  // later configuration gets reverted.
  let videoPlacedOk = false;
  if (videoTrack) {
    try {
      videoPlacedOk = overwriteOnly(seq, videoTrack, projectItem, info.timelineStart, warnings, "video", pairedTracks ? track : null);
      if (!videoPlacedOk) {
        warnings.push("Could not restore the linked video — Premiere rejected placing it.");
      }
    } catch (e) {
      warnings.push(`Restoring the linked video failed (${errMsg(e)}).`);
    }
  }

  const restored = findClipNear(track, info.timelineStart);
  if (restored) {
    try {
      restored.inPoint = secondsToTime(info.sourceInPoint);
      restored.outPoint = secondsToTime(info.sourceInPoint + sourceSpan);
      const applied = applyRestoredSpeed(track, info.timelineStart, restored);
      restored.end = secondsToTime(info.timelineStart + sourceSpan / applied);
      restored.setSelected(true, true);
    } catch (e) {
      warnings.push(`Restored the clip, but setting its exact bounds failed (${errMsg(e)}).`);
    }
  } else {
    warnings.push("Restored the clip, but couldn't verify its exact placement afterward.");
  }

  if (videoTrack && videoPlacedOk) {
    const restoredVideo = findClipNear(videoTrack, info.timelineStart);
    if (restoredVideo) {
      try {
        restoredVideo.inPoint = secondsToTime(info.sourceInPoint);
        restoredVideo.outPoint = secondsToTime(info.sourceInPoint + sourceSpan);
        const appliedVideo = applyRestoredSpeed(videoTrack, info.timelineStart, restoredVideo);
        restoredVideo.end = secondsToTime(info.timelineStart + sourceSpan / appliedVideo);
      } catch (e) {
        warnings.push(`Restored the video, but setting its exact bounds failed (${errMsg(e)}).`);
      }
    }
  }

  if (restored && videoTrack && videoPlacedOk) {
    const restoredVideo = findClipNear(videoTrack, info.timelineStart);
    const failed = linkPiecesByStart(seq, [restored], [info.timelineStart], [restoredVideo], [info.timelineStart]);
    if (failed > 0) warnings.push(unlinkedPiecesWarning(failed));
    try {
      restored.setSelected(true, true);
    } catch (e) {
      // selection is a convenience
    }
  }

  if (masterBounds) {
    try {
      setProjectItemInOut(projectItem, masterBounds.inPoint, masterBounds.outPoint);
    } catch (e) {
      // best effort — the placed clips are configured; only the master clip's marks stay narrowed
    }
  }

  return { warnings };
};

/**
 * Re-applies Speed to a tracked Cut's pieces by rebuilding them from scratch
 * instead of adjusting their current state. It never reuses the pieces as they
 * are now (their positions only widen the area to clear): it clears the whole
 * footprint (the original Cut's span, or
 * wherever the selected pieces of this media sit now if that is wider, on the
 * original and the alternate J/L tracks) and places every piece fresh from
 * `segments`, the source-media boundaries Scan/Cut computed (`lastCutSegments`
 * on the JS side), which no Speed operation touches. Repeated Speed changes
 * therefore can't accumulate drift. Audio and video are placed from one shared
 * `placeAt`/`timelineDur` per piece, so the two always move together.
 *
 * Other media is never removed: before anything changes it refuses when a
 * clip of other media sits where the re-timed pieces will go, or a target
 * track is locked. Inside the footprint only clips of this media are cleared,
 * and each overwriteClip() is narrowed to its piece's window first
 * (narrowProjectItemWindow).
 */
export const rebuildCutFromOriginal = (
  segments: { start: number; end: number }[],
  mediaPath: string,
  timelineStart: number,
  trackIndex: number,
  videoTrackIndex: number | null,
  speedPercent: number,
  projectItemNodeId?: string,
  sequenceId?: string,
  sequenceName?: string,
): ApplySpeedResult => {
  clearPlacementCache();
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (sequenceId && String(seq.sequenceID || "") !== sequenceId) {
    throw new Error(`Cannot apply Speed: this Cut was made in the sequence "${sequenceName || ""}". Open that sequence, then try again.`);
  }
  if (!segments || segments.length < 1) {
    throw new Error("No original Cut segments to rebuild from — re-run Cut first.");
  }
  if (trackIndex < 0 || trackIndex >= seq.audioTracks.numTracks) {
    throw new Error("The original audio track no longer exists in this sequence.");
  }
  const track = seq.audioTracks[trackIndex];
  let videoTrack: Track | null = null;
  if (videoTrackIndex !== null) {
    if (videoTrackIndex >= 0 && videoTrackIndex < seq.videoTracks.numTracks) {
      videoTrack = seq.videoTracks[videoTrackIndex];
    }
  }
  // J/L Pacing alternates pieces across two tracks (this one and `trackIndex + 1`,
  // the same `altTrackIndex` applyJLCutSmoothing derives), so the alternate audio
  // and video tracks are cleared and swept too, when they exist. Otherwise pieces
  // Pacing put there would survive the rebuild and confuse the next Pacing run.
  const altTrackIndex = trackIndex + 1;
  const altTrack = altTrackIndex < seq.audioTracks.numTracks ? seq.audioTracks[altTrackIndex] : null;
  let altVideoTrack: Track | null = null;
  if (videoTrack && videoTrackIndex !== null) {
    const altVideoIndex = videoTrackIndex + 1;
    if (altVideoIndex < seq.videoTracks.numTracks) altVideoTrack = seq.videoTracks[altVideoIndex];
  }

  const warnings: string[] = [];
  const debugInfo: string[] = [];
  let fps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
  } catch (e) {
    // leave the fallback in place
  }
  const strayFragmentMaxDuration = 3 / fps;

  // Top level first, then bins (see findProjectItemForMedia).
  const projectItem = findProjectItemForMedia(mediaPath, projectItemNodeId);
  if (!projectItem) {
    throw new Error("Could not find the original source media in the Project panel.");
  }

  // Clear window: the original Cut's span at 100% speed (the sum of the
  // segments), widened to wherever the selected pieces of this Cut's media sit
  // now if they reach further (that depends on the speed applied last). Inside
  // the window only clips of this media are removed (clearSpan skips other
  // media, see isForeignClip); the selection filter below only decides what
  // may widen the window.
  let originalSpan = 0;
  for (let i = 0; i < segments.length; i++) originalSpan += segments[i].end - segments[i].start;
  let sweepStart = timelineStart;
  let sweepEnd = timelineStart + originalSpan;
  // Only selected pieces of this Cut's own source media (`projectItem`, resolved
  // above) widen the clear window: every piece rebuildCutFromOriginal places is
  // one of these, and an unrelated selected clip (other media, on any track) must
  // never stretch the deletion into content that wasn't part of this Cut.
  const sel = seq.getSelection() || [];
  for (let i = 0; i < sel.length; i++) {
    const item = sel[i];
    if (!item.projectItem || item.projectItem.nodeId !== projectItem.nodeId) continue;
    const s = item.start.seconds;
    const e = item.end.seconds;
    if (s < sweepStart) sweepStart = s;
    if (e > sweepEnd) sweepEnd = e;
  }
  const SWEEP_EPS = 0.001;

  // Only clips of this Cut's own source media are cleared and swept; other media
  // on these tracks (music, B-roll, titles, SFX) is never removed. Refuse before
  // anything is touched when such a clip sits where the re-timed pieces will go
  // (a slower speed makes the run longer than the original), or when a track the
  // pieces go back onto is locked.
  const ownProjectItemNodeIds: string[] = [];
  addProjectItemNodeId(ownProjectItemNodeIds, projectItem);
  if (isTrackLocked(track)) {
    throw new Error(`Cannot apply Speed: audio track ${trackIndex + 1} is locked. Unlock it, then try again.`);
  }
  if (videoTrack && isTrackLocked(videoTrack)) {
    throw new Error(`Cannot apply Speed: video track ${(videoTrackIndex as number) + 1} is locked. Unlock it, then try again.`);
  }
  // The alternate tracks are cleared of J/L Pacing's pieces below, which a
  // locked track refuses half-way; checked up front with the others.
  if (altTrack && isTrackLocked(altTrack)) {
    throw new Error(`Cannot apply Speed: audio track ${altTrackIndex + 1} is locked. Unlock it, then try again.`);
  }
  if (altVideoTrack && isTrackLocked(altVideoTrack)) {
    throw new Error(`Cannot apply Speed: video track ${(videoTrackIndex as number) + 2} is locked. Unlock it, then try again.`);
  }
  {
    const plannedSpeedFactor = speedPercent / 100;
    let plannedEnd = timelineStart;
    for (let i = 0; i < segments.length; i++) plannedEnd += (segments[i].end - segments[i].start) / plannedSpeedFactor;
    const overlapTol = 0.5 / fps;
    const blockingAudio = findForeignClipOverlapping(track, timelineStart, plannedEnd, overlapTol, ownProjectItemNodeIds);
    if (blockingAudio) {
      throw new Error(
        `Cannot apply Speed: "${blockingAudio.name}" on audio track ${trackIndex + 1} sits where the re-timed pieces will go (${timelineStart.toFixed(
          2,
        )}s–${plannedEnd.toFixed(2)}s). Move it to free space, then try again.`,
      );
    }
    const blockingVideo = videoTrack
      ? findForeignClipOverlapping(videoTrack, timelineStart, plannedEnd, overlapTol, ownProjectItemNodeIds)
      : null;
    if (blockingVideo) {
      throw new Error(
        `Cannot apply Speed: "${blockingVideo.name}" on video track ${(videoTrackIndex as number) + 1} sits where the re-timed pieces will go (${timelineStart.toFixed(
          2,
        )}s–${plannedEnd.toFixed(2)}s). Move it to free space, then try again.`,
      );
    }

    // Every piece is placed at 100% speed first and gets its Speed after (the
    // placement loop below), so for a moment a sped-up piece reaches past its
    // final end by sourceDur × (1 − 1/speed). A clip beyond plannedEnd within
    // that reach, which the clear below leaves on the timeline, would be
    // overwritten: refused before anything is removed (Cut Undo's reach check).
    let reachEnd = plannedEnd;
    {
      let at = timelineStart;
      for (let i = 0; i < segments.length; i++) {
        const sourceDur = segments[i].end - segments[i].start;
        if (at + sourceDur > reachEnd) reachEnd = at + sourceDur;
        at += sourceDur / plannedSpeedFactor;
      }
    }
    if (reachEnd > plannedEnd + overlapTol) {
      const clipInReach = (trk: Track): TrackItem | null => {
        for (let i = 0; i < trk.clips.numItems; i++) {
          const c = trk.clips[i];
          const s = c.start.seconds;
          const cleared = !isForeignClip(c, ownProjectItemNodeIds) && s >= sweepStart - SWEEP_EPS && s < sweepEnd - SWEEP_EPS;
          if (!cleared && s < reachEnd - overlapTol && c.end.seconds > plannedEnd + overlapTol) return c;
        }
        return null;
      };
      const reached = clipInReach(track) || (videoTrack ? clipInReach(videoTrack) : null);
      if (reached) {
        const extra = (reachEnd - plannedEnd).toFixed(2);
        throw new Error(
          `Cannot apply Speed: the re-timed pieces go back at 100% speed for a moment before their Speed is set, so they need ${extra}s of free space after ${plannedEnd.toFixed(
            2,
          )}s, where "${reached.name}" sits. Move that clip ${extra}s later, then try again.`,
        );
      }
    }

    // A clip of the same media near the pieces that isn't one of them (an
    // excerpt or a copy put there after Cut) is refused rather than cleared or
    // swept: see findClipNotFromCut. Checked on the audio tracks, where every
    // excerpt with sound sits, over the widest window the clear below and the
    // stray sweep after placement can reach.
    const checkTracks: Track[] = [track];
    if (altTrack) checkTracks.push(altTrack);
    const notFromCut = findClipNotFromCut(
      checkTracks,
      sweepStart,
      Math.max(sweepEnd, plannedEnd),
      ownProjectItemNodeIds,
      segments,
      strayFragmentMaxDuration,
    );
    if (notFromCut) {
      const c = notFromCut.clip;
      const trackNumber = notFromCut.track === track ? trackIndex + 1 : altTrackIndex + 1;
      const span = `${c.start.seconds.toFixed(2)}s–${c.end.seconds.toFixed(2)}s`;
      if (notFromCut.reason === "copy") {
        throw new Error(
          `Cannot apply Speed: "${c.name}" on audio track ${trackNumber} (${span}) plays the same part of the recording as another of this Cut's pieces, so it looks like a copy. Move it to free space, then try again.`,
        );
      }
      throw new Error(
        `Cannot apply Speed: "${c.name}" on audio track ${trackNumber} (${span}) plays another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.`,
      );
    }
    // The video tracks get the same check, in a call of their own: the clear
    // below removes every clip of the Cut's media there too, and a video-only
    // copy of a piece (a punch-in on the track above, a cutaway from the same
    // recording) has no sound, so the audio pass cannot see it. A separate
    // call, because each linked video piece covers the same source range as
    // its own audio piece and would otherwise count as a copy of it.
    const videoCheckTracks: Track[] = [];
    if (videoTrack) videoCheckTracks.push(videoTrack);
    if (altVideoTrack) videoCheckTracks.push(altVideoTrack);
    const videoNotFromCut =
      videoCheckTracks.length > 0
        ? findClipNotFromCut(
            videoCheckTracks,
            sweepStart,
            Math.max(sweepEnd, plannedEnd),
            ownProjectItemNodeIds,
            segments,
            strayFragmentMaxDuration,
          )
        : null;
    if (videoNotFromCut) {
      const c = videoNotFromCut.clip;
      const trackNumber = videoNotFromCut.track === videoTrack ? (videoTrackIndex as number) + 1 : (videoTrackIndex as number) + 2;
      const span = `${c.start.seconds.toFixed(2)}s–${c.end.seconds.toFixed(2)}s`;
      if (videoNotFromCut.reason === "copy") {
        throw new Error(
          `Cannot apply Speed: "${c.name}" on video track ${trackNumber} (${span}) shows the same part of the recording as one of this Cut's pieces, so it looks like a copy. Move it to free space, then try again.`,
        );
      }
      throw new Error(
        `Cannot apply Speed: "${c.name}" on video track ${trackNumber} (${span}) shows another part of the recording, so it isn't one of this Cut's pieces. Move it to free space, then try again.`,
      );
    }
  }

  const clearSpan = (trk: Track) => {
    const toRemove: TrackItem[] = [];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      if (isForeignClip(c, ownProjectItemNodeIds)) continue;
      const s = c.start.seconds;
      // A clip that starts at sweepEnd itself is the next clip on the track
      // (the recording going on, say), as in Cut and Undo.
      if (s >= sweepStart - SWEEP_EPS && s < sweepEnd - SWEEP_EPS) toRemove.push(c);
    }
    for (let i = 0; i < toRemove.length; i++) {
      try {
        toRemove[i].remove(false, false);
      } catch (e) {
        warnings.push(`Could not remove an existing piece before rebuilding (${errMsg(e)}).`);
      }
    }
  };
  clearSpan(track);
  if (altTrack) clearSpan(altTrack);
  if (videoTrack) clearSpan(videoTrack);
  if (altVideoTrack) clearSpan(altVideoTrack);

  const speedFactor = speedPercent / 100;
  const origBounds = { inPoint: projectItem.getInPoint().seconds, outPoint: projectItem.getOutPoint().seconds };

  // Held TrackItem references can go stale here: each later overwriteClip() on
  // the same shared ProjectItem can disturb clips already placed. So every entry
  // also records `expectedStart` (the `placeAt` it was placed at, independent of
  // any TrackItem reference), and every use after the placement loop refreshes
  // the reference by position right before reading it.
  const placedAudio: { clip: TrackItem; expectedStart: number; inPoint: number; outPoint: number }[] = [];
  const placedVideo: { clip: TrackItem; expectedStart: number; inPoint: number; outPoint: number }[] = [];
  // Audio and video on tracks with the same number take each other's copy from
  // overwriteClip() (the partner track in overwriteOnly) and Premiere links
  // them; on any other layout each half is placed alone. Either way a pair left
  // unlinked is linked at the end.
  const pairedTracks = videoTrack !== null && videoTrackIndex === trackIndex;
  let cursor = timelineStart;
  let clipsProcessed = 0;
  try {
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const sourceDur = seg.end - seg.start;
      const timelineDur = sourceDur / speedFactor;
      const placeAt = cursor;

      narrowProjectItemWindow(projectItem, seg.start, seg.end, warnings, `for piece ${i + 1} before placing it`);
      const placedOk = overwriteOnly(seq, track, projectItem, placeAt, warnings, "audio", pairedTracks ? videoTrack : null);
      if (!placedOk) {
        warnings.push(`Piece ${i + 1}: Premiere rejected placing it at ${placeAt.toFixed(3)}s — left out.`);
        cursor = placeAt + timelineDur;
        continue;
      }
      const newClip = findClipNear(track, placeAt, strayFragmentMaxDuration);
      if (!newClip) {
        warnings.push(`Piece ${i + 1}: placed, but could not locate it afterward — left as-is.`);
        cursor = placeAt + timelineDur;
        continue;
      }
      // overwriteClip() starts the clip on the nearest frame, but `placeAt` (the
      // previous piece's end) is usually between frames. Writing `.start` moves
      // the clip there and keeps its source in-point; `.end` is written below.
      try {
        if (Math.abs(newClip.start.seconds - placeAt) > 0.0005) newClip.start = secondsToTime(placeAt);
      } catch (e) {
        // best effort: a start up to half a frame off leaves a gap or overlap that short
      }
      try {
        newClip.inPoint = secondsToTime(seg.start);
        newClip.outPoint = secondsToTime(seg.end);
      } catch (e) {
        warnings.push(`Piece ${i + 1}: placed, but setting its source in/out failed (${errMsg(e)}).`);
      }
      try {
        newClip.end = secondsToTime(placeAt + timelineDur);
        cursor = newClip.end.seconds;
      } catch (e) {
        cursor = placeAt + timelineDur;
      }
      placedAudio.push({ clip: newClip, expectedStart: placeAt, inPoint: seg.start, outPoint: seg.end });
      clipsProcessed++;

      if (videoTrack) {
        narrowProjectItemWindow(projectItem, seg.start, seg.end, warnings, `for the video of piece ${i + 1} before placing it`);
        const vPlacedOk = overwriteOnly(seq, videoTrack, projectItem, placeAt, warnings, "video", pairedTracks ? track : null);
        if (!vPlacedOk) {
          warnings.push(`Piece ${i + 1} (video): Premiere rejected placing it at ${placeAt.toFixed(3)}s — left out.`);
        } else {
          const newVideoClip = findClipNear(videoTrack, placeAt, strayFragmentMaxDuration);
          if (!newVideoClip) {
            warnings.push(`Piece ${i + 1} (video): placed, but could not locate it afterward — left as-is.`);
          } else {
            try {
              if (Math.abs(newVideoClip.start.seconds - placeAt) > 0.0005) newVideoClip.start = secondsToTime(placeAt);
              newVideoClip.inPoint = secondsToTime(seg.start);
              newVideoClip.outPoint = secondsToTime(seg.end);
              newVideoClip.end = secondsToTime(placeAt + timelineDur);
            } catch (e) {
              warnings.push(`Piece ${i + 1} (video): placed, but setting its exact bounds failed (${errMsg(e)}).`);
            }
            placedVideo.push({ clip: newVideoClip, expectedStart: placeAt, inPoint: seg.start, outPoint: seg.end });
          }
        }
      }
    }
  } finally {
    // Restore the shared ProjectItem's own original, full in/out — same
    // reasoning as applyJLCutSmoothing's identical `finally` block: a
    // mid-loop failure must never leave a shared ProjectItem stuck narrowed
    // for anything else in the project that references the same media.
    narrowProjectItemWindow(
      projectItem,
      origBounds.inPoint,
      origBounds.outPoint,
      warnings,
      "back to its original range after placing the pieces",
    );
  }

  // Refresh every held reference by position right before it is read again,
  // anchored on `expectedStart`, never on `.start` read off a possibly stale
  // reference.
  for (let i = 0; i < placedAudio.length; i++) {
    const refreshed = findClipNear(track, placedAudio[i].expectedStart, strayFragmentMaxDuration);
    if (refreshed) placedAudio[i].clip = refreshed;
  }
  for (let i = 0; i < placedVideo.length; i++) {
    if (!videoTrack) break;
    const refreshed = findClipNear(videoTrack, placedVideo[i].expectedStart, strayFragmentMaxDuration);
    if (refreshed) placedVideo[i].clip = refreshed;
  }

  // Repeated overwriteClip() calls on one shared ProjectItem can leave stray
  // duplicate fragments, which the clear above can't catch because this loop
  // creates them. Keep only the nodeIds this call just placed and remove anything
  // else within this run's span on the (up to) four tracks touched. The window
  // is widened to `cursor` (the loop's real end position) in case the new speed
  // spread the pieces wider than the original estimate.
  sweepEnd = Math.max(sweepEnd, cursor);
  const keepNodeIds: string[] = [];
  for (let i = 0; i < placedAudio.length; i++) keepNodeIds.push(placedAudio[i].clip.nodeId);
  for (let i = 0; i < placedVideo.length; i++) keepNodeIds.push(placedVideo[i].clip.nodeId);
  const removeStrayInWindow = (trk: Track) => {
    const stray: TrackItem[] = [];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      if (isForeignClip(c, ownProjectItemNodeIds)) continue;
      let keep = false;
      for (let k = 0; k < keepNodeIds.length; k++) {
        if (keepNodeIds[k] === c.nodeId) {
          keep = true;
          break;
        }
      }
      if (keep) continue;
      const s = c.start.seconds;
      if (s >= sweepStart - SWEEP_EPS && s < sweepEnd - SWEEP_EPS) stray.push(c);
    }
    for (let i = 0; i < stray.length; i++) {
      try {
        stray[i].remove(false, false);
      } catch (e) {
        warnings.push(`Could not remove a leftover stray fragment (${errMsg(e)}).`);
      }
    }
  };
  removeStrayInWindow(track);
  if (altTrack) removeStrayInWindow(altTrack);
  if (videoTrack) removeStrayInWindow(videoTrack);
  if (altVideoTrack) removeStrayInWindow(altVideoTrack);

  // Refresh again: the stray sweep above is another round of `.remove()` calls on
  // the tracks these pieces sit on, and can disturb them the same way.
  for (let i = 0; i < placedAudio.length; i++) {
    const refreshed = findClipNear(track, placedAudio[i].expectedStart, strayFragmentMaxDuration);
    if (refreshed) placedAudio[i].clip = refreshed;
  }
  for (let i = 0; i < placedVideo.length; i++) {
    if (!videoTrack) break;
    const refreshed = findClipNear(videoTrack, placedVideo[i].expectedStart, strayFragmentMaxDuration);
    if (refreshed) placedVideo[i].clip = refreshed;
  }

  // On tracks with the same number, each video placement laid its own copy of
  // the audio over the audio piece placed just before it, starting on the
  // nearest frame instead of at `expectedStart`. Moved back here, once the
  // sweep has cleared the slivers that copy left, so audio and video start
  // together. The ends are written by the speed pass below, or here at 100%,
  // for video as well as audio: each video placement starts on the nearest
  // frame and trims the previous video piece back to that frame, which can
  // leave it up to half a frame shorter than its audio.
  if (pairedTracks) {
    for (let i = 0; i < placedAudio.length; i++) {
      try {
        const c = placedAudio[i].clip;
        if (Math.abs(c.start.seconds - placedAudio[i].expectedStart) > 0.0005) c.start = secondsToTime(placedAudio[i].expectedStart);
      } catch (e) {
        // best effort: a start up to half a frame off
      }
    }
    if (Math.abs(speedFactor - 1) <= 0.0001) {
      for (let i = 0; i < placedAudio.length; i++) {
        try {
          const p = placedAudio[i];
          p.clip.end = secondsToTime(p.expectedStart + (p.outPoint - p.inPoint));
        } catch (e) {
          // best effort
        }
      }
      for (let i = 0; i < placedVideo.length; i++) {
        try {
          const v = placedVideo[i];
          v.clip.end = secondsToTime(v.expectedStart + (v.outPoint - v.inPoint));
        } catch (e) {
          // best effort
        }
      }
    }
  }

  // Re-assert each piece's known-good inPoint/outPoint (from `segments[]`, kept
  // in placedAudio/placedVideo). Refreshing a reference restores which object is
  // pointed at, but not a value the sweep may have nudged, and even a sub-frame
  // audio/video drift makes Premiere show its out-of-sync badge.
  for (let i = 0; i < placedAudio.length; i++) {
    try {
      placedAudio[i].clip.inPoint = secondsToTime(placedAudio[i].inPoint);
      placedAudio[i].clip.outPoint = secondsToTime(placedAudio[i].outPoint);
    } catch (e) {
      // best effort — same degrade-gracefully convention as the placement loop above
    }
  }
  for (let i = 0; i < placedVideo.length; i++) {
    try {
      placedVideo[i].clip.inPoint = secondsToTime(placedVideo[i].inPoint);
      placedVideo[i].clip.outPoint = secondsToTime(placedVideo[i].outPoint);
    } catch (e) {
      // best effort
    }
  }

  // Set the target speed on every freshly placed clip (audio and video) with the
  // same QE setSpeed() call applySpeedToSelection uses, then set each clip's
  // `.end` from its expected start and duration: setSpeed() doesn't reliably
  // leave the timeline duration right (it can even collapse a clip near the end
  // of a run to a sliver). `expectedStart` and the in/out values come from
  // placedAudio/placedVideo, never from a TrackItem setSpeed() may have just
  // disturbed.
  // The duration comes from the speed Premiere actually applied (setSpeedFully),
  // so a piece it wouldn't take all the way still shows its whole source.
  if (Math.abs(speedFactor - 1) > 0.0001) {
    const allPlaced: { clip: TrackItem; expectedStart: number; sourceSpan: number }[] = [];
    for (let i = 0; i < placedAudio.length; i++) {
      allPlaced.push({
        clip: placedAudio[i].clip,
        expectedStart: placedAudio[i].expectedStart,
        sourceSpan: placedAudio[i].outPoint - placedAudio[i].inPoint,
      });
    }
    for (let i = 0; i < placedVideo.length; i++) {
      allPlaced.push({
        clip: placedVideo[i].clip,
        expectedStart: placedVideo[i].expectedStart,
        sourceSpan: placedVideo[i].outPoint - placedVideo[i].inPoint,
      });
    }
    const allPlacedClips: TrackItem[] = [];
    for (let i = 0; i < allPlaced.length; i++) allPlacedClips.push(allPlaced[i].clip);
    const frameSec = sequenceFrameSec(seq);
    let shortfallCount = 0;
    let lowestApplied = speedFactor;
    forEachSelectedQEClip(seq, allPlacedClips, warnings, (qeItem, stdClip, _track, qeTrack) => {
      let match: { clip: TrackItem; expectedStart: number; sourceSpan: number } | null = null;
      for (let i = 0; i < allPlaced.length; i++) {
        if (allPlaced[i].clip === stdClip) {
          match = allPlaced[i];
          break;
        }
      }
      const appliedSpeed = setSpeedFully(qeItem, stdClip, speedFactor, frameSec, qeItemFinder(qeTrack, stdClip));
      if (Math.abs(appliedSpeed - speedFactor) > SPEED_MATCH_EPS) {
        shortfallCount++;
        if (appliedSpeed < lowestApplied) lowestApplied = appliedSpeed;
      }
      if (match) {
        try {
          stdClip.end = secondsToTime(match.expectedStart + match.sourceSpan / appliedSpeed);
        } catch (e) {
          warnings.push(`Could not restore a piece's own duration after setting its speed (${errMsg(e)}).`);
        }
      }
    });
    if (shortfallCount > 0) warnings.push(speedShortfallWarning(shortfallCount, lowestApplied, speedFactor));
  }

  if (videoTrack && placedVideo.length > 0) {
    const audioClips: TrackItem[] = [];
    const audioStarts: number[] = [];
    for (let i = 0; i < placedAudio.length; i++) {
      audioClips.push(findClipNear(track, placedAudio[i].expectedStart, strayFragmentMaxDuration) || placedAudio[i].clip);
      audioStarts.push(placedAudio[i].expectedStart);
    }
    const videoClips: TrackItem[] = [];
    const videoStarts: number[] = [];
    for (let i = 0; i < placedVideo.length; i++) {
      videoClips.push(findClipNear(videoTrack, placedVideo[i].expectedStart, strayFragmentMaxDuration) || placedVideo[i].clip);
      videoStarts.push(placedVideo[i].expectedStart);
    }
    const failed = linkPiecesByStart(seq, audioClips, audioStarts, videoClips, videoStarts);
    if (failed > 0) warnings.push(unlinkedPiecesWarning(failed));
    for (let i = 0; i < placedAudio.length; i++) placedAudio[i].clip = audioClips[i];
    for (let i = 0; i < placedVideo.length; i++) placedVideo[i].clip = videoClips[i];
  }

  const allNewClips: TrackItem[] = [];
  for (let i = 0; i < placedAudio.length; i++) allNewClips.push(placedAudio[i].clip);
  for (let i = 0; i < placedVideo.length; i++) allNewClips.push(placedVideo[i].clip);
  for (let i = 0; i < allNewClips.length; i++) {
    try {
      allNewClips[i].setSelected(true, i === allNewClips.length - 1);
    } catch (e) {
      // non-fatal — selection is a convenience, not required for the result itself
    }
  }

  debugInfo.push(
    `rebuildCutFromOriginal: ${segments.length} segment(s), speedPercent=${speedPercent}, sweep=[${sweepStart.toFixed(3)}, ${sweepEnd.toFixed(3)}), audio placed=${placedAudio.length}, video placed=${placedVideo.length}`,
  );

  return { clipsProcessed, warnings, debugInfo };
};

// Premiere's built-in audio fade, the same one a clip's fade handle applies in
// the timeline, added single-sided at one clip's edge (not a two-clip
// crossfade) via the QE DOM's addTransition(). It is Premiere's standard
// declick tool and, unlike keyframing the Volume component's Level, doesn't
// change the clip's loudness.
const JL_CUT_FADE_TRANSITION_NAME = "Constant Power";
// Fallback fade length in frames, used where no measured size is given (the
// first piece's start, the last piece's end, callers that pass none). Measured
// sizes come from computeJLCutOverlaps: 1-5 frames, capped at the boundary's
// overlap. The overlap is the timing choice; the fade only avoids a hard
// amplitude jump (a click) at a clip's edge.
const JL_CUT_FADE_FRAMES = 1;

/**
 * Manual loop, not `.indexOf()`: array `.indexOf` doesn't exist in this
 * ExtendScript engine.
 */
const findClipIndex = (clips: TrackItem[], target: TrackItem): number => {
  for (let k = 0; k < clips.length; k++) {
    if (clips[k] === target) return k;
  }
  return -1;
};

/**
 * JL_CUT_FADE_TRANSITION_NAME under the name each interface language of
 * Premiere shows it by: English, Russian, Spanish, German, French, Japanese,
 * Portuguese, Italian. QE looks a transition up by the name the interface
 * shows, so on a Premiere in another language the English name alone finds
 * nothing. Names outside plain ASCII are written as \u escapes, so the
 * ExtendScript source stays ASCII. A language missing here is still covered
 * by findFadeTransition's last step when Premiere lists exactly three audio
 * transitions.
 */
const JL_CUT_FADE_TRANSITION_NAMES: string[] = [
  JL_CUT_FADE_TRANSITION_NAME,
  "\u041f\u043e\u0441\u0442\u043e\u044f\u043d\u043d\u0430\u044f \u043c\u043e\u0449\u043d\u043e\u0441\u0442\u044c",
  "Potencia constante",
  "Konstante Leistung",
  "Puissance constante",
  "\u30b3\u30f3\u30b9\u30bf\u30f3\u30c8\u30d1\u30ef\u30fc",
  "Pot\u00eancia constante",
  "Potenza costante",
];

/** A name no transition has. A Premiere that answers it answers any name. */
const FADE_TRANSITION_PROBE_NAME = "AI Voice Master Tool probe - no such transition";

/** What findFadeTransition found and how, for the Diagnostics report. */
interface FadeTransitionLookup {
  /** The QE transition, or null when nothing usable was found. */
  transition: any;
  /** The name the transition was asked for by ("" when not found). */
  usedName: string;
  /** "by name", "by listed name", "by list position" or "not found". */
  how: string;
  /** Whether Premiere answered the made-up name too; null when asking threw. */
  anyNameAnswers: boolean | null;
  /** The audio transitions Premiere lists, by their shown names; null when
   *  the list could not be read. */
  listed: string[] | null;
}

/**
 * Finds the fade transition on a Premiere in any interface language.
 * Read-only: it only asks QE, nothing in the project changes.
 *
 * 1. Premiere's list of audio transitions is read, and a made-up name is
 *    asked for. Some Premiere installs answer the name lookup for any name,
 *    with an object addTransition() then refuses. On those the direct
 *    lookups (step 2) are skipped and only names the list shows are asked
 *    for, unless the list can't be read.
 * 2. Each name in JL_CUT_FADE_TRANSITION_NAMES, asked for directly.
 * 3. A listed name equal to one of those names, ignoring case, asked for as
 *    the list spells it.
 * 4. Only when the list has exactly three entries, Premiere's three audio
 *    crossfades (Constant Power, Constant Gain, Exponential Fade, in that
 *    order): the first entry. A list of any other length is not guessed
 *    from.
 */
const findFadeTransition = (project: QEProject): FadeTransitionLookup => {
  const found: FadeTransitionLookup = { transition: null, usedName: "", how: "not found", anyNameAnswers: null, listed: null };
  const ask = (name: string): any => {
    try {
      return project.getAudioTransitionByName(name) || null;
    } catch (e) {
      return null;
    }
  };
  try {
    const list: any = project.getAudioTransitionList();
    if (list && typeof list.length === "number") {
      const names: string[] = [];
      for (let i = 0; i < list.length; i++) names.push(String(list[i]));
      found.listed = names;
    }
  } catch (e) {
    found.listed = null;
  }
  try {
    found.anyNameAnswers = !!project.getAudioTransitionByName(FADE_TRANSITION_PROBE_NAME);
  } catch (e) {
    found.anyNameAnswers = null;
  }

  if (found.anyNameAnswers !== true || !found.listed) {
    for (let c = 0; c < JL_CUT_FADE_TRANSITION_NAMES.length; c++) {
      const byName = ask(JL_CUT_FADE_TRANSITION_NAMES[c]);
      if (byName) {
        found.transition = byName;
        found.usedName = JL_CUT_FADE_TRANSITION_NAMES[c];
        found.how = "by name";
        return found;
      }
    }
  }

  const listed = found.listed;
  if (!listed) return found;
  for (let c = 0; c < JL_CUT_FADE_TRANSITION_NAMES.length; c++) {
    const wanted = JL_CUT_FADE_TRANSITION_NAMES[c].toLowerCase();
    for (let n = 0; n < listed.length; n++) {
      if (listed[n].toLowerCase() !== wanted) continue;
      const byListedName = ask(listed[n]);
      if (byListedName) {
        found.transition = byListedName;
        found.usedName = listed[n];
        found.how = "by listed name";
        return found;
      }
    }
  }

  if (listed.length === 3) {
    const byPosition = ask(listed[0]);
    if (byPosition) {
      found.transition = byPosition;
      found.usedName = listed[0];
      found.how = "by list position";
    }
  }
  return found;
};

/** findFadeTransition's answer as one line for the Diagnostics report. */
const describeFadeLookup = (lookup: FadeTransitionLookup): string => {
  let text = lookup.transition ? `transition "${lookup.usedName}" found ${lookup.how}` : "transition not found";
  let probe = "unknown";
  if (lookup.anyNameAnswers === true) probe = "yes";
  else if (lookup.anyNameAnswers === false) probe = "no";
  text += `; made-up name answered: ${probe}`;
  if (lookup.listed) text += `; Premiere lists ${lookup.listed.length}: ${lookup.listed.join(", ")}`;
  else text += "; Premiere's list could not be read";
  return text;
};

/**
 * The forms of QE's addTransition() tried for one fade edge, in this order,
 * until Premiere takes one. "standard" is the full argument list: the length
 * in frames as a string, offset "0", alignment 0, single-sided, not aligned
 * to video. Each other form changes one thing: the clip selected first, the
 * length as a number, the length as a timecode, alignment 1 or 2. Every form
 * keeps the fade single-sided and not aligned to video. The short form and
 * the aligned-to-video form are left out: what they do to a neighbouring clip
 * or to the linked video is not documented.
 */
const EDGE_FADE_CALL_FORMS: string[] = ["standard", "clip selected", "length as a number", "timecode length", "alignment 1", "alignment 2"];

/** Why a piece got no fade at all; also a dictionary key (ru.ts, es.ts). */
const NO_EDGE_FADE_ON_PIECE = "neither fade-in nor fade-out could be added";

/** One fade edge: the index in EDGE_FADE_CALL_FORMS of the form Premiere
 *  took (-1 for none), each form's answer, and the standard form's error. */
interface EdgeFadeAttempt {
  form: number;
  trail: string[];
  standardError: string | null;
}

/**
 * Adds the fade at one edge of a clip (`atStart`: its start, else its end),
 * trying the forms in EDGE_FADE_CALL_FORMS until Premiere takes one.
 * addTransition()'s answer (true, or false / a thrown error) is the only
 * signal; `trail` keeps each form's answer for the Diagnostics report.
 */
const addOneEdgeFade = (
  qeItem: any,
  stdClip: TrackItem,
  transition: any,
  atStart: boolean,
  frames: string,
  fps: number,
): EdgeFadeAttempt => {
  const attempt: EdgeFadeAttempt = { form: -1, trail: [], standardError: null };
  for (let f = 0; f < EDGE_FADE_CALL_FORMS.length; f++) {
    let taken = false;
    try {
      if (f === 0) {
        taken = !!qeItem.addTransition(transition, atStart, frames, "0", 0, true, false);
      } else if (f === 1) {
        stdClip.setSelected(true, true);
        taken = !!qeItem.addTransition(transition, atStart, frames, "0", 0, true, false);
      } else if (f === 2) {
        taken = !!qeItem.addTransition(transition, atStart, Number(frames), 0, 0, true, false);
      } else if (f === 3) {
        taken = !!qeItem.addTransition(transition, atStart, secondsToTimecodeString(Number(frames) / fps, fps), "0", 0, true, false);
      } else {
        taken = !!qeItem.addTransition(transition, atStart, frames, "0", f - 3, true, false);
      }
      attempt.trail.push(`${EDGE_FADE_CALL_FORMS[f]}: ${taken ? "taken" : "refused"}`);
    } catch (e) {
      if (f === 0) attempt.standardError = errMsg(e);
      attempt.trail.push(`${EDGE_FADE_CALL_FORMS[f]}: ${errMsg(e)}`);
    }
    if (taken) {
      attempt.form = f;
      return attempt;
    }
  }
  return attempt;
};

/**
 * Adds Premiere's native audio fade (see JL_CUT_FADE_TRANSITION_NAME, found by
 * findFadeTransition in any interface language) to a clip's start and/or end
 * via the QE DOM (the standard DOM has no addTransition(); see
 * forEachSelectedQEClip), each edge through addOneEdgeFade's forms. Best effort
 * per side: one side failing doesn't block the other, and a clip this fails on
 * entirely just plays without a fade instead of failing the whole operation.
 * When Premiere refuses the transition on every piece, one warning says so in
 * place of the per-side ones. A "Diagnostic:" line (kept out of the panel's
 * banner, included in the Diagnostics report) records the lookup, the forms
 * taken and the first refused edge's answers.
 *
 * `tailFadeFramesPerClip`/`headFadeFramesPerClip`, when given, are aligned 1:1
 * with `clips` (the caller's job; see applyJLCutSmoothing's origIndex remapping
 * for why a position in `clips` isn't always the original boundary index): clip
 * k's fade-out uses `tailFadeFramesPerClip[k]` and its fade-in
 * `headFadeFramesPerClip[k]`. Omitted, or missing an entry for a clip, falls
 * back to `JL_CUT_FADE_FRAMES`.
 */
const addNativeEdgeFades = (
  seq: Sequence,
  clips: TrackItem[],
  warnings: string[],
  tailFadeFramesPerClip?: number[],
  headFadeFramesPerClip?: number[],
): number => {
  if (typeof qe === "undefined") app.enableQE();
  if (!qe) {
    warnings.push("Premiere's editing interface was not available, so no edge fades were added.");
    return 0;
  }
  const lookup = findFadeTransition(qe.project);
  const transition = lookup.transition;
  if (!transition) {
    warnings.push(`"${JL_CUT_FADE_TRANSITION_NAME}" audio transition not found — edge fades skipped for all pieces.`);
    warnings.push(`Diagnostic: edge fades: ${describeFadeLookup(lookup)}.`);
    return 0;
  }
  const defaultFrames = String(JL_CUT_FADE_FRAMES);
  // Only the timecode form uses the frame rate; 25 where the sequence has none
  // (an audio-only sequence can leave videoFrameRate unset).
  let fps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
  } catch (e) {
    // leave the fallback in place
  }

  // addTransition()'s return value and thrown errors are the only success signal.
  // `qeTrack.numTransitions` is not used to verify: it doesn't appear to count
  // single-sided fades, and it reported success for clips that had none. The QE
  // DOM has no per-clip transition query, so a linked-video clip can occasionally
  // report success and still end up without a fade.
  // The refusal warnings wait in `refusals` until every piece was tried, so a
  // transition refused on every piece gives one warning instead of three a piece.
  const refusals: string[] = [];
  const formCounts: number[] = [];
  for (let f = 0; f < EDGE_FADE_CALL_FORMS.length; f++) formCounts.push(0);
  let piecesWithFade = 0;
  let piecesRefused = 0;
  let sidesRefused = 0;
  let firstRefusal = "";
  forEachSelectedQEClip(seq, clips, warnings, (qeItem, stdClip) => {
    const k = findClipIndex(clips, stdClip);
    const inFrames =
      headFadeFramesPerClip && k >= 0 && headFadeFramesPerClip[k] !== undefined ? String(headFadeFramesPerClip[k]) : defaultFrames;
    const outFrames =
      tailFadeFramesPerClip && k >= 0 && tailFadeFramesPerClip[k] !== undefined ? String(tailFadeFramesPerClip[k]) : defaultFrames;
    const fadeIn = addOneEdgeFade(qeItem, stdClip, transition, true, inFrames, fps);
    const fadeOut = addOneEdgeFade(qeItem, stdClip, transition, false, outFrames, fps);
    if (fadeIn.form >= 0) {
      formCounts[fadeIn.form]++;
    } else {
      sidesRefused++;
      if (!firstRefusal) firstRefusal = `piece ${k + 1} fade-in: ${fadeIn.trail.join(", ")}`;
      if (fadeIn.standardError) refusals.push(`Couldn't add the fade-in (${fadeIn.standardError}).`);
      else refusals.push("Couldn't add the fade-in.");
    }
    if (fadeOut.form >= 0) {
      formCounts[fadeOut.form]++;
    } else {
      sidesRefused++;
      if (!firstRefusal) firstRefusal = `piece ${k + 1} fade-out: ${fadeOut.trail.join(", ")}`;
      if (fadeOut.standardError) refusals.push(`Couldn't add the fade-out (${fadeOut.standardError}).`);
      else refusals.push("Couldn't add the fade-out.");
    }
    if (fadeIn.form >= 0 || fadeOut.form >= 0) {
      piecesWithFade++;
    } else {
      piecesRefused++;
      refusals.push(`Clip ${k + 1} ("${stdClip.name}"): ${NO_EDGE_FADE_ON_PIECE}`);
    }
  });

  if (piecesWithFade === 0 && piecesRefused > 0) {
    warnings.push(
      `Premiere refused the "${lookup.usedName}" audio transition on every piece — no edge fades were added; the pieces themselves are in place.`,
    );
  } else {
    for (let r = 0; r < refusals.length; r++) warnings.push(refusals[r]);
  }
  const taken: string[] = [];
  for (let f = 0; f < EDGE_FADE_CALL_FORMS.length; f++) {
    if (formCounts[f] > 0) taken.push(`${EDGE_FADE_CALL_FORMS[f]} x${formCounts[f]}`);
  }
  let diag = `Diagnostic: edge fades: ${describeFadeLookup(lookup)}; sides taken: ${taken.length ? taken.join(", ") : "none"}; sides refused: ${sidesRefused}`;
  if (firstRefusal) diag += `; first refused: ${firstRefusal}`;
  warnings.push(`${diag}.`);
  return piecesWithFade;
};

/**
 * Sets a ProjectItem's In/Out to `inPoint`-`outPoint`, whatever marks it has
 * now. In goes to 0 first, so every step keeps In at or before Out: the new
 * Out can't land before the current In, and the new In can't land past the
 * current Out. Marks the user set in the Source Monitor can sit anywhere in
 * the file, before or after the range being set. Throws what Premiere throws.
 */
const setProjectItemInOut = (projectItem: any, inPoint: number, outPoint: number): void => {
  projectItem.setInPoint(0, PROJECT_ITEM_ALL_MEDIA);
  projectItem.setOutPoint(outPoint, PROJECT_ITEM_ALL_MEDIA);
  projectItem.setInPoint(inPoint, PROJECT_ITEM_ALL_MEDIA);
};

/**
 * Whether narrowing this ProjectItem's In/Out (setProjectItemInOut) takes
 * effect: narrows it to `testIn`-`testOut`, reads the marks back, and puts the
 * earlier marks back whatever happens. When it does, overwriteClip() lays down
 * only the narrowed window for a moment; when it doesn't, it lays down the
 * whole file, and J/L Pacing must keep a whole file's length clear after a
 * piece.
 */
const narrowingTakesEffect = (projectItem: any, testIn: number, testOut: number): boolean => {
  let before: { inPoint: number; outPoint: number } | null = null;
  try {
    before = { inPoint: projectItem.getInPoint().seconds, outPoint: projectItem.getOutPoint().seconds };
    setProjectItemInOut(projectItem, testIn, testOut);
    const gotIn = projectItem.getInPoint().seconds;
    const gotOut = projectItem.getOutPoint().seconds;
    return Math.abs(gotIn - testIn) < 0.05 && Math.abs(gotOut - testOut) < 0.05;
  } catch (e) {
    return false;
  } finally {
    if (before) {
      try {
        setProjectItemInOut(projectItem, before.inPoint, before.outPoint);
      } catch (e) {
        // best effort: the next placement narrows the marks again anyway
      }
    }
  }
};

/**
 * Narrows a ProjectItem's in/out to exactly `targetIn`-`targetOut` right before
 * an `overwriteClip()` meant to place only that window (see
 * setProjectItemInOut for the order). This bounds overwriteClip()'s transient
 * full-span placement to about the intended window, which limits both the risk
 * of overwriting an adjacent clip and, for a linked audio+video pair sharing
 * one ProjectItem, how much of the other track one call can disturb. Best
 * effort: if it fails, the following overwriteClip() behaves as if this hadn't
 * been called. The same call also puts a ProjectItem's original range back
 * once a placement loop ends.
 *
 * `label` completes the warning sentence and says which piece and when, e.g.
 * "for piece 2 before placing it" or "back to its original range after
 * placing the pieces".
 */
const narrowProjectItemWindow = (projectItem: any, targetIn: number, targetOut: number, warnings: string[], label: string): void => {
  try {
    setProjectItemInOut(projectItem, targetIn, targetOut);
  } catch (e) {
    warnings.push(`Could not set the source clip's in/out ${label} (${errMsg(e)}).`);
  }
};

/**
 * Read-only query, never changes the timeline: the current selection's audio
 * pieces (video filtered out via `audioOnly`, as `applyJLCutSmoothing` does),
 * sorted by position, each as a SOURCE-relative `{start, end}` pair plus its
 * media path. `inPoint.seconds * speed` recovers the true source start from a
 * Speed-scaled TrackItem (see the note below for the end).
 *
 * Each piece's current source range is read directly, so the result is right
 * whether a piece is untouched, trimmed by hand after Cut, or one of several
 * deleted; for an untouched selection it equals `lastCutSegments`.
 * `computeJLCutOverlaps` only needs a correct `{start, end}` list to look up
 * `scanResult.rmsValues` around each boundary.
 *
 * `mediaPath` lets main.tsx check that every piece belongs to the file that was
 * Cut: a piece from other media would make computeJLCutOverlaps read the wrong
 * file's analysis.
 */
export const getSelectedCutPieceInfo = (): {
  start: number;
  end: number;
  mediaPath: string;
  timelineStart: number;
  timelineEnd: number;
  frameSec: number;
}[] => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  const sel = seq.getSelection();
  if (!sel || sel.length === 0) return [];
  const audioItems = audioOnly(seq, sel)
    .slice()
    .sort((a, b) => a.start.seconds - b.start.seconds);
  // One frame of the sequence: Cut puts each edit on the nearest frame, so the
  // panel allows half of it when it compares pieces with the Cut's segments.
  const frameSec = sequenceFrameSec(seq);
  const result: { start: number; end: number; mediaPath: string; timelineStart: number; timelineEnd: number; frameSec: number }[] = [];
  for (let i = 0; i < audioItems.length; i++) {
    const c = audioItems[i];
    let speed = 1;
    try {
      const s = c.getSpeed();
      if (typeof s === "number" && s > 0) speed = s;
    } catch (e) {
      // leave at 1 — treated as unchanged rather than guessing
    }
    let mediaPath = "";
    try {
      mediaPath = (c.projectItem && c.projectItem.getMediaPath()) || "";
    } catch (e) {
      // best effort — an unreadable path just won't match anything, caught
      // by main.tsx's own mediaPath check rather than guessed at here
    }
    // The piece's END comes from clipSourceEndSec (its timeline length times its
    // speed), not from `outPoint`: after a script changes a piece's `.end`,
    // `outPoint` keeps its earlier value, and at Speed it overshoots the true
    // source end by up to (speed - 1) times the piece's length. That overshoot
    // would make consecutive pieces look like they overlap in source, and
    // computeJLCutOverlaps' `gap <= 0` guard would zero them.
    const srcStart = c.inPoint.seconds * speed;
    const srcEnd = clipSourceEndSec(c, speed);
    // The piece's own timeline position, so the panel can tell pieces dragged
    // elsewhere since the Cut from pieces still where the Cut left them.
    result.push({ start: srcStart, end: srcEnd, mediaPath, timelineStart: c.start.seconds, timelineEnd: c.end.seconds, frameSec });
  }
  return result;
};

/**
 * Follow-up step after Cut (J/L Pacing); never called by
 * cutSelectedClip and never changes the Cut itself. Takes the per-boundary
 * overlap seconds computeJLCutOverlaps (analyze.ts) worked out from the same
 * scan's RMS data, puts every other cut piece onto the next audio track down,
 * shifts each piece earlier by its boundary's overlap so it starts before the
 * previous piece stops (tighter pacing for fast-cut content), and adds
 * Premiere's native "Constant Power" declick fade at each piece's start/end
 * (see addNativeEdgeFades), a few frames long, sized per boundary by
 * computeJLCutOverlaps and capped at that boundary's overlap. Reset
 * calls this with every overlap at 0, which puts the pieces back on one track
 * with no fades.
 *
 * Needs a spare audio track directly below the selected pieces' track (except
 * for Reset) and doesn't create one; the error asks the user to add it.
 * Premiere's documented scripting API has no call that adds a track. QE's
 * addTracks() does, but QE is not part of Adobe's documented API (its
 * parameters are known only from community type definitions), and this panel
 * doesn't use it.
 *
 * Uses remove + overwriteClip() rather than cutClipViaRazor's razor/move: real
 * overlap across two tracks means moving clips to another track, and nothing in
 * Premiere's documented scripting API can do that. QE's `moveToTrack()` (not
 * documented by Adobe) is reported on the Adobe Community forums not to move
 * clips, so it isn't used. Two mitigations for overwriteClip()'s known risks:
 * 1. Every real placement position is checked against neighbouring clips
 *    before anything is touched (the collision guard below).
 * 2. Every `overwriteClip()` call is narrowed first via
 *    `narrowProjectItemWindow`, and the ProjectItem's original range is restored
 *    in a `finally` once the loop ends, so a failure mid-loop can't leave a
 *    shared ProjectItem narrowed.
 *
 * `originalAnchorStart` (optional): the true original position of the first
 * kept piece, from `cutResult.undoInfo.timelineStart` on the JS side. Positions
 * are computed from it rather than from wherever the current selection sits, so
 * repeated J/L Pacing/Reset/Speed cycles can't drift. Ignored (falls back to
 * the selection's position) if missing, not a number, NaN or negative, or more
 * than ANCHOR_DRIFT_TOLERANCE_SEC (2 s) from where the pieces sit now (they
 * were moved by another edit; a note is shown).
 */
export const applyJLCutSmoothing = (
  overlapsSec: number[],
  originalAnchorStart?: number | null,
  tailFadeFrames?: number[],
  headFadeFrames?: number[],
): JLCutResult => {
  clearPlacementCache();
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");

  const sel = seq.getSelection();
  if (!sel || sel.length < 2) {
    throw new Error("Select at least 2 of the pieces Cut just made (they're left selected right after Cut).");
  }

  const warnings: string[] = [];

  // Gives findClipNear's `minDuration` guard a frame-scaled threshold for telling
  // a real placed piece from a ~1-frame stray sliver. Falls back to 25 fps when
  // videoFrameRate can't be read, as elsewhere in this file.
  let fps = 25;
  try {
    const vfr = seq.getSettings().videoFrameRate;
    if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
  } catch (e) {
    // leave the fallback in place
  }
  // Three frames: well above the ~1-frame stray-sliver size and below the
  // length of a real kept piece.
  const strayFragmentMaxDuration = 3 / fps;

  // Reset (main.tsx's handleResetSmoothCuts) passes every overlap as exactly 0,
  // meaning no overlap and no pacing fade. `isReset` then skips alternation (the
  // guard and the audio and video placement all use the original track) and the
  // fade step, and no spare audio track is required. A real J/L Pacing call (at
  // least one nonzero overlap) is unaffected. Computed early because it only
  // depends on `overlapsSec`.
  let isReset = overlapsSec.length > 0;
  for (let b = 0; b < overlapsSec.length; b++) {
    if (overlapsSec[b] > 0.0001) {
      isReset = false;
      break;
    }
  }

  // Cut selects each piece's linked video along with its audio, so `sel` can hold
  // twice as many TrackItems as there are pacing pieces. Each audio item is paired
  // with its linked video counterpart only if that counterpart is in the same
  // selection (isLinkedTo, the nodeId check getSelectedTrackItem uses); an
  // audio-only selection still works, it just gets no video matches.
  // `containsNodeId` is a manual loop because `string[].indexOf()` doesn't exist
  // in this ExtendScript engine (tsc reports "Property 'indexOf' does not exist
  // on type 'string[]'" for it).
  const containsNodeId = (ids: string[], id: string): boolean => {
    for (let k = 0; k < ids.length; k++) if (ids[k] === id) return true;
    return false;
  };
  const audioItems: TrackItem[] = [];
  const videoForAudioItem: (TrackItem | null)[] = [];
  const claimedNodeIds: string[] = [];
  for (let i = 0; i < sel.length; i++) {
    const item = sel[i];
    if (containsNodeId(claimedNodeIds, item.nodeId)) continue;
    const loc = locateTrackOfClip(seq, item);
    if (!loc || loc.trackType !== "audio") continue;
    let video: TrackItem | null = null;
    for (let j = 0; j < sel.length; j++) {
      if (j === i) continue;
      const other = sel[j];
      if (containsNodeId(claimedNodeIds, other.nodeId)) continue;
      const otherLoc = locateTrackOfClip(seq, other);
      if (otherLoc && otherLoc.trackType === "video" && isLinkedTo(item, other)) {
        video = other;
        break;
      }
    }
    audioItems.push(item);
    videoForAudioItem.push(video);
    claimedNodeIds.push(item.nodeId);
    if (video) claimedNodeIds.push(video.nodeId);
  }
  if (audioItems.length < 2) {
    throw new Error("Select at least 2 of the pieces Cut just made (they're left selected right after Cut).");
  }
  // The pieces of one Cut all play one file. A selection that mixes files
  // (Select All with a music bed, another recording's clip) would chain those
  // clips into the run and move them, so it is refused before anything
  // changes. Reset and the re-apply after Speed go through here too. Natural
  // pitch renders (natural-pitch-*.wav, one file per speed) replace pieces of
  // that one file, so they are left out of the count; the panel maps them back
  // to their source and checks those too.
  const pieceFiles: string[] = [];
  const pieceFileClipNames: string[] = [];
  for (let i = 0; i < audioItems.length; i++) {
    let mediaKey = "";
    try {
      const pi = audioItems[i].projectItem;
      mediaKey = pi && pi.getMediaPath ? String(pi.getMediaPath() || "").toLowerCase() : "";
    } catch (e) {
      mediaKey = "";
    }
    // "\/" inside the brackets: ExtendScript ends a regex literal at any
    // unescaped "/", even inside a character class.
    if (!mediaKey || /[\\\/]natural-pitch-[^\\\/]*\.wav$/.test(mediaKey)) continue;
    let seen = false;
    for (let k = 0; k < pieceFiles.length; k++) {
      if (pieceFiles[k] === mediaKey) {
        seen = true;
        break;
      }
    }
    if (seen) continue;
    pieceFiles.push(mediaKey);
    pieceFileClipNames.push(String(audioItems[i].name || ""));
  }
  if (pieceFiles.length > 1) {
    throw new Error(
      `J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from ${pieceFiles.length} files ("${pieceFileClipNames[0]}" and "${pieceFileClipNames[1]}", for example). Select only the cut pieces (and their video), then try again. Nothing was changed.`,
    );
  }

  // When a piece's linked video isn't part of the selection (e.g. an unrelated
  // clip was selected and moved before Reset), find it directly instead of asking
  // for the selection to be fixed. Matched by shared ProjectItem AND timeline
  // position (a linked pair's video starts where its audio does, since both were
  // razored together), so only the real counterpart is picked up, never another
  // placement of the same media elsewhere in the sequence. The shared
  // ProjectItem is checked rather than getLinkedItems(): Premiere's Unlink only
  // changes editing behaviour, while overwriteClip()'s implicit video side effect
  // follows the shared ProjectItem. Only ProjectItem identity, track type and
  // position are compared, so an audio-only file (no video item to match) is
  // unaffected.
  const POSITION_MATCH_TOL = 0.5;
  for (let i = 0; i < audioItems.length; i++) {
    if (videoForAudioItem[i]) continue;
    const audioProjectItem = audioItems[i].projectItem;
    if (!audioProjectItem) continue;
    const audioStart = audioItems[i].start.seconds;
    let foundVideo: TrackItem | null = null;
    let bestDist = Infinity;
    for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
      const vtrack = seq.videoTracks[vi];
      for (let ci = 0; ci < vtrack.clips.numItems; ci++) {
        const vclip = vtrack.clips[ci];
        if (!vclip.projectItem || vclip.projectItem.nodeId !== audioProjectItem.nodeId) continue;
        if (containsNodeId(claimedNodeIds, vclip.nodeId)) continue;
        const dist = Math.abs(vclip.start.seconds - audioStart);
        if (dist < bestDist) {
          bestDist = dist;
          foundVideo = vclip;
        }
      }
    }
    if (foundVideo && bestDist < POSITION_MATCH_TOL) {
      videoForAudioItem[i] = foundVideo;
      claimedNodeIds.push(foundVideo.nodeId);
    }
  }

  // A video clip in the selection that couldn't be paired with an audio piece is
  // reported: its video pacing is skipped this run (removal and the stray sweep
  // only handle paired pieces). On a repeat run the selection holds the clips
  // this function placed last time, and whether Premiere still reports those as
  // linked can't be told from code, so the warning makes the case visible.
  let unmatchedVideoInSelection = 0;
  for (let i = 0; i < sel.length; i++) {
    const item = sel[i];
    if (containsNodeId(claimedNodeIds, item.nodeId)) continue;
    const loc = locateTrackOfClip(seq, item);
    if (loc && loc.trackType === "video") unmatchedVideoInSelection++;
  }
  if (unmatchedVideoInSelection > 0) {
    warnings.push(
      `${unmatchedVideoInSelection} video clip${
        unmatchedVideoInSelection === 1 ? "" : "s"
      } in the selection could not be matched to a linked audio piece — video pacing was skipped for ${
        unmatchedVideoInSelection === 1 ? "it" : "them"
      } this run.`,
    );
  }

  // getSelection()'s own order isn't guaranteed to match timeline order —
  // sort by each *audio* piece's own position, carrying its optional linked
  // video along so the two stay index-aligned.
  const orderIdx: number[] = [];
  for (let i = 0; i < audioItems.length; i++) orderIdx.push(i);
  orderIdx.sort((a, b) => audioItems[a].start.seconds - audioItems[b].start.seconds);
  const ordered: TrackItem[] = [];
  const linkedVideo: (TrackItem | null)[] = [];
  for (let i = 0; i < orderIdx.length; i++) {
    ordered.push(audioItems[orderIdx[i]]);
    linkedVideo.push(videoForAudioItem[orderIdx[i]]);
  }

  // Reports any audio/video pair that is already more than half a frame apart at
  // the start of this call, measured off the fresh selection before the
  // collision guard or placement runs, so a divergence carried in from an earlier
  // run can be told apart from one this run creates.
  try {
    for (let i = 0; i < ordered.length; i++) {
      const v = linkedVideo[i];
      if (!v) continue;
      const diff = ordered[i].start.seconds - v.start.seconds;
      if (Math.abs(diff) > 0.5 / fps) {
        warnings.push(
          `Piece ${i + 1}: its audio and video were already ${(Math.abs(diff) * fps).toFixed(
            2,
          )} frame(s) apart before J/L Pacing ran. [diag: audio @ ${ordered[i].start.seconds.toFixed(
            3,
          )}s, video @ ${v.start.seconds.toFixed(3)}s]`,
        );
      }
    }
  } catch (e) {
    // best effort — this diagnostic pass must never block the real work below
  }

  // Self-consistency check only. J/L Pacing can run on a partial selection
  // (main.tsx's handleSmoothCuts reads what is selected via
  // getSelectedCutPieceInfo and sizes `overlapsSec` for exactly those pieces), so
  // `overlapsSec.length + 1` is the number of pieces this call expects, not the
  // original Cut's count. A mismatch means the selection changed underneath this
  // call.
  const expectedPieceCount = overlapsSec.length + 1;
  if (ordered.length !== expectedPieceCount) {
    throw new Error(
      `${ordered.length} pieces are selected, but this run expected ${expectedPieceCount} — the selection may have changed. Re-select the pieces from that Cut and try again.`,
    );
  }

  const originalTrack = locateTrackOfClip(seq, ordered[0]);
  if (!originalTrack) throw new Error("Could not locate the selected pieces on any track.");
  if (originalTrack.trackType !== "audio") {
    throw new Error("J/L Pacing works on audio only. Select the pieces Cut made on an audio track.");
  }
  const altTrackIndex = originalTrack.trackIndex + 1;
  // Only a real J/L Pacing call needs the second track. Reset places everything
  // back on originalTrack (see `isReset`); `altTrack` still needs a value for the
  // typing below, so it falls back to `originalTrack.track`, which is what every
  // `isReset || i % 2 === 0` check resolves to on Reset anyway.
  if (!isReset && altTrackIndex >= seq.audioTracks.numTracks) {
    throw new Error(
      "J/L Pacing needs a spare audio track directly below the selected pieces to alternate onto. Add one more audio track to this sequence and try again.",
    );
  }
  const altTrack = altTrackIndex < seq.audioTracks.numTracks ? seq.audioTracks[altTrackIndex] : originalTrack.track;

  // A piece with linked video needs the same alternating-track placement as its
  // audio: pieces overlap in time by design, and one track can't hold two
  // overlapping clips. Resolved once, from the first piece that has video (they
  // all share the original video track). Without a spare video track, audio
  // pacing still runs and the video stays where it was. Reset needs no spare
  // video track, since everything goes back on the original track.
  let originalVideoTrack: Track | null = null;
  let altVideoTrack: Track | null = null;
  let originalVideoTrackIndex = -1;
  for (let i = 0; i < linkedVideo.length; i++) {
    const v = linkedVideo[i];
    if (!v) continue;
    const vLoc = locateTrackOfClip(seq, v);
    if (!vLoc) continue;
    originalVideoTrackIndex = vLoc.trackIndex;
    const altVideoIndex = vLoc.trackIndex + 1;
    if (isReset) {
      originalVideoTrack = vLoc.track;
      altVideoTrack = vLoc.track;
    } else if (altVideoIndex < seq.videoTracks.numTracks) {
      originalVideoTrack = vLoc.track;
      altVideoTrack = seq.videoTracks[altVideoIndex];
    } else {
      warnings.push(
        "Some pieces have a linked video, but there's no spare video track to alternate onto — only audio pacing was applied, the video was left where it was. Add one more video track and re-run if you need the video repositioned too.",
      );
    }
    break;
  }
  const videoEnabled = !!(originalVideoTrack && altVideoTrack);
  // Audio and video on tracks with the same number (A1 with V1, A2 with V2)
  // take each other's copy from overwriteClip() (the partner track in
  // overwriteOnly) and Premiere links them; on any other layout, and for audio
  // whose video stays where it is, each half is placed alone. Either way a pair
  // left unlinked is linked at the end.
  const jlPairedTracks = videoEnabled && originalVideoTrackIndex === originalTrack.trackIndex;

  // Read everything before touching anything: once the first piece is removed,
  // re-deriving positions from a half-modified timeline would be guessing.
  // `speed` matters because overwriteClip() always places a fresh clip at 1x;
  // without capturing and restoring it, J/L Pacing on a sped-up piece would
  // reset it to 100% (see the speed-restore pass after the placement loop). A
  // piece's linked video gets its own speed capture, since Premiere keeps a
  // separate speed on each track item.
  const snapshots: {
    projectItem: any;
    inPoint: number;
    outPoint: number;
    origStart: number;
    speed: number;
    video: { projectItem: any; inPoint: number; outPoint: number; speed: number } | null;
  }[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    if (!c.projectItem) throw new Error(`Piece ${i + 1} has no source media.`);
    let speed = 1;
    try {
      const s = c.getSpeed();
      if (typeof s === "number" && s > 0) speed = s;
    } catch (e) {
      // leave at 1 — treated as unchanged rather than guessing
    }
    let videoSnap: { projectItem: any; inPoint: number; outPoint: number; speed: number } | null = null;
    const vClip = videoEnabled ? linkedVideo[i] : null;
    if (vClip && vClip.projectItem) {
      let vSpeed = 1;
      try {
        const vs = vClip.getSpeed();
        if (typeof vs === "number" && vs > 0) vSpeed = vs;
      } catch (e) {
        // leave at 1
      }
      videoSnap = {
        projectItem: vClip.projectItem,
        inPoint: vClip.inPoint.seconds,
        outPoint: vClip.inPoint.seconds + (vClip.end.seconds - vClip.start.seconds) * vSpeed,
        speed: vSpeed,
      };
    }
    // `outPoint - inPoint` must be the piece's source length (everything below
    // divides it by `speed` for the timeline length). Premiere's own outPoint
    // can't be trusted for that once Speed isn't 100% (see clipSourceEndSec), so
    // it is rebuilt from the timeline length; at 100% this is the same value.
    snapshots.push({
      projectItem: c.projectItem,
      inPoint: c.inPoint.seconds,
      outPoint: c.inPoint.seconds + (c.end.seconds - c.start.seconds) * speed,
      origStart: c.start.seconds,
      speed,
      video: videoSnap,
    });
  }

  // Diagnostic: each piece's audio/video sync alignment as Cut left it, before
  // the placement loop runs. Compared with the later checkpoints (after the
  // placement loop, before fades), it shows which phase introduces a sync drift,
  // if any.
  const snapshotSyncAlignment: (number | null)[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    const s = snapshots[i];
    const vClip = linkedVideo[i];
    if (!s.video || !vClip) {
      snapshotSyncAlignment.push(null);
      continue;
    }
    try {
      snapshotSyncAlignment.push(s.origStart - s.inPoint - (vClip.start.seconds - s.video.inPoint));
    } catch (e) {
      snapshotSyncAlignment.push(null);
    }
  }

  // Positions are corrected to `originalAnchorStart` only for small drift. A
  // mismatch over `ANCHOR_DRIFT_TOLERANCE_SEC` isn't internal drift (that would
  // be frame-rounding noise, a few frames at most): the pieces were moved by
  // another edit after the Cut, so their current position is trusted and a note
  // is shown instead of moving them back. The tolerance sits well above any
  // plausible rounding drift and far below a real relocation.
  const ANCHOR_DRIFT_TOLERANCE_SEC = 2;
  let resolvedAnchorStart = snapshots[0].origStart;
  if (typeof originalAnchorStart === "number" && !isNaN(originalAnchorStart) && originalAnchorStart >= 0) {
    const anchorDeltaSec = Math.abs(originalAnchorStart - snapshots[0].origStart);
    if (anchorDeltaSec > ANCHOR_DRIFT_TOLERANCE_SEC) {
      warnings.push(
        `Note: these pieces now sit at ${snapshots[0].origStart.toFixed(3)}s, far from where Cut placed them (${originalAnchorStart.toFixed(
          3,
        )}s), so they were rebuilt where they are now, not moved back.`,
      );
    } else if (anchorDeltaSec > 0.05) {
      warnings.push(
        `Placing pieces at the original Cut position (${originalAnchorStart.toFixed(3)}s) instead of where they currently sit (${snapshots[0].origStart.toFixed(3)}s).`,
      );
      resolvedAnchorStart = originalAnchorStart;
    }
  } else if (originalAnchorStart !== undefined && originalAnchorStart !== null) {
    warnings.push(`The original Cut position wasn't available — the pieces were placed at their current position instead.`);
  }

  // overlapsSec is computed from analyze.ts's rmsValues, which only knows
  // about the *source* audio content — it's speed-invariant by construction
  // (the same stretch of decaying/rising waveform, regardless of how fast a
  // piece happens to be playing back on the timeline right now). Turning it
  // into a timeline shift for a specific piece needs dividing by that piece's
  // own current speed: at 150% speed the same source-relative decay region
  // takes 2/3 as much timeline time, so the overlap must shrink to match or it
  // would reach into content past the decaying tail. Scaled once here per
  // boundary (by the speed of the later piece of the pair, the one pulled
  // earlier) and used by both the collision guard's dry run and the placement
  // loop, so the two always agree. Fade lengths are separate
  // (tailFadeFrames/headFadeFrames).
  const scaledOverlapsSec: number[] = [];
  for (let b = 0; b < overlapsSec.length; b++) {
    const shiftedPieceSpeed = snapshots[b + 1] ? snapshots[b + 1].speed : 1;
    scaledOverlapsSec.push(overlapsSec[b] / shiftedPieceSpeed);
  }

  // Pre-flight collision guard, for the overwriteClip() exposure described on
  // this function. A dry run of the placement loop's cursor/placeAt math checks
  // the nearest clip starting at or after every actual placement position, on
  // the track that piece goes to, before anything is touched. It uses the
  // un-snapped `placeAt + timelineDur` (the real loop's frame-snapped
  // `newClip.end.seconds` doesn't exist yet), which is off by at most a fraction
  // of a frame per piece.
  const allPieceNodeIds: string[] = [];
  for (let i = 0; i < ordered.length; i++) allPieceNodeIds.push(ordered[i].nodeId);
  for (let i = 0; i < linkedVideo.length; i++) {
    const v = linkedVideo[i];
    if (v) allPieceNodeIds.push(v.nodeId);
  }

  // The ProjectItems this run places. Any clip with a different ProjectItem
  // (music, B-roll, titles, another speaker) is foreign: the guard refuses when
  // one sits where a piece goes, and the stray sweeps below never remove one.
  const runProjectItemNodeIds: string[] = [];
  for (let i = 0; i < snapshots.length; i++) {
    addProjectItemNodeId(runProjectItemNodeIds, snapshots[i].projectItem);
    if (snapshots[i].video) addProjectItemNodeId(runProjectItemNodeIds, (snapshots[i].video as any).projectItem);
  }

  // A locked track can't take the pieces back after they are removed, so refuse
  // before anything is touched.
  if (isTrackLocked(originalTrack.track)) {
    throw new Error(`Can't apply J/L Pacing: audio track ${originalTrack.trackIndex + 1} is locked. Unlock it and try again.`);
  }
  // Reset too: it removes the pieces J/L Pacing put on the alternate track.
  if (isTrackLocked(altTrack)) {
    throw new Error(`Can't apply J/L Pacing: audio track ${altTrackIndex + 1} is locked. Unlock it and try again.`);
  }
  if (videoEnabled) {
    let videoTrackNumber = 0;
    for (let i = 0; i < linkedVideo.length; i++) {
      const v = linkedVideo[i];
      if (!v) continue;
      const vLoc = locateTrackOfClip(seq, v);
      if (vLoc) videoTrackNumber = vLoc.trackIndex + 1;
      break;
    }
    if (isTrackLocked(originalVideoTrack)) {
      throw new Error(`Can't apply J/L Pacing: video track ${videoTrackNumber} is locked. Unlock it and try again.`);
    }
    if (isTrackLocked(altVideoTrack)) {
      throw new Error(`Can't apply J/L Pacing: video track ${videoTrackNumber + 1} is locked. Unlock it and try again.`);
    }
  }

  // Whether narrowing takes effect, checked once per ProjectItem (see
  // narrowingTakesEffect) with the first piece's own window.
  const narrowingChecked: { [nodeId: string]: boolean } = {};
  const narrowsFor = (projectItem: any, testIn: number, testOut: number): boolean => {
    if (!projectItem) return false;
    const key = String(projectItem.nodeId);
    if (!(key in narrowingChecked)) narrowingChecked[key] = narrowingTakesEffect(projectItem, testIn, testOut);
    return narrowingChecked[key];
  };

  let guardCursor = resolvedAnchorStart;
  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const timelineDur = (snap.outPoint - snap.inPoint) / snap.speed;
    const overlap = i === 0 ? 0 : scaledOverlapsSec[i - 1];
    const placeAt = i === 0 ? guardCursor : guardCursor - overlap;
    const onAltTrack = !isReset && i % 2 !== 0;

    let audioFullDuration = 0;
    try {
      audioFullDuration = snap.projectItem.getOutPoint().seconds - snap.projectItem.getInPoint().seconds;
    } catch (e) {
      // best effort — a piece whose own duration can't be read just isn't
      // checked against; every other piece still is
    }
    const audioTrackToCheck = onAltTrack ? altTrack : originalTrack.track;
    const nearestAudio = findNearestClipStartAfterExcludingAll(audioTrackToCheck, placeAt, allPieceNodeIds);
    if (nearestAudio !== null) {
      // A nearby clip that shares this piece's ProjectItem is a sibling (another
      // piece of the same Cut, or a leftover from an earlier J/L run on the same
      // file), not a foreign clip. The placement loop narrows the shared ProjectItem
      // right before this piece's overwriteClip() (see `originalBounds`), so the
      // transient span is this piece's own [inPoint, outPoint) window, not the whole
      // file. Using the full file length against a sibling would block nearly every
      // partial selection of a long single-file Cut. A foreign clip (different
      // ProjectItem) gets the same window when narrowing is confirmed to take
      // effect (narrowsFor); otherwise overwriteClip() could lay the whole file
      // down for a moment, so it keeps the full-length margin.
      const fc = nearestAudio.clip;
      const sharesThisPieceMedia = !!(snap.projectItem && fc.projectItem && fc.projectItem.nodeId === snap.projectItem.nodeId);
      const margin =
        sharesThisPieceMedia || narrowsFor(snap.projectItem, snap.inPoint, snap.outPoint)
          ? snap.outPoint - snap.inPoint
          : audioFullDuration;
      if (nearestAudio.start < placeAt + margin) {
        let flaggedNote = "";
        try {
          const fcProjectItemNodeId = fc.projectItem ? fc.projectItem.nodeId : "n/a";
          flaggedNote = ` [diag: flaggedClip name="${fc.name}" nodeId=${fc.nodeId} duration=${(fc.end.seconds - fc.start.seconds).toFixed(
            3,
          )}s ownProjectItemNodeId=${fcProjectItemNodeId} sharesThisPieceMedia=${sharesThisPieceMedia}]`;
        } catch (e) {
          // best effort
        }
        throw new Error(
          `Can't apply J/L Pacing safely: another clip on ${
            onAltTrack ? `the alternating audio track (${altTrackIndex + 1})` : "the same audio track"
          } starts at ${nearestAudio.start.toFixed(2)}s, closer than piece ${i + 1} needs (${margin.toFixed(
            2,
          )}s). Move it further away (or onto a different track) before running J/L Pacing.${flaggedNote}`,
        );
      }
    }
    // A foreign clip that starts before this piece's spot and runs across it
    // (a music bed, an adjustment layer) is invisible to the check above.
    const runningIntoAudio = findForeignClipRunningInto(audioTrackToCheck, placeAt, 0.5 / fps, runProjectItemNodeIds, allPieceNodeIds);
    if (runningIntoAudio) {
      throw new Error(
        `Can't apply J/L Pacing safely: "${runningIntoAudio.name}" on ${
          onAltTrack ? `the alternating audio track (${altTrackIndex + 1})` : "the same audio track"
        } runs across ${placeAt.toFixed(2)}s, where piece ${i + 1} goes. Move it to free space (or onto a different track) before running J/L Pacing.`,
      );
    }

    if (videoEnabled && snap.video && originalVideoTrack && altVideoTrack) {
      let videoFullDuration = 0;
      try {
        videoFullDuration = snap.video.projectItem.getOutPoint().seconds - snap.video.projectItem.getInPoint().seconds;
      } catch (e) {
        // best effort, same as the audio pass above
      }
      const videoTrackToCheck = onAltTrack ? altVideoTrack : originalVideoTrack;
      const nearestVideo = findNearestClipStartAfterExcludingAll(videoTrackToCheck, placeAt, allPieceNodeIds);
      if (nearestVideo !== null) {
        // Same sibling-vs-foreign reasoning as the audio branch just above.
        const fc = nearestVideo.clip;
        const sharesThisPieceMedia = !!(
          snap.video &&
          snap.video.projectItem &&
          fc.projectItem &&
          fc.projectItem.nodeId === snap.video.projectItem.nodeId
        );
        const margin =
          snap.video && (sharesThisPieceMedia || narrowsFor(snap.video.projectItem, snap.video.inPoint, snap.video.outPoint))
            ? snap.video.outPoint - snap.video.inPoint
            : videoFullDuration;
        if (nearestVideo.start < placeAt + margin) {
          let flaggedNote = "";
          try {
            const fcProjectItemNodeId = fc.projectItem ? fc.projectItem.nodeId : "n/a";
            flaggedNote = ` [diag: flaggedClip name="${fc.name}" nodeId=${fc.nodeId} duration=${(fc.end.seconds - fc.start.seconds).toFixed(
              3,
            )}s ownProjectItemNodeId=${fcProjectItemNodeId} sharesThisPieceMedia=${sharesThisPieceMedia}]`;
          } catch (e) {
            // best effort
          }
          throw new Error(
            `Can't apply J/L Pacing safely: another clip on ${
              onAltTrack ? "the alternating video track" : "the linked video track"
            } starts at ${nearestVideo.start.toFixed(2)}s, closer than piece ${i + 1} needs (${margin.toFixed(
              2,
            )}s). Move it further away before running J/L Pacing.${flaggedNote}`,
          );
        }
      }
      const runningIntoVideo = findForeignClipRunningInto(videoTrackToCheck, placeAt, 0.5 / fps, runProjectItemNodeIds, allPieceNodeIds);
      if (runningIntoVideo) {
        throw new Error(
          `Can't apply J/L Pacing safely: "${runningIntoVideo.name}" on ${
            onAltTrack ? "the alternating video track" : "the linked video track"
          } runs across ${placeAt.toFixed(2)}s, where piece ${i + 1} goes. Move it to free space (or onto a different track) before running J/L Pacing.`,
        );
      }
    }

    guardCursor = placeAt + timelineDur;
  }

  // The stray sweep after placement removes every clip of this run's media in
  // the run's window that this run didn't place. An unselected clip of the same
  // media there (another excerpt of the recording, a copy, a piece left out of
  // the selection) would go with it, so refuse before anything is touched.
  // Clips up to 0.2 s (SUBSTANTIAL_STRAY_THRESHOLD below) are the debris the
  // sweep exists for.
  {
    const lastSnap = snapshots[snapshots.length - 1];
    const windowEnd = Math.max(guardCursor, lastSnap.origStart + (lastSnap.outPoint - lastSnap.inPoint) / lastSnap.speed);
    let videoTrackNumber = 0;
    for (let i = 0; i < linkedVideo.length; i++) {
      const v = linkedVideo[i];
      if (!v) continue;
      const vLoc = locateTrackOfClip(seq, v);
      if (vLoc) videoTrackNumber = vLoc.trackIndex + 1;
      break;
    }
    const checkTracks: Track[] = [originalTrack.track];
    const checkIsVideo: boolean[] = [false];
    // The overlap tracks can also hold another part of the same recording
    // (a second speaker's clip), which needs moving rather than selecting.
    const checkIsAlt: boolean[] = [false];
    const checkNumbers: number[] = [originalTrack.trackIndex + 1];
    if (altTrack !== originalTrack.track) {
      checkTracks.push(altTrack);
      checkIsVideo.push(false);
      checkIsAlt.push(true);
      checkNumbers.push(altTrackIndex + 1);
    }
    if (videoEnabled) {
      checkTracks.push(originalVideoTrack as Track);
      checkIsVideo.push(true);
      checkIsAlt.push(false);
      checkNumbers.push(videoTrackNumber);
      if (altVideoTrack !== originalVideoTrack) {
        checkTracks.push(altVideoTrack as Track);
        checkIsVideo.push(true);
        checkIsAlt.push(true);
        checkNumbers.push(videoTrackNumber + 1);
      }
    }
    for (let t = 0; t < checkTracks.length; t++) {
      const trk = checkTracks[t];
      for (let i = 0; i < trk.clips.numItems; i++) {
        const c = trk.clips[i];
        if (isForeignClip(c, runProjectItemNodeIds)) continue;
        let isPiece = false;
        for (let k = 0; k < allPieceNodeIds.length; k++) {
          if (allPieceNodeIds[k] === c.nodeId) {
            isPiece = true;
            break;
          }
        }
        if (isPiece) continue;
        const s = c.start.seconds;
        if (s < resolvedAnchorStart - 0.001 || s >= windowEnd + 0.001) continue;
        if (c.end.seconds - s <= 0.2) continue;
        const span = `${s.toFixed(2)}s–${c.end.seconds.toFixed(2)}s`;
        if (checkIsAlt[t]) {
          const kind = checkIsVideo[t] ? "video" : "audio";
          throw new Error(
            `Can't apply J/L Pacing: "${c.name}" on ${kind} track ${checkNumbers[t]} (${span}) comes from the same recording as the pieces but isn't selected, and J/L Pacing, which uses that track for its overlaps, would remove it. If it is one of the pieces, select it too; if it is another part of the recording (a second speaker, for example), move it to another ${kind} track. Then try again.`,
          );
        }
        if (checkIsVideo[t]) {
          throw new Error(
            `Can't apply J/L Pacing: "${c.name}" on video track ${checkNumbers[t]} (${span}) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.`,
          );
        }
        throw new Error(
          `Can't apply J/L Pacing: "${c.name}" on audio track ${checkNumbers[t]} (${span}) comes from the same recording as the pieces but isn't selected, and J/L Pacing would remove it. Select it too, or move it out of that stretch, then try again.`,
        );
      }
    }
  }

  for (let i = 0; i < ordered.length; i++) {
    ordered[i].remove(false, false);
    if (videoEnabled && linkedVideo[i]) {
      // Guarded, unlike the audio remove above (no clean rollback exists for a
      // mid-loop failure there anyway): if the video remove throws, the original
      // video clip is still at its old position, so null out this piece's
      // *snapshot* (not just linkedVideo[i]) so the placement loop below, which
      // reads snapshots[i].video, doesn't also place a fresh copy of the same
      // projectItem at the new pacing-adjusted position, which would leave a
      // duplicate instead of a clean single relocation.
      try {
        (linkedVideo[i] as TrackItem).remove(false, false);
      } catch (e) {
        warnings.push(`Piece ${i + 1} (video): could not remove for repositioning (${errMsg(e)}) — left in its original spot.`);
        linkedVideo[i] = null;
        snapshots[i].video = null;
      }
    }
  }

  // Kept parallel to snapshots by original index (not push order), so a
  // placement failure partway through can't shift which overlap/fade value a
  // later piece gets. `expectedStart` is the intended `placeAt`, independent of
  // any TrackItem reference: nodeId lookups on clips sharing this heavily reused
  // ProjectItem are unreliable and a held reference's own `.start` can be stale,
  // so every later refresh searches near this anchor instead.
  const placed: ({ clip: TrackItem; origIndex: number; speed: number; expectedStart: number } | null)[] = [];
  const placedVideo: ({ clip: TrackItem; origIndex: number; speed: number; expectedStart: number } | null)[] = [];
  let cursor = resolvedAnchorStart;

  // Every *unique* ProjectItem's original in/out, captured once (a linked
  // audio+video pair shares one ProjectItem — see narrowProjectItemWindow's
  // own comment) — narrowed to each piece's own window immediately before
  // its own overwriteClip() call below, restored to these exact values once
  // the whole loop finishes, in a `finally` so a mid-loop failure can't
  // leave a shared ProjectItem stuck narrowed.
  const originalBounds: { projectItem: any; nodeId: string; inPoint: number; outPoint: number }[] = [];
  const captureOriginalBounds = (pi: any): { inPoint: number; outPoint: number } | null => {
    for (let k = 0; k < originalBounds.length; k++) {
      if (originalBounds[k].nodeId === pi.nodeId) return { inPoint: originalBounds[k].inPoint, outPoint: originalBounds[k].outPoint };
    }
    try {
      const inPoint = pi.getInPoint().seconds;
      const outPoint = pi.getOutPoint().seconds;
      originalBounds.push({ projectItem: pi, nodeId: pi.nodeId, inPoint, outPoint });
      return { inPoint, outPoint };
    } catch (e) {
      return null;
    }
  };

  try {
    for (let i = 0; i < snapshots.length; i++) {
      const snap = snapshots[i];
      const sourceDur = snap.outPoint - snap.inPoint;
      const timelineDur = sourceDur / snap.speed;
      const overlap = i === 0 ? 0 : scaledOverlapsSec[i - 1];
      const placeAt = i === 0 ? cursor : cursor - overlap;
      const track = isReset || i % 2 === 0 ? originalTrack.track : altTrack;

      const origAudioBounds = captureOriginalBounds(snap.projectItem);
      if (origAudioBounds) {
        narrowProjectItemWindow(snap.projectItem, snap.inPoint, snap.outPoint, warnings, `for piece ${i + 1} before placing it`);
      }
      let pairedVideoTrack: Track | null = null;
      if (snap.video && jlPairedTracks) pairedVideoTrack = isReset || i % 2 === 0 ? originalVideoTrack : altVideoTrack;
      const placedOk = overwriteOnly(seq, track, snap.projectItem, placeAt, warnings, "audio", pairedVideoTrack);
      if (!placedOk) {
        warnings.push(`Piece ${i + 1}: Premiere rejected placing it at ${placeAt.toFixed(3)}s — left out.`);
        placed.push(null);
        placedVideo.push(null);
        cursor = placeAt + timelineDur;
        continue;
      }
      // Duration floor applied right at capture: J/L places pieces close together,
      // and earlier pieces in this loop can leave stray ~1-frame slivers sitting
      // closer to this placeAt than the real clip. A plain nearest search can't
      // prefer the real clip, and every later refresh would inherit a wrong first
      // capture.
      const newClip = findClipNear(track, placeAt, strayFragmentMaxDuration);
      if (!newClip) {
        warnings.push(`Piece ${i + 1}: placed, but could not locate it afterward — left as-is.`);
        placed.push(null);
        placedVideo.push(null);
        cursor = placeAt + timelineDur;
        continue;
      }
      // Diagnostic: a capture more than a frame away from where this piece was just
      // placed probably grabbed another clip (a stray from an earlier piece). 1/fps
      // is generous relative to normal frame-snap drift, so this only fires on a real
      // mismatch.
      if (Math.abs(newClip.start.seconds - placeAt) > 1 / fps) {
        warnings.push(
          `Piece ${i + 1} may have landed ${Math.abs(newClip.start.seconds - placeAt).toFixed(
            3,
          )}s away from where it belongs. Check it on the timeline. [diag: placement capture at ${newClip.start.seconds.toFixed(3)}s, intended ${placeAt.toFixed(3)}s]`,
        );
      }
      try {
        newClip.inPoint = secondsToTime(snap.inPoint);
        newClip.outPoint = secondsToTime(snap.outPoint);
      } catch (e) {
        // The clip exists on the timeline at this point: keep it with the wrong
        // source frames rather than discarding an otherwise real placement.
        warnings.push(`Piece ${i + 1}: placed, but setting its source in/out failed (${errMsg(e)}) — kept with default source framing.`);
      }
      // overwriteClip places the *entire* source media and only inPoint/outPoint
      // remap which frames play, so `end` must be set explicitly to shrink the
      // on-timeline span back to this piece's duration, and the real,
      // frame-snapped end is read back to seed the next iteration so per-piece
      // snap error never compounds.
      try {
        newClip.end = secondsToTime(placeAt + timelineDur);
        cursor = newClip.end.seconds;
      } catch (e) {
        cursor = placeAt + timelineDur;
      }

      placed.push({ clip: newClip, origIndex: i, speed: snap.speed, expectedStart: placeAt });

      // Place the linked video at the *same* placeAt/timelineDur as its audio:
      // the video cuts hard at the new piece's onset while the audio pieces
      // overlap underneath (each with only a short edge fade). That offset
      // between where the video cuts and where the audio overlaps is ordinary
      // J/L-cut editing, not a gap needing its own video transition.
      if (snap.video && originalVideoTrack && altVideoTrack) {
        const videoTrack = isReset || i % 2 === 0 ? originalVideoTrack : altVideoTrack;
        const origVideoBounds = captureOriginalBounds(snap.video.projectItem);
        if (origVideoBounds) {
          narrowProjectItemWindow(
            snap.video.projectItem,
            snap.video.inPoint,
            snap.video.outPoint,
            warnings,
            `for the video of piece ${i + 1} before placing it`,
          );
        }
        const vPlacedOk = overwriteOnly(
          seq,
          videoTrack as Track,
          snap.video.projectItem,
          placeAt,
          warnings,
          "video",
          jlPairedTracks ? track : null,
        );
        if (!vPlacedOk) {
          warnings.push(`Piece ${i + 1} (video): Premiere rejected placing it at ${placeAt.toFixed(3)}s — left out.`);
          placedVideo.push(null);
        } else {
          // Same duration floor as the audio capture above: stray debris from earlier
          // pieces can sit near a later piece's placeAt on either track.
          const newVideoClip = findClipNear(videoTrack, placeAt, strayFragmentMaxDuration);
          if (!newVideoClip) {
            warnings.push(`Piece ${i + 1} (video): placed, but could not locate it afterward — left as-is.`);
            placedVideo.push(null);
          } else {
            try {
              newVideoClip.inPoint = secondsToTime(snap.video.inPoint);
              newVideoClip.outPoint = secondsToTime(snap.video.outPoint);
            } catch (e) {
              warnings.push(
                `Piece ${i + 1} (video): placed, but setting its source in/out failed (${errMsg(e)}) — kept with default source framing.`,
              );
            }
            try {
              newVideoClip.end = secondsToTime(placeAt + timelineDur);
            } catch (e) {
              // best effort — video's own snap drift doesn't feed the shared
              // cursor above (audio already owns that); a tiny resulting
              // gap/overlap here is cosmetic, not data loss
            }
            placedVideo.push({ clip: newVideoClip, origIndex: i, speed: snap.video.speed, expectedStart: placeAt });
          }
        }
      } else {
        placedVideo.push(null);
      }
    }
  } finally {
    for (let k = 0; k < originalBounds.length; k++) {
      const b = originalBounds[k];
      narrowProjectItemWindow(b.projectItem, b.inPoint, b.outPoint, warnings, "back to its original range after placing the pieces");
    }
  }

  // Sync checkpoint right after the placement loop, from placed[]/placedVideo[]
  // (same index as snapshots[]/snapshotSyncAlignment[], nothing filtered or
  // reordered yet), before the stray sweep, the Reset check or the speed restore
  // run. The sweep's `.remove()` calls on clips sharing this ProjectItem can
  // disturb other TrackItems, so measuring here separates placement drift from
  // cleanup drift.
  const afterPlacementLoopAlignment: (number | null)[] = [];
  for (let p = 0; p < placed.length; p++) {
    const a = placed[p];
    const v = placedVideo[p];
    if (!a || !v) {
      afterPlacementLoopAlignment.push(null);
      continue;
    }
    try {
      afterPlacementLoopAlignment.push(a.clip.start.seconds - a.clip.inPoint.seconds - (v.clip.start.seconds - v.clip.inPoint.seconds));
    } catch (e) {
      afterPlacementLoopAlignment.push(null);
    }
  }

  let overlapsApplied = 0;
  const newClips: TrackItem[] = [];
  const newClipTracks: Track[] = [];
  const newClipExpectedStart: number[] = [];
  // `origIndex` is kept alongside the other parallel arrays so each piece's
  // known-good inPoint/outPoint (from snapshots[], Cut's untouched output) can be
  // re-asserted after the stray sweep below, whose `.remove()` calls on debris
  // sharing the ProjectItem can nudge them.
  const newClipOrigIndex: number[] = [];
  // `speed` is kept alongside too, so the speed-restore pass (after the
  // @construction refreshes) uses these fresh references, not the long-stale
  // placed[]/placedVideo[] ones.
  const newClipSpeed: number[] = [];
  for (let p = 0; p < placed.length; p++) {
    const entry = placed[p];
    if (!entry) continue;
    const i = entry.origIndex;
    if (i > 0 && overlapsSec[i - 1] > 0.0001) overlapsApplied++;
    newClips.push(entry.clip);
    newClipTracks.push(isReset || i % 2 === 0 ? originalTrack.track : altTrack);
    newClipExpectedStart.push(entry.expectedStart);
    newClipOrigIndex.push(i);
    newClipSpeed.push(entry.speed);
  }
  const newVideoClips: TrackItem[] = [];
  const newVideoClipTracks: Track[] = [];
  const newVideoClipExpectedStart: number[] = [];
  const newVideoClipOrigIndex: number[] = [];
  const newVideoClipSpeed: number[] = [];
  for (let p = 0; p < placedVideo.length; p++) {
    const entry = placedVideo[p];
    if (entry) {
      newVideoClips.push(entry.clip);
      newVideoClipTracks.push(isReset || entry.origIndex % 2 === 0 ? (originalVideoTrack as Track) : (altVideoTrack as Track));
      newVideoClipExpectedStart.push(entry.expectedStart);
      newVideoClipOrigIndex.push(entry.origIndex);
      newVideoClipSpeed.push(entry.speed);
    }
  }
  // Re-resolve the video references by position before the stray-video sweep
  // builds its keep-list (keepVideoNodeIds, below) from them; the audio
  // references get the same treatment just below, and both again before
  // fades. A reference that no longer matches its real clip's current nodeId
  // would make the sweep treat that wanted clip as debris and remove it, or
  // leave real debris behind.
  for (let p = 0; p < newVideoClips.length; p++) {
    newVideoClips[p] = refreshClipRef(
      newVideoClipTracks[p],
      newVideoClips[p],
      newVideoClipExpectedStart[p],
      strayFragmentMaxDuration,
      `video[${p}]@construction`,
      warnings,
    );
  }
  // Refresh here too, before the keep-list is built: `.nodeId` read off a stale
  // `newClips` entry doesn't reliably match the live clip, and a real piece
  // missing from `keepAudioNodeIds` would be deleted by the sweep as debris.
  for (let p = 0; p < newClips.length; p++) {
    newClips[p] = refreshClipRef(
      newClipTracks[p],
      newClips[p],
      newClipExpectedStart[p],
      strayFragmentMaxDuration,
      `audio[${p}]@construction`,
      warnings,
    );
  }

  // Reset-specific back-to-back self-check, reading `newClips` (refreshed by
  // position above). Warns only on a genuine gap or overlap, so it stays silent
  // on a normal J/L Pacing call and on a working Reset. Only compares pieces
  // adjacent in original order (`newClipOrigIndex[p] === newClipOrigIndex[p - 1]
  // + 1`), so a failed, filtered-out placement doesn't read as a gap.
  if (isReset) {
    let frameDur = 0.04;
    try {
      const vfr = seq.getSettings().videoFrameRate;
      if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) frameDur = vfr.seconds;
    } catch (e) {
      // leave the fallback in place
    }
    // 1.5-frame tolerance: a video-linked clip's start/end can only land on a frame
    // boundary, so when many independently sized pieces are laid back to back, an
    // occasional one-frame snap is unavoidable and harmless. Anything of two
    // frames or more is still reported.
    const posTol = 1.5 * frameDur;
    const mismatches: string[] = [];
    for (let p = 1; p < newClips.length; p++) {
      if (newClipOrigIndex[p] !== newClipOrigIndex[p - 1] + 1) continue;
      const gapOrOverlap = newClips[p].start.seconds - newClips[p - 1].end.seconds;
      if (Math.abs(gapOrOverlap) > posTol) {
        mismatches.push(
          `piece ${newClipOrigIndex[p] + 1}: starts at ${newClips[p].start.seconds.toFixed(3)}s, previous piece ends at ${newClips[
            p - 1
          ].end.seconds.toFixed(3)}s (${gapOrOverlap > 0 ? "gap" : "overlap"} of ${Math.abs(gapOrOverlap).toFixed(3)}s)`,
        );
      }
    }
    if (mismatches.length > 0) {
      warnings.push(`Reset: ${mismatches.length} piece(s) are not back to back: ${mismatches.join("; ")}.`);
    }
  }

  // Diagnostic: checks each video piece's track for the nearest clip of any
  // length near its `expectedStart`, at each sub-step between the @construction
  // refresh and the pre-fade refresh (speed restore, stray sweep). Reports a
  // missing clip, or a suspiciously short one (a piece shrunk to a sliver rather
  // than moved or deleted), to show which step first loses track of it.
  const checkVideoPositionsAt = (checkpointLabel: string) => {
    for (let p = 0; p < newVideoClipExpectedStart.length; p++) {
      const found = findClipNear(newVideoClipTracks[p], newVideoClipExpectedStart[p], 0);
      if (!found) continue;
      const dist = Math.abs(found.start.seconds - newVideoClipExpectedStart[p]);
      const dur = found.end.seconds - found.start.seconds;
      if (dist > REFRESH_SANITY_DIST) {
        warnings.push(
          `Video piece ${newVideoClipOrigIndex[p] + 1} is missing near ${newVideoClipExpectedStart[p].toFixed(
            3,
          )}s. Check the video track. [diag: ${checkpointLabel}; nearest clip ${dist.toFixed(3)}s away, duration ${dur.toFixed(3)}s]`,
        );
      } else if (dur < strayFragmentMaxDuration) {
        warnings.push(
          `Video piece ${newVideoClipOrigIndex[p] + 1} near ${newVideoClipExpectedStart[p].toFixed(
            3,
          )}s is only ${dur.toFixed(3)}s long. Check the video track. [diag: ${checkpointLabel}; stray-fragment floor ${strayFragmentMaxDuration.toFixed(3)}s]`,
        );
      }
    }
  };
  checkVideoPositionsAt("after @construction refresh, before speed-restore");

  // Restores whatever speed each piece (audio or video) had before this function
  // removed it: overwriteClip() always creates a fresh 1x clip, so Speed set
  // earlier is put back via the QE DOM (the same call applySpeedToSelection
  // uses; the standard DOM has no speed setter). The normal fresh-Cut case has
  // every piece at 1x and skips this.
  //
  // Runs here, after newClips/newVideoClips were refreshed by position
  // (@construction), not on placed[]'s first references, which are stale after
  // the rest of the loop's placements on the same shared ProjectItem. Each
  // clip's `.end` is re-asserted right after setSpeed(), which can collapse a
  // clip's duration (e.g. the last piece's video down to a ~1-frame sliver).
  // `expectedStart`/`sourceSpan` come from `snapshots[]` (Cut's untouched
  // output) and the independent `expectedStart` anchors, never from a TrackItem
  // setSpeed() may have just disturbed.
  // `sourceSpan` is the piece's source length; its timeline length comes from
  // the speed Premiere actually applies (setSpeedFully), so a piece it wouldn't
  // take all the way still shows its whole source.
  const needsSpeedRestore: { clip: TrackItem; speed: number; expectedStart: number; sourceSpan: number }[] = [];
  for (let p = 0; p < newClips.length; p++) {
    if (Math.abs(newClipSpeed[p] - 1) > 0.0001) {
      const snap = snapshots[newClipOrigIndex[p]];
      const sourceSpan = snap ? snap.outPoint - snap.inPoint : NaN;
      needsSpeedRestore.push({ clip: newClips[p], speed: newClipSpeed[p], expectedStart: newClipExpectedStart[p], sourceSpan });
    }
  }
  for (let p = 0; p < newVideoClips.length; p++) {
    if (Math.abs(newVideoClipSpeed[p] - 1) > 0.0001) {
      const snap = snapshots[newVideoClipOrigIndex[p]];
      const sourceSpan = snap && snap.video ? snap.video.outPoint - snap.video.inPoint : NaN;
      needsSpeedRestore.push({
        clip: newVideoClips[p],
        speed: newVideoClipSpeed[p],
        expectedStart: newVideoClipExpectedStart[p],
        sourceSpan,
      });
    }
  }
  // Diagnostic: counts each relevant track's clips right before and after the
  // speed-restore pass, to show whether a clip vanishes during setSpeed() (which
  // runs after the placement loop's `finally` widened the shared ProjectItem back
  // to its full range), and on which kind of track.
  const countClips = (trk: Track | null): number => (trk ? trk.clips.numItems : -1);
  const preSpeedRestoreCounts = {
    origAudio: countClips(originalTrack.track),
    altAudio: countClips(altTrack),
    origVideo: countClips(originalVideoTrack),
    altVideo: countClips(altVideoTrack),
  };
  if (needsSpeedRestore.length > 0) {
    const clipsNeedingSpeed: TrackItem[] = [];
    for (let p = 0; p < needsSpeedRestore.length; p++) clipsNeedingSpeed.push(needsSpeedRestore[p].clip);
    const frameSec = sequenceFrameSec(seq);
    let shortfallCount = 0;
    let lowestRatio = 1;
    forEachSelectedQEClip(seq, clipsNeedingSpeed, warnings, (qeItem, stdClip, _track, qeTrack) => {
      let match: { clip: TrackItem; speed: number; expectedStart: number; sourceSpan: number } | null = null;
      for (let p = 0; p < needsSpeedRestore.length; p++) {
        if (needsSpeedRestore[p].clip === stdClip) {
          match = needsSpeedRestore[p];
          break;
        }
      }
      if (match) {
        const appliedSpeed = setSpeedFully(qeItem, stdClip, match.speed, frameSec, qeItemFinder(qeTrack, stdClip));
        if (Math.abs(appliedSpeed - match.speed) > SPEED_MATCH_EPS) {
          shortfallCount++;
          if (appliedSpeed / match.speed < lowestRatio) lowestRatio = appliedSpeed / match.speed;
        }
        // Restore the clip's known-good span right after setSpeed() (see
        // needsSpeedRestore above): its effect on duration can't be trusted.
        if (!isNaN(match.sourceSpan)) {
          try {
            stdClip.end = secondsToTime(match.expectedStart + match.sourceSpan / appliedSpeed);
          } catch (e) {
            warnings.push(`Could not restore a piece's own duration after resetting its speed (${errMsg(e)}).`);
          }
        }
      }
    });
    if (shortfallCount > 0)
      warnings.push(
        `Premiere Pro put back less than the earlier Speed on ${shortfallCount} piece(s) (lowest ${speedPercentText(lowestRatio)}% of it). They still play all of their audio, at that lower speed.`,
      );
  }
  const postSpeedRestoreCounts = {
    origAudio: countClips(originalTrack.track),
    altAudio: countClips(altTrack),
    origVideo: countClips(originalVideoTrack),
    altVideo: countClips(altVideoTrack),
  };
  if (needsSpeedRestore.length > 0) {
    const countLabels: { key: keyof typeof preSpeedRestoreCounts; label: string }[] = [
      { key: "origAudio", label: "original audio" },
      { key: "altAudio", label: "alternate audio" },
      { key: "origVideo", label: "original video" },
      { key: "altVideo", label: "alternate video" },
    ];
    for (let k = 0; k < countLabels.length; k++) {
      const key = countLabels[k].key;
      if (preSpeedRestoreCounts[key] !== postSpeedRestoreCounts[key]) {
        warnings.push(
          `The number of clips on the ${countLabels[k].label} track changed while restoring speed. Check the track. [diag: ${preSpeedRestoreCounts[key]} -> ${postSpeedRestoreCounts[key]}, before the stray-cleanup sweep]`,
        );
      }
    }
  }
  checkVideoPositionsAt("after speed-restore, before stray-cleanup sweep");

  // Stray cleanup. A linked audio+video pair's shared ProjectItem leaves stray,
  // empty-looking duplicate fragments (no thumbnail, no name) on the original
  // video track as a side effect of the audio overwriteClip() calls, even when
  // narrowed. They don't affect playback, but are removed so the timeline shows
  // only what is meant to be there. Scoped to the tracks this run touched and to
  // this run's span: every clip of this run's own media in that window that
  // isn't one of its tracked placements is removed; other media is never
  // touched (see isForeignClip).
  //
  // `removeStrayVideo` runs a second time after fades: addTransition() appears to
  // have the same side effect on a clip whose ProjectItem is shared with linked
  // video, and a sweep that only runs before fades can't catch debris created
  // later.
  const videoSweepActive = !!(videoEnabled && originalVideoTrack && altVideoTrack && newVideoClips.length > 0);
  const lastSnap = snapshots[snapshots.length - 1];
  // Starts at resolvedAnchorStart, where the placement loop put piece 0; this
  // run places nothing earlier, so its debris starts there or later.
  const sweepStart = resolvedAnchorStart;
  // Also widened to `cursor` (the placement loop's final position): Reset removes
  // all overlap and so spreads the pieces over a wider span than they started
  // in. Taking the larger of the two estimates can only enlarge the window.
  const sweepEnd = Math.max(lastSnap.origStart + (lastSnap.outPoint - lastSnap.inPoint) / lastSnap.speed, cursor);
  const SWEEP_EPS = 0.001;
  // Diagnostic: a "stray" longer than SUBSTANTIAL_STRAY_THRESHOLD is reported
  // before removal (`.remove()` can invalidate the reference's properties). A
  // real piece should never qualify as debris, so this would mean a refresh
  // resolved some piece to the wrong clip. 0.2 s sits well above a ~1-frame
  // sliver and below the length of a normal kept piece.
  const SUBSTANTIAL_STRAY_THRESHOLD = 0.2;
  const removeStrayInWindow = (trk: Track, keepNodeIds: string[]): number => {
    const stray: TrackItem[] = [];
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      // Debris always comes from this run's own ProjectItems; other media in
      // the window (music, B-roll, titles) is never touched.
      if (isForeignClip(c, runProjectItemNodeIds)) continue;
      let keep = false;
      for (let k = 0; k < keepNodeIds.length; k++) {
        if (keepNodeIds[k] === c.nodeId) {
          keep = true;
          break;
        }
      }
      if (keep) continue;
      const s = c.start.seconds;
      if (s >= sweepStart - SWEEP_EPS && s < sweepEnd + SWEEP_EPS) stray.push(c);
    }
    for (let i = 0; i < stray.length; i++) {
      let dur = 0;
      try {
        dur = stray[i].end.seconds - stray[i].start.seconds;
      } catch (e) {
        // best effort — skip the size diagnostic if properties can't be read
      }
      if (dur > SUBSTANTIAL_STRAY_THRESHOLD) {
        warnings.push(
          `A ${dur.toFixed(3)}s clip at ${stray[i].start.seconds.toFixed(
            3,
          )}s was removed as a leftover fragment. If it was a real piece, undo (Cmd/Ctrl+Z), then run Diagnostics from the gear menu and add the report to a bug report. [diag: nodeId=${
            stray[i].nodeId
          }]`,
        );
      }
      try {
        stray[i].remove(false, false);
      } catch (e) {
        warnings.push(`Could not remove a leftover stray fragment (${errMsg(e)}).`);
      }
    }
    return stray.length;
  };
  // The keep-lists are rebuilt fresh from newClips/newVideoClips each time a
  // sweep runs, not captured once: steps such as fades can shift a piece's
  // nodeId, and a keep-list frozen before fades would let the second sweep
  // delete real pieces.
  const buildKeepNodeIds = (clips: TrackItem[]): string[] => {
    const ids: string[] = [];
    for (let p = 0; p < clips.length; p++) ids.push(clips[p].nodeId);
    return ids;
  };
  const removeStrayVideo = (trk: Track): number => removeStrayInWindow(trk, buildKeepNodeIds(newVideoClips));
  const removeStrayAudio = (trk: Track): number => removeStrayInWindow(trk, buildKeepNodeIds(newClips));
  const audioSweepActive = newClips.length > 0;

  if (videoSweepActive) {
    removeStrayVideo(originalVideoTrack as Track);
    removeStrayVideo(altVideoTrack as Track);
  }
  if (audioSweepActive) {
    removeStrayAudio(originalTrack.track);
    removeStrayAudio(altTrack);
  }
  checkVideoPositionsAt("after stray-cleanup sweep");

  // Re-resolve each clip by position right before handing it to the fade step,
  // instead of trusting references captured in the placement loop (dozens of
  // overwriteClip()/remove() calls ago). With stale references,
  // `addNativeEdgeFades`'s `locateTrackOfClip` nodeId search fails for the
  // earliest-placed pieces and their fades are skipped; `findClipNear` searches
  // the live track by position.
  for (let p = 0; p < newVideoClips.length; p++) {
    newVideoClips[p] = refreshClipRef(
      newVideoClipTracks[p],
      newVideoClips[p],
      newVideoClipExpectedStart[p],
      strayFragmentMaxDuration,
      `video[${p}]@pre-fade`,
      warnings,
    );
  }
  for (let p = 0; p < newClips.length; p++) {
    newClips[p] = refreshClipRef(
      newClipTracks[p],
      newClips[p],
      newClipExpectedStart[p],
      strayFragmentMaxDuration,
      `audio[${p}]@pre-fade`,
      warnings,
    );
  }

  // Re-assert each piece's known-good inPoint/outPoint from `snapshots[]` (Cut's
  // untouched output) on the just-refreshed references. The stray sweep's
  // `.remove()` calls on debris sharing the ProjectItem can nudge a real piece's
  // in/out by about a frame, enough for an out-of-sync badge. That side effect
  // can't be prevented, so it is corrected afterwards.
  for (let p = 0; p < newClips.length; p++) {
    const snap = snapshots[newClipOrigIndex[p]];
    if (!snap) continue;
    try {
      newClips[p].inPoint = secondsToTime(snap.inPoint);
      newClips[p].outPoint = secondsToTime(snap.outPoint);
    } catch (e) {
      // best effort — same degrade-gracefully convention as the placement
      // loop's own identical assignment
    }
  }
  for (let p = 0; p < newVideoClips.length; p++) {
    const snap = snapshots[newVideoClipOrigIndex[p]];
    if (!snap || !snap.video) continue;
    try {
      newVideoClips[p].inPoint = secondsToTime(snap.video.inPoint);
      newVideoClips[p].outPoint = secondsToTime(snap.video.outPoint);
    } catch (e) {
      // best effort
    }
  }
  // Writes each piece's end again, from where the piece actually starts.
  // overwriteClip() puts a piece's start on the nearest frame, while the
  // placement loop wrote its end from the unrounded placeAt. With linked
  // tracks, the video's overwriteClip() also lays its own copy of the audio
  // over the audio piece placed just before it; that copy is as long as the
  // video (whole frames), so the audio piece's own tail is left as a fragment
  // the sweep removes. Left alone, video ends sit up to half a frame off and
  // some audio pieces lose their last frame.
  // Each audio and video piece ends at start + source span / speed. Both use
  // the audio piece's span, as the placement loop does, because after a Speed
  // rebuild a video piece's own range can be half a frame shorter than its
  // audio; a video piece whose audio piece was not placed uses its own span.
  // So each piece plays exactly its range and audio and video end together.
  // Pieces without video keep the ends the loop gave them, and an end that
  // would run into another clip on the same track is not extended.
  const endFromStart = (clip: TrackItem, trk: Track, sourceSpan: number, fallbackSpeed: number): void => {
    if (!clip || !trk || isNaN(sourceSpan) || sourceSpan <= 0) return;
    try {
      const start = clip.start.seconds;
      const target = start + sourceSpan / readClipSpeed(clip, fallbackSpeed);
      const current = clip.end.seconds;
      if (Math.abs(target - current) < 0.0005) return;
      if (target > current) {
        for (let k = 0; k < trk.clips.numItems; k++) {
          const otherStart = trk.clips[k].start.seconds;
          if (otherStart > start + 0.0005 && otherStart < target - 0.0005) return;
        }
      }
      clip.end = secondsToTime(target);
    } catch (e) {
      // best effort: the piece keeps the end it has
    }
  };
  const audioPlaced: { [origIndex: number]: boolean } = {};
  for (let p = 0; p < newClips.length; p++) {
    const snap = snapshots[newClipOrigIndex[p]];
    if (!snap || !snap.video) continue;
    endFromStart(newClips[p], newClipTracks[p], snap.outPoint - snap.inPoint, newClipSpeed[p]);
    audioPlaced[newClipOrigIndex[p]] = true;
  }
  for (let p = 0; p < newVideoClips.length; p++) {
    const snap = snapshots[newVideoClipOrigIndex[p]];
    if (!snap || !snap.video) continue;
    const span = audioPlaced[newVideoClipOrigIndex[p]] ? snap.outPoint - snap.inPoint : snap.video.outPoint - snap.video.inPoint;
    endFromStart(newVideoClips[p], newVideoClipTracks[p], span, newVideoClipSpeed[p]);
  }

  // Diagnostic: each pair's `start - inPoint` alignment right before fades,
  // compared with the same value right after (below). Fades are the only step
  // that touches audio and not video, so this shows whether addTransition()
  // shifts a piece's sync.
  const syncBefore: number[] = [];
  const syncCheckActive = !isReset && newClips.length === newVideoClips.length && newClips.length > 0;
  if (syncCheckActive) {
    for (let p = 0; p < newClips.length; p++) {
      try {
        syncBefore.push(
          newClips[p].start.seconds - newClips[p].inPoint.seconds - (newVideoClips[p].start.seconds - newVideoClips[p].inPoint.seconds),
        );
      } catch (e) {
        syncBefore.push(NaN);
      }
    }
  }

  // Compares the snapshot-time alignment (Cut's untouched output) with this
  // "before fades" measurement. Only meaningful when every piece placed
  // successfully, so newClips and snapshotSyncAlignment stay index-aligned;
  // guarded by a length check.
  if (syncCheckActive && snapshotSyncAlignment.length === syncBefore.length) {
    for (let p = 0; p < syncBefore.length; p++) {
      const before = snapshotSyncAlignment[p];
      if (before === null || isNaN(syncBefore[p])) continue;
      if (Math.abs(syncBefore[p] - before) > 0.001) {
        // For a mismatched pair, also report whether its audio and video share a
        // ProjectItem and how far apart their captured inPoint and start were at
        // snapshot time.
        const snapForPiece = snapshots[p];
        let identityNote = "";
        if (snapForPiece && snapForPiece.video) {
          const sameNodeId =
            snapForPiece.projectItem && snapForPiece.video.projectItem
              ? snapForPiece.projectItem.nodeId === snapForPiece.video.projectItem.nodeId
              : null;
          const inPointDiff = snapForPiece.inPoint - snapForPiece.video.inPoint;
          const vClipForPiece = linkedVideo[p];
          const startDiff = vClipForPiece ? snapForPiece.origStart - vClipForPiece.start.seconds : null;
          identityNote = ` [diag: sharedProjectItem=${sameNodeId}, inPointDiff=${(inPointDiff * fps).toFixed(2)}f, startDiff=${
            startDiff === null ? "n/a" : (startDiff * fps).toFixed(2) + "f"
          }]`;
        }
        // Split the window between snapshot and "before fades" in two using
        // afterPlacementLoopAlignment (captured right after the placement loop's
        // `finally`, before the sweep), so a drift can be attributed to the placement
        // loop itself or to the cleanup steps after it.
        const mid = afterPlacementLoopAlignment[p];
        let splitNote = "";
        if (mid !== null && mid !== undefined) {
          const loopDelta = ((mid - before) * fps).toFixed(2);
          const afterLoopDelta = ((syncBefore[p] - mid) * fps).toFixed(2);
          splitNote = ` [split: placement-loop-itself=${loopDelta}f, after-loop-to-before-fades(sweep etc.)=${afterLoopDelta}f]`;
        }
        warnings.push(
          `Piece ${p + 1}: audio and video moved ${((syncBefore[p] - before) * fps).toFixed(
            2,
          )} frame(s) out of sync. [diag: placement, at Cut=${before.toFixed(4)}s, before fades=${syncBefore[p].toFixed(
            4,
          )}s]${identityNote}${splitNote}`,
        );
      }
    }
  }

  // Small native declick fade on every piece's start and end, sized per boundary
  // from the measured decay/rise at that boundary (tailFadeFrames/headFadeFrames
  // from computeJLCutOverlaps, which caps each at the boundary's overlap), with
  // JL_CUT_FADE_FRAMES where no size is given. Audio only: addNativeEdgeFades adds a QE audio
  // transition, and the hard visual cut at each piece's onset is intended.
  //
  // newClips' array position isn't the original boundary index those arrays are
  // keyed by (failed placements compact newClips); newClipOrigIndex is the real
  // index. Remapped here into two arrays aligned 1:1 with newClips, so
  // addNativeEdgeFades needs no origIndex logic.
  const clipTailFadeFrames: number[] = [];
  const clipHeadFadeFrames: number[] = [];
  for (let k = 0; k < newClips.length; k++) {
    const i = newClipOrigIndex[k];
    clipTailFadeFrames.push(tailFadeFrames && tailFadeFrames[i] !== undefined ? tailFadeFrames[i] : JL_CUT_FADE_FRAMES);
    clipHeadFadeFrames.push(headFadeFrames && i > 0 && headFadeFrames[i - 1] !== undefined ? headFadeFrames[i - 1] : JL_CUT_FADE_FRAMES);
  }

  // Skipped on Reset, which promises no overlap and no pacing fade.
  const fadesApplied =
    !isReset && newClips.length > 0 ? addNativeEdgeFades(seq, newClips, warnings, clipTailFadeFrames, clipHeadFadeFrames) : 0;

  // Refresh both arrays again right after fades: fades can shift a piece's
  // nodeId, and the keep-list is only right if rebuilt from currently valid
  // references. newVideoClips is refreshed too, in line with refreshing after
  // every track-mutating step.
  for (let p = 0; p < newClips.length; p++) {
    newClips[p] = refreshClipRef(
      newClipTracks[p],
      newClips[p],
      newClipExpectedStart[p],
      strayFragmentMaxDuration,
      `audio[${p}]@post-fade`,
      warnings,
    );
  }
  for (let p = 0; p < newVideoClips.length; p++) {
    newVideoClips[p] = refreshClipRef(
      newVideoClipTracks[p],
      newVideoClips[p],
      newVideoClipExpectedStart[p],
      strayFragmentMaxDuration,
      `video[${p}]@post-fade`,
      warnings,
    );
  }

  // The "after" half of the before/after-fades comparison above. Only reports a
  // piece whose alignment actually changed across the fade step.
  if (syncCheckActive && newClips.length === newVideoClips.length) {
    for (let p = 0; p < newClips.length; p++) {
      try {
        const after =
          newClips[p].start.seconds - newClips[p].inPoint.seconds - (newVideoClips[p].start.seconds - newVideoClips[p].inPoint.seconds);
        if (!isNaN(syncBefore[p]) && Math.abs(after - syncBefore[p]) > 0.001) {
          warnings.push(
            `Piece ${p + 1}: adding fades moved audio and video ${((after - syncBefore[p]) * fps).toFixed(
              2,
            )} frame(s) out of sync. [diag: before=${syncBefore[p].toFixed(4)}s, after=${after.toFixed(4)}s]`,
          );
        }
      } catch (e) {
        // best effort — a piece that can't be re-measured just isn't
        // checked, the rest still are
      }
    }
  }

  // Second sweep pass, after fades (see above on why one pass isn't enough). The
  // keep-list is rebuilt at call time (buildKeepNodeIds) from the just-refreshed
  // arrays. Routine cleanup is silent, since debris from the shared-ProjectItem
  // side effect is expected on every run; the self-check below, which flags a
  // real clip-count mismatch, is what surfaces as a warning.
  if (videoSweepActive) {
    removeStrayVideo(originalVideoTrack as Track);
    removeStrayVideo(altVideoTrack as Track);
  }
  if (audioSweepActive) {
    removeStrayAudio(originalTrack.track);
    removeStrayAudio(altTrack);
  }

  // Self-check: compares how many clips of this run's media each video track has
  // left within this run's sweep window after both cleanup passes with how many
  // this run placed there. A mismatch means the sweep missed something or removed
  // too much.
  if (videoSweepActive) {
    const countExpected = (trk: Track): number => {
      let n = 0;
      for (let p = 0; p < newVideoClipTracks.length; p++) if (newVideoClipTracks[p] === trk) n++;
      return n;
    };
    const countActualInWindow = (trk: Track): number => {
      let n = 0;
      for (let i = 0; i < trk.clips.numItems; i++) {
        if (isForeignClip(trk.clips[i], runProjectItemNodeIds)) continue;
        const s = trk.clips[i].start.seconds;
        if (s >= sweepStart - SWEEP_EPS && s < sweepEnd + SWEEP_EPS) n++;
      }
      return n;
    };
    const origExpected = countExpected(originalVideoTrack as Track);
    const origActual = countActualInWindow(originalVideoTrack as Track);
    const altExpected = countExpected(altVideoTrack as Track);
    const altActual = countActualInWindow(altVideoTrack as Track);
    if (origActual !== origExpected || altActual !== altExpected) {
      warnings.push(
        `Video track: ${origActual} clip(s) where ${origExpected} were expected (alternate track: ${altActual} of ${altExpected}). Some leftover fragments may remain, or a piece was removed.`,
      );
    }
  }

  // Same self-check, for audio.
  if (audioSweepActive) {
    const countExpected = (trk: Track): number => {
      let n = 0;
      for (let p = 0; p < newClipTracks.length; p++) if (newClipTracks[p] === trk) n++;
      return n;
    };
    const countActualInWindow = (trk: Track): number => {
      let n = 0;
      for (let i = 0; i < trk.clips.numItems; i++) {
        if (isForeignClip(trk.clips[i], runProjectItemNodeIds)) continue;
        const s = trk.clips[i].start.seconds;
        if (s >= sweepStart - SWEEP_EPS && s < sweepEnd + SWEEP_EPS) n++;
      }
      return n;
    };
    const origExpected = countExpected(originalTrack.track);
    const origActual = countActualInWindow(originalTrack.track);
    const altExpected = countExpected(altTrack);
    const altActual = countActualInWindow(altTrack);
    if (origActual !== origExpected || altActual !== altExpected) {
      warnings.push(
        `Audio track: ${origActual} clip(s) where ${origExpected} were expected (alternate track: ${altActual} of ${altExpected}). Some leftover fragments may remain, or a piece was removed.`,
      );
    }
  }

  // Refresh once more right before the selection loop: fades, the second sweep
  // and the count check all ran since the last refresh, and `setSelected()` on a
  // stale reference fails silently, leaving only some of the pieces selected.
  for (let p = 0; p < newClips.length; p++) {
    newClips[p] = refreshClipRef(
      newClipTracks[p],
      newClips[p],
      newClipExpectedStart[p],
      strayFragmentMaxDuration,
      `audio[${p}]@final-selection`,
      warnings,
    );
  }
  for (let p = 0; p < newVideoClips.length; p++) {
    newVideoClips[p] = refreshClipRef(
      newVideoClipTracks[p],
      newVideoClips[p],
      newVideoClipExpectedStart[p],
      strayFragmentMaxDuration,
      `video[${p}]@final-selection`,
      warnings,
    );
  }

  if (videoEnabled && newVideoClips.length > 0) {
    const failed = linkPiecesByStart(seq, newClips, newClipExpectedStart, newVideoClips, newVideoClipExpectedStart);
    if (failed > 0) warnings.push(unlinkedPiecesWarning(failed));
  }

  // Plain loops build the combined list, the same style as the rest of this
  // file's ExtendScript array code (see cutClipViaRazor).
  const allNewClips: TrackItem[] = [];
  for (let i = 0; i < newClips.length; i++) allNewClips.push(newClips[i]);
  for (let i = 0; i < newVideoClips.length; i++) allNewClips.push(newVideoClips[i]);
  for (let i = 0; i < allNewClips.length; i++) {
    try {
      allNewClips[i].setSelected(true, i === allNewClips.length - 1);
    } catch (e) {
      // non-fatal — selection is a convenience, not required for the result itself
    }
  }

  return {
    clipsProcessed: newClips.length,
    overlapsApplied,
    fadesApplied,
    warnings,
    // 1 per removal + 1 per placement, plus a remove/place pair per video piece.
    // Not used by any Undo button (Premiere's undo stack can't be counted safely;
    // see main.tsx's handleResetSmoothCuts); kept for diagnostics only.
    undoSteps: ordered.length * 2 + newVideoClips.length * 2,
  };
};

/** Replace (Replace Voice and Voice Changer) puts the new take on the audio
 *  track below the old take and only disables the old take, so it can always
 *  be turned back on. Throws, before the old take is touched, when there is no
 *  track below, when either track is locked (Premiere refuses edits there), or
 *  when the track below already has a clip between `fromSec` and `toSec`.
 *  checkReplaceTarget and renderSelectedClipToWav also run it before a paid
 *  generation or conversion. */
const requireReplaceTracksReady = (seq: Sequence, takeTrack: Track, takeTrackIndex: number, fromSec: number, toSec: number): void => {
  if (takeTrackIndex + 1 >= seq.audioTracks.numTracks) {
    throw new Error(
      `The new take goes on the audio track below and the previous take stays as a disabled clip, but audio track ${
        takeTrackIndex + 1
      } is the last one. Add an audio track (Sequence > Add Tracks), then try again. Nothing was replaced.`,
    );
  }
  const placeTrack = seq.audioTracks[takeTrackIndex + 1];
  let lockedIndex = -1;
  if (isTrackLocked(takeTrack)) lockedIndex = takeTrackIndex;
  else if (isTrackLocked(placeTrack)) lockedIndex = takeTrackIndex + 1;
  if (lockedIndex >= 0) {
    throw new Error(
      `Audio track ${lockedIndex + 1} is locked, so the new take can't be placed. Unlock it, then try again. Nothing was replaced.`,
    );
  }
  const busy = findClipOverlapping(placeTrack, fromSec, toSec);
  if (busy) {
    throw new Error(
      `Audio track ${takeTrackIndex + 2} already has a clip where the new take would go ("${busy.name}", ${busy.start.seconds.toFixed(
        2,
      )}s–${busy.end.seconds.toFixed(2)}s) — nothing was replaced, to avoid overwriting it. Free that stretch of the track, then try again.`,
    );
  }
};

/**
 * Imports a generated voice-over file (written to disk by the JS side, see
 * elevenlabs.ts/kokoro.ts; ExtendScript can't generate it itself) and places
 * it on the timeline.
 *
 * `replaceSelectedClip: true` is the AI Voice tab's quick voice swap: the new
 * audio goes at the selected clip's start instead of the playhead. The previous
 * take is muted (`disabled = true`) and the new one goes on the audio track
 * below, so the swap is reversible (turn the clip back on with Clip > Enable,
 * or use the panel's Undo). Without a free track below, Replace refuses before
 * anything changes (requireReplaceTracksReady).
 * Refuses before touching anything if the target stretch is already occupied
 * (findClipOverlapping), or if `expectedClipNodeId` is given and the selection
 * has changed. Throws getSelectedTrackItem's "select exactly one clip" error
 * when the selection isn't one clip; the panel checks first that a generated
 * clip is selected (generationMetadata.ts).
 *
 * `replaceSelectedClip: false` (plain Insert) places at the playhead on the
 * target audio track (see targetAudioTrackIndex: the targeted track, else
 * track 1) and refuses, before touching the timeline, if that span already has
 * anything on it, since overwriteClip() would silently trim or delete it.
 *
 * The panel's Undo passes `placedNodeId`/`filePath`/`mutedOriginalNodeId` to
 * undoGeneratedPlacement; `undoSteps` is informational only.
 */
export const importAudioAndPlaceOnTimeline = (
  filePath: string,
  replaceSelectedClip: boolean = false,
  expectedClipNodeId?: string,
): ImportAudioResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!filePath) throw new Error("No audio file path given.");
  const sourceFile = new File(filePath);
  if (!sourceFile.exists) throw new Error(`Generated audio file not found on disk: ${filePath}`);

  // Import and locate the new ProjectItem before touching the existing clip
  // below, so a transient import failure (antivirus lock, disk hiccup) can never
  // leave the original take disabled with nothing to replace it.
  const childrenBefore = app.project.rootItem.children.numItems;
  const ok = app.project.importFiles([filePath], true, app.project.rootItem, false);
  if (!ok) throw new Error("Premiere rejected importing the generated audio file.");

  // importFiles doesn't return the created ProjectItem — find it by matching
  // media path against every root-bin item. Reliable here since the JS side
  // always writes a fresh, timestamp-unique filename, so there's exactly one
  // match; falls back to "the last item added" (child count grew) if path
  // matching somehow fails, e.g. a separator/casing mismatch between Node's
  // write and ExtendScript's own read, rather than silently doing nothing.
  // Case-insensitive compare — Windows' filesystem is case-preserving but
  // not case-sensitive, so getMediaPath() could come back with different
  // drive-letter/segment casing than the exact string importFiles was given;
  // a strict === here would then always miss on Windows and silently fall
  // through to the (less precise) last-item-added fallback every time.
  const targetPath = String(sourceFile.fsName).toLowerCase();
  const children = app.project.rootItem.children;
  let projectItem: ProjectItem | null = null;
  for (let i = 0; i < children.numItems; i++) {
    const item = children[i];
    try {
      if (item.getMediaPath && String(item.getMediaPath()).toLowerCase() === targetPath) {
        projectItem = item;
        break;
      }
    } catch (e) {
      // not a media item (e.g. a bin) — skip
    }
  }
  if (!projectItem && children.numItems > childrenBefore) {
    projectItem = children[children.numItems - 1];
  }
  if (!projectItem) {
    throw new Error("Import appeared to succeed, but the new project item could not be located.");
  }

  let track: Track;
  let trackIndex: number;
  let targetPosition: number;
  const removedExistingClip = false;
  let mutedInsteadOfRemoved = false;
  let mutedOriginalNodeId = "";
  // The old take, kept so a rejected placement can turn it back on.
  let mutedClip: TrackItem | null = null;

  if (replaceSelectedClip) {
    const selected = getSelectedTrackItem(seq);
    if (selected.trackType !== "audio") {
      throw new Error("Select the audio clip whose voice you want to replace.");
    }
    // Voice Changer (render, wait for the file, upload, convert) and AI Voice's
    // text-to-speech Replace can take from several seconds to tens of seconds
    // between selecting a clip and this placement, and a different clip can be
    // selected meanwhile. Without this check, that clip would be muted and
    // overwritten with audio made for the original one. Callers pass
    // `expectedClipNodeId` (main.tsx's handleGenerate captures it from the polled
    // clip right before generation starts); a caller with no clip to verify
    // against omits it.
    if (expectedClipNodeId && selected.clip.nodeId !== expectedClipNodeId) {
      throw new Error(
        "The selected clip changed while the new voice was being made — nothing was replaced, to avoid overwriting the wrong clip. Re-select the original clip and try again.",
      );
    }
    targetPosition = selected.clip.start.seconds;
    // The new take must land on free track space below: overwriteClip() trims
    // or deletes whatever already sits in its span. Checked over the new take's
    // real length, before the original is touched.
    const takeEnd = targetPosition + (projectItem.getOutPoint().seconds - projectItem.getInPoint().seconds);
    requireReplaceTracksReady(seq, selected.track, selected.trackIndex, targetPosition, takeEnd);
    // Replace by muting, not deleting: `disabled` is a documented TrackItem
    // property, and setting it silences the clip without removing it, so the
    // original can be recovered by clearing it in Premiere. A disabled clip still
    // occupies its slot, so the new voice goes on the audio track below, which
    // requireReplaceTracksReady has confirmed exists and is free. No track is
    // created when none exists (that would need QE's `addTracks(...)`, which is
    // not part of Adobe's documented scripting API); Replace refuses instead.
    selected.clip.disabled = true;
    mutedInsteadOfRemoved = true;
    mutedOriginalNodeId = selected.clip.nodeId;
    mutedClip = selected.clip;
    trackIndex = selected.trackIndex + 1;
    track = seq.audioTracks[trackIndex];
  } else {
    if (seq.audioTracks.numTracks === 0) {
      throw new Error("Active sequence has no audio track to place the generated voice-over on.");
    }
    trackIndex = targetAudioTrackIndex(seq);
    track = seq.audioTracks[trackIndex];
    requireUnlockedTargetTrack(track, trackIndex);
    targetPosition = seq.getPlayerPosition().seconds;

    // Insert refuses to overwrite: overwriteClip() is an ordinary overwrite edit
    // that silently trims or deletes whatever occupies the span, and Insert reads
    // as purely additive. Checked against the new audio's real duration (a freshly
    // imported ProjectItem's default in/out spans the whole file), not just the
    // playhead point, since a clip further along the span is just as much at risk.
    const newDuration = projectItem.getOutPoint().seconds - projectItem.getInPoint().seconds;
    for (let i = 0; i < track.clips.numItems; i++) {
      const existing = track.clips[i];
      const existingStartStr = existing.start.seconds.toFixed(2);
      const existingEndStr = existing.end.seconds.toFixed(2);
      const playheadStr = targetPosition.toFixed(2);
      if (existing.start.seconds < targetPosition + newDuration && existing.end.seconds > targetPosition) {
        throw new Error(
          `Audio track ${trackIndex + 1} already has a clip here ("${existing.name}", ${existingStartStr}s–${existingEndStr}s) — inserting the generated voice-over at the playhead (${playheadStr}s) would overwrite it. Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.`,
        );
      }
    }
  }

  let placedOk = false;
  try {
    placedOk = track.overwriteClip(projectItem, targetPosition);
  } catch (e) {
    if (!mutedClip) throw e;
  }
  if (!placedOk) {
    // A rejected Replace turns the old take back on before reporting.
    if (mutedClip) {
      try {
        mutedClip.disabled = false;
      } catch (e) {
        throw new Error(
          `Premiere rejected placing the generated audio at ${targetPosition.toFixed(
            3,
          )}s. The previous take is still disabled: select it and choose Clip > Enable.`,
        );
      }
      throw new Error(
        `Premiere rejected placing the generated audio at ${targetPosition.toFixed(3)}s. The previous take was turned back on.`,
      );
    }
    throw new Error(`Premiere rejected placing the generated audio at ${targetPosition.toFixed(3)}s.`);
  }

  const warnings: string[] = [];
  const newClip = findClipNear(track, targetPosition);
  if (newClip) {
    // Clear the previous selection so the new clip becomes the single selected
    // clip that Cut/Speed/Pitch expect (getSelectedTrackItem throws on 0 or >1
    // selected).
    const priorSelection = seq.getSelection();
    if (priorSelection) {
      for (let i = 0; i < priorSelection.length; i++) {
        try {
          priorSelection[i].setSelected(false, false);
        } catch (e) {
          // best effort
        }
      }
    }
    try {
      newClip.setSelected(true, true);
    } catch (e) {
      warnings.push("Placed on the timeline, but could not auto-select the new clip.");
    }
  } else {
    warnings.push("Placed on the timeline, but could not locate the new clip afterward to select it.");
  }

  return {
    imported: true,
    trackIndex,
    placedAtSeconds: targetPosition,
    mutedInsteadOfRemoved,
    // 1 for importFiles + 1 for overwriteClip + 1 more if replace mode
    // muted an existing clip first. Informational only: the panel's
    // Undo uses undoGeneratedPlacement, never a count of Premiere undo steps.
    undoSteps: 2 + (removedExistingClip || mutedInsteadOfRemoved ? 1 : 0),
    warnings,
    placedNodeId: newClip ? newClip.nodeId : "",
    filePath: String(sourceFile.fsName),
    mutedOriginalNodeId,
    removedOriginal: removedExistingClip,
    sequenceId: String(seq.sequenceID || ""),
    sequenceName: String(seq.name || ""),
  };
};

/**
 * The panel's Undo for Generate & Insert, Replace Voice, Voice Changer and
 * Batch: removes exactly the clips that placement put on the timeline and
 * turns a muted original take back on — never a guessed number of Premiere
 * undo steps, which would also undo whatever the user did in between. A clip
 * is removed only if it still plays one of `filePaths`; the imported files
 * stay in the project.
 *
 * Refuses, before anything changes, in a sequence other than `sequenceId`
 * (the clips are looked up in the active sequence only) and when a track a
 * placed clip or the muted original sits on is locked. Each removal is
 * verified by looking the clip up again: one that is still there counts as
 * `remaining`, and the original take is turned back on only when nothing of
 * the new take remains, so the two never play together.
 */
export const undoGeneratedPlacement = (
  placedNodeIds: string[],
  filePaths: string[],
  mutedOriginalNodeId: string,
  sequenceId?: string,
  sequenceName?: string,
): UndoGeneratedResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (sequenceId && String(seq.sequenceID || "") !== sequenceId) {
    throw new Error(
      `Cannot undo: this voice-over was placed in the sequence "${sequenceName || ""}". Open that sequence, then try again. Nothing was changed.`,
    );
  }
  const warnings: string[] = [];
  const paths: string[] = [];
  for (let i = 0; i < filePaths.length; i++) paths.push(String(new File(filePaths[i]).fsName).toLowerCase());
  const playsGeneratedFile = (c: TrackItem): boolean => {
    try {
      const p = String(c.projectItem.getMediaPath()).toLowerCase();
      for (let i = 0; i < paths.length; i++) if (paths[i] === p) return true;
    } catch (e) {
      // no media path — not ours
    }
    return false;
  };
  const findOnAudioTracks = (nodeId: string): TrackItem | null => {
    for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
      const m = findClipByNodeId(seq.audioTracks[ai], nodeId);
      if (m) return m;
    }
    return null;
  };
  const lockedTrackOf = (nodeId: string): number => {
    for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
      if (findClipByNodeId(seq.audioTracks[ai], nodeId) && isTrackLocked(seq.audioTracks[ai])) return ai;
    }
    return -1;
  };
  const lockedIds: string[] = [];
  for (let i = 0; i < placedNodeIds.length; i++) lockedIds.push(placedNodeIds[i]);
  if (mutedOriginalNodeId) lockedIds.push(mutedOriginalNodeId);
  for (let i = 0; i < lockedIds.length; i++) {
    const lockedIndex = lockedTrackOf(lockedIds[i]);
    if (lockedIndex >= 0) {
      throw new Error(`Cannot undo: audio track ${lockedIndex + 1} is locked. Unlock it, then try again. Nothing was changed.`);
    }
  }

  // A generated clip that was cut into pieces (or copied) after it was placed
  // can't be undone exactly: removing the clip that kept the placed nodeId
  // would leave the other pieces. Refuse before changing anything.
  let clipsPlayingFiles = 0;
  for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
    const trk = seq.audioTracks[ai];
    for (let ci = 0; ci < trk.clips.numItems; ci++) {
      if (playsGeneratedFile(trk.clips[ci])) clipsPlayingFiles++;
    }
  }
  if (clipsPlayingFiles > placedNodeIds.length) {
    throw new Error(
      "This voice-over was edited after it was placed (it now plays in more pieces), so the plugin's Undo can't restore it exactly. Nothing was changed — delete the pieces by hand, or use Cmd/Ctrl+Z.",
    );
  }

  let removed = 0;
  let missing = 0;
  let changed = 0;
  let remaining = 0;
  for (let i = 0; i < placedNodeIds.length; i++) {
    const c = findOnAudioTracks(placedNodeIds[i]);
    if (!c) {
      missing++;
      continue;
    }
    if (!playsGeneratedFile(c)) {
      changed++;
      continue;
    }
    try {
      c.remove(false, false);
    } catch (e) {
      warnings.push(`Removing a generated clip failed (${errMsg(e)}).`);
      remaining++;
      continue;
    }
    // remove() can do nothing without throwing: count the clip only once it
    // is really gone.
    if (findOnAudioTracks(placedNodeIds[i])) {
      warnings.push("A generated clip could not be removed — it is still on the timeline.");
      remaining++;
    } else {
      removed++;
    }
  }
  if (missing > 0) warnings.push("A generated clip is no longer on the timeline — nothing to remove there.");
  if (changed > 0) warnings.push("A generated clip now plays a different file — it was left on the timeline.");

  let unmuted = false;
  if (mutedOriginalNodeId && remaining > 0) {
    warnings.push(
      "The original take was left muted because the new take is still on the timeline. Remove the new take by hand, then select the original and choose Clip > Enable in Premiere.",
    );
  } else if (mutedOriginalNodeId) {
    const original = findOnAudioTracks(mutedOriginalNodeId);
    if (original) {
      try {
        original.disabled = false;
        unmuted = true;
        original.setSelected(true, true);
      } catch (e) {
        warnings.push(`Turning the original take back on failed (${errMsg(e)}).`);
      }
    } else {
      warnings.push("The original take could not be found to turn it back on. Select it and choose Clip > Enable in Premiere.");
    }
  }
  return { removed, unmuted, remaining, warnings };
};

/** The first clip on `track` overlapping [start, end), other than the clip
 *  with `exceptNodeId`; null when that stretch of the track is free. */
const findClipOverlapping = (track: Track, start: number, end: number, exceptNodeId?: string): TrackItem | null => {
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (exceptNodeId && c.nodeId === exceptNodeId) continue;
    if (c.start.seconds < end && c.end.seconds > start) return c;
  }
  return null;
};

/** The audio track new voice-overs go onto: the first audio track targeted in
 *  Premiere (the track header's target toggle), else track 1. */
const targetAudioTrackIndex = (seq: Sequence): number => {
  for (let i = 0; i < seq.audioTracks.numTracks; i++) {
    try {
      const trk: any = seq.audioTracks[i];
      if (typeof trk.isTargeted === "function" && trk.isTargeted()) return i;
    } catch (e) {
      // targeting not readable: fall through to track 1
    }
  }
  return 0;
};

/** Read-only check before a paid Generate & Insert: refuses when the playhead
 *  already sits on a clip on the target audio track. The full-length check runs
 *  again after generation, once the new audio's duration is known. */
export const checkInsertSpot = (): boolean => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (seq.audioTracks.numTracks === 0) {
    throw new Error("Active sequence has no audio track to place the generated voice-over on.");
  }
  const trackIndex = targetAudioTrackIndex(seq);
  const track = seq.audioTracks[trackIndex];
  requireUnlockedTargetTrack(track, trackIndex);
  const playhead = seq.getPlayerPosition().seconds;
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (c.start.seconds <= playhead && c.end.seconds > playhead) {
      throw new Error(
        `Audio track ${trackIndex + 1} already has a clip at the playhead ("${c.name}", ${c.start.seconds.toFixed(2)}s–${c.end.seconds.toFixed(
          2,
        )}s). Move the playhead to an empty stretch of that track, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.`,
      );
    }
  }
  return true;
};

/** Read-only check before a paid Replace Voice: the selected clip must be a whole
 *  generated clip. Replace places the full new take at the clip's start, so on
 *  one piece of a cut voice-over it would drop the whole script there. */
export const checkReplaceTarget = (): boolean => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  const selected = getSelectedTrackItem(seq);
  const clip = selected.clip;
  // The new take's length is unknown before generation; it starts at the clip's
  // start, so a clip there on the track below would refuse it in any case.
  if (selected.trackType === "audio") {
    requireReplaceTracksReady(seq, selected.track, selected.trackIndex, clip.start.seconds, clip.start.seconds + 0.01);
  }
  let speed = 1;
  try {
    const sp = clip.getSpeed();
    if (typeof sp === "number" && sp > 0) speed = sp;
  } catch (e) {
    // treated as 100%
  }
  let mediaIn = 0;
  let mediaOut = 0;
  try {
    mediaIn = clip.projectItem.getInPoint().seconds;
    mediaOut = clip.projectItem.getOutPoint().seconds;
  } catch (e) {
    return true;
  }
  const sourceIn = clip.inPoint.seconds * speed;
  const sourceEnd = sourceIn + (clip.end.seconds - clip.start.seconds) * speed;
  const tolerance = Math.abs(speed - 1) < 0.0001 ? 0.05 : 0.25;
  if (sourceIn > mediaIn + tolerance || sourceEnd < mediaOut - tolerance) {
    throw new Error(
      "The selected clip is only part of a generated voice-over (it was cut or trimmed). Replace swaps a whole generated clip and would drop the full new take here. Use Generate & Insert instead, or select an uncut generated clip.",
    );
  }
  return true;
};

/** Refuses placing generated audio on a locked track, before the generation
 *  is paid for: Premiere rejects the placement on a locked track, and the
 *  message it gives then says nothing about the lock. */
const requireUnlockedTargetTrack = (track: Track, trackIndex: number): void => {
  if (isTrackLocked(track)) {
    throw new Error(
      `Audio track ${trackIndex + 1} is locked, so the generated voice-over can't be placed there. Unlock it, or make another audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), and try again.`,
    );
  }
};

/** Guards Batch against silently overwriting existing content: it places N new
 *  clips one after another from the playhead on the target audio track (see
 *  targetAudioTrackIndex) and has no "next track down" to redirect to, so
 *  rather than guess a safe subset of the queue it refuses whenever anything
 *  on the track ends after the playhead. Without this, music or dialogue past
 *  the playhead would be eaten by track.overwriteClip() with no warning. The
 *  message names the first clip in the way and the end of the track's last
 *  clip, rounded up to the hundredth so that a playhead set to the shown time
 *  passes. `afterGeneration` is true at placement, when the lines are already
 *  generated: they stay in the queue, and the next Generate All places them
 *  without generating them again. */
const requireFreeTrackAfterPlayhead = (track: Track, trackIndex: number, playheadSeconds: number, afterGeneration: boolean): void => {
  let blocking: TrackItem | null = null;
  let lastEnd = 0;
  for (let i = 0; i < track.clips.numItems; i++) {
    const c = track.clips[i];
    if (c.end.seconds > lastEnd) lastEnd = c.end.seconds;
    if (c.end.seconds > playheadSeconds && (blocking === null || c.start.seconds < blocking.start.seconds)) blocking = c;
  }
  if (blocking === null) return;
  // The small offset keeps float error such as 0.07 * 100 = 7.000000000000001 from rounding up a whole hundredth.
  const freeFrom = (Math.ceil(lastEnd * 100 - 0.000001) / 100).toFixed(2);
  const outcome = afterGeneration ? "The generated lines are kept. Nothing was placed." : "Nothing was generated.";
  throw new Error(
    `Audio track ${trackIndex + 1} has "${blocking.name}" at or after the playhead. Batch places its clips one after another from the playhead and would overwrite it. Make an empty audio track the first targeted one (turn on its track-targeting button in the track header, and turn it off on the audio tracks above it), or move the playhead to ${freeFrom}s or later, the end of that track's last clip, and click Generate All again. ${outcome}`,
  );
};

/** Read-only check the panel runs before generating a batch, so a paid
 *  generation never ends in a refused placement: the same conditions
 *  importAudioAndPlaceSequentially checks before placing. */
export const checkBatchPlacementSpot = (expectedSequenceId?: string, expectedSequenceName?: string): boolean => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  // The same sequence rule importAudioAndPlaceSequentially applies, checked
  // here so that no line is generated for a placement that will be refused.
  if (expectedSequenceId && String(seq.sequenceID || "") !== expectedSequenceId) {
    throw new Error(
      `This batch's earlier clips were placed in the sequence "${expectedSequenceName || ""}". Open that sequence, then click Generate All again. Nothing was generated.`,
    );
  }
  if (seq.audioTracks.numTracks === 0) {
    throw new Error("Active sequence has no audio track to place generated voice-overs on.");
  }
  const batchTrackIndex = targetAudioTrackIndex(seq);
  requireUnlockedTargetTrack(seq.audioTracks[batchTrackIndex], batchTrackIndex);
  requireFreeTrackAfterPlayhead(seq.audioTracks[batchTrackIndex], batchTrackIndex, seq.getPlayerPosition().seconds, false);
  return true;
};

/**
 * Batch generation's placement step: imports each of `filePaths` (generated on
 * the JS side, one ElevenLabs/Kokoro call per queued item) and places them
 * one after another from the current playhead on the target audio track,
 * with the same defaults as importAudioAndPlaceOnTimeline's insert mode. Each
 * file goes at a cursor reseeded from the placed clip's actual end
 * (overwriteClip → findClipNear), so per-piece frame-snap error doesn't add
 * up across many pieces. Each file is a complete standalone clip, so there
 * is no inPoint/outPoint/end remapping.
 *
 * Best effort per item, like forEachSelectedQEClip: one bad file logs a
 * warning and the loop continues. Never mutes or removes anything. The
 * panel's Undo removes the placed clips with undoGeneratedPlacement
 * (placedNodeIds/placedFilePaths); `undoSteps` is informational only.
 */
export const importAudioAndPlaceSequentially = (
  filePaths: string[],
  expectedSequenceId?: string,
  expectedSequenceName?: string,
): BatchImportResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!filePaths || filePaths.length === 0) throw new Error("No files to place.");
  // The panel merges this run's clips into the record of the batch's earlier
  // runs, which the panel's Undo removes together: placing in another sequence
  // would make that record span two sequences, so it is refused before
  // anything is placed (the generated files stay; the queue can run again in
  // the right sequence). Checked here, at placement, since the user can
  // switch sequences while the lines are being generated.
  if (expectedSequenceId && String(seq.sequenceID || "") !== expectedSequenceId) {
    throw new Error(
      `Cannot place: this batch's earlier clips were placed in the sequence "${expectedSequenceName || ""}". Open that sequence, then click Generate All again; the generated lines are kept. Nothing was placed.`,
    );
  }
  if (seq.audioTracks.numTracks === 0) {
    throw new Error("Active sequence has no audio track to place generated voice-overs on.");
  }
  const batchTrackIndex = targetAudioTrackIndex(seq);
  const track = seq.audioTracks[batchTrackIndex];
  requireUnlockedTargetTrack(track, batchTrackIndex);
  let cursor = seq.getPlayerPosition().seconds;
  requireFreeTrackAfterPlayhead(track, batchTrackIndex, cursor, true);

  const warnings: string[] = [];
  let imported = 0;
  let undoSteps = 0;
  const placedNodeIds: string[] = [];
  const placedFilePaths: string[] = [];

  for (let f = 0; f < filePaths.length; f++) {
    try {
      const filePath = filePaths[f];
      const sourceFile = new File(filePath);
      if (!sourceFile.exists) {
        warnings.push(`File ${f + 1} of ${filePaths.length}: not found on disk (${filePath}).`);
        continue;
      }

      const childrenBefore = app.project.rootItem.children.numItems;
      const ok = app.project.importFiles([filePath], true, app.project.rootItem, false);
      if (!ok) {
        warnings.push(`File ${f + 1} of ${filePaths.length}: Premiere rejected importing it.`);
        continue;
      }
      undoSteps++;

      // Same locate-by-media-path (case-insensitive) pattern as
      // importAudioAndPlaceOnTimeline — see its own comment for why.
      const targetPath = String(sourceFile.fsName).toLowerCase();
      const children = app.project.rootItem.children;
      let projectItem: ProjectItem | null = null;
      for (let i = 0; i < children.numItems; i++) {
        const item = children[i];
        try {
          if (item.getMediaPath && String(item.getMediaPath()).toLowerCase() === targetPath) {
            projectItem = item;
            break;
          }
        } catch (e) {
          // not a media item (e.g. a bin) — skip
        }
      }
      if (!projectItem && children.numItems > childrenBefore) {
        projectItem = children[children.numItems - 1];
      }
      if (!projectItem) {
        warnings.push(`File ${f + 1} of ${filePaths.length}: import appeared to succeed, but the new project item could not be located.`);
        continue;
      }

      const placedOk = track.overwriteClip(projectItem, cursor);
      if (!placedOk) {
        warnings.push(`File ${f + 1} of ${filePaths.length}: Premiere rejected placing it at ${cursor.toFixed(3)}s.`);
        continue;
      }
      undoSteps++;

      const newClip = findClipNear(track, cursor);
      if (!newClip) {
        warnings.push(`File ${f + 1} of ${filePaths.length}: placed, but could not be located afterward to place the next file.`);
        continue;
      }
      // Reseed from the actual, frame-snapped end so per-item snap error can't
      // compound across many sequential placements.
      cursor = newClip.end.seconds;
      imported++;
      placedNodeIds.push(newClip.nodeId);
      placedFilePaths.push(String(sourceFile.fsName));
    } catch (e) {
      warnings.push(`File ${f + 1} of ${filePaths.length}: ${errMsg(e)}`);
    }
  }

  return {
    imported,
    undoSteps,
    warnings,
    placedNodeIds,
    placedFilePaths,
    sequenceId: String(seq.sequenceID || ""),
    sequenceName: String(seq.name || ""),
  };
};

/**
 * Resolves the QE ("Quality Engineering") clip for every given standard-DOM
 * TrackItem and runs `fn` against it — the shared lookup behind both
 * applySpeedToSelection and applyPitchToSelection. Best-effort per clip: a
 * bad lookup or a thrown error from `fn` on one clip is recorded as a
 * warning and skipped, never aborting the rest of the selection. QE is
 * undocumented and can differ between Premiere versions; see runDiagnostics()
 * if warnings show up here.
 */
const forEachSelectedQEClip = (
  seq: Sequence,
  sel: TrackItem[],
  warnings: string[],
  fn: (qeItem: any, stdClip: TrackItem, track: { trackType: "video" | "audio"; trackIndex: number }, qeTrack: any) => void,
): number => {
  if (typeof qe === "undefined") app.enableQE();
  if (!qe) {
    warnings.push("Premiere's editing interface is not available. Restart Premiere Pro and try again.");
    return 0;
  }
  let qeSeq: any;
  try {
    qeSeq = qe.project.getActiveSequence();
  } catch (e) {
    qeSeq = null;
  }
  if (!qeSeq) {
    warnings.push("No active sequence. Open the sequence in the Timeline and try again.");
    return 0;
  }

  let processed = 0;
  for (let i = 0; i < sel.length; i++) {
    const stdClip = sel[i];
    const located = locateTrackOfClip(seq, stdClip);
    if (!located) {
      warnings.push(`Clip ${i + 1} ("${stdClip.name}"): couldn't find its track.`);
      continue;
    }
    const { trackType, trackIndex } = located;

    let qeItem: any;
    let qeTrack: any;
    try {
      qeTrack = trackType === "video" ? qeSeq.getVideoTrackAt(trackIndex) : qeSeq.getAudioTrackAt(trackIndex);
      if (!qeTrack) {
        warnings.push(
          `Clip ${i + 1} ("${stdClip.name}"): Premiere couldn't find it on its track. [diag: QE has no ${trackType} track at index ${trackIndex}]`,
        );
        continue;
      }
      const ordinal = qeFindOrdinalAt(qeTrack, stdClip.start.seconds);
      if (ordinal === -1) {
        warnings.push(`Clip ${i + 1} ("${stdClip.name}"): Premiere couldn't find it on its track. [diag: no QE track item]`);
        continue;
      }
      qeItem = qeGetClipAt(qeTrack, ordinal);
    } catch (e) {
      warnings.push(
        `Clip ${i + 1} ("${stdClip.name}"): Premiere couldn't find it on its track. [diag: QE track lookup failed: ${errMsg(e)}]`,
      );
      continue;
    }
    if (!qeItem) {
      warnings.push(`Clip ${i + 1} ("${stdClip.name}"): Premiere couldn't find it on its track. [diag: QE clip not found]`);
      continue;
    }

    try {
      fn(qeItem, stdClip, located, qeTrack);
      processed++;
    } catch (e) {
      warnings.push(`Clip ${i + 1} ("${stdClip.name}"): ${errMsg(e)}`);
    }
  }
  return processed;
};

/**
 * How close (in seconds) two clips' original start/end times must be to count
 * as "touching" (see applySpeedToSelection's per-track repositioning). Wide
 * enough to absorb frame-snap drift (up to ~42 ms at 24 fps between a requested
 * and an actual position) but far smaller than any gap left on purpose.
 */
const SPEED_ADJACENCY_EPS_SEC = 0.06;

/**
 * Applies Speed only, to the currently selected TrackItem(s), independent of
 * Pitch (see applyPitchToSelection) and of Cut, so it works on the pieces Cut
 * just made (auto-selected) or on anything selected by hand. 100 = unchanged,
 * above 100 is faster (shorter), below 100 is slower (longer): the same
 * direction as Premiere's Speed/Duration dialog and qeItem.setSpeed() (a
 * literal rate factor, 1 = 100%).
 */
export const applySpeedToSelection = (speedPercent: number): ApplySpeedResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  const sel = seq.getSelection();
  if (!sel || sel.length === 0) {
    throw new Error("Select one or more clips on the timeline first (the pieces Cut just made are auto-selected).");
  }

  // Process left-to-right by timeline position (not necessarily selection
  // order) — the repositioning below depends on visiting clips in the
  // order they actually sit on the track. Global sort across all tracks is
  // fine even though repositioning itself is tracked per-track (below):
  // clips sharing a track keep their relative order within this sort too.
  const ordered = sel.slice().sort((a, b) => a.start.seconds - b.start.seconds);

  // Per-track state, so a mixed/non-contiguous selection (any track, any
  // adjacency) never gets collapsed onto a single shared cursor — see the
  // per-clip logic below for why this is necessary (this repositioning
  // exists solely to keep clips that were *already touching* seamlessly
  // touching after Speed changes their individual durations; it must never
  // move a clip that wasn't already adjacent to whatever comes right
  // before it in this same selection).
  const trackCursor: Record<string, { cursor: number; prevOriginalEnd: number }> = {};

  const warnings: string[] = [];
  const debugInfo: string[] = [];
  const speedFactor = speedPercent / 100;
  // Diagnostic, read-only. Audio and video pieces sit on separate tracks, and the
  // repositioning below (the planned layout, or the per-track `trackCursor` when
  // every clip only gets shorter) treats each track on its own, so nothing ties a
  // linked pair's two chains together. This records each processed clip's final
  // start/end, pairs each video clip with its audio counterpart (same ProjectItem
  // nodeId, closest by original pre-Speed position, since the post-Speed position
  // is what might have drifted) and reports any pair whose final start/end differ
  // by more than half a frame. It changes no clip's position.
  const processedInfo: { trackType: string; projectItemNodeId: string; originalStart: number; newStart: number; newEnd: number }[] = [];
  let clipIndex = 0;
  const frameSec = sequenceFrameSec(seq);
  let shortfallCount = 0;
  let lowestApplied = speedFactor;
  // The layout after Speed: a clip's new timeline length is its length times
  // its current speed divided by the new speed; a clip that touched the
  // previous one on its track goes right after that one's new end, any other
  // clip keeps its start. Worked out first with the requested speed, to see
  // whether any clip gets longer or moves right.
  const plan: {
    clip: TrackItem;
    key: string;
    trackType: string;
    start: number;
    duration: number;
    speedBefore: number;
    applied: number;
    targetStart: number;
    targetDuration: number;
    videoIds: string[];
  }[] = [];
  const layOut = (useApplied: boolean): void => {
    const ends: Record<string, { end: number; targetEnd: number }> = {};
    for (let p = 0; p < plan.length; p++) {
      const e = plan[p];
      let speedNow = speedFactor;
      if (useApplied) speedNow = isNaN(e.applied) ? e.speedBefore : e.applied;
      e.targetDuration = (e.duration * e.speedBefore) / speedNow;
      const prev = ends[e.key];
      e.targetStart = prev && Math.abs(e.start - prev.end) < SPEED_ADJACENCY_EPS_SEC ? prev.targetEnd : e.start;
      ends[e.key] = { end: e.start + e.duration, targetEnd: e.targetStart + e.targetDuration };
    }
  };
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    const loc = locateTrackOfClip(seq, c);
    const start = c.start.seconds;
    plan.push({
      clip: c,
      key: loc ? `${loc.trackType}:${loc.trackIndex}` : `unknown:${i}`,
      trackType: loc ? loc.trackType : "",
      start,
      duration: c.end.seconds - start,
      speedBefore: readClipSpeed(c, 1),
      applied: NaN,
      targetStart: start,
      targetDuration: 0,
      videoIds: loc && loc.trackType === "audio" ? linkedVideoNodeIds(seq, c) : [],
    });
  }
  layOut(false);
  let growPlan = false;
  for (let p = 0; p < plan.length; p++) {
    if (plan[p].targetStart > plan[p].start + 0.0005 || plan[p].targetDuration > plan[p].duration + 0.0005) growPlan = true;
  }

  // Speeding up only shortens clips, so the left-to-right pass below never
  // lays a clip over its neighbour. When a clip grows or moves right, that pass
  // would lengthen it over the next clip before that one has moved, and a few
  // short pieces in, the shift is longer than a piece: Premiere then loses the
  // piece it covers. So in that case the speed is set on every clip where it
  // is first (setSpeed() leaves a clip's place alone and setSpeedFully only
  // shortens one, so nothing overlaps), the layout is worked out again from
  // the speeds Premiere really applied, and then every clip goes straight to
  // its place, in an order in which none lands on a clip that has not moved
  // yet: the clips that move right or stay, from the last one back, then the
  // clips that move left, from the first one on.
  const applySpeedInPlanOrder = (): number => {
    const processed = forEachSelectedQEClip(seq, ordered, warnings, (qeItem, stdClip, _track, qeTrack) => {
      let p = -1;
      for (let k = 0; k < plan.length; k++) {
        if (plan[k].clip === stdClip) {
          p = k;
          break;
        }
      }
      if (p < 0) throw new Error("Premiere did not match it to the selection, so its Speed was left unchanged.");
      const appliedSpeed = setSpeedFully(qeItem, stdClip, speedFactor, frameSec, qeItemFinder(qeTrack, stdClip));
      plan[p].applied = appliedSpeed;
      if (Math.abs(appliedSpeed - speedFactor) > SPEED_MATCH_EPS) {
        shortfallCount++;
        if (appliedSpeed < lowestApplied) lowestApplied = appliedSpeed;
      }
    });
    layOut(true);
    const order: number[] = [];
    for (let p = plan.length - 1; p >= 0; p--) {
      if (plan[p].targetStart >= plan[p].start - 0.0005) order.push(p);
    }
    for (let p = 0; p < plan.length; p++) {
      if (plan[p].targetStart < plan[p].start - 0.0005) order.push(p);
    }
    for (let o = 0; o < order.length; o++) {
      const entry = plan[order[o]];
      const stdClip = entry.clip;
      const i = clipIndex++;
      try {
        // Writing `.start` moves only the start (the end and the in-point stay),
        // and Premiere ignores a start past the end. So a clip moving right gets
        // its new end first, a clip moving left its new start first; either way
        // it never reaches past its own new place.
        const newEnd = secondsToTime(entry.targetStart + entry.targetDuration);
        if (entry.targetStart > entry.start + 0.0005) {
          stdClip.end = newEnd;
          stdClip.start = secondsToTime(entry.targetStart);
        } else {
          if (entry.targetStart < entry.start - 0.0005) stdClip.start = secondsToTime(entry.targetStart);
          stdClip.end = newEnd;
        }
      } catch (e) {
        warnings.push(`Speed was applied to "${stdClip.name}", but moving it into place failed (${errMsg(e)}). Check it on the timeline.`);
      }
      try {
        debugInfo.push(
          `clip ${i} (planned order): speedPercent=${speedPercent} getSpeed() before=${entry.speedBefore} applied=${entry.applied} ` +
            `start ${entry.start.toFixed(3)}s -> ${entry.targetStart.toFixed(3)}s (now ${stdClip.start.seconds.toFixed(3)}s) ` +
            `duration before=${entry.duration.toFixed(3)}s expected=${entry.targetDuration.toFixed(3)}s after=${(
              stdClip.end.seconds - stdClip.start.seconds
            ).toFixed(3)}s`,
        );
        processedInfo.push({
          trackType: entry.trackType,
          projectItemNodeId: stdClip.projectItem ? stdClip.projectItem.nodeId : "",
          originalStart: entry.start,
          newStart: stdClip.start.seconds,
          newEnd: stdClip.end.seconds,
        });
      } catch (e) {
        // best effort: diagnostics only
      }
    }
    return processed;
  };

  const plannedProcessed = growPlan ? applySpeedInPlanOrder() : 0;
  const clipsProcessed = forEachSelectedQEClip(seq, growPlan ? [] : ordered, warnings, (qeItem, stdClip, track, qeTrack) => {
    const i = clipIndex++;
    const trackKey = `${track.trackType}:${track.trackIndex}`;
    const originalStart = stdClip.start.seconds;
    // Diagnostic snapshot before touching anything (see ApplySpeedResult.debugInfo
    // in types.ts). speedBefore is getSpeed() before this call changes anything:
    // a factor, ~1 on a clip whose speed was never changed.
    const oldDuration = stdClip.end.seconds - stdClip.start.seconds;
    const oldInOut = `${stdClip.inPoint.seconds.toFixed(3)}-${stdClip.outPoint.seconds.toFixed(3)}`;
    let speedBefore = NaN;
    try {
      speedBefore = stdClip.getSpeed();
    } catch (e) {
      // leave NaN
    }

    // QE's setSpeed() takes a ripple flag (5th arg) — deliberately left
    // false here rather than true: true ripples every later item on the
    // *whole track*, including content this selection doesn't own (e.g.
    // anything placed after these clips that isn't part of this Cut).
    // setSpeedFully repeats the call where Premiere caps it (see there).
    const appliedSpeed = setSpeedFully(qeItem, stdClip, speedFactor, frameSec, qeItemFinder(qeTrack, stdClip));
    if (Math.abs(appliedSpeed - speedFactor) > SPEED_MATCH_EPS) {
      shortfallCount++;
      if (appliedSpeed < lowestApplied) lowestApplied = appliedSpeed;
    }

    let speedAfter = NaN;
    try {
      speedAfter = stdClip.getSpeed();
    } catch (e) {
      // leave NaN
    }
    // Captured before the `.end` write below, to show whether setSpeed() alone
    // changes inPoint/outPoint as a side effect.
    const inOutRightAfterSetSpeed = `${stdClip.inPoint.seconds.toFixed(3)}-${stdClip.outPoint.seconds.toFixed(3)}`;

    // setSpeed(..., ripple=false) only updates the clip's playback rate
    // (speedAfter reads back the new factor); it doesn't resize the clip's out
    // point or duration. Content that now needs more (or less) time would stay in
    // an unchanged box, e.g. a 98%-speed clip losing the end of its last word. So
    // resize explicitly: the right timeline length is the clip's original
    // (speed=1) duration divided by the new rate. Derived from this clip's current
    // values (oldDuration * speedBefore, or oldDuration alone if speedBefore can't
    // be read) rather than assuming it was at 100%, so re-running Apply Speed at a
    // different % recovers the original length instead of compounding.
    // Divided by the speed Premiere actually applied, so a clip it wouldn't take
    // all the way still shows its whole source.
    const trueOriginalDuration = oldDuration * (isNaN(speedBefore) ? 1 : speedBefore);
    const expectedDuration = trueOriginalDuration / appliedSpeed;
    try {
      stdClip.end = secondsToTime(stdClip.start.seconds + expectedDuration);
    } catch (e) {
      // best effort — reposition logic below still runs off whatever
      // duration actually resulted from setSpeed() alone
    }
    const newDuration = stdClip.end.seconds - stdClip.start.seconds;

    const newInOut = `${stdClip.inPoint.seconds.toFixed(3)}-${stdClip.outPoint.seconds.toFixed(3)}`;
    debugInfo.push(
      `clip ${i}: speedPercent=${speedPercent} speedFactor=${speedFactor} ` +
        `getSpeed() before=${speedBefore} after=${speedAfter} ` +
        `duration before=${oldDuration.toFixed(3)}s expected=${expectedDuration.toFixed(3)}s after=${newDuration.toFixed(3)}s ` +
        `inPoint-outPoint before=${oldInOut} right-after-setSpeed=${inOutRightAfterSetSpeed} after=${newInOut}`,
    );

    // Only chain this clip against the previous clip processed on this same
    // track if it was touching it before Speed changed anything; otherwise keep
    // its start and only resize it. A selection made by hand can mix tracks or
    // contain intentional gaps, and chaining those clips would pull each one
    // flush against the clip processed before it.
    const state = trackCursor[trackKey];
    const wasTouchingPrev = !!state && Math.abs(originalStart - state.prevOriginalEnd) < SPEED_ADJACENCY_EPS_SEC;
    const targetStart = wasTouchingPrev ? state.cursor : originalStart;
    let resultingEnd = targetStart + newDuration;
    try {
      if (wasTouchingPrev) stdClip.start = secondsToTime(targetStart);
      stdClip.end = secondsToTime(resultingEnd);
      // Read the actual, frame-snapped end back rather than trusting the unsnapped
      // target + newDuration: Premiere's Time values are frame-quantized and
      // newDuration almost never lands on a frame, so accumulating the ideal value
      // would add a little error per clip and open visible gaps after enough
      // clips.
      resultingEnd = stdClip.end.seconds;
    } catch (e) {
      // Best effort: speed itself was still applied even if repositioning this
      // clip failed; a gap or overlap here is cosmetic, not data loss.
    }
    trackCursor[trackKey] = { cursor: resultingEnd, prevOriginalEnd: originalStart + oldDuration };
    try {
      processedInfo.push({
        trackType: track.trackType,
        projectItemNodeId: stdClip.projectItem ? stdClip.projectItem.nodeId : "",
        originalStart,
        newStart: stdClip.start.seconds,
        newEnd: stdClip.end.seconds,
      });
    } catch (e) {
      // best effort — this entry just won't participate in the pairing
      // diagnostic below, doesn't affect the real Speed work above
    }
  });
  if (shortfallCount > 0) warnings.push(speedShortfallWarning(shortfallCount, lowestApplied, speedFactor));

  // Repeating setSpeed() on a clip Premiere caps (setSpeedFully) can leave the
  // clip unlinked from its video. An audio clip that was linked before and no
  // longer is gets linked to the same video clips again; relinking changes the
  // selection, so the selection is put back afterwards.
  let relinkFailed = 0;
  let relinked = false;
  for (let p = 0; p < plan.length; p++) {
    const entry = plan[p];
    if (entry.videoIds.length === 0) continue;
    const now = linkedVideoNodeIds(seq, entry.clip);
    let stillLinked = false;
    for (let a = 0; a < now.length && !stillLinked; a++) {
      for (let b = 0; b < entry.videoIds.length; b++) {
        if (now[a] === entry.videoIds[b]) {
          stillLinked = true;
          break;
        }
      }
    }
    if (stillLinked) continue;
    relinked = true;
    if (!relinkToVideo(seq, entry.clip, entry.videoIds)) relinkFailed++;
  }
  if (relinked) {
    clearSelection(seq);
    for (let p = 0; p < ordered.length; p++) {
      try {
        ordered[p].setSelected(true, p === ordered.length - 1);
      } catch (e) {
        // selection is a convenience
      }
    }
  }
  if (relinkFailed > 0) warnings.push(unlinkedPiecesWarning(relinkFailed));

  // Diagnostic (continued): pairing and comparison, read-only.
  try {
    let fps = 25;
    try {
      const vfr = seq.getSettings().videoFrameRate;
      if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
    } catch (e) {
      // leave the fallback in place
    }
    const videoList: typeof processedInfo = [];
    const audioList: typeof processedInfo = [];
    for (let p = 0; p < processedInfo.length; p++) {
      if (processedInfo[p].trackType === "video") videoList.push(processedInfo[p]);
      else audioList.push(processedInfo[p]);
    }
    for (let v = 0; v < videoList.length; v++) {
      const vEntry = videoList[v];
      let bestAudio: (typeof processedInfo)[number] | null = null;
      let bestDist = Infinity;
      for (let a = 0; a < audioList.length; a++) {
        const aEntry = audioList[a];
        if (!aEntry.projectItemNodeId || aEntry.projectItemNodeId !== vEntry.projectItemNodeId) continue;
        const dist = Math.abs(aEntry.originalStart - vEntry.originalStart);
        if (dist < bestDist) {
          bestDist = dist;
          bestAudio = aEntry;
        }
      }
      if (!bestAudio || bestDist > 2) continue;
      const startDiff = vEntry.newStart - bestAudio.newStart;
      const endDiff = vEntry.newEnd - bestAudio.newEnd;
      if (Math.abs(startDiff) > 0.5 / fps || Math.abs(endDiff) > 0.5 / fps) {
        warnings.push(
          `After Speed, a video clip and its audio no longer line up (start differs by ${(startDiff * fps).toFixed(2)} frame(s), end by ${(endDiff * fps).toFixed(2)} frame(s)). Check them on the timeline. [diag: video @ ${vEntry.newStart.toFixed(
            3,
          )}-${vEntry.newEnd.toFixed(3)}s, audio @ ${bestAudio.newStart.toFixed(3)}-${bestAudio.newEnd.toFixed(3)}s]`,
        );
      }
    }
  } catch (e) {
    warnings.push(`Diagnostic: audio/video position-pairing check failed (${errMsg(e)}) — not a real Speed failure.`);
  }

  return { clipsProcessed: clipsProcessed + plannedProcessed, warnings, debugInfo };
};

/** Removes every component on this QE clip whose name or matchName equals
 *  `needle` (case-insensitive, whole name), through the QE DOM (only
 *  QEComponent exposes .remove()). Walks backwards since removing a component
 *  shifts later indices. */
const removeMatchingEffectsFromQEClip = (qeItem: any, needle: string): void => {
  const needleLower = needle.toLowerCase();
  const numComponents = qeItem.numComponents || 0;
  for (let c = numComponents - 1; c >= 0; c--) {
    const comp = qeItem.getComponentAt(c);
    const name = comp && comp.name ? String(comp.name).toLowerCase() : "";
    const matchName = comp && comp.matchName ? String(comp.matchName).toLowerCase() : "";
    // Whole-name match: a third-party effect whose name contains the same
    // words (kHs Pitch Shifter) is the user's own and stays.
    if (name === needleLower || matchName === needleLower) {
      comp.remove();
    }
  }
};

/**
 * Premiere's built-in Pitch Shifter, addressed through its "Transpose Ratio"
 * parameter. "Semi-tones"/"Cents" (the Clip Fx Editor's slider labels) are not
 * scriptable parameter names; the real ones are "Transpose Ratio",
 * "Precision", "Frequency", "Overlapping", "Use Default Setting" and "Use
 * Positive Cents". The two sliders and the "Ratio:" readout display one
 * underlying value, but see literalRatioToScriptedRatio for why the value seen
 * through the scripting API isn't what "Ratio:" shows either. Only this one
 * effect is supported; add any third-party plugin option as a separate,
 * isolated path.
 */
const PITCH_EFFECT_NAME = "Pitch Shifter";
const PITCH_PARAM_NAME = "Transpose Ratio";

/**
 * The literal frequency ratio for a pitch shift of `semitones`: 2^(semitones/12)
 * (1.0 = unchanged, 0.5 = one octave down, 2.0 = one octave up), the value the
 * Clip Fx Editor's "Ratio:" readout shows (-12 semitones shows 0.5000). Not
 * what gets written to "Transpose Ratio"; see literalRatioToScriptedRatio
 * below.
 */
const semitonesToLiteralRatio = (semitones: number): number => Math.pow(2, semitones / 12);

/**
 * Converts a literal frequency ratio into the value "Transpose Ratio" needs when
 * set through the Component/ComponentParam API:
 *
 *   scripted = (2 * literalRatio - 1) / 3    (inverse: literalRatio = (3 * scripted + 1) / 2)
 *
 * Through this API "Transpose Ratio" is not the literal ratio the UI's "Ratio:"
 * field shows, but a normalized 0-1 value spanning a fixed one-octave range
 * each way (0.5x-2.0x): 0 = one octave down, 1/3 = unchanged (the default of a
 * freshly added instance), 1 = one octave up. Writing the literal ratio
 * directly (e.g. 0.971046) would be read on this scale as literalRatio
 * 1.956569, about +11.6 semitones: the "chipmunk" result. Worked examples,
 * checked by rendering audio and measuring its fundamental frequency (the
 * formula reproduces them to 8 significant figures):
 *
 *   speed=1.0298168848779  -> literalRatio=0.971046 -> scripted 0.314031
 *   speed=1.49949965115246 -> literalRatio=0.666889 -> scripted 0.111259
 *
 * The other Pitch Shifter parameters (Use Default Setting, Use Positive Cents,
 * Precision, Frequency, Overlapping) don't affect this and are left alone.
 * Covers speed changes within about 50%-200% (literalRatio 0.5-2.0) before
 * clamping at the octave boundary, far beyond any sensible change for
 * narration (the panel warns well before that).
 */
const literalRatioToScriptedRatio = (literalRatio: number): number => (2 * literalRatio - 1) / 3;

/** The exact semitone shift a given speed factor causes (so correcting for
 *  it is a full, automatic restoration back to the original pitch):
 *  -12 * log2(speed factor), since playing at speed s moves pitch by log2(s)
 *  octaves. Same formula as main.tsx's computeSemitones preview, kept in sync
 *  by hand because nothing is imported across the JS/ExtendScript boundary. */
const computeSemitonesForSpeed = (speedPercent: number): number => {
  const speedFactor = speedPercent / 100;
  return (-12 * Math.log(speedFactor)) / Math.LN2;
};

/**
 * Pure read, no side effects: each selected clip's current speed as a percent
 * (`getSpeed()` * 100, rounded to 0.01) and whether they differ, so the panel
 * can fill its Speed % field from the selection.
 */
export const getSelectedClipsSpeed = (): SelectedClipsSpeedInfo => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  const sel = seq.getSelection();
  if (!sel || sel.length === 0) {
    throw new Error("Select one or more clips on the timeline first.");
  }
  const speeds: number[] = [];
  for (let i = 0; i < sel.length; i++) {
    let factor = 1;
    try {
      factor = sel[i].getSpeed();
    } catch (e) {
      // Couldn't read it — treat as unchanged rather than guessing.
    }
    speeds.push(Math.round(factor * 100 * 100) / 100);
  }
  let mixed = false;
  for (let i = 1; i < speeds.length; i++) {
    if (Math.abs(speeds[i] - speeds[0]) > 0.01) {
      mixed = true;
      break;
    }
  }
  return { speeds, mixed };
};

/**
 * Applies Pitch only: adds (or re-adds) Premiere's built-in "Pitch Shifter"
 * on every selected audio clip whose speed isn't 100%; clips at 100%, or
 * whose speed can't be read, are skipped and counted in skippedNoSpeedChange.
 * The correction is computed per clip from
 * that clip's own current speed (`stdClip.getSpeed()`, the same documented
 * API sendToAfterEffects reads), not from the panel's Speed % field, so it is
 * right for a mixed-speed selection, a clip whose speed was set outside this
 * panel, and Pitch re-run after Speed. It never changes speed itself (see
 * applySpeedToSelection).
 */
export const applyPitchToSelection = (): ApplyPitchResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  // Pitch is inherently audio-only (a Pitch Shifter component has no video
  // equivalent) — filtering here avoids addAudioEffect() throwing once per
  // video piece whenever Cut's selection includes a clip's linked video
  // (unlike applySpeedToSelection, which genuinely needs both tracks and
  // already handles a mixed selection correctly via its own per-track
  // cursor — this filter is deliberately NOT applied there).
  const sel = audioOnly(seq, seq.getSelection() || []);
  if (!sel || sel.length === 0) {
    throw new Error("Select one or more clips on the timeline first (the pieces Cut just made are auto-selected).");
  }

  // Best effort: switch a mono sequence to stereo before adding the effect
  // (see ensureSequenceStereo for why). No-op if it is already stereo;
  // reported as stereoForced.
  const stereoForced = ensureSequenceStereo(seq);

  const warnings: string[] = [];
  const debugInfo: string[] = [];
  let skippedNoSpeedChange = 0;
  let clipIndex = 0;
  const clipsProcessed = forEachSelectedQEClip(seq, sel, warnings, (qeItem, stdClip) => {
    const i = clipIndex++;
    // stdClip.getSpeed() returns a factor (1 = unchanged), not a percent (a clip
    // set to 98% reads back 0.98000001907349). computeSemitonesForSpeed expects a
    // percent, like main.tsx's Speed % field, so convert here; the raw factor would
    // read 0.98 as "0.98% speed" and produce a huge correction.
    let speedFactor = 1;
    try {
      speedFactor = stdClip.getSpeed();
    } catch (e) {
      // Couldn't read it — treat as unchanged rather than guessing a
      // correction from nothing; this clip just gets skipped below.
    }
    if (Math.abs(speedFactor - 1) < 0.0001) {
      skippedNoSpeedChange++;
      debugInfo.push(`clip ${i}: getSpeed()=${speedFactor} -> skipped (no speed change)`);
      return;
    }
    const speed = speedFactor * 100;
    const semitones = computeSemitonesForSpeed(speed);
    const literalRatio = semitonesToLiteralRatio(semitones);
    const scriptedRatio = literalRatioToScriptedRatio(literalRatio);

    // forEachSelectedQEClip already confirmed `qe` is defined before it ever
    // calls this callback — TS can't see across that closure boundary.
    const effect = qe!.project.getAudioEffectByName(PITCH_EFFECT_NAME);
    if (!effect) throw new Error(`Premiere's "${PITCH_EFFECT_NAME}" audio effect could not be found. Restart Premiere Pro and try again.`);
    // Remove any previous instance of this same effect before adding a
    // fresh one — addAudioEffect() always adds a *new* component, it never
    // reconfigures an existing one. Without this, re-applying Pitch to a
    // clip that already has it (Speed changed in place keeps the clip and its
    // effects) piles up multiple Pitch Shifter instances on the same clip, each still
    // carrying whatever value it was last set to — their pitch shifts
    // multiply together, and setEffectParamsOnClip only ever updates the
    // *first* match it finds, leaving the rest stuck at old, stale values.
    const numComponentsBefore = qeItem.numComponents || 0;
    removeMatchingEffectsFromQEClip(qeItem, PITCH_EFFECT_NAME);
    const numComponentsAfterRemove = qeItem.numComponents || 0;
    qeItem.addAudioEffect(effect);
    const numComponentsAfterAdd = qeItem.numComponents || 0;

    // Only "Transpose Ratio" needs writing; the other Pitch Shifter parameters
    // ("Use Default Setting", "Use Positive Cents", Precision, Frequency,
    // Overlapping) keep their defaults (see literalRatioToScriptedRatio).
    const paramWarnings = setEffectParamsOnClip(stdClip, PITCH_EFFECT_NAME, [{ paramName: PITCH_PARAM_NAME, value: scriptedRatio }]);
    for (let w = 0; w < paramWarnings.length; w++) warnings.push(paramWarnings[w]);

    // Read the ratio back the same way setEffectParamsOnClip itself found
    // the parameter to write it, to directly verify the write actually
    // landed on the component we just added — not a stale, un-removed
    // leftover from an earlier Pitch run still sitting first in the list.
    let ratioReadBack: number | string = "n/a";
    try {
      const components: any = stdClip.components;
      for (let c = 0; c < components.numItems; c++) {
        const comp = components[c];
        if (comp && isPremierePitchShifterName(String(comp.displayName || ""))) {
          const ratioParam = comp.properties && comp.properties.getParamForDisplayName(PITCH_PARAM_NAME);
          if (ratioParam) ratioReadBack = ratioParam.getValue();
          break;
        }
      }
    } catch (e) {
      ratioReadBack = "read failed: " + errMsg(e);
    }

    debugInfo.push(
      `clip ${i}: getSpeed()=${speedFactor} speedPercent=${speed} semitones=${semitones.toFixed(4)} ` +
        `literalRatio=${literalRatio.toFixed(6)} scriptedRatio=${scriptedRatio.toFixed(6)} read back=${ratioReadBack} ` +
        `numComponents before-remove=${numComponentsBefore} after-remove=${numComponentsAfterRemove} ` +
        `after-add=${numComponentsAfterAdd}`,
    );
  });
  return { clipsProcessed, skippedNoSpeedChange, warnings, debugInfo, stereoForced };
};

/**
 * The bundled preset (see getExportPresetPath(), JS side) is fixed at
 * 48000Hz/24-bit/stereo — 24-bit losslessly covers any lower-bit-depth
 * source, so bit depth never needs adjusting, but the sample rate is a
 * real mismatch risk: if a user's actual sequence runs at a different rate
 * (44100Hz is common too), forcing 48000Hz means Premiere resamples on
 * export. Playback stays correct either way (pieces are placed by time,
 * not sample count), but resampling is avoidable, so this patches a
 * *copy* of the bundled .epr's sample-rate value to match the sequence's
 * own `audioSampleRate` before use — never mutates the bundled template
 * itself. "48000" is a safe, unambiguous string to target: in this exact
 * known bundled template it appears exactly once, as the
 * ADBEAudioRatePerSecond ParamValue (verified by inspecting the file) —
 * this is not a generic arbitrary-.epr patcher, just this one known file.
 * Falls back to the original, unmodified presetPath on any failure
 * (missing file, unreadable rate, `48000` not found to replace, write
 * failure) — a mismatched-but-working render beats a broken one.
 */
const resolvePresetForSequence = (seq: Sequence, presetPath: string, outFolder: Folder): string => {
  try {
    const rateTime: any = seq.getSettings().audioSampleRate;
    const rateSeconds = rateTime && typeof rateTime.seconds === "number" ? rateTime.seconds : 0;
    if (!rateSeconds) return presetPath;
    const rateHz = Math.round(1 / rateSeconds);
    if (!rateHz || isNaN(rateHz) || rateHz === 48000 || rateHz < 8000 || rateHz > 192000) {
      return presetPath;
    }

    const templateFile = new File(presetPath);
    templateFile.encoding = "UTF-8";
    if (!templateFile.open("r")) return presetPath;
    const xml = templateFile.read();
    templateFile.close();

    if (xml.indexOf("<ParamValue>48000</ParamValue>") === -1) return presetPath;
    const patched = xml.replace("<ParamValue>48000</ParamValue>", `<ParamValue>${rateHz}</ParamValue>`);

    const patchedFile = new File(outFolder.fsName + "/_preset-" + rateHz + "hz.epr");
    patchedFile.encoding = "UTF-8";
    if (!patchedFile.open("w")) return presetPath;
    patchedFile.write(patched);
    patchedFile.close();

    return patchedFile.fsName;
  } catch (e) {
    return presetPath;
  }
};

/** The first clip on one of the audio tracks `trackIndices` that overlaps
 *  [start, end) and isn't one of `nodeIds`, with its track index; null when
 *  there is none. Used by the full-timeline render, whose render and placement
 *  cover that whole span. */
const findUnlistedClipInSpan = (
  seq: Sequence,
  trackIndices: number[],
  start: number,
  end: number,
  nodeIds: string[],
): { clip: TrackItem; trackIndex: number } | null => {
  const EPS = 0.01;
  for (let t = 0; t < trackIndices.length; t++) {
    const ti = trackIndices[t];
    if (ti < 0 || ti >= seq.audioTracks.numTracks) continue;
    const track = seq.audioTracks[ti];
    for (let ci = 0; ci < track.clips.numItems; ci++) {
      const c = track.clips[ci];
      if (c.start.seconds >= end - EPS || c.end.seconds <= start + EPS) continue;
      let listed = false;
      for (let k = 0; k < nodeIds.length; k++) {
        if (c.nodeId === nodeIds[k]) {
          listed = true;
          break;
        }
      }
      if (!listed) return { clip: c, trackIndex: ti };
    }
  }
  return null;
};

/** Refuses a render whose result would be silence: the clip is disabled
 *  (greyed out, e.g. the old take Replace turned off) or its track is muted.
 *  `tail` is the message's closing sentence ("Nothing was rendered."). */
const requireAudibleForRender = (clip: TrackItem, track: Track, trackIndex: number, tail: string): void => {
  let disabled = false;
  try {
    disabled = !!clip.disabled;
  } catch (e) {
    // unreadable: treated as enabled
  }
  if (disabled) {
    throw new Error(
      `"${clip.name}" is disabled (greyed out), so its render would be silent. Enable it (right-click > Enable), or select the take that is playing, then try again. ${tail}`,
    );
  }
  let muted = false;
  try {
    muted = !!track.isMuted();
  } catch (e) {
    // unreadable: treated as audible
  }
  if (muted) {
    throw new Error(`Audio track ${trackIndex + 1} is muted, so the render would be silent. Unmute it, then try again. ${tail}`);
  }
};

/** Mutes every audio track except `keepTrackIndices` while an export runs or
 *  is queued, so the WAV holds the selected audio only, not music, SFX or
 *  another speaker under it. Tracks the user already muted are left alone.
 *  Premiere's own export has finished when encodeWorkAreaToWav returns, and a
 *  Media Encoder job takes its snapshot of the sequence when it is queued
 *  (which is also why the work area can be restored right after), so
 *  unmuteTracks() runs right after either. Returns the tracks it muted. */
const muteOtherAudioTracks = (seq: Sequence, keepTrackIndices: number[]): Track[] => {
  const muted: Track[] = [];
  for (let i = 0; i < seq.audioTracks.numTracks; i++) {
    let keep = false;
    for (let k = 0; k < keepTrackIndices.length; k++) {
      if (keepTrackIndices[k] === i) {
        keep = true;
        break;
      }
    }
    if (keep) continue;
    const trk = seq.audioTracks[i];
    try {
      if (trk.isMuted()) continue;
      trk.setMute(1);
      muted.push(trk);
    } catch (e) {
      // a track that can't be muted stays audible in the export
    }
  }
  return muted;
};

const unmuteTracks = (tracks: Track[]): void => {
  for (let i = 0; i < tracks.length; i++) {
    try {
      tracks[i].setMute(0);
    } catch (e) {
      // best effort; the track stays muted and can be unmuted by hand
    }
  }
};

/** Which engine wrote a render: Premiere itself, or Adobe Media Encoder's queue. */
export type RenderEngine = "premiere" | "media-encoder";

/**
 * Exports the sequence's current in/out work area to a WAV file. The export
 * captures speed, pitch and effects as Premiere plays them back.
 *
 * First Premiere renders it itself with `Sequence.exportAsMediaDirect()` (the
 * Export button of Premiere's export window): no Adobe Media Encoder needed,
 * and the file is complete when the call returns; Premiere is busy until then.
 * When that is unavailable, fails or writes no file, any partial file is
 * removed and the export is queued in Adobe Media Encoder through
 * `app.encoder.encodeSequence()` instead, where it waits unless AME's own
 * "auto-start queue" preference is on; that file may still be writing after
 * this returns. Callers wait with waitForFileStable (JS side) either way.
 *
 * `resolvedPresetPath` must be a real .epr preset (getExportPresetPath() in
 * src/js/lib/exportPresetPath.ts, adjusted by resolvePresetForSequence()):
 * with `""`, encodeSequence still returns something that looks like a job-id
 * GUID but registers no job and writes no file. Shared by
 * renderSelectedClipToWav and renderFullTimelineForAE; returns which engine
 * wrote the file.
 */
const encodeWorkAreaToWav = (encoder: any, seq: Sequence, outPath: string, resolvedPresetPath: string): RenderEngine => {
  const ENCODE_IN_TO_OUT = 1;
  const outFile = new File(outPath);
  try {
    if (typeof (seq as any).exportAsMediaDirect === "function") {
      const direct = String((seq as any).exportAsMediaDirect(outPath, resolvedPresetPath, ENCODE_IN_TO_OUT));
      const reportedError = /error/i.test(direct.replace(/no error/i, ""));
      if (!reportedError && outFile.exists && outFile.length > 0) return "premiere";
    }
  } catch (e) {
    // falls back to the Media Encoder queue below
  }
  if (outFile.exists) outFile.remove();
  if (!encoder) throw new Error("Rendering isn't available in this version of Premiere Pro.");
  const res = encoder.encodeSequence(seq, outPath, resolvedPresetPath, ENCODE_IN_TO_OUT, 0);
  if (!(typeof res === "string" && res.length > 0)) {
    throw new Error("Premiere didn't start the render. Check that Adobe Media Encoder is installed.");
  }
  return "media-encoder";
};

/** ElevenLabs' speech-to-speech input limit: 300 seconds on every plan. */
const VOICE_CHANGER_MAX_SECONDS = 300;

/**
 * Voice Changer's audio-extraction step: renders exactly the currently
 * selected audio clip (enforced via getSelectedTrackItem — throws unless
 * exactly one clip is selected) to a single WAV file, using the same
 * encodeWorkAreaToWav + bundled .epr preset mechanism as
 * renderFullTimelineForAE (correctly bakes in whatever Speed/Pitch is
 * already applied to the clip, unlike reading the raw source media file
 * directly) — but returns the one resolved file path directly instead of a
 * manifest, since the caller needs the exact path to hand to ElevenLabs'
 * speech-to-speech endpoint next. Writes to its own VoiceChanger subfolder,
 * apart from Renders (Render full timeline and Natural pitch output), with a
 * unique file name per render, so a retry can't collide with a file Media
 * Encoder is still writing and a previous run's output is never read by
 * mistake.
 *
 * Premiere renders it itself when it can, else the export is queued in Adobe
 * Media Encoder (see encodeWorkAreaToWav); the caller polls for the output
 * file to stabilize before reading it.
 */
export const renderSelectedClipToWav = (
  presetPath: string,
  useProjectFolder: boolean = false,
): { filePath: string; warnings: string[]; clipNodeId: string; renderedBy: RenderEngine } => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!presetPath) throw new Error("No export preset path given.");
  const { clip, trackType, trackIndex, track } = getSelectedTrackItem(seq);
  if (trackType !== "audio") throw new Error("Select the audio clip you want to convert.");
  // A disabled clip or a muted track renders as silence, which would then be
  // sent to ElevenLabs and paid for; refused before anything is rendered.
  requireAudibleForRender(clip, track, trackIndex, "Nothing was rendered or sent.");
  // The converted take replaces this clip and has about its length; checked
  // before anything is rendered or uploaded, like the length limit below.
  requireReplaceTracksReady(seq, track, trackIndex, clip.start.seconds, clip.end.seconds);
  // Checked before anything is rendered or uploaded: ElevenLabs refuses a
  // longer input only after the whole render and upload.
  const clipSeconds = clip.end.seconds - clip.start.seconds;
  if (clipSeconds > VOICE_CHANGER_MAX_SECONDS) {
    const total = Math.ceil(clipSeconds);
    const secs = total % 60;
    const length = String(Math.floor(total / 60)) + ":" + (secs < 10 ? "0" : "") + String(secs);
    throw new Error(
      `This clip is ${length} long, and ElevenLabs Voice Changer takes at most 5:00. Cut it into shorter clips and convert them one at a time. Nothing was rendered or sent.`,
    );
  }
  const encoder: any = (app as any).encoder;

  const outFolder = getSubFolder("VoiceChanger", useProjectFolder);
  const resolvedPresetPath = resolvePresetForSequence(seq, presetPath, outFolder);
  // A unique name per render: a retry while Media Encoder is still writing the
  // previous file must not collide with it.
  const outPath = `${outFolder.fsName}/voice-changer-source-${String(new Date().getTime())}.wav`;
  const existing = new File(outPath);
  if (existing.exists) {
    // Fatal, not best effort: a stale leftover file can look "stable" to
    // waitForFileStable from its first check and would be uploaded to ElevenLabs
    // as the wrong audio. waitForFileStable's notBeforeMs check also guards
    // this, but failing here gives a clear cause.
    if (!existing.remove()) {
      throw new Error(
        `Could not remove the previous render at ${outPath} before starting a new one — it may be locked by another process (antivirus scan, cloud-sync client). Close anything that might be reading it and try again.`,
      );
    }
  }

  // getInPoint()/getOutPoint() return a timecode string, not seconds, so the
  // *AsTime variants are used here (see renderFullTimelineForAE).
  const savedIn = seq.getInPointAsTime();
  const savedOut = seq.getOutPointAsTime();
  const mutedTracks = muteOtherAudioTracks(seq, [trackIndex]);
  let renderedBy: RenderEngine;
  try {
    seq.setInPoint(clip.start.seconds);
    seq.setOutPoint(clip.end.seconds);
    renderedBy = encodeWorkAreaToWav(encoder, seq, outPath, resolvedPresetPath);
  } finally {
    unmuteTracks(mutedTracks);
    try {
      seq.setInPoint(savedIn.seconds);
      seq.setOutPoint(savedOut.seconds);
    } catch (e) {
      // non-fatal — leaves the work area at the rendered clip's own span
    }
  }

  return { filePath: outPath, warnings: [], clipNodeId: clip.nodeId, renderedBy };
};

/** True if any component on this clip looks like a pitch-shifting effect
 *  (case-insensitive substring "pitch" in displayName or matchName, so
 *  third-party pitch effects count too). Standard DOM only; no QE lookup
 *  needed since we already have the TrackItem in hand. */
const hasPitchEffect = (clip: TrackItem): boolean => {
  const comps: any = clip.components;
  if (!comps) return false;
  const n = comps.numItems || 0;
  for (let c = 0; c < n; c++) {
    const comp = comps[c];
    const name = comp && comp.displayName ? String(comp.displayName).toLowerCase() : "";
    const matchName = comp && comp.matchName ? String(comp.matchName).toLowerCase() : "";
    if (name.indexOf("pitch") !== -1 || matchName.indexOf("pitch") !== -1) return true;
  }
  return false;
};

/** True only for Premiere's own "Pitch Shifter" (exact display name), the
 *  effect applyPitchToSelection writes. A third-party pitch plug-in whose name
 *  contains the same words (kHs Pitch Shifter) is not it: a rebuild must not
 *  replace it with Premiere's. */
const isPremierePitchShifterName = (displayName: string): boolean => displayName.toLowerCase() === PITCH_EFFECT_NAME.toLowerCase();

const hasPremierePitchShifter = (clip: TrackItem): boolean => {
  const comps: any = clip.components;
  if (!comps) return false;
  const n = comps.numItems || 0;
  for (let c = 0; c < n; c++) {
    const comp = comps[c];
    const name = comp && comp.displayName ? String(comp.displayName) : "";
    if (isPremierePitchShifterName(name)) return true;
  }
  return false;
};

/** Names (matched case-insensitively as a substring against both
 *  displayName and matchName) of Premiere's own built-in fixed effects —
 *  present on every single clip regardless of anything the user does, and
 *  never something Send to AE's position/speed reconstruction needs to
 *  carry over (Motion/Opacity/Time Remapping are already AE-native
 *  concepts; Volume/Channel Volume/Balance map to AE's own audio levels,
 *  untouched by this reconstruction anyway). Not meant to be exhaustive —
 *  its only job is ruling out the effects every clip already has, so
 *  hasUnsupportedEffect below only flags what the user genuinely added by
 *  hand. */
const BASELINE_EFFECT_NEEDLES = ["motion", "opacity", "time remapping", "volume", "channel volume", "balance"];

/**
 * True if this clip has any component beyond Premiere's built-in fixed effects
 * (see BASELINE_EFFECT_NEEDLES), e.g. color correction, an audio
 * EQ/reverb/de-esser, Warp Stabilizer, Pitch, or anything else applied by
 * hand. Such effects exist only in Premiere's playback engine and would be
 * silently dropped by Send to AE's position/speed reconstruction.
 */
const hasUnsupportedEffect = (clip: TrackItem): { found: boolean; name: string } => {
  const comps: any = clip.components;
  if (!comps) return { found: false, name: "" };
  const n = comps.numItems || 0;
  for (let c = 0; c < n; c++) {
    const comp = comps[c];
    const name = comp && comp.displayName ? String(comp.displayName) : "";
    const matchName = comp && comp.matchName ? String(comp.matchName) : "";
    const nameLower = name.toLowerCase();
    const matchNameLower = matchName.toLowerCase();
    let isBaseline = false;
    for (let b = 0; b < BASELINE_EFFECT_NEEDLES.length; b++) {
      const needle = BASELINE_EFFECT_NEEDLES[b];
      if (nameLower.indexOf(needle) !== -1 || matchNameLower.indexOf(needle) !== -1) {
        isBaseline = true;
        break;
      }
    }
    if (!isBaseline) return { found: true, name: name || matchName || "unknown effect" };
  }
  return { found: false, name: "" };
};

/** Every effect on `clip` beyond Premiere's fixed ones (see
 *  BASELINE_EFFECT_NEEDLES), Pitch Shifter included, with whether it is a
 *  pitch effect (matched on displayName and matchName, as hasPitchEffect). */
const effectNamesBeyondBaseline = (clip: TrackItem): { name: string; isPitch: boolean }[] => {
  const names: { name: string; isPitch: boolean }[] = [];
  const comps: any = clip.components;
  if (!comps) return names;
  const n = comps.numItems || 0;
  for (let c = 0; c < n; c++) {
    const comp = comps[c];
    const name = comp && comp.displayName ? String(comp.displayName) : "";
    const matchName = comp && comp.matchName ? String(comp.matchName) : "";
    const both = (name + " " + matchName).toLowerCase();
    let isBaseline = false;
    for (let b = 0; b < BASELINE_EFFECT_NEEDLES.length; b++) {
      if (both.indexOf(BASELINE_EFFECT_NEEDLES[b]) !== -1) {
        isBaseline = true;
        break;
      }
    }
    if (!isBaseline) {
      names.push({ name: name || matchName || "unknown effect", isPitch: isPremierePitchShifterName(name) });
      continue;
    }
    // A built-in effect counts too when it carries the user's work: keyframes
    // on any of its parameters, or Motion/Opacity values changed by hand (a
    // punch-in scale, a reframe). The rebuild places fresh clips, so these go
    // the same way as an added effect.
    const changed = baselineEffectChangeNote(comp, name);
    if (changed) names.push({ name: changed, isPitch: false });
  }
  return names;
};

/** "<Effect> (keyframes)" / "<Effect> (changed)" for a built-in effect whose
 *  parameters show the user's work, "" when they are at their defaults. Only
 *  parameters whose default is unambiguous are compared by value (Scale 100,
 *  Rotation 0, Opacity 100); any keyframed parameter counts. Best effort:
 *  unreadable parameters count as untouched. */
const baselineEffectChangeNote = (comp: any, displayName: string): string => {
  const label = displayName || "effect";
  let props: any = null;
  try {
    props = comp.properties;
  } catch (e) {
    return "";
  }
  if (!props) return "";
  const n = props.numItems || 0;
  const nameLower = label.toLowerCase();
  let changed = false;
  for (let p = 0; p < n; p++) {
    const param = props[p];
    if (!param) continue;
    try {
      if (param.isTimeVarying()) return `${label} (keyframes)`;
    } catch (e) {
      // not readable: treated as constant
    }
    if (changed) continue;
    let paramName = "";
    try {
      paramName = param.displayName ? String(param.displayName).toLowerCase() : "";
    } catch (e) {
      continue;
    }
    let value: any = null;
    try {
      value = param.getValue();
    } catch (e) {
      continue;
    }
    if (typeof value !== "number") continue;
    if (nameLower === "motion" && paramName === "scale" && Math.abs(value - 100) > 0.01) changed = true;
    if (nameLower === "motion" && paramName === "rotation" && Math.abs(value) > 0.01) changed = true;
    if (nameLower === "opacity" && paramName === "opacity" && Math.abs(value - 100) > 0.01) changed = true;
  }
  if (changed) return `${label} (changed)`;
  return "";
};

/** What the panel's warning before a rebuild needs: the effects found (each
 *  once), the same list without pitch effects, and how many of the audio clips
 *  carry Pitch Shifter, so Pitch can be applied again afterwards when every
 *  piece had it. */
export interface RebuildEffectSummary {
  effects: string[];
  nonPitchEffects: string[];
  audioClips: number;
  audioClipsWithPitch: number;
}

const summarizeEffects = (seq: Sequence, clips: TrackItem[]): RebuildEffectSummary => {
  const effects: string[] = [];
  const nonPitchEffects: string[] = [];
  let audioClips = 0;
  let audioClipsWithPitch = 0;
  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    let names: { name: string; isPitch: boolean }[] = [];
    try {
      names = effectNamesBeyondBaseline(clip);
    } catch (e) {
      // unreadable components: nothing to report for this clip
    }
    for (let k = 0; k < names.length; k++) {
      let seen = false;
      for (let m = 0; m < effects.length; m++) {
        if (effects[m] === names[k].name) {
          seen = true;
          break;
        }
      }
      if (!seen) {
        effects.push(names[k].name);
        if (!names[k].isPitch) nonPitchEffects.push(names[k].name);
      }
    }
    const loc = locateTrackOfClip(seq, clip);
    if (loc && loc.trackType === "audio") {
      audioClips++;
      let pitched = false;
      try {
        pitched = hasPremierePitchShifter(clip);
      } catch (e) {
        pitched = false;
      }
      if (pitched) audioClipsWithPitch++;
    }
  }
  return { effects, nonPitchEffects, audioClips, audioClipsWithPitch };
};

/** Read-only. Effects on the selected clips, for the panel's warning before
 *  J/L Pacing, its Reset and the Speed rebuild: those place fresh clips from
 *  the source file, so effects, volume/Motion changes and keyframes on the old
 *  pieces are not carried over. */
export const getSelectionEffectSummary = (): RebuildEffectSummary => {
  const seq = app.project.activeSequence;
  if (!seq) return { effects: [], nonPitchEffects: [], audioClips: 0, audioClipsWithPitch: 0 };
  const sel = seq.getSelection() || [];
  const clips: TrackItem[] = [];
  for (let i = 0; i < sel.length; i++) clips.push(sel[i]);
  return summarizeEffects(seq, clips);
};

/** Read-only. Effects on a Cut's pieces (clips of its source media starting
 *  in the original span), for the warning before Cut's Undo, which places the
 *  original clip fresh from the source file. */
export const getCutSpanEffectSummary = (info: CutUndoInfo): RebuildEffectSummary => {
  const empty: RebuildEffectSummary = { effects: [], nonPitchEffects: [], audioClips: 0, audioClipsWithPitch: 0 };
  const seq = app.project.activeSequence;
  if (!seq || !info || !info.projectItemNodeId) return empty;
  const ownIds = [info.projectItemNodeId];
  const end = info.timelineStart + info.originalDuration;
  const clips: TrackItem[] = [];
  const collect = (trk: Track | null) => {
    if (!trk) return;
    for (let i = 0; i < trk.clips.numItems; i++) {
      const c = trk.clips[i];
      if (!c.projectItem || isForeignClip(c, ownIds)) continue;
      const st = c.start.seconds;
      if (st >= info.timelineStart - 0.001 && st < end + 0.001) clips.push(c);
    }
  };
  if (info.trackIndex >= 0 && info.trackIndex < seq.audioTracks.numTracks) collect(seq.audioTracks[info.trackIndex]);
  if (info.videoTrackIndex !== null && info.videoTrackIndex >= 0 && info.videoTrackIndex < seq.videoTracks.numTracks) {
    collect(seq.videoTracks[info.videoTrackIndex]);
  }
  return summarizeEffects(seq, clips);
};

/** Read-only. Effects on the audio clips that play one of `filePaths`, for
 *  the warning before "Revert to segments" and Natural pitch's Revert, which
 *  remove those clips. */
export const getMediaClipsEffectSummary = (filePaths: string[]): RebuildEffectSummary => {
  const seq = app.project.activeSequence;
  if (!seq || !filePaths || filePaths.length === 0) return { effects: [], nonPitchEffects: [], audioClips: 0, audioClipsWithPitch: 0 };
  const wanted: string[] = [];
  for (let i = 0; i < filePaths.length; i++) wanted.push(String(filePaths[i]).replace(/\\/g, "/").toLowerCase());
  const clips: TrackItem[] = [];
  for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
    const trk = seq.audioTracks[ai];
    for (let ci = 0; ci < trk.clips.numItems; ci++) {
      const c = trk.clips[ci];
      let path = "";
      try {
        path = c.projectItem ? String(c.projectItem.getMediaPath()).replace(/\\/g, "/").toLowerCase() : "";
      } catch (e) {
        path = "";
      }
      if (!path) continue;
      for (let w = 0; w < wanted.length; w++) {
        if (wanted[w] === path) {
          clips.push(c);
          break;
        }
      }
    }
  }
  return summarizeEffects(seq, clips);
};

/** Video is always sent to AE via position/speed reconstruction — never
 *  baked, in either sendToAfterEffects or renderFullTimelineForAE, since
 *  baking video would risk changing its original format/size for no
 *  benefit. That means any *other* effect on a selected video piece (an
 *  unsupported one, same category as Pitch on audio) would be silently
 *  dropped either way — checked unconditionally by both functions. */
const checkNoUnsupportedVideoEffects = (videoSel: TrackItem[]): void => {
  for (let i = 0; i < videoSel.length; i++) {
    const bad = hasUnsupportedEffect(videoSel[i]);
    if (bad.found) {
      throw new Error(
        `Clip "${videoSel[i].name}" has an effect applied ("${bad.name}") that can't be carried over to After Effects — video is never rendered: it goes over as the original file, with only its cut points, position and speed. Remove it before sending, or exclude this clip from the selection.`,
      );
    }
  }
};

/** 0 for a piece on the lowest-numbered track its list uses, 1 for the next
 *  track number (J/L Pacing's alternating track: below on audio, above on
 *  video), and so on: After Effects stacks the pieces by this, so a video
 *  piece Premiere shows on top during an overlap stays on top there (for
 *  audio the layer order does not change the sound; see aeft.ts's
 *  placeSegmentsReconstruction). */
const stackLevelOf = (seq: Sequence, clip: TrackItem, lowestTrackIndex: number): number => {
  const loc = locateTrackOfClip(seq, clip);
  if (!loc) return 0;
  const level = loc.trackIndex - lowestTrackIndex;
  return level > 0 ? level : 0;
};

const lowestTrackIndexOf = (seq: Sequence, clips: TrackItem[]): number => {
  let lowest = -1;
  for (let i = 0; i < clips.length; i++) {
    const loc = locateTrackOfClip(seq, clips[i]);
    if (loc && (lowest < 0 || loc.trackIndex < lowest)) lowest = loc.trackIndex;
  }
  return lowest < 0 ? 0 : lowest;
};

/**
 * Builds the video half of the AE bridge manifest from the selection's linked
 * video pieces, shared by sendToAfterEffects and renderFullTimelineForAE (sort
 * by position, require one shared source media, compute each piece's
 * timelineStart/speedFactor). Returns null if there's no video, no readable
 * source media, or the pieces don't all share one source file (best effort:
 * the caller then skips sending video).
 */
const buildVideoManifestSegments = (
  seq: Sequence,
  videoSel: TrackItem[],
  baseStart: number,
): {
  videoMediaPath: string;
  videoSegments: { start: number; end: number; timelineStart: number; speedFactor: number; stackLevel: number }[];
} | null => {
  if (videoSel.length === 0) return null;
  const orderedVideo = videoSel.slice().sort((a, b) => a.start.seconds - b.start.seconds);
  const firstVideoItem = orderedVideo[0].projectItem;
  if (!firstVideoItem) return null;
  const videoMediaPath = firstVideoItem.getMediaPath();
  if (!videoMediaPath) return null;
  const targetVideoPath = String(videoMediaPath).toLowerCase();
  const lowestVideoTrack = lowestTrackIndexOf(seq, orderedVideo);
  const videoSegments: { start: number; end: number; timelineStart: number; speedFactor: number; stackLevel: number }[] = [];
  for (let i = 0; i < orderedVideo.length; i++) {
    const clip = orderedVideo[i];
    if (!clip.projectItem || String(clip.projectItem.getMediaPath()).toLowerCase() !== targetVideoPath) {
      return null;
    }
    let speedFactor = 1;
    try {
      const s = clip.getSpeed();
      if (typeof s === "number" && s > 0) speedFactor = s;
    } catch (e) {
      // leave at 1 — treated as unchanged rather than guessing
    }
    // As in sendToAfterEffects: TrackItem.inPoint/.outPoint are already
    // timeline-scaled once Speed isn't 100%, so multiply by speedFactor to get
    // true source time. inPoint * speed is exact; the end comes from
    // clipSourceEndSec, since outPoint * speed overshoots after Speed.
    videoSegments.push({
      start: clip.inPoint.seconds * speedFactor,
      end: clipSourceEndSec(clip, speedFactor),
      // Relative to the same base as the audio pieces (the first selected piece
      // of either kind): After Effects adds one playhead time to both lists.
      timelineStart: clip.start.seconds - baseStart,
      speedFactor,
      stackLevel: stackLevelOf(seq, clip, lowestVideoTrack),
    });
  }
  return { videoMediaPath, videoSegments };
};

/**
 * Writes a JSON manifest describing the current selection for the After
 * Effects Bridge panel (see src/jsx/aeft/aeft.ts): the only hand-off between
 * the two apps, since there is no clipboard bridge for timeline clips between
 * host applications.
 *
 * Always "segments" mode: clips keep referencing the untouched original source
 * media; only the trim points (plus each piece's Speed/position) cross over,
 * and Speed and J/L Pacing positions are reconstructed in After Effects
 * (AVLayer.stretch; see aeft.ts) rather than baked. The AE editor can still
 * nudge segment edges, since the full original media is there.
 *
 * Never renders anything. It refuses (see the validation loop below) when the
 * selection has Pitch or any other unsupported effect, and points to
 * `renderFullTimelineForAE` instead: one deliberate whole-timeline bake, with
 * no per-piece boundaries to preserve.
 *
 * Video is never rendered: it is rebuilt from position/speed like the audio,
 * as its own placement when it comes from a different file (see the video
 * step below). Audio effects never touch video, so it never needs baking.
 */
export const sendToAfterEffects = (presetPath: string, useProjectFolder: boolean = false): SendToAEResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  // Cut can leave a clip's linked video selected alongside its audio;
  // `videoSel` is sent separately below via its own reconstruction.
  const rawSel = seq.getSelection() || [];
  const audioSel = audioOnly(seq, rawSel);
  const videoSel = videoOnly(seq, rawSel);
  if (!audioSel || audioSel.length === 0) {
    throw new Error("Select the cut segments to send first (they're auto-selected right after Cut).");
  }

  // Refuses rather than silently rendering: Send to AE only reconstructs
  // position/speed, so anything that exists only in Premiere's playback engine
  // (Pitch, or any other effect applied by hand) would otherwise be silently
  // dropped.
  for (let i = 0; i < audioSel.length; i++) {
    if (hasPitchEffect(audioSel[i])) {
      throw new Error(
        `Clip "${audioSel[i].name}" has Pitch applied — Send to AE never renders: it rebuilds the cut in After Effects from the original file, with only cut points, positions and speed. Remove Pitch before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything (including Pitch) into one file first.`,
      );
    }
    const bad = hasUnsupportedEffect(audioSel[i]);
    if (bad.found) {
      throw new Error(
        `Clip "${audioSel[i].name}" has an effect applied ("${bad.name}") that can't be carried over to After Effects — Send to AE rebuilds the cut there from the original file, with only cut points, positions and speed. Remove it before sending, or use "Render full timeline for AE" in the Pacing tab instead, which bakes everything into one file first.`,
      );
    }
  }
  checkNoUnsupportedVideoEffects(videoSel);

  const bridgeFolder = getSubFolder("Bridge");

  const manifest: any = {
    createdAt: new Date().toString(),
    sequenceName: seq.name,
    audioMode: "segments",
  };

  // getSelection()'s own order isn't guaranteed to match timeline order
  // (same concern applyJLCutSmoothing's own identical sort already
  // documents) — sort by each piece's own current position before
  // computing anything relative to its neighbors, or naming/positioning it
  // in the manifest below.
  const orderedAudio = audioSel.slice().sort((a, b) => a.start.seconds - b.start.seconds);
  const firstAudioStart = orderedAudio[0].start.seconds;
  // One base for the audio and the video lists: the earliest selected piece of
  // either kind. After Effects adds the same playhead time to both, so a video
  // sent separately whose first piece starts later or earlier than the first
  // audio piece keeps its offset.
  let baseStart = firstAudioStart;
  for (let i = 0; i < videoSel.length; i++) {
    if (videoSel[i].start.seconds < baseStart) baseStart = videoSel[i].start.seconds;
  }
  const lowestAudioTrack = lowestTrackIndexOf(seq, orderedAudio);

  const firstItem = orderedAudio[0].projectItem;
  if (!firstItem) throw new Error("Selected clip has no source media.");
  const mediaPath = firstItem.getMediaPath();
  if (!mediaPath) throw new Error("Selected clip has no linked media file on disk.");
  // Compared case-insensitively, like the media-path lookups elsewhere in this
  // file (findProjectItemForMedia, importAudioAndPlaceOnTimeline): Windows
  // filesystems aren't case-sensitive, so getMediaPath() can return different
  // drive-letter or folder casing for the same file (e.g. a relinked or
  // duplicated ProjectItem), and a strict === would refuse pieces that do
  // share one source.
  const targetMediaPath = String(mediaPath).toLowerCase();

  const warnings: string[] = [];
  const segments: {
    start: number;
    end: number;
    timelineStart: number;
    speedFactor: number;
    stackLevel: number;
  }[] = [];
  for (let i = 0; i < orderedAudio.length; i++) {
    const clip = orderedAudio[i];
    if (!clip.projectItem || String(clip.projectItem.getMediaPath()).toLowerCase() !== targetMediaPath) {
      throw new Error("All selected clips must come from the same source media to send as segments.");
    }
    let speedFactor = 1;
    try {
      const s = clip.getSpeed();
      if (typeof s === "number" && s > 0) speedFactor = s;
    } catch (e) {
      // leave at 1 — treated as unchanged rather than guessing
    }
    // `TrackItem.inPoint`/`.outPoint` are not raw source-media positions once
    // Speed != 100%: they are already timeline-scaled (undocumented; Adobe's type
    // definitions have no doc comments on either). Converting back to true source
    // time (multiplying by speedFactor) is what every consumer of `start`/`end`
    // expects (this file's reconstruction math and aeft.ts's identical formula);
    // without it, reconstructed pieces in After Effects have audible gaps.
    // inPoint * speed is exact; the end comes from clipSourceEndSec (the clip's
    // timeline length times its speed), since outPoint * speed overshoots after
    // Speed and would make each piece run long in After Effects.
    const start = clip.inPoint.seconds * speedFactor;
    const end = clipSourceEndSec(clip, speedFactor);
    segments.push({
      start,
      end,
      timelineStart: clip.start.seconds - baseStart,
      speedFactor,
      stackLevel: stackLevelOf(seq, clip, lowestAudioTrack),
    });
  }

  manifest.audioMediaPath = mediaPath;
  manifest.audioSegments = segments;

  // Video is sent via its own position/speed reconstruction, whatever is on the
  // audio: audio effects never touch video, and re-encoding it could change its
  // format or size for no benefit.
  //
  // Only as a SEPARATE placement when it is genuinely a different source file,
  // though. A plain linked audio+video clip (e.g. a camera's .mp4) has both
  // halves pointing at the same file and should arrive as one linked
  // audio+video layer per piece, not two separately muted copies. When the audio
  // and video media paths match AND the piece counts line up 1:1 (Cut keeps a
  // linked video piece's start/end/speed identical to its audio counterpart),
  // video is left out of the manifest, and aeft.ts's placeFromManifest keeps the
  // audio reconstruction's own picture (`keepVideo = !hasVideo`). Otherwise this
  // falls back to separate audio and video placements rather than guessing a
  // piece-for-piece correspondence.
  const videoManifest = buildVideoManifestSegments(seq, videoSel, baseStart);
  const videoIsSameFileAsAudio =
    !!videoManifest &&
    videoManifest.videoMediaPath.toLowerCase() === targetMediaPath &&
    videoManifest.videoSegments.length === segments.length;
  if (videoManifest && !videoIsSameFileAsAudio) {
    manifest.videoMediaPath = videoManifest.videoMediaPath;
    manifest.videoSegments = videoManifest.videoSegments;
  }
  if (videoSel.length > 0 && !videoManifest) {
    warnings.push(
      "The selected video was not sent: its clips come from more than one file, or have no media file on disk. Only the audio was sent; select video from one file to send it too.",
    );
  }

  const manifestFile = new File(bridgeFolder.fsName + "/manifest.json");
  manifestFile.encoding = "UTF-8";
  if (!manifestFile.open("w")) {
    throw new Error(`Could not open ${manifestFile.fsName} for writing.`);
  }
  manifestFile.write(JSON.stringify(manifest));
  manifestFile.close();

  const itemCount = manifest.audioSegments.length;
  const videoItemCount = manifest.videoSegments ? manifest.videoSegments.length : 0;
  return { audioMode: "segments", itemCount, videoItemCount, manifestPath: manifestFile.fsName, warnings };
};

/** Everything `undoFullTimelineRender` needs to deterministically restore
 *  one audio piece that `placeFullTimelineRender` is about to remove — same
 *  shape and restore mechanism as `CutUndoInfo`/`undoCutViaRazor` (see that
 *  interface's own comment for the full reasoning: a from-scratch rebuild
 *  rather than a guessed Premiere undo-stack rewind), just one entry per
 *  piece instead of a single clip. Video is not restored:
 *  placeFullTimelineRender never removes or changes linked video;
 *  `linkedVideoIds` only lets the revert link the restored audio to it again. Pitch
 *  Shifter's value is not stored, because applyPitchToSelection derives it
 *  from the restored Speed; `hadPitch` records only whether to apply it
 *  again. */
export interface RenderUndoPiece {
  /** Whether the piece carried Pitch Shifter when it was rendered, so a revert
   *  applies Pitch again only where it was. */
  hadPitch?: boolean;
  trackIndex: number;
  timelineStart: number;
  originalDuration: number;
  sourceInPoint: number;
  mediaPath: string;
  speedFactor: number;
  /** nodeId of the piece's own ProjectItem (see findProjectItemForMedia). */
  projectItemNodeId?: string;
  /** nodeIds of the video track items the piece was linked to, so "Revert to
   *  segments" can link the restored audio to its video again. */
  linkedVideoIds?: string[];
}

export interface FullTimelineRenderResult {
  filePath: string;
  firstAudioStart: number;
  /** nodeIds of every audio piece placeFullTimelineRender will replace —
   *  captured here rather than re-derived later from a live re-read of the
   *  selection, so that call can verify the same pieces are still there
   *  right before removing anything instead of trusting nothing changed
   *  during the (potentially lengthy) render wait in between. */
  audioNodeIds: string[];
  /** Timeline start and end of each piece in `audioNodeIds`, same order: what
   *  the rendered file holds. placeFullTimelineRender refuses when a piece
   *  was moved or trimmed while rendering. */
  audioSpans: { start: number; end: number }[];
  /** One entry per audio piece about to be replaced, captured here (before
   *  anything is removed) so a later "Revert to segments" click has
   *  everything undoFullTimelineRender needs. Best-effort per piece (see the
   *  capture loop in renderFullTimelineForAE) — a piece that couldn't be
   *  captured (no source media path, couldn't locate its track) is simply
   *  absent here; Undo just leaves that one piece un-restored rather than
   *  blocking the whole revert. */
  pieces: RenderUndoPiece[];
  /** The sequence rendered from (Sequence.sequenceID and name), so "Revert to
   *  segments" refuses to work in a different one. */
  sequenceId: string;
  sequenceName: string;
  /** Which engine wrote the file (see encodeWorkAreaToWav). */
  renderedBy: RenderEngine;
}

export interface PlaceFullTimelineRenderResult {
  clipsRemoved: number;
  placedAtSeconds: number;
  /** nodeId of the clip placed, "" when it couldn't be found afterwards.
   *  "Revert to segments" removes exactly this clip. */
  placedNodeId: string;
  warnings: string[];
}

/**
 * First half of the "Render full timeline for AE" flow, for a selection with
 * Pitch (or any other real Premiere effect) applied, which sendToAfterEffects
 * refuses (see hasUnsupportedEffect). Renders one work-area export over the
 * whole selected audio span with every other audio track muted for the export
 * (muteOtherAudioTracks), so it captures exactly what Premiere plays back on
 * the selected pieces' tracks, effects included, as renderSelectedClipToWav
 * does for one clip. Only renders (or, as the fallback, queues) the export
 * and reports its path; placeFullTimelineRender is the second half (replacing
 * the original pieces with this file), called once the JS side has confirmed
 * via waitForFileStable that the file has finished writing.
 *
 * Cut, pacing, speed and pitch should be final before this runs: there is no
 * per-piece slack afterwards. After placement, the ordinary "Send to After
 * Effects" button sends the rendered WAV (no Pitch on it) through the regular
 * segments path. Video is never baked; it is sent separately via position/speed
 * reconstruction.
 */
export const renderFullTimelineForAE = (presetPath: string, useProjectFolder: boolean = false): FullTimelineRenderResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!presetPath) throw new Error("No export preset path given.");
  const encoder: any = (app as any).encoder;

  const rawSel = seq.getSelection() || [];
  const audioSel = audioOnly(seq, rawSel);
  const videoSel = videoOnly(seq, rawSel);
  if (!audioSel || audioSel.length === 0) {
    throw new Error("Select the audio to render first.");
  }
  // Audio itself is unchecked here — baking captures whatever effects are
  // really there, that's the whole point. Video is still only ever sent by
  // reconstruction (never baked), so it needs the same check
  // sendToAfterEffects applies.
  checkNoUnsupportedVideoEffects(videoSel);

  const orderedAudio = audioSel.slice().sort((a, b) => a.start.seconds - b.start.seconds);
  const firstAudioStart = orderedAudio[0].start.seconds;
  let lastAudioEnd = orderedAudio[0].end.seconds;
  for (let i = 1; i < orderedAudio.length; i++) {
    if (orderedAudio[i].end.seconds > lastAudioEnd) lastAudioEnd = orderedAudio[i].end.seconds;
  }

  // One subfolder per source name under Renders; the file name inside is unique
  // per render (see below).
  const rendersFolder = getSubFolder("Renders", useProjectFolder);
  const sourceName = orderedAudio[0].name ? String(orderedAudio[0].name) : "clip";
  const outFolder = new Folder(rendersFolder.fsName + "/" + safeFolderName(sourceName));
  requireFolder(outFolder);
  const resolvedPresetPath = resolvePresetForSequence(seq, presetPath, rendersFolder);

  // A unique name per render (millisecond stamp), as Natural pitch does: an
  // earlier render's clip may still be on the timeline, linked to its file by
  // path, so it must never be overwritten. A fresh name also means no stale
  // file can look "stable" to waitForFileStable.
  const outPath = `${outFolder.fsName}/full-render-${String(new Date().getTime())}.wav`;

  const keepTrackIndices: number[] = [];
  for (let i = 0; i < orderedAudio.length; i++) {
    const loc = locateTrackOfClip(seq, orderedAudio[i]);
    if (loc) {
      keepTrackIndices.push(loc.trackIndex);
      // A disabled piece or a muted track would be baked as silence and then
      // replace the pieces; refused before anything is rendered. A locked
      // track could not give its piece up at the placement step.
      requireAudibleForRender(orderedAudio[i], loc.track, loc.trackIndex, "Nothing was rendered.");
      if (isTrackLocked(loc.track)) {
        throw new Error(
          `Audio track ${loc.trackIndex + 1}, where a selected piece sits, is locked. Unlock it, then try again. Nothing was rendered.`,
        );
      }
    }
  }

  // The render takes everything on these tracks from the first selected piece to
  // the end of the last, and placing it overwrites that whole stretch of the
  // first piece's track. An unselected clip in that stretch would be baked into
  // the render and then overwritten (or left playing twice on another track), so
  // refuse before rendering.
  const selectedNodeIds: string[] = [];
  for (let i = 0; i < orderedAudio.length; i++) selectedNodeIds.push(orderedAudio[i].nodeId);
  const unselected = findUnlistedClipInSpan(seq, keepTrackIndices, firstAudioStart, lastAudioEnd, selectedNodeIds);
  if (unselected) {
    throw new Error(
      `"${unselected.clip.name}" on audio track ${unselected.trackIndex + 1} (${unselected.clip.start.seconds.toFixed(
        2,
      )}s–${unselected.clip.end.seconds.toFixed(
        2,
      )}s) sits between the selected pieces but isn't selected: the render would include it and then replace it. Select it too, or move it out of that stretch, then try again. Nothing was rendered.`,
    );
  }

  // getInPoint()/getOutPoint() return a timecode string, not seconds — must
  // use the *AsTime variants here (same gotcha documented at every other
  // call site in this file that touches the work area).
  const savedIn = seq.getInPointAsTime();
  const savedOut = seq.getOutPointAsTime();
  const mutedTracks = muteOtherAudioTracks(seq, keepTrackIndices);
  let renderedBy: RenderEngine;
  try {
    seq.setInPoint(firstAudioStart);
    seq.setOutPoint(lastAudioEnd);
    renderedBy = encodeWorkAreaToWav(encoder, seq, outPath, resolvedPresetPath);
  } finally {
    unmuteTracks(mutedTracks);
    try {
      seq.setInPoint(savedIn.seconds);
      seq.setOutPoint(savedOut.seconds);
    } catch (e) {
      // non-fatal — leaves the work area at the just-rendered span
    }
  }

  const audioNodeIds: string[] = [];
  // Captured *before* placeFullTimelineRender removes anything, mirroring
  // cutSelectedClip's own undoInfo capture (see CutUndoInfo's comment) —
  // everything a later "Revert to segments" click needs to put each piece
  // back deterministically. Best-effort per piece: a piece this can't fully
  // read (no source media path, no resolvable track) is just left out of
  // `pieces` rather than aborting the whole render — Undo will simply leave
  // that one piece un-restored later.
  const pieces: RenderUndoPiece[] = [];
  const audioSpans: { start: number; end: number }[] = [];
  for (let i = 0; i < orderedAudio.length; i++) {
    const item = orderedAudio[i];
    audioNodeIds.push(item.nodeId);
    audioSpans.push({ start: item.start.seconds, end: item.end.seconds });
    try {
      const pi = item.projectItem;
      if (!pi) continue;
      const mediaPath = pi.getMediaPath();
      if (!mediaPath) continue;
      const loc = locateTrackOfClip(seq, item);
      if (!loc) continue;
      let speedFactor = 1;
      try {
        const s = item.getSpeed();
        if (typeof s === "number" && s > 0) speedFactor = s;
      } catch (e) {
        // leave at 1 — treated as unchanged rather than guessing, same as cutSelectedClip's identical capture
      }
      pieces.push({
        projectItemNodeId: pi.nodeId,
        trackIndex: loc.trackIndex,
        timelineStart: item.start.seconds,
        originalDuration: item.end.seconds - item.start.seconds,
        sourceInPoint: item.inPoint.seconds * speedFactor,
        mediaPath,
        speedFactor,
        hadPitch: hasPremierePitchShifter(item),
        linkedVideoIds: linkedVideoNodeIds(seq, item),
      });
    } catch (e) {
      // best effort — this one piece just won't be restorable by
      // undoFullTimelineRender later; never blocks the render itself
    }
  }

  return {
    filePath: outPath,
    firstAudioStart,
    audioNodeIds,
    audioSpans,
    pieces,
    sequenceId: String(seq.sequenceID || ""),
    sequenceName: String(seq.name || ""),
    renderedBy,
  };
};

/**
 * Second half of the "Render full timeline for AE" flow, called once the JS
 * side has confirmed (via waitForFileStable) that renderFullTimelineForAE's
 * output has finished writing. Removes the original effect-affected audio
 * pieces and places the one rendered file at the same position, so the bake is
 * visible, then selects the new clip (plus any untouched linked video) so
 * "Send to After Effects" can be used right after.
 *
 * `audioNodeIds` is re-checked against the CURRENT timeline (via
 * `findClipByNodeId`, across every audio track, since J/L Pacing may have
 * spread pieces over two tracks) before anything is removed: the render takes a
 * while and the timeline may have changed. If even one expected piece can't be
 * found, this throws instead of guessing which pieces are still safe to remove.
 * With `audioSpans` (FullTimelineRenderResult.audioSpans), a piece moved or
 * trimmed since rendering throws too: the file still holds the old piece, at
 * its old length.
 *
 * Undone by undoFullTimelineRender ("Revert to segments"), which rebuilds the
 * original pieces from `FullTimelineRenderResult.pieces` instead of counting
 * Premiere undo steps.
 */
export const placeFullTimelineRender = (
  filePath: string,
  firstAudioStart: number,
  audioNodeIds: string[],
  pieces?: RenderUndoPiece[],
  audioSpans?: { start: number; end: number }[],
): PlaceFullTimelineRenderResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!filePath) throw new Error("No rendered file path given.");
  const sourceFile = new File(filePath);
  if (!sourceFile.exists) throw new Error(`Rendered file not found on disk: ${filePath}`);
  if (!audioNodeIds || audioNodeIds.length === 0) {
    throw new Error("No audio pieces recorded from the render step — nothing to replace.");
  }

  const found: TrackItem[] = [];
  for (let n = 0; n < audioNodeIds.length; n++) {
    let match: TrackItem | null = null;
    for (let ai = 0; ai < seq.audioTracks.numTracks && !match; ai++) {
      match = findClipByNodeId(seq.audioTracks[ai], audioNodeIds[n]);
    }
    if (!match) {
      throw new Error(
        'The timeline changed since rendering — one or more of the original pieces can no longer be found. Nothing was removed. Run "Render full timeline for AE" again.',
      );
    }
    const span = audioSpans && audioSpans.length === audioNodeIds.length ? audioSpans[n] : null;
    if (span && (Math.abs(match.start.seconds - span.start) > 0.01 || Math.abs(match.end.seconds - span.end) > 0.01)) {
      throw new Error(
        'The timeline changed since rendering — one or more of the original pieces was moved or trimmed. Nothing was removed. Run "Render full timeline for AE" again.',
      );
    }
    found.push(match);
  }

  // Video pieces are left completely untouched — captured here (before
  // anything below mutates the timeline) purely so they can be re-selected
  // alongside the new clip afterward, exactly as they already were.
  const rawSel = seq.getSelection() || [];
  const videoSel = videoOnly(seq, rawSel);

  const targetLoc = locateTrackOfClip(seq, found[0]);
  if (!targetLoc) throw new Error("Could not locate a track for the original audio pieces.");
  const targetTrack = targetLoc.track;

  // The rendered file covers the first piece's start to the last piece's end.
  // A clip put into that stretch of the target track during the render would be
  // overwritten by the placement: refuse before anything is removed.
  let renderEnd = firstAudioStart;
  for (let i = 0; i < found.length; i++) {
    if (found[i].end.seconds > renderEnd) renderEnd = found[i].end.seconds;
  }
  const added = findUnlistedClipInSpan(seq, [targetLoc.trackIndex], firstAudioStart, renderEnd, audioNodeIds);
  if (added) {
    throw new Error(
      `"${added.clip.name}" now sits on audio track ${added.trackIndex + 1} where the rendered file goes (${added.clip.start.seconds.toFixed(
        2,
      )}s–${added.clip.end.seconds.toFixed(
        2,
      )}s). Nothing was removed. Move it out of that stretch, then run "Render full timeline for AE" again.`,
    );
  }

  // Import and locate the rendered file before removing anything, so a failed
  // import leaves the original pieces where they are.
  const childrenBefore = app.project.rootItem.children.numItems;
  const ok = app.project.importFiles([filePath], true, app.project.rootItem, false);
  if (!ok) throw new Error("Premiere rejected importing the rendered file.");

  const targetPath = String(sourceFile.fsName).toLowerCase();
  const children = app.project.rootItem.children;
  let projectItem: ProjectItem | null = null;
  for (let i = 0; i < children.numItems; i++) {
    const item = children[i];
    try {
      if (item.getMediaPath && String(item.getMediaPath()).toLowerCase() === targetPath) {
        projectItem = item;
        break;
      }
    } catch (e) {
      // not a media item (e.g. a bin) — skip
    }
  }
  if (!projectItem && children.numItems > childrenBefore) {
    projectItem = children[children.numItems - 1];
  }
  if (!projectItem) {
    throw new Error("Import appeared to succeed, but the new project item could not be located.");
  }

  // Before anything is removed: every track an original sits on must take a
  // removal and the target track the placement (a locked track refuses either
  // silently).
  for (let i = 0; i < found.length; i++) {
    const loc = locateTrackOfClip(seq, found[i]);
    if (loc && isTrackLocked(loc.track)) {
      throw new Error(
        `Audio track ${loc.trackIndex + 1}, where an original piece sits, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.`,
      );
    }
  }
  if (isTrackLocked(targetTrack)) {
    throw new Error(
      `Audio track ${targetLoc.trackIndex + 1}, where the rendered file goes, is locked. Unlock it, then run "Render full timeline for AE" again. Nothing was removed.`,
    );
  }
  // The render step records every piece for "Revert to segments" and for the
  // rollback below (best effort there: a piece without source media is left
  // out). A record that holds some pieces but not all would let the missing
  // ones be replaced for good while Revert looks available, so it is refused
  // before anything is removed. With no record at all the pieces are still
  // replaced, and the panel offers no Revert.
  const piecesAligned = !!pieces && pieces.length === found.length;
  if (pieces && pieces.length > 0 && !piecesAligned) {
    throw new Error(
      `${found.length - pieces.length} of the ${found.length} selected piece(s) could not be recorded for "Revert to segments" (their source media was not found in the project), so nothing was replaced. Reconnect the media, select the pieces and run "Render full timeline for AE" again.`,
    );
  }

  const warnings: string[] = [];
  // The originals removed so far, in timeline order, for a rollback: a bounded
  // restore, since the clips around them are still on the timeline. Returns
  // the sentence that says what the rollback achieved; the restore itself can
  // skip a piece or put one back without its exact Speed or bounds, and the
  // message then says so instead of claiming everything went back. Without a
  // record nothing can go back and the sentence says that.
  const removedPieces: RenderUndoPiece[] = [];
  let removedCount = 0;
  const withOutcome = (head: string, outcome: string): string => (outcome ? `${head} ${outcome}` : head);
  const rollback = (): string => {
    if (removedCount === 0) return "Nothing was removed; nothing was replaced.";
    if (!piecesAligned) {
      return "The removed pieces could not be put back (no restore data); use Premiere's Undo (Cmd/Ctrl+Z) to bring them back.";
    }
    const firstRollbackWarning = warnings.length;
    const back = restoreRenderUndoPieces(seq, removedPieces, warnings, true);
    const details = warnings.splice(firstRollbackWarning, warnings.length - firstRollbackWarning).join(" ");
    if (back.length === removedPieces.length && !details) return "The original pieces were put back; nothing was replaced.";
    if (back.length === removedPieces.length)
      return `Every original piece went back, but not exactly as before (${details}); nothing was replaced.`;
    return `${back.length} of ${removedPieces.length} removed piece(s) went back (${details}). Use Premiere's Undo (Cmd/Ctrl+Z) for the rest; nothing was replaced.`;
  };
  for (let i = 0; i < found.length; i++) {
    const nodeId = found[i].nodeId;
    const name = found[i].name;
    try {
      found[i].remove(false, false);
    } catch (e) {
      throw new Error(withOutcome(`Premiere could not remove "${name}" (${errMsg(e)}).`, rollback()));
    }
    if (findAudioClipByNodeId(seq, nodeId)) {
      throw new Error(withOutcome(`Premiere did not remove "${name}".`, rollback()));
    }
    removedCount++;
    if (piecesAligned) removedPieces.push((pieces as RenderUndoPiece[])[i]);
  }

  let placedOk = false;
  try {
    placedOk = !!targetTrack.overwriteClip(projectItem, firstAudioStart);
  } catch (e) {
    // The pieces are already off the timeline: put them back before reporting.
    throw new Error(withOutcome(`Premiere failed while placing the rendered file (${errMsg(e)}).`, rollback()));
  }
  if (!placedOk) {
    throw new Error(withOutcome(`Premiere rejected placing the rendered file at ${firstAudioStart.toFixed(3)}s.`, rollback()));
  }

  const newClip = findClipNear(targetTrack, firstAudioStart);
  const priorSelection = seq.getSelection();
  if (priorSelection) {
    for (let i = 0; i < priorSelection.length; i++) {
      try {
        priorSelection[i].setSelected(false, false);
      } catch (e) {
        // best effort
      }
    }
  }
  if (newClip) {
    try {
      newClip.setSelected(true, true);
    } catch (e) {
      warnings.push("Placed on the timeline, but could not auto-select the new clip.");
    }
  } else {
    warnings.push("Placed on the timeline, but could not locate the new clip afterward to select it.");
  }
  for (let i = 0; i < videoSel.length; i++) {
    try {
      videoSel[i].setSelected(true, true);
    } catch (e) {
      // best effort — the video piece itself is untouched either way
    }
  }

  return { clipsRemoved: found.length, placedAtSeconds: firstAudioStart, placedNodeId: newClip ? newClip.nodeId : "", warnings };
};

export interface UndoFullTimelineRenderResult {
  piecesRestored: number;
  warnings: string[];
}

/** Throws, before anything is removed, when the source of any piece to restore
 *  can't be found in the project — so a revert never takes audio off the
 *  timeline that it then can't put back. */
const requireRestorableSources = (pieces: RenderUndoPiece[]): void => {
  let missing = 0;
  for (let i = 0; i < pieces.length; i++) {
    if (!findProjectItemForMedia(pieces[i].mediaPath, pieces[i].projectItemNodeId)) missing++;
  }
  if (missing > 0) {
    throw new Error(
      `Could not find the original source media of ${missing} piece(s) in the Project panel — nothing was changed. Import the source file again, then try again.`,
    );
  }
};

/** Throws, before anything is removed, when the audio track a piece goes back
 *  to no longer exists or is locked: the restore would skip that piece after
 *  the clips replacing it were already taken off. */
const requireRestoreTracks = (seq: Sequence, pieces: RenderUndoPiece[]): void => {
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.trackIndex < 0 || p.trackIndex >= seq.audioTracks.numTracks) {
      throw new Error(
        `Cannot revert: audio track ${p.trackIndex + 1}, where an original piece goes back, no longer exists. Add audio tracks (Sequence > Add Tracks) until it is there again, then try again. Nothing was changed.`,
      );
    }
    if (isTrackLocked(seq.audioTracks[p.trackIndex])) {
      throw new Error(
        `Cannot revert: audio track ${p.trackIndex + 1}, where an original piece goes back, is locked. Unlock it, then try again. Nothing was changed.`,
      );
    }
  }
};

/** Throws, before anything is removed, when putting a piece back would land
 *  on a clip that stays on the timeline: the restore uses overwriteClip(),
 *  which would trim that clip. `willBeRemoved` names the clips the revert
 *  takes off first. This happens when the timeline changed after the replace
 *  step, for example when J/L Pacing moved untouched pieces into the span.
 *
 *  A sped-up piece goes back at 100% speed first and gets its Speed after
 *  (restoreRenderUndoPieces), so for a moment it reaches past its own end by
 *  originalDuration × (speedFactor − 1). A clip that stays in that reach is
 *  refused too. Another piece's span there is free: pieces are recorded in
 *  timeline order, and each one is back at its own length before the next is
 *  placed. */
const requireFreeRestoreSpans = (seq: Sequence, pieces: RenderUndoPiece[], willBeRemoved: (c: TrackItem) => boolean): void => {
  const EPS = 0.01;
  let blocked = 0;
  let inReach: { piece: number; trackIndex: number; end: number; extra: number; clip: TrackItem } | null = null;
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (p.trackIndex < 0 || p.trackIndex >= seq.audioTracks.numTracks) continue;
    const track = seq.audioTracks[p.trackIndex];
    const start = p.timelineStart;
    const end = p.timelineStart + p.originalDuration;
    const reachEnd = p.timelineStart + p.originalDuration * Math.max(1, p.speedFactor);
    for (let ci = 0; ci < track.clips.numItems; ci++) {
      const c = track.clips[ci];
      if (willBeRemoved(c)) continue;
      if (c.start.seconds < end - EPS && c.end.seconds > start + EPS) {
        blocked++;
        break;
      }
      if (!inReach && reachEnd > end + EPS && c.start.seconds < reachEnd - EPS && c.end.seconds > end + EPS) {
        inReach = { piece: i, trackIndex: p.trackIndex, end, extra: reachEnd - end, clip: c };
      }
    }
  }
  if (blocked > 0) {
    throw new Error(
      `${blocked} original piece(s) would land on other clips that were moved there after the replace step (for example by J/L Pacing) — nothing was changed. Click Reset in J/L Pacing, or move those clips, then try again.`,
    );
  }
  if (inReach) {
    throw new Error(
      `Cannot revert: sped-up piece ${inReach.piece + 1} goes back at 100% speed for a moment before its Speed is set again, so it needs ${inReach.extra.toFixed(
        2,
      )}s of free space after ${inReach.end.toFixed(2)}s on audio track ${inReach.trackIndex + 1}, where "${
        inReach.clip.name
      }" sits. Move that clip ${inReach.extra.toFixed(2)}s later, then try again. Nothing was changed.`,
    );
  }
};

/** The restore loop shared by `undoFullTimelineRender` and Natural pitch's
 *  Revert (`undoNaturalPitch`): places every piece back at its own position,
 *  source range and Speed. Returns the clips it restored, in `pieces` order. */
const restoreRenderUndoPieces = (seq: Sequence, pieces: RenderUndoPiece[], warnings: string[], bounded: boolean = false): TrackItem[] => {
  clearPlacementCache();
  // Same ProjectItem narrowing as narrowProjectItemWindow's own callers
  // elsewhere — cached per media path (almost always all pieces share the same
  // one source file) so the master clip's own marks are read and the
  // ProjectItem is looked up only once per distinct source, not once per piece.
  const projectItemCache: { [path: string]: { item: any; origBounds: { inPoint: number; outPoint: number } } } = {};
  const findProjectItem = (mediaPath: string, nodeId?: string): { item: any; origBounds: { inPoint: number; outPoint: number } } | null => {
    const key = mediaPath.toLowerCase() + "|" + (nodeId || "");
    if (projectItemCache[key]) return projectItemCache[key];
    const item = findProjectItemForMedia(mediaPath, nodeId);
    if (!item) return null;
    const entry = { item, origBounds: { inPoint: item.getInPoint().seconds, outPoint: item.getOutPoint().seconds } };
    projectItemCache[key] = entry;
    return entry;
  };

  // Mirrors undoCutViaRazor's own applyRestoredSpeed helper exactly (same
  // qeFindOrdinalAt/qeGetClipAt lookup, same setSpeedFully call, same return
  // value) — see the comment on that helper for why the inPoint/outPoint writes
  // must run first, while the clip is still at 100% speed.
  const frameSec = sequenceFrameSec(seq);
  let shortfallCount = 0;
  let lowestRatio = 1;
  const applyRestoredSpeed = (trackIndex: number, atSeconds: number, speedFactor: number, clip: TrackItem): number => {
    if (Math.abs(speedFactor - 1) < 0.0001) return 1;
    try {
      if (typeof qe === "undefined") app.enableQE();
      if (!qe) {
        warnings.push(
          "Restored a piece's position, but couldn't restore its original Speed (Premiere's editing interface was not available).",
        );
        return 1;
      }
      const qeSeq = qe.project.getActiveSequence();
      if (!qeSeq) {
        warnings.push("Restored a piece's position, but couldn't restore its original Speed (no active sequence).");
        return 1;
      }
      const qeTrack = qeSeq.getAudioTrackAt(trackIndex);
      const ordinal = qeFindOrdinalAt(qeTrack, atSeconds);
      const qeItem = ordinal >= 0 ? qeGetClipAt(qeTrack, ordinal) : null;
      if (!qeItem) {
        warnings.push("Restored a piece's position, but couldn't find it in Premiere's editing interface to restore its original Speed.");
        return 1;
      }
      const applied = setSpeedFully(qeItem, clip, speedFactor, frameSec, qeItemFinder(qeTrack, clip));
      if (Math.abs(applied - speedFactor) > SPEED_MATCH_EPS) {
        shortfallCount++;
        if (applied / speedFactor < lowestRatio) lowestRatio = applied / speedFactor;
      }
      return applied;
    } catch (e) {
      warnings.push(`Restored a piece's position, but restoring its original Speed failed (${errMsg(e)}).`);
      return readClipSpeed(clip, 1);
    }
  };

  const restoredClips: TrackItem[] = [];
  const restoredEnds: number[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    try {
      if (p.trackIndex < 0 || p.trackIndex >= seq.audioTracks.numTracks) {
        warnings.push(`Piece ${i + 1}: its original audio track no longer exists — skipped.`);
        continue;
      }
      const track = seq.audioTracks[p.trackIndex];
      const found = findProjectItem(p.mediaPath, p.projectItemNodeId);
      if (!found) {
        warnings.push(`Piece ${i + 1}: could not find its original source media in the Project panel — skipped.`);
        continue;
      }
      const sourceSpan = p.originalDuration * p.speedFactor;
      // `bounded` (the rollback after a rejected placement, where the clips
      // around the piece are still on the timeline): the piece is placed over
      // exactly its own timeline length at 100% speed, never over the full
      // source span, so the overwrite cannot reach the next clip. Its Speed
      // then makes that box cover the full source span. The explicit Reverts
      // keep the full-span placement; only the overwrite is the destructive
      // step, the in/out and end writes below trim and cannot remove a
      // neighbour.
      const placeSpanEnd = bounded ? p.sourceInPoint + p.originalDuration : p.sourceInPoint + sourceSpan;
      narrowProjectItemWindow(found.item, p.sourceInPoint, placeSpanEnd, warnings, `for piece ${i + 1} before placing it`);
      const placedOk = overwriteAudioOnly(seq, track, found.item, p.timelineStart, warnings);
      if (!placedOk) {
        warnings.push(`Piece ${i + 1}: Premiere rejected placing it at ${p.timelineStart.toFixed(3)}s — skipped.`);
        continue;
      }
      const restored = findClipNear(track, p.timelineStart);
      if (!restored) {
        warnings.push(`Piece ${i + 1}: placed, but could not locate it afterward — its exact bounds/Speed were left unset.`);
        continue;
      }
      if (!bounded) {
        try {
          restored.inPoint = secondsToTime(p.sourceInPoint);
          restored.outPoint = secondsToTime(p.sourceInPoint + sourceSpan);
        } catch (e) {
          warnings.push(`Piece ${i + 1}: placed, but setting its exact source range failed (${errMsg(e)}).`);
        }
      }
      // overwriteClip() starts the clip on the nearest frame, but a sped-up piece
      // usually started between frames: put it back exactly, while it is still at
      // 100% speed, so it touches the piece before it again.
      try {
        if (Math.abs(restored.start.seconds - p.timelineStart) > 0.0005) restored.start = secondsToTime(p.timelineStart);
      } catch (e) {
        // best effort: a start up to half a frame late leaves a gap that short
      }
      // No inPoint/outPoint writes after this: once the speed isn't 100%, Premiere
      // reads them as timeline-scaled, and source seconds written there would
      // make the piece play from sourceInPoint * speed. setSpeed() keeps the
      // source in-point where the writes above (or the placement) put it.
      const appliedSpeed = applyRestoredSpeed(p.trackIndex, p.timelineStart, p.speedFactor, restored);
      const targetEnd = p.timelineStart + sourceSpan / appliedSpeed;
      try {
        restored.end = secondsToTime(targetEnd);
      } catch (e) {
        warnings.push(`Piece ${i + 1}: restored, but setting its exact end bound failed (${errMsg(e)}).`);
      }
      restoredClips.push(restored);
      restoredEnds.push(targetEnd);
    } catch (e) {
      warnings.push(`Piece ${i + 1}: restoring it failed (${errMsg(e)}).`);
    }
  }
  if (shortfallCount > 0)
    warnings.push(
      `Premiere Pro put back less than the earlier Speed on ${shortfallCount} piece(s) (lowest ${speedPercentText(lowestRatio)}% of it). They still play all of their audio, at that lower speed.`,
    );
  // The master clips' own In/Out go back to what they were (as Cut Undo, the
  // Speed rebuild and J/L Pacing do), so the Project panel keeps no marks from
  // the last piece placed.
  for (const key in projectItemCache) {
    if (!Object.prototype.hasOwnProperty.call(projectItemCache, key)) continue;
    const entry = projectItemCache[key];
    try {
      setProjectItemInOut(entry.item, entry.origBounds.inPoint, entry.origBounds.outPoint);
    } catch (e) {
      // best effort — the pieces are back; only the master clip's marks stay narrowed
    }
  }
  // Each later piece is placed by overwriteClip() on the nearest frame, which
  // can cut the piece before it back to that frame; once the later piece is
  // moved to its exact start, that leaves a gap of up to half a frame. Writing
  // each end again after all pieces are placed closes it.
  for (let i = 0; i < restoredClips.length; i++) {
    try {
      if (Math.abs(restoredClips[i].end.seconds - restoredEnds[i]) > 0.0005) restoredClips[i].end = secondsToTime(restoredEnds[i]);
    } catch (e) {
      // best effort: the gap left is under half a frame
    }
  }
  return restoredClips;
};

/**
 * "Revert to segments": undoes `placeFullTimelineRender` by removing the one
 * baked clip it placed and putting every original audio piece back at its own
 * position, source range and Speed, from `pieces`
 * (`FullTimelineRenderResult.pieces`, captured before anything was removed).
 * Same from-scratch rebuild as `undoCutViaRazor`, never Premiere's undo stack:
 * the replace step's footprint (N removes + 1 import + 1 place) can't be
 * counted safely.
 *
 * Pitch Shifter's value needs no capture: applyPitchToSelection derives it
 * from each clip's current getSpeed(), so restoring Speed is enough. The panel
 * re-runs applyPitchToSelection on the restored (selected) pieces when every
 * sped-up piece had Pitch (RenderUndoPiece.hadPitch), and warns on a mix. See
 * main.tsx's handleUndoRenderFullTimeline.
 *
 * Video is never re-placed: `placeFullTimelineRender` leaves it where it was.
 * Each piece goes back without its video (overwriteAudioOnly) and is linked to
 * that video again (`RenderUndoPiece.linkedVideoIds`).
 *
 * Before removing anything, throws in a sequence other than `sequenceId`, if
 * any piece's source can't be found in the project (requireRestorableSources),
 * if a piece's audio track is gone or locked (requireRestoreTracks) or if a
 * piece would land on a clip that stays on the timeline, a copy of the render
 * included, or reach one while it is briefly at 100% speed
 * (requireFreeRestoreSpans). After that, a rejected placement
 * or a failed bounds/speed write becomes a warning and the next piece is
 * restored.
 */
export const undoFullTimelineRender = (
  renderedFilePath: string,
  timelineStart: number,
  pieces: RenderUndoPiece[],
  restoreFades: boolean = false,
  tailFadeFrames?: number[],
  headFadeFrames?: number[],
  sequenceId?: string,
  sequenceName?: string,
  placedNodeId?: string,
): UndoFullTimelineRenderResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (sequenceId && String(seq.sequenceID || "") !== sequenceId) {
    throw new Error(
      `Cannot revert: these pieces were rendered in the sequence "${sequenceName || ""}". Open that sequence, then try again. Nothing was changed.`,
    );
  }
  if (!pieces || pieces.length === 0) {
    throw new Error("No original pieces were recorded for this render — nothing to restore.");
  }
  const warnings: string[] = [];
  requireRestorableSources(pieces);
  requireRestoreTracks(seq, pieces);

  // Locate the single rendered clip first, searched across every audio track
  // rather than trusting pieces[0].trackIndex, since that piece's own capture
  // could have been skipped (best-effort). With `placedNodeId`
  // (PlaceFullTimelineRenderResult.placedNodeId) it is exactly the clip
  // placeFullTimelineRender put down, so a copy of the render nearby is never
  // taken for it; when that clip is gone, none is removed. Without it, the
  // same case-insensitive media path and a start within REMOVE_POSITION_TOL
  // decide. Only this clip is removed, so only this clip may sit where the
  // pieces go back: a copy of the render there blocks.
  // `renderedFilePath` was built with "/" after the folder's fsName; on
  // Windows getMediaPath() answers with backslashes, so both sides are
  // compared in the platform's own form.
  const renderedPath = String(new File(renderedFilePath).fsName).toLowerCase();
  const REMOVE_POSITION_TOL = 0.5;
  const isRenderFile = (c: TrackItem): boolean => {
    if (!c.projectItem || !c.projectItem.getMediaPath) return false;
    try {
      return String(c.projectItem.getMediaPath()).toLowerCase() === renderedPath;
    } catch (e) {
      return false;
    }
  };
  let renderedClip: TrackItem | null = null;
  for (let ai = 0; ai < seq.audioTracks.numTracks && !renderedClip; ai++) {
    const trk = seq.audioTracks[ai];
    if (placedNodeId) {
      const c = findClipByNodeId(trk, placedNodeId);
      if (c && isRenderFile(c)) renderedClip = c;
      continue;
    }
    for (let ci = 0; ci < trk.clips.numItems; ci++) {
      const c = trk.clips[ci];
      if (!isRenderFile(c)) continue;
      if (Math.abs(c.start.seconds - timelineStart) > REMOVE_POSITION_TOL) continue;
      renderedClip = c;
      break;
    }
  }
  const renderedNodeId = renderedClip ? renderedClip.nodeId : "";
  requireFreeRestoreSpans(seq, pieces, (c: TrackItem): boolean => !!renderedClip && c.nodeId === renderedNodeId);

  let removedRendered = false;
  if (renderedClip) {
    try {
      renderedClip.remove(false, false);
      removedRendered = true;
    } catch (e) {
      warnings.push(`Removing the rendered clip failed (${errMsg(e)}).`);
    }
  }
  if (!removedRendered) {
    warnings.push(
      "Could not find the rendered clip on the timeline to remove — it may already have been moved or deleted. Restoring the original pieces anyway.",
    );
  }

  const restoredClips = restoreRenderUndoPieces(seq, pieces, warnings);

  // Link each restored piece to its video again (restoreRenderUndoPieces places
  // a new, unlinked track item; the render left the video where it was). J/L
  // Pacing finds a piece's video through this link.
  let unlinked = 0;
  for (let k = 0; k < restoredClips.length; k++) {
    for (let j = 0; j < pieces.length; j++) {
      const ids = pieces[j].linkedVideoIds;
      if (!ids || ids.length === 0) continue;
      if (Math.abs(pieces[j].timelineStart - restoredClips[k].start.seconds) < 0.05) {
        if (!relinkToVideo(seq, restoredClips[k], ids)) unlinked++;
        break;
      }
    }
  }
  if (unlinked > 0) warnings.push(`${unlinked} restored piece(s) could not be linked to their video again.`);

  // J/L Pacing's declick fades, when J/L was applied to these pieces before the
  // render: the exact sizes when they are known (aligned 1:1 with `pieces`),
  // else the default size.
  if (restoreFades && restoredClips.length > 0) {
    const sized =
      !!tailFadeFrames && !!headFadeFrames && tailFadeFrames.length === pieces.length && headFadeFrames.length === pieces.length;
    const tail: number[] = [];
    const head: number[] = [];
    for (let k = 0; k < restoredClips.length; k++) {
      let match = -1;
      for (let j = 0; j < pieces.length && sized; j++) {
        if (Math.abs(pieces[j].timelineStart - restoredClips[k].start.seconds) < 0.05) {
          match = j;
          break;
        }
      }
      tail.push(match >= 0 ? (tailFadeFrames as number[])[match] : JL_CUT_FADE_FRAMES);
      head.push(match >= 0 ? (headFadeFrames as number[])[match] : JL_CUT_FADE_FRAMES);
    }
    addNativeEdgeFades(seq, restoredClips, warnings, tail, head);
  }

  // Explicit clear-then-select, same as placeFullTimelineRender's own
  // pattern — so a subsequent applyPitchToSelection call (see this
  // function's own doc comment) acts on exactly these restored pieces, not
  // whatever was left selected from before Undo ran (e.g. the now-removed
  // rendered clip).
  const priorSelection = seq.getSelection();
  if (priorSelection) {
    for (let i = 0; i < priorSelection.length; i++) {
      try {
        priorSelection[i].setSelected(false, false);
      } catch (e) {
        // best effort
      }
    }
  }
  for (let i = 0; i < restoredClips.length; i++) {
    try {
      restoredClips[i].setSelected(true, i === restoredClips.length - 1);
    } catch (e) {
      // best effort — selection is a convenience, not required for the restore itself
    }
  }

  return { piecesRestored: restoredClips.length, warnings };
};

// =========================
// Natural pitch (Pacing → Pitch correction → Natural)
// =========================

/** Seconds of source rendered before the first and after the last selected
 *  piece of each natural-pitch file — handles for J/L Pacing to extend a
 *  piece into, if it runs afterwards. J/L's overlaps are well under this. */
const NATURAL_PITCH_MARGIN_SEC = 1.0;
/** Name of the project-panel bin the rendered files are imported into, so
 *  they don't scatter across the root of the user's project. */
const NATURAL_PITCH_BIN_NAME = "Natural pitch renders";

/** One selected audio piece, as `getNaturalPitchPlan` read it. Source
 *  seconds use the conventions of `getSelectedCutPieceInfo`: the start is
 *  `inPoint * speed`, the end is start + timeline length * speed (never
 *  `outPoint * speed`, which overshoots after Speed — see that function). */
export interface NaturalPitchPiece {
  nodeId: string;
  /** nodeId of the piece's own ProjectItem (see findProjectItemForMedia). */
  projectItemNodeId: string;
  trackIndex: number;
  start: number;
  end: number;
  mediaPath: string;
  speedFactor: number;
  sourceIn: number;
  sourceEnd: number;
  /** Index into NaturalPitchPlan.renders, or -1 for a piece left alone (at
   *  100% speed, or unreadable). */
  renderIndex: number;
  hadPitch: boolean;
  /** Name of the first effect on this piece other than Pitch and the
   *  built-in fixed effects, "" if none. The rendered file is made from the
   *  source media, so such an effect does not carry over. */
  otherEffect: string;
}

/** One file the panel renders with ffmpeg: every selected piece of one
 *  source at one speed, plus NATURAL_PITCH_MARGIN_SEC each side. */
export interface NaturalPitchRender {
  mediaPath: string;
  speedFactor: number;
  rangeStart: number;
  rangeEnd: number;
  outPath: string;
}

export interface NaturalPitchPlan {
  /** Every selected audio piece, sorted by timeline start — the same order
   *  J/L Pacing indexes its boundaries in. */
  pieces: NaturalPitchPiece[];
  renders: NaturalPitchRender[];
  skippedNoSpeedChange: number;
}

/** Fades to put back on the replaced pieces. J/L Pacing adds a native fade at
 *  both edges of every piece; the replacement clips are new track items and
 *  would lose them. `tailFadeFrames[i]` is piece i's fade-out and
 *  `headFadeFrames[i - 1]` its fade-in, exactly as applyJLCutSmoothing reads
 *  the same arrays; a missing entry means JL_CUT_FADE_FRAMES. */
export interface NaturalPitchFades {
  apply: boolean;
  tailFadeFrames?: number[];
  headFadeFrames?: number[];
}

export interface PlaceNaturalPitchResult {
  replaced: number;
  /** What `undoNaturalPitch` needs to put the original pieces back. */
  undoPieces: RenderUndoPiece[];
  /** Fade sizes of each entry in undoPieces (frames), so Revert can put the
   *  same fades back; empty when no fades were applied. */
  undoTailFadeFrames: number[];
  undoHeadFadeFrames: number[];
  /** nodeIds of the video each entry in undoPieces was linked to, so Revert
   *  can link the restored piece to it again. */
  undoLinkedVideoIds: string[][];
  fadesApplied: number;
  warnings: string[];
  /** The sequence the pieces were replaced in (Sequence.sequenceID and name),
   *  so Revert refuses to work in a different one. */
  sequenceId: string;
  sequenceName: string;
  /** nodeIds of the clips placed here, and the render file each one plays
   *  (aligned), so Revert removes only these clips and never a copy. */
  placedNodeIds: string[];
  placedRenderPaths: string[];
}

export interface UndoNaturalPitchResult {
  piecesRestored: number;
  clipsRemoved: number;
  warnings: string[];
}

/**
 * Read-only first step of Natural pitch: reads the selected audio pieces and
 * groups every sped-up one by (source file, speed) into the files the panel
 * will render with ffmpeg. Never touches the timeline. Pieces at 100% speed
 * are listed but left alone, like applyPitchToSelection skips them.
 */
export const getNaturalPitchPlan = (useProjectFolder: boolean = false): NaturalPitchPlan => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  const sel = audioOnly(seq, seq.getSelection() || []);
  if (!sel || sel.length === 0) {
    throw new Error("Select one or more clips on the timeline first (the pieces Cut just made are auto-selected).");
  }
  const ordered = sel.slice().sort((a, b) => a.start.seconds - b.start.seconds);

  // The render takes the file's audio as it is (mono or stereo: the panel
  // refuses files with more channels or several audio streams). A piece that
  // is one of several linked channels (a camera clip shown as A1 + A2) plays
  // only its own channel, so the render would mix the others in.
  for (let i = 0; i < ordered.length; i++) {
    const loc = locateTrackOfClip(seq, ordered[i]);
    if (!loc) continue;
    const others = otherLinkedAudioTracks(seq, ordered[i], loc.trackIndex);
    if (others.length > 0) {
      throw new Error(
        `Natural pitch can't be used on a clip with more linked audio channels (audio track(s) ${others.join(
          ", ",
        )}): its render mixes the file's channels together, and would still after deleting a channel. Export the voice channel as its own mono file and cut that, or correct the pitch with a pitch plug-in of your own, using the values in Pitch correction → Calculator.`,
      );
    }
  }

  const pieces: NaturalPitchPiece[] = [];
  const renders: NaturalPitchRender[] = [];
  let skippedNoSpeedChange = 0;
  for (let i = 0; i < ordered.length; i++) {
    const c = ordered[i];
    let speed = 1;
    try {
      const s = c.getSpeed();
      if (typeof s === "number" && s > 0) speed = s;
    } catch (e) {
      // leave at 1 — treated as unchanged rather than guessing
    }
    let mediaPath = "";
    let projectItemNodeId = "";
    try {
      mediaPath = (c.projectItem && c.projectItem.getMediaPath()) || "";
      projectItemNodeId = (c.projectItem && c.projectItem.nodeId) || "";
    } catch (e) {
      // no media path — this piece is left alone below
    }
    const loc = locateTrackOfClip(seq, c);
    const start = c.start.seconds;
    const end = c.end.seconds;
    const sourceIn = c.inPoint.seconds * speed;
    const sourceEnd = sourceIn + (end - start) * speed;
    const otherEffect = firstEffectOtherThanPitch(c);

    let renderIndex = -1;
    if (Math.abs(speed - 1) < 0.0001) {
      skippedNoSpeedChange++;
    } else if (mediaPath && loc) {
      const key = String(mediaPath).toLowerCase();
      for (let r = 0; r < renders.length; r++) {
        if (String(renders[r].mediaPath).toLowerCase() === key && Math.abs(renders[r].speedFactor - speed) < 0.0001) {
          renderIndex = r;
          break;
        }
      }
      if (renderIndex === -1) {
        renders.push({ mediaPath, speedFactor: speed, rangeStart: sourceIn, rangeEnd: sourceEnd, outPath: "" });
        renderIndex = renders.length - 1;
      } else {
        if (sourceIn < renders[renderIndex].rangeStart) renders[renderIndex].rangeStart = sourceIn;
        if (sourceEnd > renders[renderIndex].rangeEnd) renders[renderIndex].rangeEnd = sourceEnd;
      }
    }

    pieces.push({
      nodeId: c.nodeId,
      projectItemNodeId,
      trackIndex: loc ? loc.trackIndex : -1,
      start,
      end,
      mediaPath,
      speedFactor: speed,
      sourceIn,
      sourceEnd,
      renderIndex,
      hadPitch: hasPremierePitchShifter(c),
      otherEffect,
    });
  }

  // Unique file names (millisecond stamp + index): Premiere links every
  // placed clip to its file by path, so an older render must never be
  // overwritten while a timeline may still use it.
  const rendersFolder = getSubFolder("Renders", useProjectFolder);
  const stamp = String(new Date().getTime());
  for (let r = 0; r < renders.length; r++) {
    const rd = renders[r];
    rd.rangeStart = Math.max(0, rd.rangeStart - NATURAL_PITCH_MARGIN_SEC);
    rd.rangeEnd = rd.rangeEnd + NATURAL_PITCH_MARGIN_SEC;
    // displayName, not name: File.name is URI-encoded ("%D0%93…" for Cyrillic),
    // which would make the folder name unreadable and, for a long name, longer
    // than the file system allows.
    const srcName = String(new File(rd.mediaPath).displayName || "clip").replace(/\.[^.]*$/, "");
    const outFolder = new Folder(rendersFolder.fsName + "/" + safeFolderName(srcName));
    requireFolder(outFolder);
    const pct = String(Math.round(rd.speedFactor * 10000) / 100).replace(".", "_");
    rd.outPath = `${outFolder.fsName}/natural-pitch-${pct}pct-${stamp}-${r + 1}.wav`;
  }

  return { pieces, renders, skippedNoSpeedChange };
};

/** Like hasUnsupportedEffect, but skips Pitch too (Natural pitch replaces
 *  it on purpose) and keeps looking past it, so an EQ added after a Pitch
 *  Shifter is still reported. "" if none. */
const firstEffectOtherThanPitch = (clip: TrackItem): string => {
  const comps: any = clip.components;
  if (!comps) return "";
  const n = comps.numItems || 0;
  for (let c = 0; c < n; c++) {
    const comp = comps[c];
    const name = comp && comp.displayName ? String(comp.displayName) : "";
    const matchName = comp && comp.matchName ? String(comp.matchName) : "";
    const both = (name + " " + matchName).toLowerCase();
    if (both.indexOf("pitch") !== -1) continue;
    let isBaseline = false;
    for (let b = 0; b < BASELINE_EFFECT_NEEDLES.length; b++) {
      if (both.indexOf(BASELINE_EFFECT_NEEDLES[b]) !== -1) {
        isBaseline = true;
        break;
      }
    }
    if (!isBaseline) return name || matchName || "unknown effect";
  }
  return "";
};

/** Finds the bin the natural-pitch renders go into, creating it on first
 *  use. Falls back to the project root if a bin can't be made. */
const getNaturalPitchBin = (): ProjectItem => {
  const root = app.project.rootItem;
  const findIt = (): ProjectItem | null => {
    for (let i = 0; i < root.children.numItems; i++) {
      const item = root.children[i];
      if (item && item.type === ProjectItemType.BIN && item.name === NATURAL_PITCH_BIN_NAME) return item;
    }
    return null;
  };
  let bin = findIt();
  if (bin) return bin;
  try {
    root.createBin(NATURAL_PITCH_BIN_NAME);
  } catch (e) {
    // fall through to the root below
  }
  bin = findIt();
  return bin ? bin : root;
};

/** Finds a ProjectItem by its media path inside `bin` (case-insensitive,
 *  the same comparison every other import in this file uses). */
const findProjectItemInBin = (bin: ProjectItem, filePath: string): ProjectItem | null => {
  const target = String(new File(filePath).fsName).toLowerCase();
  for (let i = 0; i < bin.children.numItems; i++) {
    const item = bin.children[i];
    try {
      if (item.getMediaPath && String(item.getMediaPath()).toLowerCase() === target) return item;
    } catch (e) {
      // not a media item (e.g. a nested bin) — skip
    }
  }
  return null;
};

/** Finds a selected piece again by its nodeId, on any audio track (J/L
 *  Pacing spreads pieces over two tracks). */
const findAudioClipByNodeId = (seq: Sequence, nodeId: string): TrackItem | null => {
  for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
    const m = findClipByNodeId(seq.audioTracks[ai], nodeId);
    if (m) return m;
  }
  return null;
};

/** nodeIds of the video track items `clip` is linked to. */
const linkedVideoNodeIds = (seq: Sequence, clip: TrackItem): string[] => {
  const ids: string[] = [];
  try {
    const linked = clip.getLinkedItems();
    if (!linked) return ids;
    for (let k = 0; k < linked.numItems; k++) {
      const li: TrackItem = (linked as any)[k];
      const loc = locateTrackOfClip(seq, li);
      if (loc && loc.trackType === "video") ids.push(li.nodeId);
    }
  } catch (e) {
    // best effort — no link found
  }
  return ids;
};

/** Links `audio` to the video track items in `videoIds`, the way Cut leaves
 *  a piece of a linked clip. J/L Pacing finds a piece's video through this
 *  link (getLinkedItems) and moves the two together; an unlinked
 *  replacement would be moved without its video. Returns false if it could
 *  not link. Changes the selection; callers re-select afterwards. */
const relinkToVideo = (seq: Sequence, audio: TrackItem, videoIds: string[]): boolean => {
  if (videoIds.length === 0) return true;
  clearSelection(seq);
  try {
    audio.setSelected(true, false);
  } catch (e) {
    return false;
  }
  let found = 0;
  for (let k = 0; k < videoIds.length; k++) {
    for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
      const v = findClipByNodeId(seq.videoTracks[vi], videoIds[k]);
      if (v) {
        try {
          v.setSelected(true, false);
          found++;
        } catch (e) {
          // best effort
        }
        break;
      }
    }
  }
  if (found === 0) return false;
  try {
    return !!seq.linkSelection();
  } catch (e) {
    return false;
  }
};

const clearSelection = (seq: Sequence): void => {
  const prior = seq.getSelection();
  if (!prior) return;
  for (let i = 0; i < prior.length; i++) {
    try {
      prior[i].setSelected(false, false);
    } catch (e) {
      // best effort
    }
  }
};

/**
 * Second step of Natural pitch, once the panel has rendered every file in
 * `plan.renders` (renderFilePaths[r] is the finished file for plan.renders[r]).
 * Replaces each sped-up piece with the matching stretch of its render, at
 * 100% speed, on the same track, over exactly the same timeline span, so
 * whatever layout Cut, Speed or J/L Pacing left stays as it is. Originals are
 * removed, not muted; `undoNaturalPitch` puts them back from `undoPieces`.
 *
 * Every piece is first found again by nodeId with its position unchanged,
 * before anything is removed: the render takes a while and the timeline may
 * have been edited meanwhile. If any piece moved or is gone, this throws and
 * nothing is touched.
 *
 * Placement uses the same narrow-then-overwriteClip pattern as J/L Pacing, the
 * Speed rebuild after a Cut and the render-undo restore code (see
 * narrowProjectItemWindow), and re-asserts in/out/end afterwards. All or
 * nothing: if an original can't be removed or its replacement can't be
 * placed, everything done so far is rolled back (rollBack below) and the
 * call throws.
 */
export const placeNaturalPitch = (plan: NaturalPitchPlan, renderFilePaths: string[], fades: NaturalPitchFades): PlaceNaturalPitchResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (!plan || !plan.pieces || !plan.renders || plan.renders.length === 0) {
    throw new Error("Nothing to replace — no selected piece has a speed change.");
  }
  if (!renderFilePaths || renderFilePaths.length !== plan.renders.length) {
    throw new Error("Natural pitch: the rendered files don't match the selected pieces. Nothing was replaced. Run Natural pitch again.");
  }
  for (let r = 0; r < renderFilePaths.length; r++) {
    if (!new File(renderFilePaths[r]).exists) throw new Error(`Rendered file not found on disk: ${renderFilePaths[r]}`);
  }

  // 1. Every piece to replace must still be where it was planned: same track,
  // position, source range and Speed. The render is placed on the planned
  // track over the planned span, so a piece moved to another track, slipped
  // or sped up again while rendering is refused before anything is removed.
  const live: (TrackItem | null)[] = [];
  for (let i = 0; i < plan.pieces.length; i++) {
    const p = plan.pieces[i];
    if (p.renderIndex < 0) {
      live.push(null);
      continue;
    }
    const plannedTrack = p.trackIndex >= 0 && p.trackIndex < seq.audioTracks.numTracks ? seq.audioTracks[p.trackIndex] : null;
    const c = plannedTrack ? findClipByNodeId(plannedTrack, p.nodeId) : null;
    let unchanged = !!c && Math.abs(c.start.seconds - p.start) <= 0.01 && Math.abs(c.end.seconds - p.end) <= 0.01;
    if (c && unchanged) {
      let speed = 1;
      try {
        const s = c.getSpeed();
        if (typeof s === "number" && s > 0) speed = s;
      } catch (e) {
        // leave at 1, the same reading getNaturalPitchPlan falls back to
      }
      unchanged = Math.abs(speed - p.speedFactor) < 0.0001 && Math.abs(c.inPoint.seconds * speed - p.sourceIn) <= 0.01;
    }
    if (!c || !unchanged) {
      throw new Error(
        "The timeline changed while rendering — a selected piece moved or is gone. Nothing was replaced. Select the pieces and run Natural pitch again.",
      );
    }
    if (isTrackLocked(plannedTrack)) {
      throw new Error(
        `Audio track ${p.trackIndex + 1}, where a selected piece is replaced, is locked. Unlock it, then run Natural pitch again. Nothing was replaced.`,
      );
    }
    live.push(c);
  }

  // 2. Import every render (no timeline change yet).
  const bin = getNaturalPitchBin();
  const ok = app.project.importFiles(renderFilePaths, true, bin, false);
  if (!ok) throw new Error("Premiere rejected importing the rendered natural-pitch files. Nothing was replaced.");
  const items: ProjectItem[] = [];
  const fullOut: number[] = [];
  for (let r = 0; r < renderFilePaths.length; r++) {
    const item = findProjectItemInBin(bin, renderFilePaths[r]);
    if (!item) throw new Error("Import appeared to succeed, but a rendered file could not be found in the project. Nothing was replaced.");
    items.push(item);
    fullOut.push(item.getOutPoint().seconds);
  }

  const warnings: string[] = [];
  const videoSel = videoOnly(seq, seq.getSelection() || []);

  const undoPieces: RenderUndoPiece[] = [];
  const undoTail: number[] = [];
  const undoHead: number[] = [];
  const undoLinks: string[][] = [];
  const newClips: TrackItem[] = [];
  const newClipEnds: number[] = [];
  const placedNodeIds: string[] = [];
  const placedRenderPaths: string[] = [];
  const newTail: number[] = [];
  const newHead: number[] = [];
  let replaced = 0;
  // The originals removed so far (timeline order) and their linked video, for
  // the all-or-nothing rollback below.
  const removedUndo: RenderUndoPiece[] = [];
  const removedLinks: string[][] = [];
  // All or nothing: the renders placed so far come off and every removed
  // original goes back (in timeline order; a bounded restore, since the clips
  // around them are still there), then the failure is reported; nothing is
  // left half-replaced. Used when an original fails to come off as well as
  // when a render fails to go on. Returns the sentence that reports the
  // outcome, and the caller throws it, so it is all the panel shows: the
  // restore can itself skip a piece (Premiere rejecting the placement), and
  // then the message says how many went back instead of claiming everything
  // did; a piece can also go back without its Speed, exact bounds or video
  // link, or a natural-pitch clip can refuse to come off, and then the message
  // says so instead of "Everything was put back".
  const rollBack = (): string => {
    const firstRollbackWarning = warnings.length;
    for (let k = 0; k < newClips.length; k++) {
      try {
        newClips[k].remove(false, false);
      } catch (e) {
        warnings.push(`Could not remove an already placed natural-pitch clip (${errMsg(e)}).`);
      }
    }
    const back = restoreRenderUndoPieces(seq, removedUndo, warnings, true);
    let unlinked = 0;
    for (let k = 0; k < back.length && k < removedLinks.length; k++) {
      if (!relinkToVideo(seq, back[k], removedLinks[k])) unlinked++;
    }
    if (unlinked > 0) warnings.push(`${unlinked} restored piece(s) could not be linked to their video again.`);
    const details = warnings.slice(firstRollbackWarning).join(" ");
    if (back.length >= removedUndo.length) {
      if (!details) {
        return "Everything was put back; nothing was replaced. Try again, or check that stretch of the timeline in Premiere.";
      }
      return `Every original piece went back, but not exactly as before (${details}). Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.`;
    }
    return `Putting the originals back failed too: ${back.length} of ${removedUndo.length} original piece(s) went back${details ? ` (${details})` : ""}. Check that stretch of the timeline in Premiere, or use Cmd/Ctrl+Z there to step back. Nothing else was replaced.`;
  };

  // 3. Replace piece by piece.
  try {
    for (let i = 0; i < plan.pieces.length; i++) {
      const p = plan.pieces[i];
      const orig = live[i];
      if (!orig || p.renderIndex < 0) continue;
      const rd = plan.renders[p.renderIndex];
      const item = items[p.renderIndex];
      const label = `piece ${i + 1}`;
      if (p.otherEffect) {
        warnings.push(`Piece ${i + 1}: its effect "${p.otherEffect}" is not in the rendered audio — add it again if you need it.`);
      }

      let tailFrames = JL_CUT_FADE_FRAMES;
      if (fades && fades.tailFadeFrames && fades.tailFadeFrames[i] !== undefined) tailFrames = fades.tailFadeFrames[i];
      let headFrames = JL_CUT_FADE_FRAMES;
      if (fades && fades.headFadeFrames && i > 0 && fades.headFadeFrames[i - 1] !== undefined) headFrames = fades.headFadeFrames[i - 1];

      const undo: RenderUndoPiece = {
        trackIndex: p.trackIndex,
        timelineStart: p.start,
        originalDuration: p.end - p.start,
        sourceInPoint: p.sourceIn,
        mediaPath: p.mediaPath,
        speedFactor: p.speedFactor,
        projectItemNodeId: p.projectItemNodeId,
      };

      const track = seq.audioTracks[p.trackIndex];
      const dur = p.end - p.start;
      const stretchedIn = (p.sourceIn - rd.rangeStart) / rd.speedFactor;
      const stretchedOut = stretchedIn + dur;
      if (stretchedIn < 0 || stretchedOut > fullOut[p.renderIndex] + 0.05) {
        warnings.push(`Piece ${i + 1}: its source range falls outside the rendered file — left unchanged.`);
        continue;
      }

      const videoIds = linkedVideoNodeIds(seq, orig);
      // The original comes off inside the same all-or-nothing contract as the
      // placement: a remove() that throws, or returns with the clip still on
      // the track, rolls back the pieces replaced so far instead of leaving
      // them replaced with no Revert record.
      const origNodeId = orig.nodeId;
      let removeError = "";
      try {
        orig.remove(false, false);
      } catch (e) {
        removeError = errMsg(e);
      }
      if (!removeError && findClipByNodeId(track, origNodeId)) removeError = "the clip is still on the timeline";
      if (removeError) {
        const outcome = rollBack();
        throw new Error(`Natural pitch: Premiere did not remove the original audio of piece ${i + 1} (${removeError}). ${outcome}`);
      }
      removedUndo.push(undo);
      removedLinks.push(videoIds);
      let placed: TrackItem | null = null;
      let placeError = "";
      try {
        narrowProjectItemWindow(
          item,
          stretchedIn,
          Math.min(stretchedOut, fullOut[p.renderIndex]),
          warnings,
          `for ${label} before placing it`,
        );
        const placedOk = track.overwriteClip(item, p.start);
        placed = placedOk ? findClipNear(track, p.start) : null;
      } catch (e) {
        placed = null;
        placeError = errMsg(e);
      }
      if (!placed) {
        const outcome = rollBack();
        throw new Error(
          `Natural pitch: Premiere rejected placing the audio for piece ${i + 1}${placeError ? ` (${placeError})` : ""}. ${outcome}`,
        );
      }
      try {
        placed.inPoint = secondsToTime(stretchedIn);
        placed.outPoint = secondsToTime(stretchedOut);
        // overwriteClip() starts the clip on the nearest frame, but a sped-up
        // piece usually starts between frames: put it back exactly where the
        // piece was, so it still touches the piece before it.
        if (Math.abs(placed.start.seconds - p.start) > 0.0005) placed.start = secondsToTime(p.start);
        placed.end = secondsToTime(p.end);
      } catch (e) {
        warnings.push(`Piece ${i + 1}: placed, but setting its exact source range failed (${errMsg(e)}).`);
      }
      if (!relinkToVideo(seq, placed, videoIds)) {
        warnings.push(`Piece ${i + 1}: could not link the new audio to its video. J/L Pacing would move this audio without its video.`);
      }
      undoPieces.push(undo);
      undoLinks.push(videoIds);
      undoTail.push(tailFrames);
      undoHead.push(headFrames);
      newClips.push(placed);
      newClipEnds.push(p.end);
      placedNodeIds.push(placed.nodeId);
      placedRenderPaths.push(renderFilePaths[p.renderIndex]);
      newTail.push(tailFrames);
      newHead.push(headFrames);
      replaced++;
    }
  } finally {
    // Shared ProjectItems must not stay narrowed to the last piece's window.
    for (let r = 0; r < items.length; r++) {
      try {
        items[r].setOutPoint(fullOut[r], PROJECT_ITEM_ALL_MEDIA);
        items[r].setInPoint(0, PROJECT_ITEM_ALL_MEDIA);
      } catch (e) {
        // best effort — only affects the default range of a later drag from the bin
      }
    }
  }

  // Each later piece is placed by overwriteClip() on the nearest frame, which
  // can cut the piece before it back to that frame; once the later piece is
  // moved to its exact start, that leaves a gap of up to half a frame. Writing
  // each end again after all pieces are placed closes it.
  for (let i = 0; i < newClips.length; i++) {
    try {
      if (Math.abs(newClips[i].end.seconds - newClipEnds[i]) > 0.0005) newClips[i].end = secondsToTime(newClipEnds[i]);
    } catch (e) {
      // best effort: the gap left is under half a frame
    }
  }

  // 4. J/L fades back on the new clips (only if the originals had them).
  let fadesApplied = 0;
  if (fades && fades.apply && newClips.length > 0) {
    fadesApplied = addNativeEdgeFades(seq, newClips, warnings, newTail, newHead);
  }

  // 5. Select the whole set again (replaced + untouched pieces + linked
  // video), looked up afresh because adding fades can change references.
  clearSelection(seq);
  for (let i = 0; i < plan.pieces.length; i++) {
    const p = plan.pieces[i];
    let c: TrackItem | null = null;
    if (p.trackIndex >= 0 && p.trackIndex < seq.audioTracks.numTracks) c = findClipNear(seq.audioTracks[p.trackIndex], p.start);
    if (!c) c = findAudioClipByNodeId(seq, p.nodeId);
    if (c) {
      try {
        c.setSelected(true, false);
      } catch (e) {
        // best effort
      }
    }
  }
  for (let i = 0; i < videoSel.length; i++) {
    try {
      videoSel[i].setSelected(true, i === videoSel.length - 1);
    } catch (e) {
      // best effort — the video itself is untouched
    }
  }

  if (!fades || !fades.apply) {
    undoTail.length = 0;
    undoHead.length = 0;
  }
  return {
    replaced,
    undoPieces,
    undoTailFadeFrames: undoTail,
    undoHeadFadeFrames: undoHead,
    undoLinkedVideoIds: undoLinks,
    fadesApplied,
    warnings,
    sequenceId: String(seq.sequenceID || ""),
    sequenceName: String(seq.name || ""),
    placedNodeIds,
    placedRenderPaths,
  };
};

/**
 * Revert for Natural pitch: removes the clips Natural pitch placed, then puts
 * each original piece back from `pieces` with the same restore code "Revert to
 * segments" uses. The placed clips are found by `placedNodeIds`; when J/L
 * Pacing or Revert to segments has re-placed them since (`rePlacedSince`: new
 * nodeIds), a render file still used by no more clips than Natural pitch
 * placed from it is taken as its own. When `rePlacedSince` is false, a placed clip that is no longer
 * there was deleted, and every other clip of the file is a copy. A copy the
 * user made of a render is never removed: when it can't be told apart from the
 * placed clips, Revert refuses before anything changes. Deterministic, no Premiere undo
 * stack involved (the replace step's undo-stack footprint is not a known
 * count). Fades are put back on a restored piece when
 * `tailFadeFrames`/`headFadeFrames` are given (aligned 1:1 with `pieces`).
 * Pitch is not handled here: the panel re-runs applyPitchToSelection when the
 * originals had it, as "Revert to segments" does.
 *
 * Refuses, before anything changes, in a sequence other than `sequenceId`,
 * when a piece's audio track is gone or locked (requireRestoreTracks), and
 * when a piece would land on a clip that stays, or reach one while it is
 * briefly at 100% speed (requireFreeRestoreSpans).
 */
export const undoNaturalPitch = (
  renderFilePaths: string[],
  pieces: RenderUndoPiece[],
  tailFadeFrames?: number[],
  headFadeFrames?: number[],
  linkedVideoIds?: string[][],
  sequenceId?: string,
  sequenceName?: string,
  placedNodeIds?: string[],
  placedRenderPaths?: string[],
  rePlacedSince?: boolean,
): UndoNaturalPitchResult => {
  const seq = app.project.activeSequence;
  if (!seq) throw new Error("No active sequence. Open a sequence first.");
  if (sequenceId && String(seq.sequenceID || "") !== sequenceId) {
    throw new Error(
      `Cannot revert: Natural pitch was applied in the sequence "${sequenceName || ""}". Open that sequence, then try again. Nothing was changed.`,
    );
  }
  if (!pieces || pieces.length === 0) throw new Error("No original pieces were recorded for Natural pitch — nothing to restore.");
  const warnings: string[] = [];
  requireRestorableSources(pieces);
  requireRestoreTracks(seq, pieces);

  const targets: string[] = [];
  for (let r = 0; r < renderFilePaths.length; r++) targets.push(String(new File(renderFilePaths[r]).fsName).toLowerCase());
  const mediaPathOf = (c: TrackItem): string => {
    try {
      return c.projectItem && c.projectItem.getMediaPath ? String(c.projectItem.getMediaPath()).toLowerCase() : "";
    } catch (e) {
      return "";
    }
  };
  const ownIds = placedNodeIds || [];
  const ownPaths: string[] = [];
  if (placedRenderPaths) {
    for (let r = 0; r < placedRenderPaths.length; r++) ownPaths.push(String(new File(placedRenderPaths[r]).fsName).toLowerCase());
  }
  const isOwnId = (id: string): boolean => {
    for (let k = 0; k < ownIds.length; k++) if (ownIds[k] === id) return true;
    return false;
  };

  // When placedNodeIds or rePlacedSince isn't passed, any placed clip that
  // can't be found by nodeId may have been re-placed.
  const adoptByCount = !placedNodeIds || rePlacedSince !== false;
  // Every clip playing one of the render files, by file.
  const toRemove: TrackItem[] = [];
  const leftInPlace: string[] = [];
  for (let t = 0; t < targets.length; t++) {
    const clipsOfFile: TrackItem[] = [];
    const owned: TrackItem[] = [];
    for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
      const trk = seq.audioTracks[ai];
      for (let ci = 0; ci < trk.clips.numItems; ci++) {
        const c = trk.clips[ci];
        if (mediaPathOf(c) !== targets[t]) continue;
        clipsOfFile.push(c);
        if (isOwnId(c.nodeId)) owned.push(c);
      }
    }
    let expected = 0;
    for (let k = 0; k < ownPaths.length; k++) if (ownPaths[k] === targets[t]) expected++;
    if (!placedNodeIds) expected = clipsOfFile.length;
    if (owned.length === expected || !adoptByCount) {
      // Placed clips found by identity; any other clip of this file is a copy
      // (when not re-placed since, the missing placed clips were deleted).
      for (let k = 0; k < owned.length; k++) toRemove.push(owned[k]);
      for (let k = 0; k < clipsOfFile.length; k++) {
        if (!isOwnId(clipsOfFile[k].nodeId)) leftInPlace.push(`${clipsOfFile[k].start.seconds.toFixed(2)}s`);
      }
    } else if (clipsOfFile.length <= expected) {
      // Re-placed since (J/L Pacing) or partly deleted, and no extra clip of the file.
      for (let k = 0; k < clipsOfFile.length; k++) toRemove.push(clipsOfFile[k]);
    } else {
      const where: string[] = [];
      for (let k = 0; k < clipsOfFile.length; k++) where.push(`${clipsOfFile[k].start.seconds.toFixed(2)}s`);
      throw new Error(
        `Cannot revert: a Natural pitch render is on the timeline more often than Natural pitch placed it (at ${where.join(
          ", ",
        )}), so Revert can't tell its own clips from your copies. Delete the copies you don't need, then try again. Nothing was changed.`,
      );
    }
  }
  const isPlacedRender = (c: TrackItem): boolean => {
    for (let k = 0; k < toRemove.length; k++) if (toRemove[k].nodeId === c.nodeId) return true;
    return false;
  };
  requireFreeRestoreSpans(seq, pieces, isPlacedRender);

  let clipsRemoved = 0;
  for (let k = 0; k < toRemove.length; k++) {
    try {
      toRemove[k].remove(false, false);
      clipsRemoved++;
    } catch (e) {
      warnings.push(`Removing a natural-pitch clip failed (${errMsg(e)}).`);
    }
  }
  if (leftInPlace.length > 0) {
    warnings.push(
      `${leftInPlace.length} other clip(s) of a Natural pitch render stay on the timeline (at ${leftInPlace.join(
        ", ",
      )}): they aren't the clips Natural pitch placed, so Revert leaves them where they are.`,
    );
  }
  if (clipsRemoved === 0) {
    warnings.push(
      "Could not find the natural-pitch clips on the timeline — they may already have been deleted. Restoring the original pieces anyway.",
    );
  }

  const restored = restoreRenderUndoPieces(seq, pieces, warnings);

  // Link each restored piece to its video again (restoreRenderUndoPieces
  // places a new, unlinked track item).
  if (linkedVideoIds && linkedVideoIds.length === pieces.length) {
    for (let k = 0; k < restored.length; k++) {
      for (let j = 0; j < pieces.length; j++) {
        if (Math.abs(pieces[j].timelineStart - restored[k].start.seconds) < 0.05) {
          if (!relinkToVideo(seq, restored[k], linkedVideoIds[j])) {
            warnings.push(`Restored piece at ${pieces[j].timelineStart.toFixed(2)}s: could not link it to its video again.`);
          }
          break;
        }
      }
    }
  }

  if (tailFadeFrames && headFadeFrames && tailFadeFrames.length === pieces.length && restored.length > 0) {
    const tail: number[] = [];
    const head: number[] = [];
    for (let k = 0; k < restored.length; k++) {
      let match = -1;
      for (let j = 0; j < pieces.length; j++) {
        if (Math.abs(pieces[j].timelineStart - restored[k].start.seconds) < 0.05) {
          match = j;
          break;
        }
      }
      tail.push(match >= 0 ? tailFadeFrames[match] : JL_CUT_FADE_FRAMES);
      head.push(match >= 0 ? headFadeFrames[match] : JL_CUT_FADE_FRAMES);
    }
    addNativeEdgeFades(seq, restored, warnings, tail, head);
  }

  clearSelection(seq);
  for (let k = 0; k < pieces.length; k++) {
    const p = pieces[k];
    if (p.trackIndex < 0 || p.trackIndex >= seq.audioTracks.numTracks) continue;
    const c = findClipNear(seq.audioTracks[p.trackIndex], p.timelineStart);
    if (c) {
      try {
        c.setSelected(true, false);
      } catch (e) {
        // best effort
      }
    }
  }
  if (linkedVideoIds) {
    for (let j = 0; j < linkedVideoIds.length; j++) {
      const ids = linkedVideoIds[j] || [];
      for (let k = 0; k < ids.length; k++) {
        for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
          const v = findClipByNodeId(seq.videoTracks[vi], ids[k]);
          if (v) {
            try {
              v.setSelected(true, false);
            } catch (e) {
              // best effort
            }
            break;
          }
        }
      }
    }
  }

  return { piecesRestored: restored.length, clipsRemoved, warnings };
};

/** Deletes every file/subfolder inside `folder`, then the (now-empty)
 *  folder itself — Folder.remove() only works on already-empty folders,
 *  there's no built-in recursive delete. Best-effort per item: a locked or
 *  in-use file shouldn't abort clearing the rest. */
const deleteFolderRecursive = (folder: Folder): void => {
  if (!folder.exists) return;
  const items = folder.getFiles() || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (item instanceof Folder) {
        deleteFolderRecursive(item);
      } else {
        item.remove();
      }
    } catch (e) {
      // best effort — leave it, still try the rest
    }
  }
  try {
    folder.remove();
  } catch (e) {
    // non-empty (something above failed to delete) or locked — leave it
  }
};

export interface ClearDataResult {
  cleared: boolean;
  path: string;
}

/** Deletes the whole "AI Voice Master Tool" folder in Documents: Renders,
 *  Generated, VoiceChanger, Bridge (including any pending manifest.json) and
 *  Diagnostics. Output saved next to the project is not touched. Each writer
 *  recreates its subfolder on demand; timeline clips that play a deleted file
 *  go offline (the panel warns before calling this). `cleared` is only true
 *  if the folder is really gone afterward; a locked file that stays behind
 *  is reported, not claimed as a full success. */
export const clearAllData = (): ClearDataResult => {
  const baseFolder = new Folder(Folder.myDocuments.fsName + "/AI Voice Master Tool");
  deleteFolderRecursive(baseFolder);
  return { cleared: !baseFolder.exists, path: baseFolder.fsName };
};

// =========================
// Diagnostics: writes a troubleshooting report (effect lookups, sequence
// settings, trailing-space and A/V sync checks, CTI, the selection's effects).
// Raw qe/DOM API listings, for checking undocumented methods such as
// setSpeed/addAudioEffect on a given Premiere version, are behind
// INCLUDE_API_SURFACE_DUMPS.
// =========================

/**
 * Reads and prints current values for named properties: .reflect (see
 * dumpReflect below) only lists property *names*, never values, so this is the
 * only way to see e.g. what SequenceSettings.audioChannelType is set to (to
 * check the Mono/Stereo values ensureSequenceStereo uses).
 */
const dumpValues = (label: string, obj: any, keys: string[]): string => {
  let out = `--- ${label} (current values) ---\n`;
  if (!obj) return out + "<null/undefined>\n\n";
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    try {
      out += `${k} = ${obj[k]}\n`;
    } catch (e) {
      out += `${k} = <error: ${errMsg(e)}>\n`;
    }
  }
  return out + "\n";
};

/** Dumps every component (effect) on a clip and every one of its
 *  parameters' actual display name + current value — the only way to
 *  learn a real effect's exact parameter names (e.g. kHs Pitch Shifter's
 *  "Compensation"/"Grain Size" controls) instead of guessing them. */
const dumpClipEffects = (label: string, clip: any): string => {
  let out = `--- ${label}: effects ---\n`;
  try {
    const components = clip.components;
    if (!components || !components.numItems) return out + "(no effects on this clip)\n\n";
    for (let i = 0; i < components.numItems; i++) {
      const comp = components[i];
      out += `[${i}] "${comp.displayName}"\n`;
      try {
        const props = comp.properties;
        // Some effects (e.g. kHs Pitch Shifter) expose a hundred+ identically named
        // parameters (MIDI CC slots). Collapse consecutive same-named entries into one
        // line with a repeat count, so the report isn't truncated before later clips.
        let lastName: string | null = null;
        let repeatCount = 0;
        for (let p = 0; p < props.numItems; p++) {
          const param = props[p];
          const name = String(param.displayName);
          if (name === lastName) {
            repeatCount++;
            continue;
          }
          if (lastName !== null && repeatCount > 1) {
            out += `    ("${lastName}" repeated ${repeatCount - 1} more time(s), skipped)\n`;
          }
          lastName = name;
          repeatCount = 1;
          let value = "<unreadable>";
          try {
            value = param.getValue();
          } catch (e) {
            value = `<error: ${errMsg(e)}>`;
          }
          // getValue() (no time argument) may resolve against the current playhead
          // position rather than a clip-wide constant; ComponentParam exposes
          // isTimeVarying()/getValueAtTime() for exactly this. Logged so a read that
          // disagrees with the Clip Fx Editor can be checked for a keyframed,
          // time-varying parameter.
          let timeVarying = "<unreadable>";
          let valueAtKeys = "";
          try {
            timeVarying = String(param.isTimeVarying());
            if (param.isTimeVarying()) {
              // getValueAtTime() takes no time argument in this DOM (the same playhead
              // ambiguity), so getValueAtKey(time) is used to ask what value the parameter
              // has at a specific moment, sampled at the clip's start and end.
              try {
                const atStart = clip.start ? param.getValueAtKey(clip.start) : "<no clip.start>";
                const atEnd = clip.end ? param.getValueAtKey(clip.end) : "<no clip.end>";
                valueAtKeys = ` atClipStart=${atStart} atClipEnd=${atEnd}`;
              } catch (e) {
                valueAtKeys = ` atClipStart/End=<error: ${errMsg(e)}>`;
              }
            }
          } catch (e) {
            timeVarying = `<error: ${errMsg(e)}>`;
          }
          out += `    "${name}" = ${value} [isTimeVarying=${timeVarying}]${valueAtKeys}\n`;
        }
        if (lastName !== null && repeatCount > 1) {
          out += `    ("${lastName}" repeated ${repeatCount - 1} more time(s), skipped)\n`;
        }
      } catch (e) {
        out += `    <error reading properties: ${errMsg(e)}>\n`;
      }
    }
  } catch (e) {
    out += `<error: ${errMsg(e)}>\n`;
  }
  return out + "\n";
};

const dumpReflect = (label: string, obj: any): string => {
  if (!obj) return `--- ${label} ---\n<null/undefined>\n\n`;
  let out = `--- ${label} ---\n`;
  try {
    if (obj.reflect) {
      const props: any[] = [];
      const methods: any[] = [];
      const propList = obj.reflect.properties;
      const methodList = obj.reflect.methods;
      for (let i = 0; i < propList.length; i++) props.push(propList[i].name);
      for (let i = 0; i < methodList.length; i++) methods.push(methodList[i].name);
      out += `properties (${props.length}): ${props.join(", ")}\n`;
      out += `methods (${methods.length}): ${methods.join(", ")}\n`;
    } else {
      // Fallback for plain/QE objects without .reflect: enumerate own keys.
      const keys: string[] = [];
      for (const k in obj) {
        keys.push(k);
      }
      out += keys.length ? `keys (${keys.length}): ${keys.join(", ")}\n` : "(no .reflect and no enumerable keys)\n";
    }
  } catch (e) {
    out += `<error reading: ${errMsg(e)}>\n`;
  }
  return out + "\n";
};

// The property/method listings of Premiere's API objects (qe, qe.project, the
// active sequence, a track item, app.encoder, ...) are for exploring an
// undocumented API: long, identical on every run, and unrelated to the problem
// being reported. Off for shipped builds; set to true for an API
// investigation. Everything that actually diagnoses something (effect lookups,
// trailing-space and A/V sync checks, CTI, selection, per-clip effects,
// sequence settings values) is unaffected.
const INCLUDE_API_SURFACE_DUMPS = false;

/**
 * `jsInfo`, if given, is the panel's JS-side state (Scan/Cut/Speed/Pitch/
 * Render/Send results, Whisper's load state, the session log). This function
 * runs in ExtendScript and can't see any of that, so main.tsx builds it and
 * passes it through to be folded into the same report. Optional for callers
 * without that context.
 */
export const runDiagnostics = (jsInfo?: string): { path: string } => {
  let log = "AI Voice Master Tool — Diagnostics\n" + new Date().toString() + "\n\n";
  if (jsInfo) log += jsInfo + "\n\n";

  if (typeof qe === "undefined") app.enableQE();

  if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe", qe);
  if (qe) {
    if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe.project", qe.project);
    const qeSeq = qe.project.getActiveSequence();
    if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe.project.getActiveSequence()", qeSeq);
    if (qeSeq) {
      const vTrack = qeSeq.getVideoTrackAt(0);
      if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe videoTrack[0]", vTrack);
      if (vTrack && vTrack.numItems > 0) {
        if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe videoTrack[0].getItemAt(0)", vTrack.getItemAt(0));
      }
      const aTrack = qeSeq.getAudioTrackAt(0);
      if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe audioTrack[0]", aTrack);
      if (aTrack && aTrack.numItems > 0) {
        if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("qe audioTrack[0].getItemAt(0)", aTrack.getItemAt(0));
      }
    }
    // Whether Premiere can find each of the two "Pitch Shifter" effects: its
    // own, the one Pitch restores after a rebuild, and kHs Pitch Shifter, the
    // third-party plug-in the Pacing tab's Calculator recommends for manual
    // pitch correction. Pitch code tells them apart by exact name (see
    // isPremierePitchShifterName), so a report shows which ones are installed.
    try {
      const pitchEffect = qe.project.getAudioEffectByName("Pitch Shifter");
      log += `qe.project.getAudioEffectByName("Pitch Shifter") -> ${pitchEffect ? "FOUND" : "null"}\n\n`;
    } catch (e) {
      log += `qe.project.getAudioEffectByName("Pitch Shifter") -> threw: ${errMsg(e)}\n\n`;
    }
    try {
      const khs = qe.project.getAudioEffectByName("kHs Pitch Shifter");
      log += `qe.project.getAudioEffectByName("kHs Pitch Shifter") -> ${khs ? "FOUND" : "null"}\n\n`;
    } catch (e) {
      log += `qe.project.getAudioEffectByName("kHs Pitch Shifter") -> threw: ${errMsg(e)}\n\n`;
    }
  }

  const seq = app.project.activeSequence;
  if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("app.project.activeSequence", seq);
  if (seq) {
    const settings = seq.getSettings();
    if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("app.project.activeSequence.getSettings()", settings);
    log += dumpValues("app.project.activeSequence.getSettings()", settings, [
      "audioChannelType",
      "audioChannelCount",
      "audioSampleRate",
      "videoFrameRate",
    ]);
    // Lists seq.end and each track's last clip, plus QE's view of each track's
    // tail. QE reports a trailing "Empty" item on every track, empty ones
    // included: a placeholder for "no content past this point", not a clip.
    try {
      const seqEnd: any = (seq as any).end;
      const seqEndSeconds = seqEnd && typeof seqEnd.seconds === "number" ? seqEnd.seconds : seqEnd;
      log += `--- trailing-space check ---\nseq.end = ${seqEndSeconds}\n`;

      const dumpTrackTail = (track: Track, label: string) => {
        const n = track.clips.numItems;
        if (n === 0) {
          log += `${label}: no clips\n`;
          return;
        }
        const last = track.clips[n - 1];
        log += `${label}: ${n} clip(s), last = "${last.name}" end=${last.end.seconds}s\n`;
      };
      for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) dumpTrackTail(seq.videoTracks[vi], `video track ${vi}`);
      for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) dumpTrackTail(seq.audioTracks[ai], `audio track ${ai}`);

      if (qe) {
        const qeSeqForTail = qe.project.getActiveSequence();
        const dumpQeTrackTail = (qeTrack: any, label: string) => {
          if (!qeTrack || qeTrack.numItems === 0) {
            log += `${label} (QE): no items\n`;
            return;
          }
          const last = qeTrack.getItemAt(qeTrack.numItems - 1);
          log += `${label} (QE): ${qeTrack.numItems} item(s), last type="${last ? last.type : "?"}" start=${
            last && last.start ? last.start.secs : "?"
          }\n`;
        };
        if (qeSeqForTail) {
          for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
            dumpQeTrackTail(qeSeqForTail.getVideoTrackAt(vi), `video track ${vi}`);
          }
          for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
            dumpQeTrackTail(qeSeqForTail.getAudioTrackAt(ai), `audio track ${ai}`);
          }
        }
      }
      log += "\n";
    } catch (e) {
      log += `trailing-space check failed: ${errMsg(e)}\n\n`;
    }

    // A/V sync check. Premiere's "linked clips out of sync" badge (a small red
    // offset readout on the clip) means a video TrackItem and its paired audio show
    // different moments of the shared source; this computes the same thing
    // directly, so a mismatch shows up in the Diagnostics report without spotting
    // it on the timeline.
    //
    // For a TrackItem, `start - inPoint` is the timeline offset that converts
    // timeline time into that clip's source-media time; two clips truly in sync
    // (same original recording) have the IDENTICAL offset. Pairs are matched by
    // shared ProjectItem + closest timeline position, the same approach
    // applyJLCutSmoothing's pairing uses, not getLinkedItems() alone ("Unlink"
    // changes only Premiere's selection bookkeeping, not the shared media this
    // depends on).
    try {
      log += `--- linked audio/video sync-offset check ---\n`;
      let fps = 25;
      try {
        const vfr = seq.getSettings().videoFrameRate;
        if (vfr && typeof vfr.seconds === "number" && vfr.seconds > 0) fps = 1 / vfr.seconds;
      } catch (e) {
        // leave the fallback in place
      }
      const syncTol = 0.5 / fps;
      // Clips shorter than three frames are ignored when matching: the
      // shared-ProjectItem side effect can leave ~1-frame slivers right next to a
      // real piece, often with the same nodeId, and a sliver marginally closer in
      // position would produce a spurious, perfectly reproducible "1 frame off"
      // report. Same kind of duration floor findClipNear uses.
      const minRealDuration = 3 / fps;
      let foundAny = false;
      for (let vi = 0; vi < seq.videoTracks.numTracks; vi++) {
        const vTrack = seq.videoTracks[vi];
        for (let ci = 0; ci < vTrack.clips.numItems; ci++) {
          const vClip = vTrack.clips[ci];
          if (!vClip.projectItem) continue;
          if (vClip.end.seconds - vClip.start.seconds < minRealDuration) continue;
          let bestAudio: TrackItem | null = null;
          let bestDist = Infinity;
          for (let ai = 0; ai < seq.audioTracks.numTracks; ai++) {
            const aTrack = seq.audioTracks[ai];
            for (let acIdx = 0; acIdx < aTrack.clips.numItems; acIdx++) {
              const aClip = aTrack.clips[acIdx];
              if (!aClip.projectItem || aClip.projectItem.nodeId !== vClip.projectItem.nodeId) continue;
              if (aClip.end.seconds - aClip.start.seconds < minRealDuration) continue;
              const dist = Math.abs(aClip.start.seconds - vClip.start.seconds);
              if (dist < bestDist) {
                bestDist = dist;
                bestAudio = aClip;
              }
            }
          }
          // 2s is a heuristic, not a precise bound — just enough to reject
          // matching this video clip against some unrelated, far-away
          // placement of the same source file elsewhere in the sequence.
          if (!bestAudio || bestDist > 2) continue;
          const videoOffset = vClip.start.seconds - vClip.inPoint.seconds;
          const audioOffset = bestAudio.start.seconds - bestAudio.inPoint.seconds;
          const syncDelta = videoOffset - audioOffset;
          if (Math.abs(syncDelta) > syncTol) {
            foundAny = true;
            log += `"${vClip.name}": video @ ${vClip.start.seconds.toFixed(3)}s vs its matched audio @ ${bestAudio.start.seconds.toFixed(
              3,
            )}s — source alignment differs by ${(syncDelta * fps).toFixed(2)} frame(s) (raw ${syncDelta.toFixed(4)}s).\n`;
          }
        }
      }
      if (!foundAny) log += "No sync offset beyond half a frame found on any matched audio/video pair.\n";
      log += "\n";
    } catch (e) {
      log += `sync-offset check failed: ${errMsg(e)}\n\n`;
    }

    // Together with dumpClipEffects' isTimeVarying/getValueAtKey readings: a
    // plain getValue() on a time-varying parameter depends on the playhead, so
    // the playhead (CTI) is logged here, before the per-clip effect dumps below.
    try {
      if (qe) {
        const qeSeqForCti = qe.project.getActiveSequence();
        const cti: any = qeSeqForCti && qeSeqForCti.CTI;
        log += `qe.project.getActiveSequence().CTI = ${cti && typeof cti.secs === "number" ? cti.secs : cti}\n\n`;
      }
    } catch (e) {
      log += `qe.project.getActiveSequence().CTI -> threw: ${errMsg(e)}\n\n`;
    }

    const sel = seq.getSelection();
    log += `seq.getSelection().length = ${sel ? sel.length : 0}\n\n`;
    if (sel && sel.length > 0) {
      if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("selected TrackItem", sel[0]);
      if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("selected TrackItem.components", sel[0].components);
      // Real parameter names for every effect on the clip: the only reliable way to
      // learn a third-party effect's exact control names, which aren't documented
      // anywhere this extension can read. Capped to the first 3 clips: a
      // multi-select Apply almost always sets the same effect and values on every
      // clip, so dumping all of them only repeats the same information.
      const effectsDumpCount = Math.min(sel.length, 3);
      for (let i = 0; i < effectsDumpCount; i++) {
        // start/end included specifically to cross-check against the CTI
        // logged above — see dumpClipEffects's own isTimeVarying comment.
        const clipStart = sel[i].start && typeof sel[i].start.seconds === "number" ? sel[i].start.seconds : "?";
        const clipEnd = sel[i].end && typeof sel[i].end.seconds === "number" ? sel[i].end.seconds : "?";
        log += dumpClipEffects(`selected clip [${i}] ("${sel[i].name}", start=${clipStart} end=${clipEnd})`, sel[i]);
      }
      if (sel.length > effectsDumpCount) {
        log += `(${sel.length - effectsDumpCount} more selected clip(s) not dumped — see above, they're almost always identical)\n\n`;
      }
    }
  }
  if (INCLUDE_API_SURFACE_DUMPS) log += dumpReflect("app.encoder", (app as any).encoder);

  // Folder.myDocuments is ExtendScript's built-in portable "Documents"
  // reference — resolves correctly on both macOS and Windows without any
  // OS-specific path handling. The filename includes an exact timestamp so
  // running Diagnostics more than once doesn't silently overwrite (or fail
  // to visibly update) the previous dump — each run gets its own file.
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
  const logFile = new File(getSubFolder("Diagnostics").fsName + "/ai-voice-master-tool-diagnostics-" + stamp + ".txt");
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
