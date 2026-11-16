// Mirrors the return/arg shapes exported from src/jsx/ppro/ppro.ts and
// src/jsx/aeft/aeft.ts. Duplicated (not imported) because tsconfig-build.json
// points the "@esTypes/*" alias at a loose placeholder type for the actual
// build pass — see src/js/lib/cep/es-types/index.ts — so evalTS() itself is
// effectively untyped there. Keep these in sync with the ExtendScript side's
// exported interfaces.

export interface ClipInfo {
  trackType: "video" | "audio";
  trackIndex: number;
  clipName: string;
  mediaPath: string;
  /** The clip's Premiere nodeId at read time — used to verify the selection
   *  hasn't changed across an async gap before mutating the timeline. */
  nodeId: string;
  sequenceName: string;
  sequenceFps: number;
  sourceFps: number;
  fpsMismatch: boolean;
  /** The selected clip's own trim range into the source media, in seconds —
   *  scanAudioFile must be called with this range so Scan only analyzes what
   *  the timeline clip actually plays, not the whole underlying file. */
  sourceInPoint: number;
  sourceOutPoint: number;
  /** The clip's own Speed factor at read time (1 = 100%) — used to warn if
   *  it's changed since Scan (main.tsx's scannedClipInfo/clipInfo compare). */
  speedFactor: number;
  /** See ppro.ts: other audio channels linked to this clip; Scan and Cut refuse it. */
  otherLinkedAudioTracks?: number[];
}

export interface CutSegment {
  start: number;
  end: number;
  /** See analyze.ts's identical Segment.confidence — kept in sync per this
   *  file's own header comment. */
  confidence?: number;
}

export interface CutResult {
  segmentsCut: number;
  /**
   * See ppro.ts's CutResult: normally false (cutClipViaRazor never clears the
   * track), but the real value is passed through.
   */
  stereoForced: boolean;
  warnings: string[];
  /** Pass straight to evalTS("undoCutViaRazor", undoInfo) for Undo — a
   *  deterministic from-scratch rebuild, not a Premiere undo-stack rewind
   *  (see ppro.ts's CutResult.undoInfo). Null means Undo isn't offered for
   *  this Cut (building it failed). */
  undoInfo: CutUndoInfo | null;
}

/** See ppro.ts's identical interface. */
export interface CutUndoInfo {
  trackIndex: number;
  videoTrackIndex: number | null;
  timelineStart: number;
  originalDuration: number;
  sourceInPoint: number;
  mediaPath: string;
  /** The clip's own Speed factor at Cut time (1 = 100%) — see ppro.ts's
   *  own CutUndoInfo/undoCutViaRazor for why this is restored on Undo too. */
  speedFactor: number;
  /** nodeId of the clip's own ProjectItem, so Undo and Speed find it inside a bin. */
  projectItemNodeId?: string;
  /** The Cut's sequence, so Undo and the Speed rebuild refuse another sequence. */
  sequenceId?: string;
  sequenceName?: string;
}

export interface ApplySpeedResult {
  clipsProcessed: number;
  warnings: string[];
  /**
   * Per-clip diagnostic line (speedFactor sent, duration before and after,
   * getSpeed() read back after setSpeed()). Not shown in the result banner, but
   * part of the Diagnostics report (main.tsx's buildJsDiagnosticsSummary
   * JSON-stringifies the whole result).
   */
  debugInfo: string[];
}

export interface ApplyPitchResult {
  clipsProcessed: number;
  /** Subset of clipsProcessed that were left alone because that specific
   *  clip's own current speed was already ~100% — nothing to correct. */
  skippedNoSpeedChange: number;
  /** Per-clip diagnostic line (getSpeed() reading, computed semitones,
   *  computed Transpose Ratio) — see ApplySpeedResult.debugInfo's comment. */
  debugInfo: string[];
  warnings: string[];
  stereoForced: boolean;
}

/**
 * Mirrors ppro.ts's getSelectedClipsSpeed: a pure read (no effects touched,
 * nothing applied) used by the Pacing tab's Calculator pitch-correction mode to
 * show the real speed of the current selection, not only what the Speed %
 * field contains.
 */
export interface SelectedClipsSpeedInfo {
  /** One entry per selected clip, in Premiere's own selection order —
   *  percent, e.g. 120 for 120% speed, matching the Speed % field's units. */
  speeds: number[];
  /**
   * True if the selection has more than one distinct real speed; Calculator mode
   * can't show a single semitones value then.
   */
  mixed: boolean;
}

