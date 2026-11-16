import type { Segment } from "./analyze";
import type { WordTimestamp } from "./whisper";

// Pure boundary math with no model dependency, testable with hand-built
// fixtures. Only ever extends a segment to include a word it was about to
// bisect; never creates a segment or shrinks a kept region (the same
// "rescue only" contract as analyze.ts's computeLocalThresholds safety net).
// It runs as a safety pass after the energy-based segmentation decided the
// cuts, and only steps in when a boundary seems to land inside a word.
//
// Two independent gates must both pass before a boundary moves:
//
// 1. `maxSnapSec` — a hard cap on how far a boundary may move. Whisper's word
//    timestamps can be off by more than a trivial amount (whisper.ts clamps
//    each word to the audio duration, but smaller misalignments remain).
//
// 2. `energyGate` (linear RMS, the scale of analyze.ts's rmsValues). whisper.cpp's
//    `-ml 1` timestamps tile the timeline edge to edge (one word's end is almost
//    always the next word's start), and a word's span is often padded into the
//    silence around it. So any cut boundary lands "inside" some word, and
//    trusting the word edge alone would extend cuts into real silence and
//    merge them. Gate #2 checks the same independent energy signal the main
//    segmentation trusts: a boundary moves only if the whole newly included
//    region is above the speech threshold. A real mid-word split has signal on
//    both sides of the boundary; a word span padded into silence doesn't.
//
//    Gate #2's bar is the more lenient of `energyGate` (flat, file-wide) and a
//    per-word relative floor (RELATIVE_DECAY_RATIO, below): a quietly spoken
//    word's trailing decay can dip under one file-wide gate while still being
//    that word's tail, and comparing against the word's own peak RMS catches
//    that without loosening the gate for every word.
//
// How far below a word's own peak RMS its trailing sound may decay and still
// count as real for gate #2 (0.2 ≈ -14 dB below that peak). Only an
// alternative, more lenient option next to the flat `energyGate` (see
// effectiveGateFor), never instead of it, so a quiet word's peak can't make
// the bar stricter than the absolute gate. Bounded by gate #1's `maxSnapSec`
// either way.
const RELATIVE_DECAY_RATIO = 0.2;

// How many extra frames a boundary may coast past a word's reported edge, once
// snapped there, while corroborated energy (the same gate as the snap)
// continues. Whisper's word edge can undershoot the true acoustic end or start
// by tens of ms, which gates #1/#2 can't catch since they extend a boundary
// only as far as the reported edge. A separate, smaller allowance than
// `maxSnapSec`: it fires only right after a real snap and only while energy
// keeps corroborating frame by frame, so it can't run into real silence.
// 3 frames (~90 ms). Known limitation: the gate is energy-only, so loud
// background music under narration (which Silero correctly calls non-speech)
// can corroborate a coast, as it can the snap itself.
const POST_SNAP_COAST_FRAMES = 3;

// whisper.cpp's `-ml 1` mode tiles the whole timeline with one "word" per
// segment, including punctuation-only segments (a bare "." or a "'d"
// fragment) with their own short span — a Whisper segmentation artifact, not
// spoken content. Used as a snap target, with POST_SNAP_COAST_FRAMES' coast,
// such a token can walk the boundary past its short span into the real
// adjacent word, leaving it more clipped than before, and modes whose raw
// boundaries land later and coarser hit this most. These tokens are never
// used as a rescue target or for wordPeakRms/effectiveGateFor: a real-content
// check, not a change to the coast or the gate.
export const normalizeWordToken = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']+/gu, "");

