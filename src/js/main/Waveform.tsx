import { useEffect, useRef, useState } from "react";
import type { MouseEventHandler } from "react";
import { tr } from "../lib/i18n";

// Small hand-drawn monochrome toolbar icons in the visual language of the
// After Effects toolbar. Inline SVG rather than an icon font or library:
// identical rendering on macOS and Windows, no extra dependency to vet, no
// font fallback for an unusual glyph. All use `currentColor`, so they inherit
// the button's hover/active colour.
const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <polygon points="4,2.5 13.5,8 4,13.5" fill="currentColor" />
  </svg>
);
const IconPause = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3" height="11" fill="currentColor" />
    <rect x="9.5" y="2.5" width="3" height="11" fill="currentColor" />
  </svg>
);
const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 6.5h6.5a4 4 0 1 1 -3.8 5.3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <polygon points="2,3.5 2,8.5 6.5,6" fill="currentColor" />
  </svg>
);
/**
 * Selection-cursor arrow in the style of Premiere/AE's Selection Tool icon,
 * used for "Seek mode" (move the playhead): this shape reads as "a cursor you
 * drag", which is what seek mode is.
 */
const IconSeek = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 2 L3 13.5 L6 10.8 L8 14.3 L9.7 13.4 L7.7 9.9 L11.2 9.7 Z" fill="currentColor" />
  </svg>
);
/**
 * Razor blade in the style of Premiere's Razor Tool icon, used for "Edit
 * mode" (click a region to toggle keep/cut): a cutting tool's icon reads as
 * "this button cuts/toggles".
 */
const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 13 L11.5 1.8 L13.8 3.5 L5.3 14.7 Z" fill="currentColor" />
  </svg>
);
const IconFit = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M2 5.5V2h3.5M14 5.5V2h-3.5M2 10.5V14h3.5M14 10.5V14h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export interface Region {
  start: number;
  end: number;
  keep: boolean;
  /** See analyze.ts's Segment.confidence — 0-1, undefined for regions with
   *  no LLR-derived score (manual overrides, Advanced-mode segments, cut
   *  gaps). Drives the low-confidence marker in the draw effect below. */
  confidence?: number;
}

interface WaveformProps {
  rmsValues: number[];
  durationSec: number;
  regions: Region[];
  onToggleRegion: (index: number) => void;
  /** Undoes the most recent preview edit (a region toggle, boundary drag or
   *  range selection) — main.tsx keeps the history stack, this just triggers
   *  a pop. `canUndoToggle` disables the button once the stack is empty. Pure
   *  preview-state undo (see main.tsx's toggleHistory comment) — unrelated to
   *  Premiere's own undo stack, nothing here ever touches the timeline. */
  onUndoToggle: () => void;
  canUndoToggle: boolean;
  /** file:// URL pointing straight at the scanned clip's own source media
   *  (see main.tsx's ensurePreviewAudio), or null before the first Play
   *  press / after a rescan clears it. */
  audioUrl: string | null;
  audioError: string | null;
  /** Lazily resolves the preview audio URL (main.tsx's ensurePreviewAudio)
   *  — called on Play when nothing's loaded yet, and on a seek click (the
   *  waveform in Seek mode, or the scrubber strip) before any audio URL
   *  exists. */
  onRequestAudio: () => Promise<string | null>;
  /** Seconds into `audioUrl`'s own file where THIS waveform's own t=0 sits
   *  (scannedClipInfo.sourceInPoint) — `audioUrl` points at the whole
   *  original source file, not just the scanned/trimmed range, so every
   *  read/write of the audio element's own `currentTime` needs this offset
   *  to convert to/from the waveform's own 0-relative region coordinates. */
  audioOffsetSec: number;
  /** Commits a manually-dragged boundary — `index` is the shared edge
   *  between `regions[index]` and `regions[index + 1]`, `time` is its new
   *  position in seconds (already clamped). */
  onAdjustBoundary: (index: number, time: number) => void;
  /** Commits a drag-selected range — `start`/`end` in seconds, `keep` is
   *  the state the whole range should become (decided by the drag's own
   *  start point — see handleMouseDown/the range-select effect). */
  onSelectRange: (start: number, end: number, keep: boolean) => void;
}