export interface SendToAEResult {
  /**
   * How the audio is sent. Video is always sent separately (see
   * `videoItemCount`). sendToAfterEffects produces only "segments" (it refuses
   * on Pitch or any other unsupported effect instead of rendering);
   * "rendered" stays in the union for the Bridge panel's display. A Pitch
   * render is baked into a real timeline clip by renderFullTimelineForAE +
   * placeFullTimelineRender, which the "segments" path then picks up like any
   * other clip.
   */
  audioMode: "segments" | "rendered";
  itemCount: number;
  /**
   * 0 when the selection has no linked video, or when the video is the same
   * source file as the audio (counted in `itemCount` as one linked piece).
   * Nonzero only when video needs its own placement (a different source
   * file). Video is always sent by position/speed reconstruction, never
   * rendered.
   */
  videoItemCount: number;
  /** Never set: sendToAfterEffects writes only "segments" manifests (see
   *  audioMode above). Kept so this type matches ppro.ts's SendToAEResult;
   *  nothing on the JS side reads it. */
  filePaths?: string[];
  /**
   * The absolute path this manifest was written to (always Documents, whatever
   * the "Next to project" setting). aeft.ts's PendingManifestInfo.manifestPath
   * reports the same field from After Effects' side, so the two can be compared
   * when the Bridge panel seems to show stale information.
   */
  manifestPath: string;
  /**
   * Cross-check of each segment's reconstructed against its real Premiere
   * timeline duration, reported when they disagree (see ppro.ts's field of the
   * same name).
   */
  warnings: string[];
}

/** Mirrors ppro.ts's RenderUndoPiece — see that interface's own comment.
 *  Everything undoFullTimelineRender needs to restore one audio piece
 *  placeFullTimelineRender is about to remove. */
export interface RenderUndoPiece {
  /** See ppro.ts: whether the piece had Pitch Shifter when it was rendered. */
  hadPitch?: boolean;
  trackIndex: number;
  timelineStart: number;
  originalDuration: number;
  sourceInPoint: number;
  mediaPath: string;
  speedFactor: number;
  /** nodeId of the piece's own ProjectItem, so a revert finds it inside a bin. */
  projectItemNodeId?: string;
}

/** Mirrors ppro.ts's renderFullTimelineForAE — the render half of the Pacing
 *  tab's "Render full timeline for AE" flow. Only queues/exports; the JS
 *  side waits on `filePath` via waitForFileStable before calling
 *  placeFullTimelineRender with this same result's own fields. */
export interface FullTimelineRenderResult {
  filePath: string;
  firstAudioStart: number;
  audioNodeIds: string[];
  /** Timeline start/end of each piece in `audioNodeIds`, same order, so
   *  placeFullTimelineRender refuses when one was moved or trimmed. */
  audioSpans: { start: number; end: number }[];
  /** See RenderUndoPiece / undoFullTimelineRender — captured before
   *  placeFullTimelineRender removes anything, kept around by main.tsx so a
   *  later "Revert to segments" click has what it needs. */
  pieces: RenderUndoPiece[];
  /** The sequence rendered from, so "Revert to segments" refuses to work in a
   *  different one. */
  sequenceId: string;
  sequenceName: string;
  /** Which engine wrote the file: Premiere itself, or Adobe Media Encoder's
   *  queue as the fallback (see ppro.ts's encodeWorkAreaToWav). */
  renderedBy: "premiere" | "media-encoder";
}

/** Mirrors ppro.ts's placeFullTimelineRender — replaces the original
 *  Pitch-affected pieces with the rendered file directly on the Premiere
 *  timeline, so the change is visible there before Send to AE picks it up. */
export interface PlaceFullTimelineRenderResult {
  clipsRemoved: number;
  placedAtSeconds: number;
  /** nodeId of the placed clip ("" if not found); Revert removes only it. */
  placedNodeId: string;
  warnings: string[];
}

/** Mirrors ppro.ts's undoFullTimelineRender — the "Revert to segments"
 *  button's result: removes the one baked clip and restores every original
 *  audio piece from its own captured RenderUndoPiece. */
export interface UndoFullTimelineRenderResult {
  piecesRestored: number;
  warnings: string[];
}

export interface ClearDataResult {
  cleared: boolean;
  path: string;
}

/**
 * Mirrors ppro.ts's importAudioAndPlaceOnTimeline. Voice generation itself
 * (ElevenLabs SDK / Kokoro ONNX inference) runs on the JS side (see
 * elevenlabs.ts's GenerateVoiceResult) and never goes through ExtendScript;
 * only the resulting file path crosses over, into this function.
 */
export interface ImportAudioResult {
  imported: boolean;
  trackIndex: number;
  placedAtSeconds: number;
  mutedInsteadOfRemoved: boolean;
  undoSteps: number;
  warnings: string[];
  /** See ppro.ts's ImportAudioResult: what undoGeneratedPlacement needs. */
  placedNodeId: string;
  filePath: string;
  mutedOriginalNodeId: string;
  removedOriginal: boolean;
  /** The sequence placed into; Undo refuses in any other sequence. */
  sequenceId: string;
  sequenceName: string;
}

/** Mirrors ppro.ts's importAudioAndPlaceSequentially — Batch generation's
 *  placement step. `imported` is a count here (unlike ImportAudioResult's
 *  boolean), so this needs its own result state/banner on the JS side, not
 *  a reuse of genResult/handleUndoGenerate. */
export interface BatchImportResult {
  imported: number;
  undoSteps: number;
  warnings: string[];
  placedNodeIds: string[];
  placedFilePaths: string[];
  /** The sequence placed into; Undo refuses in any other sequence. */
  sequenceId: string;
  sequenceName: string;
}