export const snapSegmentsToWords = (
  segments: Segment[],
  rawWords: WordTimestamp[],
  maxSnapSec: number,
  rmsValues: number[],
  frameStepSec: number,
  energyGate: number,
): Segment[] => {
  if (!segments.length || !rawWords.length) return segments;
  const words = rawWords.filter((w) => normalizeWordToken(w.word).length > 0);
  if (!words.length) return segments;

  const frameAt = (t: number): number => Math.max(0, Math.min(rmsValues.length - 1, Math.round(t / frameStepSec)));

  // A word spoken quietly throughout has a naturally quiet trailing decay
  // too — comparing it against one flat, file-wide gate can miss a real
  // (if soft) word ending that a loud speaker's equivalent tail would have
  // passed easily. Peak RMS *within this specific word's own span* gives a
  // per-word reference point instead. Falls back to the flat gate alone
  // (see effectiveGateFor) if the word's span is degenerate (zero peak).
  const wordPeakRms = (w: WordTimestamp): number => {
    const lo = frameAt(w.start);
    const hi = frameAt(w.end);
    let peak = 0;
    for (let f = lo; f <= hi; f++) {
      if (rmsValues[f] > peak) peak = rmsValues[f];
    }
    return peak;
  };

  // The more lenient (lower) of the flat gate and this word's own relative
  // decay floor — i.e. `energy > effectiveGate` is true whenever energy
  // clears *either* bar, not only when it clears both. This can only make
  // rescuing a real trailing sound easier than the flat gate alone did; it
  // can never make the absolute gate's own "definitely not real silence"
  // floor any stricter.
  const effectiveGateFor = (w: WordTimestamp): number => {
    const peak = wordPeakRms(w);
    if (peak <= 0) return energyGate;
    return Math.min(energyGate, peak * RELATIVE_DECAY_RATIO);
  };

  // True only if every frame strictly between `a` and `b` shows energy above the
  // gate (gate #2 above); a sub-frame move passes trivially. All or nothing:
  // stopping at the first failing frame instead would let one marginal frame in
  // a noisy non-speech passage trigger a spurious rescue.
  const hasRealEnergyBetween = (a: number, b: number, gate: number): boolean => {
    const lo = frameAt(Math.min(a, b));
    const hi = frameAt(Math.max(a, b));
    if (hi <= lo) return true;
    for (let f = lo; f <= hi; f++) {
      if (rmsValues[f] <= gate) return false;
    }
    return true;
  };

  // Only ever called right after a real snap-to-word-edge succeeded (see
  // POST_SNAP_COAST_FRAMES's own doc comment) — nudges `boundary` up to
  // `POST_SNAP_COAST_FRAMES` further frames in `direction` (+1 for a
  // segment end, -1 for a start) as long as each next frame still clears
  // `gate`, stopping at the first frame that doesn't.
  const coastWhileReal = (boundary: number, direction: 1 | -1, gate: number): number => {
    // frameAt() below clamps which frame gets energy-checked, but not the
    // returned time `t`: for speech starting at/near t=0 (direction=-1) or
    // ending at the clip's last analyzed frame (direction=1) it could return a
    // negative start or an end past the clip's duration, breaking the Segment
    // contract every consumer (Cut placement, computeJLCutOverlaps) assumes.
    // Clamp to the same [0, clip duration] bound analyze.ts uses.
    const maxT = rmsValues.length * frameStepSec;
    let t = boundary;
    for (let i = 0; i < POST_SNAP_COAST_FRAMES; i++) {
      const nextT = Math.max(0, Math.min(maxT, t + direction * frameStepSec));
      const f = frameAt(nextT);
      if (rmsValues[f] <= gate) break;
      t = nextT;
    }
    return t;
  };

  const adjusted = segments.map((seg) => {
    let start = seg.start;
    let end = seg.end;

    for (const w of words) {
      const gate = effectiveGateFor(w);
      // The boundary lands strictly inside this word's span: pull it out to the
      // word's edge, but only if the move is small enough to trust (gate #1) and the
      // newly included region is not silence (gate #2); then coast a little past the
      // edge in case Whisper's boundary undershot.
      //
      // No "far" branch for a word edge beyond maxSnapSec: on gentle settings,
      // boundaries already sit far from speech, and room tone or hiss can keep
      // clearing the energy gate across the whole capped window although Silero is
      // sure it isn't speech. Rescuing those cases would need Silero's confidence in
      // word-snap, not a higher bar on the same energy-only signal.
      if (w.start < start && start < w.end) {
        const delta = start - w.start;
        if (delta <= maxSnapSec && hasRealEnergyBetween(w.start, start, gate)) {
          start = coastWhileReal(w.start, -1, gate);
        }
      }
      if (w.start < end && end < w.end) {
        const delta = w.end - end;
        if (delta <= maxSnapSec && hasRealEnergyBetween(end, w.end, gate)) {
          end = coastWhileReal(w.end, 1, gate);
        }
      }
    }

    return { start, end };
  });

  // A pulled-out boundary can now overlap (or exactly touch) its neighbor
  // — merge those back together, same tuple-based merge analyze.ts's own
  // buildSegments already relies on for the identical reason.
  const tuples: [number, number][] = adjusted.map((s) => [s.start, s.end]);
  const merged: [number, number][] = [tuples[0]];
  for (let i = 1; i < tuples.length; i++) {
    const [s, e] = tuples[i];
    const last = merged[merged.length - 1];
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  return merged.map(([start, end]) => ({ start, end }));
};