const HEIGHT = 72;
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;
/** Floor on how close a dragged boundary may get to either of its own
 *  neighbors' own opposite edge — stops a region inverting or vanishing
 *  under drag. Deliberately small and fixed rather than frame-derived
 *  (Waveform doesn't know the sequence's fps) — this is a "stretch a
 *  little" gesture, not frame-accurate trimming. */
const MIN_REGION_SEC = 0.05;
/** Screen-space hit radius for grabbing a boundary handle, in CSS px —
 *  constant regardless of zoom, so a handle stays just as easy to grab at
 *  1x as at 24x. */
const BOUNDARY_HIT_PX = 6;
/** How far the pointer must move (CSS px) before a mousedown-near-a-boundary
 *  counts as a real drag rather than a click that should fall through to
 *  the normal toggle behavior. */
const DRAG_THRESHOLD_PX = 3;
/**
 * Below this, a kept region's confidence (see analyze.ts's
 * computeBoundaryConfidence) is flagged with a marker. Set so the marker flags
 * a minority of boundaries, the ones worth a glance, not most of them. It
 * catches a locally ambiguous, flat LLR signal at a boundary, not a whole
 * file whose calibration produced a confidently wrong cut.
 */
const LOW_CONFIDENCE_THRESHOLD = 0.1;

/**
 * Read-only-until-clicked waveform preview: amber bars for audio that will
 * be kept, dimmed for audio that will be cut. In Edit mode, click a region to
 * flip it (or drag an edge, or drag across a stretch) — rescue a word that
 * got cut, or drop a bit that got kept — before committing; in Seek mode a
 * click plays from there. Zoom (1x-24x) widens the drawn canvas beyond the visible
 * strip and scrolls it, for picking out precise spots on long tracks. Pure
 * canvas, no deps.
 */