/** Mirrors ppro.ts's undoGeneratedPlacement. */
export interface UndoGeneratedResult {
  removed: number;
  unmuted: boolean;
  /** Placed clips still on the timeline after the attempt; the panel keeps
   *  its Undo record while this is above zero. */
  remaining: number;
  warnings: string[];
}

/** Mirrors ppro.ts's getSelectedCutPieceInfo — a pure read (no timeline
 *  mutation) of the current selection's audio pieces, sorted left-to-right
 *  by position, each already converted to a SOURCE-relative {start, end}
 *  pair (true source time recovered from a Speed-scaled TrackItem) plus its
 *  own source media path. handleSmoothCuts feeds this straight into
 *  computeJLCutOverlaps — no matching against lastCutSegments needed, this
 *  is correct whether a piece is untouched, trimmed, or part of a smaller
 *  (some pieces deleted) selection; `mediaPath` lets it sanity-check every
 *  piece actually belongs to the file that was Cut. */
export type SelectedCutPieceInfo = { start: number; end: number; mediaPath: string }[];

/**
 * Mirrors ppro.ts's applyJLCutSmoothing (J/L Pacing, the follow-up step after
 * Cut). Called with the overlapsSec array lib/analyze.ts's
 * computeJLCutOverlaps worked out from the same scan's RMS data; see both.
 */
export interface JLCutResult {
  clipsProcessed: number;
  overlapsApplied: number;
  fadesApplied: number;
  warnings: string[];
  undoSteps: number;
}

// --- aeft.ts (the After Effects bridge panel) ---

export interface PendingManifestInfo {
  exists: boolean;
  createdAt?: string;
  audioMode?: "segments" | "rendered";
  itemCount?: number;
  /** 0 when the last sent manifest had no linked video at all — see
   *  SendToAEResult's own identical field. */
  videoItemCount?: number;
  sequenceName?: string;
  /**
   * Source media file name (segments mode only), shown in the bridge panel next
   * to sequenceName/createdAt so the user can check that it matches the last
   * thing sent from Premiere.
   */
  mediaFileName?: string;
  /**
   * The absolute path this After Effects engine reads, always present whatever
   * `exists` says (see ppro.ts's SendToAEResult).
   */
  manifestPath: string;
  /** The manifest file's own reported last-modified time, only present when
   *  it exists — compare against when Send to AE was actually last clicked
   *  in Premiere to tell a genuinely stale read apart from a JS-side
   *  display bug. */
  manifestModifiedAt?: string;
  /** Raw byte size at read time — a second signal alongside
   *  manifestModifiedAt. */
  manifestSizeBytes?: number;
}

export interface PlaceResult {
  placed: number;
  /** 0 when the placed manifest had no linked video at all. */
  videoPlaced: number;
  audioMode: "segments" | "rendered";
  warnings: string[];
  /**
   * AE layer indices to hand to evalTS("repositionStretchedLayers", ...) as a
   * separate call; see aeft.ts's placeSegmentsReconstruction for why.
   */
  stretchedLayerIndices: number[];
}

/** See ppro.ts's NaturalPitchPiece/NaturalPitchRender/NaturalPitchPlan. */
export interface NaturalPitchPiece {
  nodeId: string;
  /** nodeId of the piece's own ProjectItem, so a revert finds it inside a bin. */
  projectItemNodeId: string;
  trackIndex: number;
  start: number;
  end: number;
  mediaPath: string;
  speedFactor: number;
  sourceIn: number;
  sourceEnd: number;
  renderIndex: number;
  hadPitch: boolean;
  otherEffect: string;
}

export interface NaturalPitchRender {
  mediaPath: string;
  speedFactor: number;
  rangeStart: number;
  rangeEnd: number;
  outPath: string;
}

export interface NaturalPitchPlan {
  pieces: NaturalPitchPiece[];
  renders: NaturalPitchRender[];
  skippedNoSpeedChange: number;
}

export interface NaturalPitchFades {
  apply: boolean;
  tailFadeFrames?: number[];
  headFadeFrames?: number[];
}

export interface PlaceNaturalPitchResult {
  replaced: number;
  undoPieces: RenderUndoPiece[];
  undoTailFadeFrames: number[];
  undoHeadFadeFrames: number[];
  undoLinkedVideoIds: string[][];
  fadesApplied: number;
  warnings: string[];
  /** The sequence the pieces were replaced in, so Revert refuses to work in a
   *  different one. */
  sequenceId: string;
  sequenceName: string;
  /** See ppro.ts's PlaceNaturalPitchResult: the placed clips and their render files. */
  placedNodeIds: string[];
  placedRenderPaths: string[];
}

export interface UndoNaturalPitchResult {
  piecesRestored: number;
  clipsRemoved: number;
  warnings: string[];
}

/** See ppro.ts's identical interface (getSelectionEffectSummary and friends). */
export interface RebuildEffectSummary {
  effects: string[];
  nonPitchEffects: string[];
  audioClips: number;
  audioClipsWithPitch: number;
}