export const Waveform = ({
  rmsValues,
  durationSec,
  regions,
  onToggleRegion,
  onUndoToggle,
  canUndoToggle,
  audioUrl,
  audioError,
  onRequestAudio,
  audioOffsetSec,
  onAdjustBoundary,
  onSelectRange,
}: WaveformProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(560);
  const [zoom, setZoom] = useState(1);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  // Set when the <audio> element refuses the source (a codec CEP's Chromium
  // can't decode) or play() rejects; shown like audioError. Cleared on a new
  // source.
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const noteUnplayable = () => {
    setPlaying(false);
    setPlaybackError(
      tr("The plugin can't play this file (a format its preview doesn't decode). Cutting still works; preview it in Premiere."),
    );
  };
  const startPlayback = (audio: HTMLAudioElement) => {
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(noteUnplayable);
  };
  const [playheadSec, setPlayheadSec] = useState(0);
  // Set by the Play button (when nothing's decoded yet) or by a seek click
  // (the waveform in Seek mode, or the scrubber strip) before audio exists —
  // once `audioUrl` shows up, the effect below seeks to this position and
  // starts playback, then clears it.
  const pendingPlayFromRef = useRef<number | null>(null);

  // Seek/Edit interaction modes (arrow and razor icons, like Premiere's
  // Selection Tool / Razor Tool). "Edit" keeps every gesture (a plain click toggles a region;
  // see handleClick); "seek" turns a plain canvas click into the same
  // seekAndPlay handleScrubberClick does and disables the boundary-drag and
  // range-select gestures, so scrubbing can't edit anything. Default is
  // "seek": previewing is a more common first action after a Scan than editing
  // a region.
  const [interactionMode, setInteractionMode] = useState<"edit" | "seek">("seek");
  // Draggable boundary handles: which boundary (index into `regions`, the shared
  // edge between regions[i]/regions[i+1]) is being dragged, and its live
  // preview position, in seconds. `regionsRef`/`dragPreviewSecRef` mirror the
  // state below into refs so the window-level mousemove/mouseup listeners
  // (attached once per drag, not every render) always read the latest values
  // without being rebuilt mid-drag.
  const [draggingBoundary, setDraggingBoundary] = useState<number | null>(null);
  const [dragPreviewSec, setDragPreviewSec] = useState<number | null>(null);
  const [hoverBoundaryIndex, setHoverBoundaryIndex] = useState<number | null>(null);
  const regionsRef = useRef(regions);
  const dragPreviewSecRef = useRef<number | null>(null);
  // Shared between boundary-drag and range-select-drag below — only one of
  // the two is ever active at a time (handleMouseDown decides which up
  // front), so reusing the same "where did this gesture start"/"did it
  // really move"/"was the last gesture a drag" state for both is safe and
  // avoids duplicating the click-vs-drag bookkeeping.
  const dragStartClientXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
  const dragMovedRef = useRef(false);
  const justDraggedRef = useRef(false);
  useEffect(() => {
    regionsRef.current = regions;
  });

  // Range-select drag — mousedown on open waveform (not near a boundary
  // handle) + a real drag marks the whole dragged span cut/keep in one
  // action, instead of clicking each little region individually.
  // `draggingRangeStart` is the drag's fixed anchor point (seconds); the
  // range shown/committed is always [min(anchor, current), max(...)].
  const [draggingRangeStart, setDraggingRangeStart] = useState<number | null>(null);
  const [rangeCurrentSec, setRangeCurrentSec] = useState<number | null>(null);
  const rangeCurrentSecRef = useRef<number | null>(null);

  const width = Math.round(containerWidth * zoom);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - containerWidth) > 2) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerWidth]);

  // Reset scroll/zoom whenever the underlying audio changes so an old zoomed
  // position doesn't silently point at a different clip's timeline.
  useEffect(() => {
    setZoom(1);
  }, [rmsValues, durationSec]);

  // Reset playback state when the underlying audio changes (a rescan clears
  // audioUrl upstream too) — a stale playhead position from a previous
  // clip's timeline would otherwise linger on screen.
  useEffect(() => {
    audioRef.current?.pause();
    setPlaying(false);
    setPlayheadSec(0);
    pendingPlayFromRef.current = null;
  }, [rmsValues, durationSec]);

  // Fires once audioUrl actually becomes available after a pending seek+play
  // request (Play button, or a seek click in Seek mode or on the scrubber
  // strip, before anything was decoded yet) — waits for real metadata
  // (readyState) before setting currentTime, since doing so immediately after
  // `src` changes isn't reliably honored by every browser engine.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl || pendingPlayFromRef.current === null) return;
    const target = pendingPlayFromRef.current;
    pendingPlayFromRef.current = null;
    const start = () => {
      audio.currentTime = audioOffsetSec + target;
      startPlayback(audio);
    };
    if (audio.readyState >= 1) start();
    else audio.addEventListener("loadedmetadata", start, { once: true });
  }, [audioUrl]);

  // Drives the playhead line while audio is actually playing — a rAF loop
  // (not the `timeupdate` event, whose ~4Hz firing rate looks visibly
  // choppy for a moving line) reading the audio element's own currentTime
  // directly, cheaper than re-deriving position from wall-clock time.
  // `audioUrl` points at the WHOLE original file, not just this waveform's
  // own scanned/trimmed range — converts back to 0-relative region time via
  // audioOffsetSec, and auto-pauses once playback reaches this range's own
  // end rather than continuing into unrelated content past what was scanned.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        const t = audio.currentTime - audioOffsetSec;
        if (t >= durationSec) {
          audio.pause();
          setPlayheadSec(durationSec);
          return;
        }
        setPlayheadSec(Math.max(0, t));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, audioOffsetSec, durationSec]);

  // Drawn on its own small overlay canvas, redrawn independently from the
  // (much more expensive) waveform+regions draw effect below — at 60fps
  // during playback/dragging, re-running that full draw (bucketed RMS
  // bars, cut-region hatching) every frame would be wasteful and could get
  // janky on a long, heavily-zoomed file; this effect only ever
  // clears+strokes one shape. Draws exactly one of: the range-select
  // highlight (takes priority — a translucent fill so the selected span
  // reads clearly against the waveform underneath), the boundary-drag
  // preview line, or the normal playhead line — never more than one.
  useEffect(() => {
    const canvas = playheadCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, HEIGHT);
    const style = getComputedStyle(document.documentElement);
    if (draggingRangeStart !== null && rangeCurrentSec !== null) {
      const handleColor = style.getPropertyValue("--wf-handle").trim() || "#ffffff";
      const x0 = (Math.min(draggingRangeStart, rangeCurrentSec) / durationSec) * width;
      const x1 = (Math.max(draggingRangeStart, rangeCurrentSec) / durationSec) * width;
      const w = Math.max(1, x1 - x0);
      ctx.fillStyle = handleColor;
      ctx.globalAlpha = 0.22;
      ctx.fillRect(x0, 0, w, HEIGHT);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, 0.5, Math.max(1, w - 1), HEIGHT - 1);
      return;
    }
    if (draggingBoundary !== null && dragPreviewSec !== null) {
      const handleColor = style.getPropertyValue("--wf-handle").trim() || "#ffffff";
      const x = (dragPreviewSec / durationSec) * width;
      ctx.strokeStyle = handleColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, HEIGHT);
      ctx.stroke();
      return;
    }
    if (!audioUrl || durationSec <= 0) return;
    const playheadColor = style.getPropertyValue("--wf-playhead").trim() || "#ffffff";
    const x = (playheadSec / durationSec) * width;
    ctx.strokeStyle = playheadColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, HEIGHT);
    ctx.stroke();
  }, [playheadSec, width, durationSec, audioUrl, draggingBoundary, dragPreviewSec, draggingRangeStart, rangeCurrentSec]);

  /** Screen-space (CSS px, relative to the canvas's own left edge) index of
   *  the boundary nearest `x`, within BOUNDARY_HIT_PX — or -1 if none are
   *  close enough. Boundary `i` is the shared edge between regions[i] and
   *  regions[i+1], so there's one fewer boundary than region. */
  const findBoundaryNear = (x: number): number => {
    for (let i = 0; i < regions.length - 1; i++) {
      const bx = (regions[i].end / durationSec) * width;
      if (Math.abs(x - bx) <= BOUNDARY_HIT_PX) return i;
    }
    return -1;
  };

  const handleMouseDown: MouseEventHandler<HTMLCanvasElement> = (e) => {
    // Seek mode never starts a boundary-drag or range-select-drag — only
    // handleClick's own seek-on-click fires (see its own doc comment).
    if (interactionMode === "seek") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    const idx = findBoundaryNear(xCss);
    dragStartClientXRef.current = e.clientX;
    dragMovedRef.current = false;
    if (idx !== -1) {
      e.preventDefault();
      dragStartTimeRef.current = regions[idx].end;
      dragPreviewSecRef.current = regions[idx].end;
      setDraggingBoundary(idx);
      setDragPreviewSec(regions[idx].end);
      return;
    }
    // Not on a handle — starts a potential range-select drag. If the
    // pointer never really moves, handleClick's own justDraggedRef check
    // lets this fall through to the normal single-region toggle instead.
    e.preventDefault();
    const startSec = Math.max(0, Math.min(durationSec, (xCss / width) * durationSec));
    rangeCurrentSecRef.current = startSec;
    setDraggingRangeStart(startSec);
    setRangeCurrentSec(startSec);
  };

  // Window-level (not just canvas-level) mousemove/mouseup while a drag is
  // active, so dragging past the canvas's own edge still tracks — standard
  // approach for a canvas drag interaction without the Pointer Capture API.
  // Reads regionsRef (always current) rather than depending on `regions`
  // directly, so this effect doesn't need to tear down and reattach mid-
  // drag if an unrelated re-render happens to produce a new regions array.
  useEffect(() => {
    if (draggingBoundary === null) return;
    const idx = draggingBoundary;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartClientXRef.current;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) dragMovedRef.current = true;
      const dtSec = (dx / width) * durationSec;
      const rs = regionsRef.current;
      const minT = rs[idx].start + MIN_REGION_SEC;
      const maxT = rs[idx + 1].end - MIN_REGION_SEC;
      const t = Math.max(minT, Math.min(maxT, dragStartTimeRef.current + dtSec));
      dragPreviewSecRef.current = t;
      setDragPreviewSec(t);
    };
    const onUp = () => {
      if (dragMovedRef.current && dragPreviewSecRef.current !== null) {
        onAdjustBoundary(idx, dragPreviewSecRef.current);
        justDraggedRef.current = true;
      }
      setDraggingBoundary(null);
      setDragPreviewSec(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [draggingBoundary, width, durationSec, onAdjustBoundary]);

  // Window-level mousemove/mouseup for an active range-select drag — same
  // shape as the boundary-drag effect above (see its own comment for why
  // window-level, and why regionsRef instead of `regions` in the closure).
  // Direction convention: the region under the drag's own START point
  // decides the action — starting inside a kept region marks the whole
  // dragged span cut, starting inside a cut region marks it kept. No
  // matching region at the start point (shouldn't normally happen —
  // regions tile the whole duration) defaults to cut.
  useEffect(() => {
    if (draggingRangeStart === null) return;
    const anchor = draggingRangeStart;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStartClientXRef.current;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) dragMovedRef.current = true;
      const dtSec = (dx / width) * durationSec;
      const t = Math.max(0, Math.min(durationSec, anchor + dtSec));
      rangeCurrentSecRef.current = t;
      setRangeCurrentSec(t);
    };
    const onUp = () => {
      if (dragMovedRef.current && rangeCurrentSecRef.current !== null) {
        const a = Math.min(anchor, rangeCurrentSecRef.current);
        const b = Math.max(anchor, rangeCurrentSecRef.current);
        const rs = regionsRef.current;
        let keep = false;
        for (let i = 0; i < rs.length; i++) {
          if (anchor >= rs[i].start && anchor < rs[i].end) {
            keep = !rs[i].keep;
            break;
          }
        }
        onSelectRange(a, b, keep);
        justDraggedRef.current = true;
      }
      setDraggingRangeStart(null);
      setRangeCurrentSec(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [draggingRangeStart, width, durationSec, onSelectRange]);

  /** Seeks to `timeSec` and plays — if nothing's decoded yet, kicks off
   *  onRequestAudio() and defers the actual seek+play to the pending-play
   *  effect above once `audioUrl` shows up. */
  const seekAndPlay = async (timeSec: number) => {
    setPlayheadSec(timeSec);
    if (!audioUrl) {
      pendingPlayFromRef.current = timeSec;
      await onRequestAudio();
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = audioOffsetSec + timeSec;
    startPlayback(audio);
  };

  const handlePlayPause = async () => {
    if (playing) {
      audioRef.current?.pause();
      return;
    }
    if (!audioUrl) {
      pendingPlayFromRef.current = playheadSec;
      await onRequestAudio();
      return;
    }
    if (audioRef.current) startPlayback(audioRef.current);
  };

  const regionAt = (xRatio: number): number => {
    const t = xRatio * durationSec;
    for (let i = 0; i < regions.length; i++) {
      if (t >= regions[i].start && t < regions[i].end) return i;
    }
    return -1;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rmsValues.length || durationSec <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, HEIGHT);

    const style = getComputedStyle(document.documentElement);
    const signal = style.getPropertyValue("--wf-signal").trim() || "#e0a339";
    const faint = style.getPropertyValue("--wf-faint").trim() || "#616166";
    const cutDim = style.getPropertyValue("--wf-cut-dim").trim() || "#0000004d";
    const cutHatch = style.getPropertyValue("--wf-cut-hatch").trim() || "#e2634f";
    const hoverOutline = style.getPropertyValue("--wf-hover").trim() || "#eab04f";
    const handleColor = style.getPropertyValue("--wf-handle").trim() || "#ffffff";
    const lowConfidenceColor = style.getPropertyValue("--wf-low-confidence").trim() || "#e2634f";

    // Downsample RMS into one bar per pixel column (peak within each bucket)
    // — at higher zoom the canvas itself is wider, so more buckets = more
    // visible detail, down to roughly one bar per source frame.
    const bucketCount = Math.max(1, Math.min(width, rmsValues.length));
    const framesPerBucket = Math.max(1, rmsValues.length / bucketCount);
    const mid = HEIGHT / 2;
    // Plain loop, not Math.max(1, ...rmsValues) — spreading tens of
    // thousands of array elements as call arguments (a 30+ minute
    // recording at FRAME_MS=30 easily exceeds that) risks a V8 "Maximum
    // call stack size exceeded" RangeError, which would take down the
    // whole Scan-results view with no error boundary around it.
    let maxRms = 1;
    for (let r = 0; r < rmsValues.length; r++) {
      if (rmsValues[r] > maxRms) maxRms = rmsValues[r];
    }
    const pxPerBucket = width / bucketCount;

    for (let b = 0; b < bucketCount; b++) {
      const startFrame = Math.floor(b * framesPerBucket);
      const endFrame = Math.min(rmsValues.length, Math.floor((b + 1) * framesPerBucket));
      let peak = 0;
      for (let f = startFrame; f < endFrame; f++) peak = Math.max(peak, rmsValues[f]);
      const amp = Math.min(1, peak / maxRms);
      const barH = Math.max(1, amp * (HEIGHT - 8));

      const tSec = ((b + 0.5) / bucketCount) * durationSec;
      const regionIdx = regions.findIndex((r) => tSec >= r.start && tSec < r.end);
      const keep = regionIdx === -1 ? true : regions[regionIdx].keep;

      ctx.fillStyle = keep ? signal : faint;
      ctx.globalAlpha = keep ? 1 : 0.45;
      ctx.fillRect(b * pxPerBucket, mid - barH / 2, Math.max(1, pxPerBucket), barH);
      ctx.globalAlpha = 1;
    }

    // Cut regions get a dark wash plus diagonal hatching — the same visual
    // shorthand Premiere's own timeline uses for "empty/removed" space, so
    // it reads unambiguously as "this goes away" rather than just "dimmer."
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (r.keep) continue;
      const x0 = (r.start / durationSec) * width;
      const x1 = (r.end / durationSec) * width;
      const w = Math.max(1, x1 - x0);
      ctx.fillStyle = cutDim;
      ctx.fillRect(x0, 0, w, HEIGHT);

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 0, w, HEIGHT);
      ctx.clip();
      ctx.strokeStyle = cutHatch;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 1;
      const spacing = 6;
      for (let sx = -HEIGHT; sx < w + HEIGHT; sx += spacing) {
        ctx.beginPath();
        ctx.moveTo(x0 + sx, HEIGHT);
        ctx.lineTo(x0 + sx + HEIGHT, 0);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Low-confidence marker: a small downward triangle at the top-left of any
    // kept region whose LLR-derived confidence (see analyze.ts's
    // Segment.confidence) falls below LOW_CONFIDENCE_THRESHOLD, so a boundary
    // worth a quick manual glance stands out without a second color scheme.
    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (!r.keep || r.confidence === undefined || r.confidence >= LOW_CONFIDENCE_THRESHOLD) continue;
      const x0 = (r.start / durationSec) * width;
      ctx.fillStyle = lowConfidenceColor;
      ctx.beginPath();
      ctx.moveTo(x0 + 1, 1);
      ctx.lineTo(x0 + 9, 1);
      ctx.lineTo(x0 + 5, 8);
      ctx.closePath();
      ctx.fill();
    }

    if (hoverIndex !== null && regions[hoverIndex]) {
      const r = regions[hoverIndex];
      const x0 = (r.start / durationSec) * width;
      const x1 = (r.end / durationSec) * width;
      ctx.strokeStyle = hoverOutline;
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, 0.5, Math.max(1, x1 - x0) - 1, HEIGHT - 1);
    }

    // Draggable boundary handles: a small tick at every internal region edge,
    // brighter when hovered/grabbable. Skips the boundary being dragged; its live
    // position is drawn on the separate playhead/drag-preview overlay canvas,
    // which redraws far more cheaply on every pointer move than this effect.
    for (let i = 0; i < regions.length - 1; i++) {
      if (i === draggingBoundary) continue;
      const bx = (regions[i].end / durationSec) * width;
      ctx.globalAlpha = i === hoverBoundaryIndex ? 1 : 0.55;
      ctx.fillStyle = handleColor;
      ctx.fillRect(bx - 1, HEIGHT / 2 - 9, 2, 18);
      ctx.globalAlpha = 1;
    }
  }, [rmsValues, durationSec, regions, width, hoverIndex, hoverBoundaryIndex, draggingBoundary]);

  const handleMove: MouseEventHandler<HTMLCanvasElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xCss = e.clientX - rect.left;
    // Seek mode never drags a boundary, so it shouldn't show the
    // ew-resize/drag-handle affordance for one either.
    const boundaryIdx = interactionMode === "seek" ? -1 : findBoundaryNear(xCss);
    setHoverBoundaryIndex(boundaryIdx);
    // Both hover states are computed independently: a boundary handle and the
    // regions on either side of it share the same edge pixels, and they
    // describe independent facts ("you can drag this edge", "this is the
    // region under the pointer"). Clearing one when the other is set would
    // make the hover highlight flicker with sub-pixel mouse jitter there.
    setHoverIndex(regionAt(xCss / rect.width));
  };

  // In Edit mode a plain click toggles a region both ways, keep→cut and
  // cut→keep (rescue a wrongly cut word, cut a wrongly kept one). The
  // scrubber strip below always seeks, in either mode.
  //
  // Bails out if a boundary drag just completed on this same mousedown/mouseup
  // pair: the browser still fires a native click after mouseup lands on the
  // canvas, which would otherwise also toggle the region under the pointer.
  //
  // In Seek mode a plain canvas click seeks and plays (the same as
  // handleScrubberClick) instead of toggling: a way to move the playhead across
  // the whole waveform without any risk of editing a region.
  const handleClick: MouseEventHandler<HTMLCanvasElement> = (e) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    if (interactionMode === "seek") {
      void seekAndPlay(Math.max(0, Math.min(durationSec, xRatio * durationSec)));
      return;
    }
    const idx = regionAt(xRatio);
    if (idx !== -1) onToggleRegion(idx);
  };

  const handleScrubberClick: MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xRatio = (e.clientX - rect.left) / rect.width;
    void seekAndPlay(Math.max(0, Math.min(durationSec, xRatio * durationSec)));
  };

  const zoomBy = (factor: number) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));

  return (
    <div className="waveform">
      <div className="waveform-toolbar">
        <button className="icon-btn waveform-play" onClick={() => void handlePlayPause()} title={playing ? tr("Pause") : tr("Play")}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <button className="icon-btn" onClick={onUndoToggle} disabled={!canUndoToggle} title={tr("Undo last preview edit")}>
          <IconUndo />
        </button>
        <div className="toolbar-sep" aria-hidden="true" />
        <div className="waveform-mode-toggle" role="group" aria-label={tr("Interaction mode")}>
          <button
            className={"icon-btn" + (interactionMode === "seek" ? " active" : "")}
            onClick={() => setInteractionMode("seek")}
            title={tr("Seek mode — click anywhere to move the playhead")}
          >
            <IconSeek />
          </button>
          <button
            className={"icon-btn" + (interactionMode === "edit" ? " active" : "")}
            onClick={() => setInteractionMode("edit")}
            title={tr("Edit mode — click a region to toggle keep/cut")}
          >
            <IconEdit />
          </button>
        </div>
        {/* push-right: keeps the zoom/fit group at the toolbar's right edge. */}
        <div className="toolbar-sep toolbar-sep-push" aria-hidden="true" />
        <button className="icon-btn" onClick={() => zoomBy(1 / 1.6)} disabled={zoom <= MIN_ZOOM} title={tr("Zoom out")}>
          −
        </button>
        <span className="hint zoom-label">{zoom === 1 ? "1x" : `${zoom.toFixed(1)}x`}</span>
        <button className="icon-btn" onClick={() => zoomBy(1.6)} disabled={zoom >= MAX_ZOOM} title={tr("Zoom in")}>
          +
        </button>
        <button className="icon-btn" onClick={() => setZoom(1)} disabled={zoom === 1} title={tr("Fit to width")}>
          <IconFit />
        </button>
      </div>
      {audioError && <div className="hint waveform-audio-error">{audioError}</div>}
      {!audioError && playbackError && <div className="hint waveform-audio-error">{playbackError}</div>}
      <div className="waveform-scroll" ref={scrollRef}>
        <div className="waveform-canvas-stack" style={{ width, height: HEIGHT }}>
          <canvas
            ref={canvasRef}
            style={{
              width,
              height: HEIGHT,
              cursor: interactionMode === "seek" ? "crosshair" : hoverBoundaryIndex !== null ? "ew-resize" : "pointer",
            }}
            onMouseMove={handleMove}
            onMouseLeave={() => {
              setHoverIndex(null);
              setHoverBoundaryIndex(null);
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
          />
          <canvas ref={playheadCanvasRef} className="waveform-playhead" style={{ width, height: HEIGHT }} />
        </div>
        <div className="waveform-scrubber" style={{ width }} onClick={handleScrubberClick} title={tr("Click to seek")}>
          <div className="waveform-scrubber-marker" style={{ left: durationSec > 0 ? `${(playheadSec / durationSec) * width}px` : 0 }} />
        </div>
      </div>
      {/* Legend row, with the low-confidence marker as a third static entry (it
          explains the red triangle drawn on the waveform); its longer explanation is
          the entry's `title` tooltip, so no line appears and disappears on hover. */}
      <div className="waveform-legend" aria-hidden="true">
        <span className="legend-swatch keep" />
        {tr("Kept")}
        <span className="legend-swatch cut" />
        {tr("Cut")}
        <span className="legend-item" title={tr("Uncertain edge — worth a quick listen")}>
          <svg className="legend-swatch-triangle" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
            <polygon points="1,1 10,1 5.5,9" fill="var(--wf-low-confidence, #e2634f)" />
          </svg>
          {tr("Uncertain edge")}
        </span>
      </div>
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          if (audioRef.current) setPlayheadSec(Math.max(0, Math.min(durationSec, audioRef.current.currentTime - audioOffsetSec)));
        }}
        onEnded={() => setPlaying(false)}
        onError={noteUnplayable}
        onLoadedMetadata={() => setPlaybackError(null)}
        style={{ display: "none" }}
      />
    </div>
  );
};
