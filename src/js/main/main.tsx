import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { csi, evalTS, getJsxLoadDiagnostics } from "../lib/utils/bolt";
import { useJsxLoadError } from "../lib/utils/useJsxLoadError";
import { getExportPresetPath } from "../lib/exportPresetPath";
import type {
  ApplyPitchResult,
  ApplySpeedResult,
  BatchImportResult,
  ClearDataResult,
  ClipInfo,
  CutResult,
  CutSegment,
  FullTimelineRenderResult,
  ImportAudioResult,
  JLCutResult,
  NaturalPitchFades,
  NaturalPitchPlan,
  PlaceFullTimelineRenderResult,
  PlaceNaturalPitchResult,
  RenderUndoPiece,
  CutUndoInfo,
  SendToAEResult,
  UndoFullTimelineRenderResult,
  UndoGeneratedResult,
  UndoNaturalPitchResult,
  RebuildEffectSummary,
} from "../lib/types";
import {
  clearLocalSettings,
  hasMacQuarantineNoticeBeenShown,
  hasOutputLocationBeenSet,
  hasUiLanguageBeenSet,
  loadAnthropicApiKey,
  loadAnthropicModelId,
  loadElevenLabsApiKey,
  loadElevenOutputFormat,
  loadFavoriteVoiceIds,
  loadOpenAiApiKey,
  loadOpenAiModelId,
  loadOutputLocation,
  loadScriptIntensity,
  loadSkipExternalLinkConfirm,
  OutputLocation,
  saveAnthropicApiKey,
  saveAnthropicModelId,
  saveElevenLabsApiKey,
  saveElevenOutputFormat,
  saveMacQuarantineNoticeShown,
  saveOpenAiApiKey,
  saveOpenAiModelId,
  saveOutputLocation,
  saveScriptIntensity,
  saveSkipExternalLinkConfirm,
  toggleFavoriteVoiceId,
  UiLanguage,
} from "../lib/settings";
import { getLanguage, setLanguage, tr, useLanguage } from "../lib/i18n";
import { readGenerationMetadata, GenerationMetadata } from "../lib/generationMetadata";
// Value imports for elevenlabs.ts/scriptAssistant.ts are deliberately NOT
// static — see each call site below (`await import("../lib/elevenlabs")` /
// `await import("../lib/scriptAssistant")`). These two lib files are only
// ever needed once the user actually generates via ElevenLabs or clicks
// "Improve for voice," so loading them lazily keeps them out of the panel's
// initial parse/eval cost. Types are erased at compile time, so importing
// them normally here has zero runtime cost either way.
import type { ElevenLabsOutputFormat, ElevenLabsVoice, VoiceSettings } from "../lib/elevenlabs";
import { waitForFileStable } from "../lib/waitForFileStable";
import type { AssistantProvider, ModelOption, ScriptIntensity, ScriptStyle } from "../lib/scriptAssistant";
import {
  KokoroVoice,
  generateSpeech as generateKokoroSpeech,
  drainKokoroDiagnosticLog,
  getKokoroDiagnostics,
  listKokoroVoices,
  persistentRef,
} from "../lib/kokoro";
import {
  ADVANCED_LOCAL_THRESHOLD_PARAMS,
  FRAME_STEP_SEC,
  JLCutOverlapResult,
  JLCutPreset,
  getJLCutPresetConfig,
  MODES,
  ModeConfig,
  ScanResult,
  WORD_SNAP_MAX_SEC,
  buildSegmentsAdvanced,
  computeJLCutOverlaps,
  computeLocalThresholds,
  getFallbackJLCutOverlaps,
  probeAudioLayout,
  scanAudioFile,
} from "../lib/analyze";
import { os, url } from "../lib/cep/node";
import { snapSegmentsToWords } from "../lib/wordSnap";
import { getWhisperDiagnostics } from "../lib/whisper";
import { apiKeyProblem, cleanApiKey } from "../lib/apiKey";
import { translateHostMessage } from "../lib/i18n/hostMessages";
import { getSileroDiagnostics } from "../lib/silero";
import { hasMacQuarantineEventEverLogged } from "../lib/ffmpegPath";
import { readRenderSource, renderNaturalPitch } from "../lib/naturalPitch";
import { Preset, deletePreset, loadPresets, savePreset } from "../lib/presets";
import { describeDataFileProblem, useDataFileProblems } from "../lib/dataFileMessages";
import { primeDocumentsPathCache } from "../lib/genAudioDir";
import { Waveform, Region } from "./Waveform";
import { LICENSE_COPYRIGHT, LICENSE_SECTIONS, LICENSE_TITLE } from "../lib/licenseText";
import { GUIDE_TITLE, GUIDE_SECTIONS } from "./guideText";
// Vite's built-in `?raw` import (no new dependency) — the exact same
// NOTICE.md that's also bundled as a plain asset file at
// assets/licenses/NOTICE.md, rendered here so it's actually visible inside
// the panel's own UI instead of only reachable by browsing the installed
// extension's file tree. Read the string once at build time, not on every
// render.
import THIRD_PARTY_NOTICES from "../../assets/licenses/NOTICE.md?raw";
import "./main.scss";

type Tab = "voice" | "cut" | "speed" | "send";
type DetectMode = "simple" | "advanced";

interface BatchItem {
  id: string;
  text: string;
  status: "pending" | "generating" | "done" | "failed";
  error?: string;
  filePath?: string;
  /** On the timeline from an earlier run; a new run doesn't place it again. */
  placed?: boolean;
}

const FEEDBACK_URL = "https://linktr.ee/nkolesov";
// localStorage key for a "Clear all data" result that must survive the reload
// it triggers (see handleClearData).
const CLEAR_DATA_NOTE_KEY = "aivmt.clearDataNote";

// eleven_v3's per-request character limit, as listed on ElevenLabs' models page.
// v2 and v4 allow 10,000.
const V3_MAX_CHARS = 5000;
// Per-request character limit of each model the panel offers; a longer text is
// refused before anything is sent.
const ELEVEN_MAX_CHARS = { v2: 10000, v3: V3_MAX_CHARS, v4: 10000 } as const;

// Batch request stitching: how much of each neighbouring line is sent as
// previous_text/next_text (see handleRunBatch).
const STITCH_CONTEXT_CHARS = 200;

// ElevenLabs text-to-speech model ids behind the panel's v2/v3/v4 choice.
const ELEVEN_TTS_MODEL_IDS = {
  v2: "eleven_multilingual_v2",
  v3: "eleven_v3",
  v4: "eleven_v4",
} as const;

/** Minimal geometric gear glyph (dashed ring = teeth) — matches the panel's
 *  existing line-art brand-mark instead of pulling in an icon set. */
const GearIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.5 2.15" />
  </svg>
);

const fmtDb = (db: number) => `${db.toFixed(0)} dB`;
const fmtPct = (secs: number, total: number) => (total > 0 ? `${Math.round((1 - secs / total) * 100)}%` : "0%");
const fillStyle = (value: number, min: number, max: number) => ({ "--fill": `${(100 * (value - min)) / (max - min)}%` }) as CSSProperties;

/*
 * Background for the Calculator values below. Premiere's "Pitch Shifter" has no
 * "Semitones" parameter: the Clip Fx Editor's "Semi-tones"/"Cents"/"Ratio:" are
 * three linked displays of one literal frequency ratio (1.0 = unchanged, 2.0 =
 * one octave up, 0.5 = one octave down; typing -12 semitones reads
 * "Ratio: 0.5000", i.e. 2^(-12/12)). Those labels are not scriptable
 * parameter names; the real ones are "Transpose Ratio", "Precision",
 * "Frequency", "Overlapping", "Use Default Setting" and "Use Positive Cents"
 * (setEffectParamsOnClip's "parameter not found" warning lists them).
 *
 * The scriptable "Transpose Ratio" is **not** the UI's "Ratio:" readout: it is
 * a normalized 0-1 value spanning a fixed ±1-octave range, where 1/3 =
 * unchanged, so `scripted = (2 * literalRatio - 1) / 3` (verified by rendering
 * audio and measuring its pitch, not only by reading the parameter back). The
 * Calculator here shows the literal ratio; ppro.ts's `literalRatioToScriptedRatio`
 * does the conversion applyPitchToSelection writes to the effect.
 */
/** The exact semitone shift a given speed change causes — used only for the
 *  Calculator's values (Pacing tab, from the Speed % field). The correction
 *  Premiere's Pitch Shifter gets when it is applied again after a rebuild is
 *  computed fresh, per clip, in ppro.ts's applyPitchToSelection from that clip's own real current
 *  speed (`stdClip.getSpeed()`) — not from the Calculator or from this
 *  field — so this estimate can go stale (multi-select with different
 *  speeds, a clip changed outside this panel, Speed % edited after
 *  Apply Speed) without the real result ever being wrong. Kept in sync
 *  with ppro.ts's own copy of this same formula by hand — no shared
 *  import across the JS/ExtendScript boundary in this codebase (see
 *  types.ts's own top comment for why). */
const computeSemitones = (speedPercent: number): number | null => {
  if (speedPercent === 100) return null;
  const speedFactor = speedPercent / 100;
  return (-12 * Math.log(speedFactor)) / Math.LN2;
};
/** For the Calculator only (see computeSemitones above) — the *literal* ratio, matching
 *  the Clip Fx Editor's own "Ratio:" readout, not the scripted value
 *  applyPitchToSelection writes (see ppro.ts's literalRatioToScriptedRatio). */
const semitonesToLiteralRatio = (semitones: number): number => Math.pow(2, semitones / 12);

/** True when `info` plays the scanned file but is not the scanned clip: another
 *  clip cut from that file (a different soundbite, or one piece of a finished
 *  Cut), or the scanned clip trimmed since. The scan stays (J/L Pacing still
 *  needs it), but CUT is disabled. A different file clears the scan instead. A
 *  Speed change alone moves outPoint * speed slightly and has its own warning,
 *  so the out-point tolerance is wider then. */
const isOtherClipOfScannedFile = (info: ClipInfo, scanned: ClipInfo): boolean => {
  if (info.mediaPath !== scanned.mediaPath) return false;
  if (info.nodeId && scanned.nodeId && info.nodeId !== scanned.nodeId) return true;
  if (Math.abs(info.sourceInPoint - scanned.sourceInPoint) > 0.01) return true;
  const outTolerance = Math.abs(info.speedFactor - scanned.speedFactor) > 0.001 ? 0.25 : 0.01;
  return Math.abs(info.sourceOutPoint - scanned.sourceOutPoint) > outTolerance;
};

/** The source files of J/L's pieces, normalised. Natural pitch renders the
 *  panel remembers come in already mapped to their source by
 *  mapNaturalPitchSegments; any other render is traced through the source
 *  record written next to it (naturalPitch.ts), and one without a record is
 *  counted as unknown. */
const pieceSourceFiles = (segs: { mediaPath: string }[]): { files: string[]; unknownRenders: number } => {
  const norm = (p: string) => (p || "").replace(/\\/g, "/").toLowerCase();
  const files: string[] = [];
  let unknownRenders = 0;
  for (const s of segs) {
    let p = norm(s.mediaPath);
    if (!p) continue;
    if (/\/natural-pitch-[^/]*\.wav$/.test(p)) {
      const source = readRenderSource(s.mediaPath);
      if (!source) {
        unknownRenders++;
        continue;
      }
      p = norm(source);
    }
    if (!files.includes(p)) files.push(p);
  }
  return { files, unknownRenders };
};

/** One Cut's pieces play one file; J/L Pacing and Reset refuse a selection
 *  that mixes files (Select All with a music bed), before anything moves. A
 *  render of unknown source next to other clips is refused too, since it
 *  cannot be told apart from another recording. */
const mixedFilesRefusal = (segs: { mediaPath: string }[]): string | null => {
  const { files, unknownRenders } = pieceSourceFiles(segs);
  if (files.length > 1) {
    return tr(
      "J/L Pacing works on the pieces of one Cut, which all play one file, but the selected audio comes from {count} files. Select only the cut pieces (and their video), then try again. Nothing was changed.",
      { count: String(files.length) },
    );
  }
  if (unknownRenders > 0 && files.length > 0) {
    return tr(
      "Some selected pieces are Natural pitch renders whose source recording isn't known, selected together with other clips, so J/L Pacing can't tell whether they all belong to one Cut. Select only the Natural pitch pieces, or only clips of one file, then try again. Nothing was changed.",
    );
  }
  return null;
};

/** True when a remembered Natural pitch run replaced pieces of the file the
 *  remembered Cut was made from, in the same sequence: Cut's Undo and the
 *  Speed rebuild re-place that Cut from the original clip and would wipe the
 *  rendered pieces. Natural pitch on another file or in another sequence
 *  leaves Cut's own actions free. */
const naturalPitchOnRememberedCut = (
  natural: { pieces: RenderUndoPiece[]; sequenceId: string } | null,
  undoInfo: CutUndoInfo | null | undefined,
): boolean => {
  if (!natural || !undoInfo) return false;
  if (undoInfo.sequenceId && natural.sequenceId && undoInfo.sequenceId !== natural.sequenceId) return false;
  const norm = (p: string) => (p || "").replace(/\\/g, "/").toLowerCase();
  const cutFile = norm(undoInfo.mediaPath);
  return natural.pieces.some((p) => norm(p.mediaPath) === cutFile);
};

/**
 * What the detection algorithm finds for a given scan and the current Silence
 * Cut settings (detect mode, preset, Advanced threshold/minimum pause, local
 * safety check); the `autoSegments` useMemo below calls it. Pure function of
 * its arguments, no detection logic of its own.
 */
const computeAutoSegments = (
  scanResult: ScanResult | null,
  detectMode: DetectMode,
  simpleMode: string,
  advDb: number,
  advMinSilence: number,
  localSafetyCheck: boolean,
): CutSegment[] => {
  if (!scanResult) return [];
  if (detectMode === "simple") {
    return scanResult.segmentsByModeWordSnapped?.[simpleMode] || scanResult.segmentsByMode[simpleMode] || [];
  }
  const localThresholds = localSafetyCheck
    ? computeLocalThresholds(scanResult.weightedRmsValues, 5, 1, ADVANCED_LOCAL_THRESHOLD_PARAMS, scanResult.vadFlags)
    : null;
  const advanced = buildSegmentsAdvanced(
    scanResult.weightedRmsValues,
    advDb,
    advMinSilence,
    scanResult.vadFlags,
    localThresholds,
    undefined,
    undefined,
    scanResult.vadReleaseFlags,
  );
  if (scanResult.words) {
    return snapSegmentsToWords(
      advanced,
      scanResult.words,
      WORD_SNAP_MAX_SEC,
      scanResult.weightedRmsValues,
      FRAME_STEP_SEC,
      scanResult.wordSnapEnergyGate,
    );
  }
  return advanced;
};

/** Merges adjacent/overlapping (start,end) ranges in ascending order. Used
 *  by segmentsToCut (the reviewed regions Cut receives) and by the preset
 *  cards' speech totals. */
const mergeAdjacentSegments = <T extends { start: number; end: number }>(segments: T[]): CutSegment[] => {
  const merged: CutSegment[] = [];
  for (const seg of segments) {
    const last = merged[merged.length - 1];
    if (last && seg.start <= last.end) last.end = Math.max(last.end, seg.end);
    else merged.push({ start: seg.start, end: seg.end });
  }
  return merged;
};

/**
 * Common HTTP status codes shared by the ElevenLabs/OpenAI/Anthropic official
 * SDKs (`statusCode` on ElevenLabsError, `status` on OpenAI's/Anthropic's
 * APIError, both Stainless-generated, same shape), used to translate the
 * common, actionable cases into a short message instead of the SDK's raw
 * `Status code: 401\nBody: {...}` text. Anything not in this list falls
 * through to the SDK's own message, so unusual errors keep their detail.
 */
const describeSdkStatusError = (status: number | undefined): string | null => {
  switch (status) {
    case 401:
      return tr("Invalid API key — double-check it was copied correctly.");
    case 403:
      return tr("This API key doesn't have permission for this request — check your account's plan/scopes.");
    case 429:
      return tr("Rate limit or quota exceeded — wait a moment and try again, or check your usage/billing.");
    default:
      return null;
  }
};

// The codes ElevenLabs' error reference
// (elevenlabs.io/docs/eleven-api/resources/errors) uses for "this key itself
// is wrong", plus the older `status` value returned for a pasted key ID.
const INVALID_KEY_CODES = ["invalid_api_key", "api_key_id_used_as_api_key", "missing_api_key", "invalid_authorization_header"];

/** True if this error indicates the API key itself is wrong (not a
 *  transient/network/other-field problem) — used to flip the ElevenLabs
 *  key's status dot to "invalid" the moment a real call proves it, rather
 *  than the dot only ever reflecting "a string is saved" regardless of
 *  whether it actually works. */
const isInvalidApiKeyError = (e: any): boolean => {
  // Decided by the response's own code whenever it has one, not by the HTTP
  // status: a pasted key ID comes back as a 400, and ElevenLabs also answers 401
  // for exhausted credits and for a key missing a permission, neither of which
  // means the key is bad.
  const detail = sdkErrorDetail(e);
  if (detail && (detail.code || detail.status)) {
    return INVALID_KEY_CODES.indexOf(detail.code || "") !== -1 || INVALID_KEY_CODES.indexOf(detail.status || "") !== -1;
  }
  return (e?.statusCode ?? e?.status) === 401;
};

/** The structured `detail` object from an ElevenLabs error response, if
 *  there is one. The SDK error carries it as `body`; if only the formatted
 *  message survived ("Status code: 400\nBody: {...}"), it is parsed back out
 *  of that. Null for anything else, including OpenAI/Anthropic errors. */
function sdkErrorDetail(e: any): { type?: string; code?: string; status?: string; message?: string } | null {
  let body: any = e?.body;
  if (!body && typeof e?.message === "string") {
    const at = e.message.indexOf("Body:");
    if (at !== -1) {
      try {
        body = JSON.parse(e.message.slice(at + 5).trim());
      } catch (parseErr) {
        body = null;
      }
    }
  }
  const detail = body && typeof body === "object" ? body.detail : null;
  return detail && typeof detail === "object" ? detail : null;
}

/** Technical detail for the Diagnostics report that host messages can carry: a
 *  whole line starting with "Diagnostic:", or a "[diag: …]", "[diagnostic: …]"
 *  or "[split: …]" note inside a message. The panel shows the message without
 *  it; describeError keeps the notes of thrown errors for the report (the
 *  results of the last Cut, J/L Pacing, Speed etc. are in the report whole). */
const hostDiagnosticNotes: string[] = [];
const splitHostDiagnostics = (raw: string): { text: string; notes: string[] } => {
  if (/^Diagnostic:/.test(raw)) return { text: "", notes: [raw] };
  const notes: string[] = [];
  const open = /\s*\[(?:diag|diagnostic|split):/g;
  let text = "";
  let i = 0;
  while (i < raw.length) {
    open.lastIndex = i;
    const m = open.exec(raw);
    if (!m) {
      text += raw.slice(i);
      break;
    }
    text += raw.slice(i, m.index);
    const start = m.index + m[0].indexOf("[");
    let depth = 0;
    let end = raw.length - 1;
    for (let j = start; j < raw.length; j++) {
      if (raw[j] === "[") depth++;
      else if (raw[j] === "]" && --depth === 0) {
        end = j;
        break;
      }
    }
    notes.push(raw.slice(start, end + 1));
    i = end + 1;
  }
  return { text: text.trim(), notes };
};

/** Scan and Natural pitch work with one mono or stereo audio stream (stereo
 *  is mixed to one signal). A file with more channels, or with its channels
 *  as separate audio streams (common in camera files), would be analyzed or
 *  rendered as a mix of all of them, so it is refused with a way to make a
 *  mono file. Null when the file is fine or its layout can't be read. */
const audioLayoutRefusal = async (mediaPath: string): Promise<string | null> => {
  const { streams, channels } = await probeAudioLayout(mediaPath);
  const name = mediaPath.split(/[\\/]/).pop() || mediaPath;
  if (streams > 1) {
    return tr(
      '"{name}" has {count} separate audio tracks. The plugin works with files that have one mono or stereo audio track: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.',
      { name, count: String(streams) },
    );
  }
  if (channels !== null && channels > 2) {
    return tr(
      '"{name}" has {count} audio channels. The plugin works with mono and stereo files: export the voice as a mono file (File > Export > Media, Audio > Channels: Mono), import it and use that clip.',
      { name, count: String(channels) },
    );
  }
  return null;
};

/** The SDKs and fetch report a missing network with their own English text
 *  ("Failed to fetch", "Connection error.", a timeout on the request path), so
 *  the display gets one translated sentence instead. Host messages never
 *  carry these words. */
const isConnectionError = (e: any): boolean => {
  const name = String(e?.name || "");
  const msg = String(e?.message || "");
  if (/^(APIConnectionError|APIConnectionTimeoutError|ConnectionError)$/.test(name)) return true;
  return /Failed to fetch|fetch failed|Connection error\.|Request timed out\.|Timeout exceeded when calling|ECONNREFUSED|ENOTFOUND|ECONNRESET|ETIMEDOUT|EAI_AGAIN|NetworkError when attempting/i.test(
    msg,
  );
};

/** Plain error message for display: the message only, never ExtendScript's
 *  fileName/line fields (noise for ordinary validation errors like "no clip
 *  selected"). Diagnostic notes are split off into hostDiagnosticNotes for the
 *  report. */
const describeError = (e: any): string => {
  if (!e) return tr("Unknown error.");
  const detail = sdkErrorDetail(e);
  if (detail?.status === "api_key_id_used_as_api_key") {
    return tr(
      "This is the key's ID, not the key itself. ElevenLabs shows the key, which starts with sk_, only once, when it is created. Create a new key there and paste that one.",
    );
  }
  if (isInvalidApiKeyError(e)) return tr("Invalid API key — double-check it was copied correctly.");
  if (isConnectionError(e)) return tr("No connection to the service. Check the internet connection, then try again.");
  const status = e?.statusCode ?? e?.status;
  const codes = `${detail?.code || ""} ${detail?.status || ""}`;
  // A translated lead naming the cause, followed by the provider's own
  // sentence, which carries the specifics (credits left, permission name).
  const withDetail = (lead: string) => (detail?.message ? `${lead} ${detail.message}` : lead);
  if (/quota_exceeded|insufficient_credits/.test(codes)) {
    return withDetail(tr("Not enough ElevenLabs credits for this request."));
  }
  if (/missing_permissions|insufficient_permissions/.test(codes)) {
    return withDetail(
      tr(
        "This key works, but it isn't allowed to do this. In ElevenLabs, turn on the permission named below in the key's settings, or create a key with full access.",
      ),
    );
  }
  if (detail?.message) {
    // 401 is left out on purpose: with a detail present, a 401 that reached
    // here is NOT an invalid key (that was handled above), so the generic
    // "Invalid API key" text would be wrong.
    const friendly = status === 401 ? null : describeSdkStatusError(status);
    return friendly ? `${friendly} ${detail.message}` : detail.message;
  }
  const friendly = describeSdkStatusError(status);
  if (friendly) return friendly;
  // Errors thrown on the ExtendScript side arrive here as plain English;
  // anything that isn't one of those passes through unchanged.
  const { text, notes } = splitHostDiagnostics(e.message || String(e));
  for (const n of notes) hostDiagnosticNotes.push(n);
  if (hostDiagnosticNotes.length > 40) hostDiagnosticNotes.splice(0, hostDiagnosticNotes.length - 40);
  return translateHostMessage(text);
};

/** Generated file names carry the first words of the script (see
 *  buildGeneratedFileName); the Diagnostics report shows them with that part
 *  replaced, so it never contains script text. */
const redactScriptInFileNames = (text: string): string =>
  text.replace(/((?:elevenlabs-vc|elevenlabs|kokoro)_[^_"\\/]*_)[^"\\/]*?(_\d{4}-\d{2}-\d{2}T[\d-]+Z\.[a-z0-9]+)/gi, "$1[text]$2");

/**
 * One line for the session log (Diagnostics only, never shown in the UI)
 * with the raw cause behind a friendly message, which the friendly text alone
 * doesn't show.
 */
const rawErrorForLog = (e: any): string => {
  const detail = sdkErrorDetail(e);
  const status = e?.statusCode ?? e?.status ?? "?";
  if (detail) return `HTTP ${status} code=${detail.code ?? "-"} status=${detail.status ?? "-"} message=${detail.message ?? "-"}`;
  return `HTTP ${status} ${String(e?.message ?? e).slice(0, 300)}`;
};

/** The panel's own Undo can reverse a placement when it knows the placed clip
 *  (Replace only disables the original take, so it can always be turned back
 *  on). */
const canUndoGenerated = (r: ImportAudioResult): boolean => !!r.placedNodeId;

/** Undo button for a generated placement, or a pointer to Premiere's own
 *  undo when the panel can't reverse it exactly. */
const UndoGeneratedRow = ({ result, onUndo, busy }: { result: ImportAudioResult; onUndo: () => void; busy: boolean }) =>
  canUndoGenerated(result) ? (
    <div className="row">
      <button style={{ flex: 1 }} onClick={onUndo} disabled={busy}>
        {tr("Undo")}
      </button>
    </div>
  ) : (
    <p className="hint">{tr("To undo this, use Cmd/Ctrl+Z in Premiere.")}</p>
  );

interface VoicePickerOption {
  id: string;
  label: string;
  /** Short label for the favorites quick-access chip row — falls back to
   *  the full label if not given. */
  shortLabel?: string;
  /** Options are shown in the order given, with a header inserted whenever
   *  this changes from the previous option — callers are expected to sort
   *  by group themselves (see the ElevenLabs "My Voices"/"Stock voices"
   *  split in main.tsx). Omit entirely for an ungrouped list (Kokoro). */
  group?: string;
}

/**
 * Custom dropdown/listbox instead of a native <select>: in CEP's embedded
 * browser a native <select> popup doesn't render or respond reliably (a known
 * class of CEP issues with native popup widgets). Built from plain DOM: a
 * button showing the current selection toggles a popover (same
 * outside-click/Escape-to-close handling as the settings popover), with a
 * filter field once there are enough options to matter.
 *
 * Also renders a row of starred voices above the trigger when `favoriteIds` is
 * non-empty, so a favourite voice is one click away; each list item has its
 * own star toggle to manage that set.
 */
const VoicePicker = ({
  options,
  value,
  onChange,
  disabled,
  placeholder,
  favoriteIds,
  onToggleFavorite,
}: {
  options: VoicePickerOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder: string;
  favoriteIds?: string[];
  onToggleFavorite?: (id: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const favorites = favoriteIds?.length ? options.filter((o) => favoriteIds.includes(o.id)) : [];

  let lastGroup: string | undefined;

  return (
    <div className="voice-picker" ref={ref}>
      {favorites.length > 0 && (
        <div className="voice-picker-favorites">
          {favorites.map((o) => (
            <button
              key={o.id}
              type="button"
              className={o.id === value ? "voice-chip active" : "voice-chip"}
              onClick={() => onChange(o.id)}
              disabled={disabled}
              title={o.label}
            >
              ★ {o.shortLabel || o.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className="voice-picker-trigger" onClick={() => setOpen((o) => !o)} disabled={disabled || options.length === 0}>
        <span>{selected ? selected.label : placeholder}</span>
        <span className="voice-picker-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="voice-picker-popover" role="listbox">
          {options.length > 6 && (
            <input type="text" autoFocus placeholder={tr("Filter voices…")} value={query} onChange={(e) => setQuery(e.target.value)} />
          )}
          <div className="voice-picker-list">
            {filtered.length === 0 && <div className="voice-picker-empty">{tr("No matches.")}</div>}
            {filtered.map((o) => {
              const showGroupHeader = !q && o.group !== undefined && o.group !== lastGroup;
              lastGroup = o.group;
              const isFavorite = favoriteIds?.includes(o.id);
              return (
                <Fragment key={o.id}>
                  {showGroupHeader && <div className="voice-picker-group-header">{o.group}</div>}
                  <div
                    role="option"
                    aria-selected={o.id === value}
                    className={o.id === value ? "voice-picker-item active" : "voice-picker-item"}
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                  >
                    <span>{o.label}</span>
                    {onToggleFavorite && (
                      <span
                        className={isFavorite ? "voice-picker-star active" : "voice-picker-star"}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(o.id);
                        }}
                        title={isFavorite ? tr("Remove from favorites") : tr("Add to favorites")}
                      >
                        ★
                      </span>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const App = () => {
  const [tab, setTab] = useState<Tab>("voice");
  const [busy, setBusy] = useState(false);
  // Shown in the full-panel busy overlay below, which dims and blocks the whole
  // panel while a long operation runs: Premiere's ExtendScript engine can't
  // report progress mid-call, only "done" or "not done yet", so there is no real
  // percentage to show. Not reset in any `finally` block: it's only rendered
  // while `busy` is true, so a stale value between actions is harmless.
  const [busyLabel, setBusyLabel] = useState(tr("Working…"));

  // Polled while the Cut tab is open (see the effect below, like the AI Voice
  // tab's detectedClip poll): reflects what is selected on the timeline now,
  // not what was selected when Scan ran. Shows nothing when nothing (or more
  // than one clip) is selected, since getSelectedClipInfoIfAny returns null in
  // both cases.
  const [clipInfo, setClipInfo] = useState<ClipInfo | null>(null);
  // Snapshot of exactly what Scan actually analyzed (mediaPath is the
  // identity key, not clipName — two different source files can share a
  // display name, but never a path) — compared with the live clipInfo above:
  // the selection poll below clears the scan as soon as they no longer match.
  // The Cut tab's "selection changed" banners compare the two as well, as a
  // fallback for when the poll's selection read fails.
  const [scannedClipInfo, setScannedClipInfo] = useState<ClipInfo | null>(null);
  // Mirrors scannedClipInfo for the clipInfo poll below (its own interval
  // closure is only re-created when `tab` changes, so it would otherwise
  // keep comparing against a stale snapshot from whenever the poll last
  // restarted, missing every scan that happened since).
  const scannedClipInfoRef = useRef(scannedClipInfo);
  useEffect(() => {
    scannedClipInfoRef.current = scannedClipInfo;
  }, [scannedClipInfo]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  // ExtendScript load failure, shown in the panel instead of a modal dialog (see
  // evalES). initBolt's evalFile is fire-and-forget and settles after this
  // component mounts, so useJsxLoadError subscribes instead of reading once.
  const jsxLoadError = useJsxLoadError();
  // settings.json / presets.json couldn't be read or saved (see dataFile.ts).
  const dataFileProblems = useDataFileProblems();

  // Scan-preview playback (Waveform's Play button) — a file:// URL pointing
  // straight at the scanned clip's own source media (see ensurePreviewAudio
  // below), full original quality/channels, not a re-decoded copy. Cleared
  // whenever the underlying scan changes (below) so Play can never hand
  // back stale audio for a since-rescanned/different clip.
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewAudioError, setPreviewAudioError] = useState<string | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
  useEffect(() => {
    previewAudioUrlRef.current = previewAudioUrl;
  }, [previewAudioUrl]);

  const [detectMode, setDetectMode] = useState<DetectMode>("simple");
  // Aggressive is the default mode (see analyze.ts's MODES).
  const [simpleMode, setSimpleMode] = useState<string>("aggressive");
  const [advDb, setAdvDb] = useState(-42);
  const [advMinSilence, setAdvMinSilence] = useState(0.3);
  const [localSafetyCheck, setLocalSafetyCheck] = useState(false);
  const [regionOverrides, setRegionOverrides] = useState<Record<number, boolean>>({});
  // Scan-preview boundary dragging: boundary index i (the shared edge between
  // baseRegions[i] and baseRegions[i+1]) -> a manually dragged time, in
  // seconds. Applied on top of regionOverrides when building finalRegions
  // below.
  const [boundaryOverrides, setBoundaryOverrides] = useState<Record<number, number>>({});
  // Range-select (drag across the waveform, mark the whole span cut/keep in
  // one action) — applied on top of both overrides above, in the order the
  // drags happened, when building finalRegions below.
  const [rangeOverrides, setRangeOverrides] = useState<{ start: number; end: number; keep: boolean }[]>([]);
  // Undo for the waveform preview's own edits: client-side history, one entry
  // per edit, popped by undoLastToggle. Never Premiere's undo stack (how many
  // steps an operation leaves there is not known): this only reverts the
  // preview's in-memory state before Cut runs, so a plain snapshot stack is
  // safe. Each entry snapshots all three override states together, and all
  // three editing actions (toggleRegion, adjustBoundary, selectRange) push onto
  // this one stack, so Undo reverts any kind of edit.
  interface OverridesSnapshot {
    regionOverrides: Record<number, boolean>;
    boundaryOverrides: Record<number, number>;
    rangeOverrides: { start: number; end: number; keep: boolean }[];
  }
  const [toggleHistory, setToggleHistory] = useState<OverridesSnapshot[]>([]);
  // Mirror the three override states into refs so the memoized
  // adjustBoundary/selectRange callbacks below (stable identity is load-
  // bearing for them — see their own doc comments) can read the CURRENT
  // values at call time without needing those states in their own
  // dependency arrays, which would otherwise recreate them on every edit.
  const regionOverridesRef = useRef(regionOverrides);
  useEffect(() => {
    regionOverridesRef.current = regionOverrides;
  }, [regionOverrides]);
  const boundaryOverridesRef = useRef(boundaryOverrides);
  useEffect(() => {
    boundaryOverridesRef.current = boundaryOverrides;
  }, [boundaryOverrides]);
  const rangeOverridesRef = useRef(rangeOverrides);
  useEffect(() => {
    rangeOverridesRef.current = rangeOverrides;
  }, [rangeOverrides]);
  const snapshotOverrides = (): OverridesSnapshot => ({
    regionOverrides: regionOverridesRef.current,
    boundaryOverrides: boundaryOverridesRef.current,
    rangeOverrides: rangeOverridesRef.current,
  });

  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetName, setSelectedPresetName] = useState("");

  const [speedPercent, setSpeedPercent] = useState(100);
  // Raw text of the Speed % field, kept separate from the parsed number so
  // clearing the field to retype (e.g. deleting "100" to type "95") doesn't
  // get snapped back to 100 on every intermediate empty/partial keystroke.
  const [speedInput, setSpeedInput] = useState("100");
  // "calculator" is display-only: third-party plugins expose their parameters to
  // Premiere's scripting API in different ways that can't be guessed per plugin
  // (kHs Pitch Shifter's "Pitch", for one, is a normalized 0-1 host value although
  // its window shows semitones). So this mode shows the semitones/cents/ratio for
  // the current Speed % to type into the plugin's own UI by hand, which always
  // uses the plugin's intended mapping. "natural" (the first mode and the
  // default) re-renders sped-up pieces with ffmpeg's pitch-preserving atempo;
  // see naturalPitch.ts and ppro.ts's placeNaturalPitch.
  const [pitchMode, setPitchMode] = useState<"calculator" | "natural">("natural");
  // "Read from selected clip" (Calculator mode) — populates speedPercent/speedInput
  // from the selection's own real speed instead of leaving the user to
  // already know/type it. readClipSpeedMixed holds each distinct speed
  // found when the selection doesn't share one, since Calculator mode can only
  // show a single semitones value.
  const [readClipSpeedError, setReadClipSpeedError] = useState<string | null>(null);
  const [readClipSpeedMixed, setReadClipSpeedMixed] = useState<number[] | null>(null);
  const [speedApplyResult, setSpeedApplyResult] = useState<ApplySpeedResult | null>(null);
  const [pitchApplyResult, setPitchApplyResult] = useState<ApplyPitchResult | null>(null);
  // Natural pitch: everything its Revert needs, kept until Revert, a new
  // Scan or a new Cut. `renders` also lets J/L Pacing map a replaced piece
  // back to source seconds (see mapNaturalPitchSegments). `jlBefore` is the
  // J/L state when Natural pitch ran, put back on Revert, since Revert
  // restores the pieces exactly as they were then.
  const [naturalPitchInfo, setNaturalPitchInfo] = useState<{
    renders: { filePath: string; mediaPath: string; speedFactor: number; rangeStart: number }[];
    pieces: RenderUndoPiece[];
    tailFadeFrames: number[];
    headFadeFrames: number[];
    linkedVideoIds: string[][];
    hadPitch: boolean[];
    jlBefore: { result: JLCutResult | null; everRan: boolean; last: typeof lastJLApplied.current };
    sequenceId: string;
    sequenceName: string;
    placedNodeIds: string[];
    placedRenderPaths: string[];
  } | null>(null);
  const [naturalPitchResult, setNaturalPitchResult] = useState<{ replaced: number; skipped: number; warnings: string[] } | null>(null);
  const [naturalPitchError, setNaturalPitchError] = useState<string | null>(null);
  // Set when J/L Pacing runs (or is reset) after Natural pitch, so Revert
  // can say that the pieces at 100% speed keep that later layout, and so
  // undoNaturalPitch knows the placed clips may have new nodeIds.
  const jlChangedAfterNatural = useRef(false);
  // Set when "Revert to segments" puts Natural pitch's clips back as new track
  // items, so undoNaturalPitch looks for them by file (as after J/L Pacing).
  const naturalClipsReplaced = useRef(false);
  const [sendResult, setSendResult] = useState<SendToAEResult | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [renderPlaceResult, setRenderPlaceResult] = useState<PlaceFullTimelineRenderResult | null>(null);
  const [renderPlaceError, setRenderPlaceError] = useState<string | null>(null);
  // "Revert to segments" — the pieces a successful Render captured (see
  // FullTimelineRenderResult.pieces), kept around so the button can call
  // undoFullTimelineRender later. Cleared whenever a fresh Cut runs (same
  // staleness reasoning as lastCutSegments/cutResult — a new Cut means the
  // timeline no longer has anything this could meaningfully revert).
  const [renderUndoInfo, setRenderUndoInfo] = useState<{
    filePath: string;
    timelineStart: number;
    pieces: RenderUndoPiece[];
    /** J/L fades to put back on Revert (see renderUndoFadesFor). */
    fades: NaturalPitchFades;
    sequenceId: string;
    sequenceName: string;
    /** The clip placeFullTimelineRender placed; Revert removes only it. */
    placedNodeId: string;
  } | null>(null);
  const [renderUndoResult, setRenderUndoResult] = useState<UndoFullTimelineRenderResult | null>(null);
  const [renderUndoError, setRenderUndoError] = useState<string | null>(null);

  const [cutResult, setCutResult] = useState<CutResult | null>(null);
  const [cutError, setCutError] = useState<string | null>(null);
  // Mirrors cutResult/lastCutSourceInfo for the clip-info poll below, same
  // reasoning as scannedClipInfoRef right above — that poll's own interval
  // closure is only re-created when `tab` changes, so without this it would
  // keep comparing against a stale snapshot from whenever the poll last
  // restarted.
  const cutResultRef = useRef(cutResult);
  useEffect(() => {
    cutResultRef.current = cutResult;
  }, [cutResult]);

  // "J/L Pacing" (Pacing tab): a separate step after Cut (Silence Cut tab), never
  // part of cutSelectedClip; its state lives here because both tabs read it.
  // lastCutSegments is the exact list Cut used (snapshotted in handleCut, not the
  // live segmentsToCut, which changes with detect mode or regions after
  // cutting). Apply Speed rebuilds from it, and J/L Pacing compares its length
  // with the live selection to spot a partial selection. J/L Pacing itself reads
  // the selected pieces from the timeline, so it also works on pieces cut in an
  // earlier session. Aggressive is the default, matching the Silence Cut tab's
  // simpleMode default.
  const [jlCutPreset, setJlCutPreset] = useState<JLCutPreset>("aggressive");
  const [lastCutSegments, setLastCutSegments] = useState<CutSegment[] | null>(null);
  // Which source file lastCutSegments actually belongs to (mediaPath is the
  // identity key — see clipInfo/scannedClipInfo's own comment on why not
  // clipName) — captured from that Cut's own scannedClipInfo so the J/L
  // Pacing section (Pacing tab) can caption *which* prior Cut it's
  // about to act on, since by the time the user gets there the Silence Cut
  // tab (and whatever was literally selected at Cut time) is out of view.
  const [lastCutSourceInfo, setLastCutSourceInfo] = useState<{ mediaPath: string; clipName: string } | null>(null);
  const lastCutSourceInfoRef = useRef(lastCutSourceInfo);
  useEffect(() => {
    lastCutSourceInfoRef.current = lastCutSourceInfo;
  }, [lastCutSourceInfo]);
  const [jlCutResult, setJlCutResult] = useState<JLCutResult | null>(null);
  // Exactly what the last successful J/L Pacing run applied, in source seconds,
  // so Apply Speed can re-apply it. ppro.ts's applyJLCutSmoothing divides each
  // overlap by the shifted piece's current speed, so replaying the same
  // source-relative overlaps recomputes the overlap for the new speed. Keyed on
  // preset and piece identity, not a bare piece count. After a speed change,
  // piece starts read back exactly; the ends can overshoot slightly, which
  // getSelectedCutPieceInfo corrects at the source.
  const lastJLApplied = useRef<{
    overlapsSec: number[];
    tailFadeFrames: number[];
    headFadeFrames: number[];
    anchorStart: number | null;
    preset: JLCutPreset;
    pieces: { start: number; mediaPath: string }[];
  } | null>(null);
  const [jlCutError, setJlCutError] = useState<string | null>(null);
  // Separate from jlCutResult (which only reflects whether the current
  // arrangement has any overlap): true once J/L Pacing has run on this Cut, and
  // false again after Reset, which puts the pieces back in Cut's own shape (see
  // handleResetSmoothCuts). While true it disables Cut's own Undo button: J/L
  // Pacing moves pieces onto a second track, which undoCutViaRazor's rebuild
  // (see ppro.ts) doesn't reverse, since it only clears the original track's
  // span. Send to AE doesn't need it: it reads each piece's overlap directly off
  // the timeline.
  const [jlCutEverRan, setJlCutEverRan] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [diagPath, setDiagPath] = useState<string | null>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<ClearDataResult | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  // Warning before an operation that places fresh clips from the source file
  // (J/L Pacing, its Reset, the Speed rebuild, Cut's Undo, the reverts): the
  // effects it won't carry over, and a Continue/Cancel choice.
  const [effectsWarning, setEffectsWarning] = useState<{ action: string; effects: string[] } | null>(null);
  const effectsWarningResolve = useRef<((proceed: boolean) => void) | null>(null);

  // Confirm-before-leaving-Premiere dialog for "Give Feedback" (opens an
  // external site in the default browser) — skipped entirely once the user
  // has ever checked "remember my choice" (loadSkipExternalLinkConfirm).
  const [confirmLinkOpen, setConfirmLinkOpen] = useState(false);
  const [rememberLinkChoice, setRememberLinkChoice] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  // Where renders (Render full timeline, Natural pitch, Voice Changer) and AI
  // Voice's generated output are written: Documents (default) or next to the
  // current project file. Affects both tabs, so it lives in the gear-icon
  // settings popover. See settings.ts for why "Clear all data" never touches
  // the project-folder option.
  const [outputLocation, setOutputLocation] = useState<OutputLocation>("documents");
  // Shown once, on this machine's genuine first launch (settings.json has
  // never had an outputLocation key written to it at all — see
  // hasOutputLocationBeenSet's own comment for why that's different from
  // loadOutputLocation()'s always-defaulting-to-"documents" read) — asks the
  // user to pick a default up front instead of silently defaulting to
  // Documents and leaving them to discover the gear-icon toggle later.
  const [firstRunOutputPromptOpen, setFirstRunOutputPromptOpen] = useState(false);

  // Interface language — English/Russian/Spanish, see i18n/index.ts. Subscribes
  // this component to language changes (see useLanguage's own comment for why
  // just calling it once here is enough for the whole tree). Shown as its own
  // first-run step, gated the same "never explicitly set yet" way as
  // firstRunOutputPromptOpen above — shown first, before the output-location
  // step, so that step's own text already renders in the language just picked.
  const uiLanguage = useLanguage();
  const [firstRunLanguagePromptOpen, setFirstRunLanguagePromptOpen] = useState(false);
  const handleFirstRunLanguageChoice = (language: UiLanguage) => {
    setLanguage(language);
    setFirstRunLanguagePromptOpen(false);
    if (!hasOutputLocationBeenSet()) setFirstRunOutputPromptOpen(true);
  };

  // "License" modal (gear-icon settings popover) — read-only display of
  // licenseText.ts's content, plain local state, nothing to persist.
  const [licenseOpen, setLicenseOpen] = useState(false);

  // "Guide / FAQ" modal (gear-icon settings popover): read-only display of
  // guideText.ts's content.
  const [guideOpen, setGuideOpen] = useState(false);

  // "Licenses / Third-party notices" modal (gear-icon settings popover): shows
  // the bundled NOTICE.md (THIRD_PARTY_NOTICES, imported via Vite's `?raw`),
  // preformatted rather than through a markdown-rendering dependency.
  const [licensesOpen, setLicensesOpen] = useState(false);

  // AI Voice tab — two engines: ElevenLabs (BYO-key), Kokoro (bundled,
  // offline). apiKey/voices use their own small loading flags rather than
  // the shared `busy` above — that flag gates the deliberate, user-clicked
  // actions across every tab (Scan/Cut/Apply/Generate), and reusing it for
  // background "load my voice list" fetches would disable unrelated buttons
  // on other tabs for no reason.
  // No default engine — the user picks one explicitly before either
  // engine's own fields (and the shared Text/Generate controls below them)
  // appear, rather than silently defaulting to ElevenLabs on every open.
  const [voiceEngine, setVoiceEngine] = useState<"elevenlabs" | "kokoro" | null>(null);
  const [voiceText, setVoiceText] = useState("");
  // handleImproveScript's own API call can take several seconds, and the
  // Text field stays editable the whole time — this mirrors the live value
  // so that handler can tell, once the request resolves, whether the user
  // kept typing in the meantime instead of blindly overwriting it.
  const voiceTextRef = useRef(voiceText);
  useEffect(() => {
    voiceTextRef.current = voiceText;
  }, [voiceText]);
  // Mode toggle within whichever engine is picked above. Kokoro only ever
  // offers "tts"/"batch" (no speech-to-speech endpoint exists for it);
  // ElevenLabs additionally offers "voice-changer". Kept as one shared enum
  // (not two separate per-engine booleans) so switching engines mid-session
  // doesn't need to reconcile two independent toggles.
  const [voiceMode, setVoiceMode] = useState<"tts" | "voice-changer" | "batch">("tts");
  // "voice-changer" is only ever a valid mode for ElevenLabs — without this,
  // picking ElevenLabs -> Voice Changer -> then switching the engine to
  // Kokoro would leave voiceMode stuck on a value none of the tab's content
  // blocks match anymore (the mode toggle no longer even shows a "Voice
  // Changer" button for Kokoro), so the whole content area below would go
  // blank until the user happened to click a still-visible mode button.
  useEffect(() => {
    if (voiceMode === "voice-changer" && voiceEngine !== "elevenlabs") setVoiceMode("tts");
  }, [voiceEngine, voiceMode]);

  const [apiKey, setApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [apiKeyInputError, setApiKeyInputError] = useState<string | null>(null);
  // Shown whenever there's no saved key yet, or the user explicitly clicked
  // "Edit" — once a key is saved, the input+Save row hides in favor of a
  // plain green/red status dot and an Edit button, so the key (even masked)
  // isn't sitting on screen every time the tab is open.
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  // Set the moment a real call proves the saved key is wrong (an invalid-key
  // response from the voice-list load below), so the status dot reflects
  // whether the key works, not only that a string is saved. Reset to false on
  // every fresh save/reload attempt so a corrected key gets a clean re-check.
  const [apiKeyInvalid, setApiKeyInvalid] = useState(false);
  // True only once ElevenLabs has accepted the saved key (the voice list
  // loaded), so the indicator turns green only for a key that works, as the
  // Guide says.
  const [apiKeyVerified, setApiKeyVerified] = useState(false);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [voicesReloadToken, setVoicesReloadToken] = useState(0);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [elevenFavoriteIds, setElevenFavoriteIds] = useState<string[]>([]);
  // v2 (eleven_multilingual_v2) is the default. v3 (eleven_v3) is ElevenLabs'
  // expressive model: bracket audio tags ([excited], [whispers], etc.) work on
  // v3 (and v4), and on v3 only really register in its lower, "Creative"
  // stability range (its docs: high stability is "less responsive to
  // directional prompts like Audio Tags"), which is why REALISM_PRESETS_V3
  // below sets lower stability than the v2 table. v3 takes Stability alone.
  //
  // v4 (eleven_v4): 90+ languages, 10,000 characters per request. It takes only
  // Stability and Similarity ("Style and Speed sliders are not available in
  // Eleven v4"), so those controls are hidden for it and left out of the
  // request (see elevenTtsVoiceSettings). v3 and v4 are opt-ins.
  const [elevenModel, setElevenModel] = useState<"v2" | "v3" | "v4">("v2");
  // Realism presets replace raw sliders as the default control; see
  // REALISM_PRESETS below for the values and the tips text in the tab for the
  // reasoning. "advanced" reveals the Stability/Similarity/Style sliders for
  // fine-tuning beyond the presets. Same Automatic/Advanced convention as
  // Silence Cut's detection mode.
  const [realismMode, setRealismMode] = useState<"automatic" | "advanced">("automatic");
  const [realismPreset, setRealismPreset] = useState<"narration" | "expressive" | "calm">("narration");
  const [tipsOpen, setTipsOpen] = useState(false);
  // Stability/Similarity/Style as 0-100 (matching this panel's existing
  // dB/percent sliders); divided by 100 before being sent as ElevenLabs'
  // own 0-1 voice_settings. Defaults match the "narration" preset.
  const [stability, setStability] = useState(70);
  const [similarity, setSimilarity] = useState(85);
  const [style, setStyle] = useState(0);
  // Output quality/format for generated audio — see elevenlabs.ts's
  // ElevenLabsOutputFormat for the curated mp3/wav set exposed here.
  // Persisted (unlike elevenModel/realismMode above) since it's a
  // fire-and-forget preference with no per-script reason to change it,
  // closer to outputLocation than to a creative choice like Realism.
  const [elevenOutputFormat, setElevenOutputFormat] = useState<ElevenLabsOutputFormat>("mp3_44100_128");
  // Speed (0.7-1.2x, ElevenLabs' own generation-speed setting; see
  // VoiceSettings.speed's doc comment in elevenlabs.ts for how it differs from
  // the Pacing tab's Speed, which retimes clips on the timeline) as 70-120 to
  // match this panel's 0-100-scale sliders; divided by 100 before being sent.
  // Not persisted, and not part of the Realism presets: it stays where the user
  // sets it.
  const [speed, setSpeed] = useState(100);
  // ElevenLabs' own default is true (their API leaves it unset = enabled) —
  // matched here so leaving this control untouched behaves the same as not
  // sending the field at all.
  const [useSpeakerBoost, setUseSpeakerBoost] = useState(true);
  // Language Override: off by default; per ElevenLabs' docs it is ignored on
  // eleven_multilingual_v2 (which detects the language from the text), so the
  // control only renders for v3 and v4, and not in Voice Changer (see the JSX
  // below). The language list and ISO 639-1 codes are ElevenLabs' documented v3
  // language set (elevenlabs.io/docs/overview/models), minus a couple of names
  // with no clean 2-letter ISO 639-1 code (Cebuano, Filipino). Per ElevenLabs'
  // docs an unsupported code is ignored, not an error, so the worst case is a
  // no-op.
  const [languageOverrideEnabled, setLanguageOverrideEnabled] = useState(false);
  const [languageCode, setLanguageCode] = useState("");

  // Kokoro (bundled offline engine): the model only loads (~90 MB parsed + WASM
  // init) the first time this engine tab is opened, not on every panel mount.
  //
  // `kokoroVoicesCacheRef`: a window-level cache (the same persistentRef pattern
  // kokoro.ts uses for ttsPromiseRef). A panel reload creates a new React tree;
  // if the previous tree's listKokoroVoices() call is the one that resolves, it
  // updates a component that is no longer on screen, and the visible voice list
  // stays on "Loading model…". Seeding these three from the shared cache, and
  // writing into it whenever any instance's promise resolves (regardless of its
  // own `cancelled` flag), lets the visible tree see the result on its first
  // render. It doesn't prevent the reload itself, only this symptom.
  const kokoroVoicesCacheRef = persistentRef<KokoroVoice[]>("__kokoroVoicesCache", []);
  const [kokoroVoices, setKokoroVoices] = useState<KokoroVoice[]>(kokoroVoicesCacheRef.value);
  const [kokoroVoicesLoading, setKokoroVoicesLoading] = useState(false);
  const [kokoroVoicesError, setKokoroVoicesError] = useState<string | null>(null);
  // Empty until the voice list loads; the voice-loading effect below then picks
  // an en-us voice (and sets kokoroLanguageFilter) unless one was already
  // picked. The phonemization language comes entirely from the selected voice
  // (kokoro.ts's phonemizeForVoice), so the default is always English rather
  // than whichever voice loads first: a non-English script needs a deliberate
  // voice choice and is never phonemized in a mismatched language by accident.
  const [selectedKokoroVoiceId, setSelectedKokoroVoiceId] = useState("");
  const [kokoroFavoriteIds, setKokoroFavoriteIds] = useState<string[]>([]);
  // "" = show every language's voices (grouped); any other value narrows the
  // picker below to that one language.
  const [kokoroLanguageFilter, setKokoroLanguageFilter] = useState("");
  // A ref, not state: the loading effect below sets it first thing. As state
  // and a dependency of that effect, setting it would re-render and run the
  // in-flight effect's cleanup before the multi-second listKokoroVoices() call
  // resolves; `cancelled` would then be true, its .then() would do nothing, and
  // the voice list would never appear without a manual Retry. A plain "have I
  // started" guard must not be a reactive dependency.
  const kokoroLoadAttemptedRef = useRef(kokoroVoicesCacheRef.value.length > 0);
  const [kokoroReloadToken, setKokoroReloadToken] = useState(0);

  // "Quick voice swap": while a clip on the timeline is selected that this
  // extension itself generated (see generationMetadata.ts's sidecar files),
  // its original text/voice show up here so picking a different voice and
  // clicking "Replace Voice" swaps it in place instead of only inserting a new
  // clip at the playhead. Polled lightly while this tab is open rather than
  // requiring a manual "check selection" click — same precedent as this
  // file's own window-height poll elsewhere (see the app-sizing effect).
  const [detectedClip, setDetectedClip] = useState<{ mediaPath: string; nodeId: string; meta: GenerationMetadata } | null>(null);
  const autoFilledMediaPathRef = useRef<string | null>(null);
  // Tracks what this poll itself last wrote into voiceText, so it can tell
  // "the user hasn't touched what we auto-filled" (safe to replace with a
  // newly-selected clip's own script) apart from "the user is composing or
  // editing their own text" (never safe to silently overwrite).
  const lastAutoFilledTextRef = useRef<string | null>(null);
  // The generated clip whose own script the Text field was last loaded from
  // (by the poll or by "Load its text"); edits after loading still count.
  const [textLoadedFor, setTextLoadedFor] = useState<string | null>(null);
  // Replace Voice over a clip whose script isn't in the Text field asks for a
  // second click first; this holds the clip and text the first click was for.
  const replaceOtherTextConfirmed = useRef<string | null>(null);
  // Same poll as detectedClip above, just capturing the raw clip info
  // unconditionally (not only when it's this extension's own generated
  // clip) — Voice Changer needs to know a plain audio clip is selected
  // regardless of whether it carries a generation-metadata sidecar.
  const [voiceTabSelectedClip, setVoiceTabSelectedClip] = useState<ClipInfo | null>(null);

  const [genResult, setGenResult] = useState<ImportAudioResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // A take that was generated (paid) or converted but refused at placement:
  // the playhead was on a clip, the span was occupied, the selection changed.
  // Kept so "Place it again" can place the saved file without generating it
  // again; cleared by the next successful placement.
  const [unplacedTake, setUnplacedTake] = useState<{
    filePath: string;
    mode: "insert" | "replace";
    expectedClipNodeId?: string;
    /** A Voice Changer result: placed as a replace, shown in the Voice Changer view. */
    fromConvert?: boolean;
  } | null>(null);
  // Which action `genResult` actually belongs to — genResult/handleUndoGenerate
  // are shared across Insert, Replace, AND Voice Changer's Convert (all three
  // place-on-timeline results funnel through the same importAudioAndPlaceOnTimeline
  // call), so a single Undo button can't tell which of those it's undoing
  // without this. Used to show Undo inline next to the specific button that
  // produced the current result, instead of one detached Undo row that could
  // silently belong to a different action than whichever button is nearby.
  const [lastGenerateMode, setLastGenerateMode] = useState<"insert" | "replace" | "convert" | null>(null);

  // "Improve for voice" (scriptAssistant.ts): optional step above Generate,
  // BYO-key for whichever of OpenAI/Claude the user picks (see
  // scriptAssistant.ts). `assistantKeyInput`/`assistantKeyEditing` are
  // shared across both providers, same reasoning as ElevenLabs' single
  // apiKeyInput: only one provider's key-entry row is ever visible at once
  // (whichever the dropdown currently selects).
  const [assistantProvider, setAssistantProvider] = useState<AssistantProvider>("openai");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [assistantKeyInput, setAssistantKeyInput] = useState("");
  const [assistantKeyInputError, setAssistantKeyInputError] = useState<string | null>(null);
  const [assistantKeyEditing, setAssistantKeyEditing] = useState(false);
  const [improvingScript, setImprovingScript] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  // How much "Improve for voice" is allowed to do — see scriptAssistant.ts's
  // ScriptIntensity. One shared setting across both providers (unlike the
  // per-provider key/model state below), since it's a property of the
  // rewrite itself, not of which API delivers it.
  const [scriptIntensity, setScriptIntensity] = useState<ScriptIntensity>("natural");
  // Live GET /v1/models lists (see scriptAssistant.ts) — one cached list per
  // provider so switching the segmented toggle above doesn't re-fetch every
  // time, same reasoning as ElevenLabs' own voices list staying loaded
  // across tab switches. Model *choice* is per-provider too (a user's
  // preferred OpenAI model has no bearing on which Claude model they'd
  // pick), unlike scriptIntensity above.
  const [openaiModels, setOpenaiModels] = useState<ModelOption[]>([]);
  const [claudeModels, setClaudeModels] = useState<ModelOption[]>([]);
  const [openaiModelId, setOpenaiModelId] = useState("");
  const [claudeModelId, setClaudeModelId] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // Holds the pre-improve text so a single "Undo" can restore it; cleared
  // once the user edits the text further, so Undo never reverts work done
  // after the improve rather than the improve itself.
  const [lastImprovedFrom, setLastImprovedFrom] = useState<string | null>(null);

  // Batch generation — its own dedicated state, not the shared `busy` above
  // (same reasoning as voicesLoading/kokoroVoicesLoading: a multi-item
  // sequential run shouldn't disable every other tab's buttons for however
  // long it takes). One line of batchText = one queued item; "done" items
  // keep their filePath so re-running after adding more lines doesn't
  // regenerate them.
  const [batchText, setBatchText] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchImportResult, setBatchImportResult] = useState<BatchImportResult | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  // A neutral note under Generate All when a run has nothing to do (every line
  // is already placed), shown without the error styling of batchError.
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  // handleRunBatch's loop `await`s a paid API call per item, so it can't
  // just read the `batchItems` closure it captured at the top — a user
  // removing a still-pending item mid-run needs the *live* state, not a
  // stale snapshot, or the removed item still gets generated (billed) and
  // placed on the timeline despite no longer being in the visible queue.
  const batchItemsRef = useRef(batchItems);
  useEffect(() => {
    batchItemsRef.current = batchItems;
  }, [batchItems]);

  // Voice Changer (speech-to-speech, ElevenLabs only) — reuses genResult/
  // genError for its final placement banner (same ImportAudioResult shape
  // importAudioAndPlaceOnTimeline already returns), but needs its own staged
  // progress text since it's a multi-step pipeline (render → wait → convert
  // → place), not a single call.
  const [convertStage, setConvertStage] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  useEffect(() => {
    setPresets(loadPresets());
    setApiKey(loadElevenLabsApiKey());
    // A "Clear all data" that removed the settings but not every file: its
    // result was kept across the reload and is shown now (see handleClearData).
    try {
      const note = window.localStorage.getItem(CLEAR_DATA_NOTE_KEY);
      if (note) {
        window.localStorage.removeItem(CLEAR_DATA_NOTE_KEY);
        const parsed = JSON.parse(note);
        setClearResult({ ...parsed, cleared: false });
        setSettingsOpen(true);
      }
    } catch (e) {
      // no storage or an unreadable note: nothing to show
    }
    setElevenOutputFormat(loadElevenOutputFormat());
    setOpenaiKey(loadOpenAiApiKey());
    setAnthropicKey(loadAnthropicApiKey());
    setScriptIntensity(loadScriptIntensity());
    setOpenaiModelId(loadOpenAiModelId());
    setClaudeModelId(loadAnthropicModelId());
    setOutputLocation(loadOutputLocation());
    setElevenFavoriteIds(loadFavoriteVoiceIds("elevenlabs"));
    setKokoroFavoriteIds(loadFavoriteVoiceIds("kokoro"));
    // Language step first, output-location step second — see
    // handleFirstRunLanguageChoice, which opens the output-location prompt
    // itself once a language is picked. If language was already set on a
    // prior launch (e.g. only the output location was reset), go straight to
    // the output-location check.
    if (!hasUiLanguageBeenSet()) setFirstRunLanguagePromptOpen(true);
    else if (!hasOutputLocationBeenSet()) setFirstRunOutputPromptOpen(true);
    // One-time note about ffmpegPath.ts's macOS quarantine-clear/re-sign of the
    // bundled binaries (see that file). hasMacQuarantineEventEverLogged returns
    // true only once prepareMacBinary has cleared a quarantine attribute or
    // re-signed a bundled binary on this machine (in any session), so most users
    // never see it. Session log only, not a blocking dialog; it still reaches the
    // Diagnostics report through buildJsDiagnosticsSummary.
    if (!hasMacQuarantineNoticeBeenShown() && hasMacQuarantineEventEverLogged()) {
      appendLog(
        "Note: on this Mac, AI Voice Master Tool adjusted one of its own bundled command-line tools so it can run without a Gatekeeper prompt: it cleared a macOS download flag (com.apple.quarantine), or re-applied the tool's code signature because the existing one no longer verified. Only ever affects this app's own bundled files. See License > Third-party components for details; a local record is kept in Documents/AI Voice Master Tool/Diagnostics/macos-quarantine-clear.log.",
      );
      saveMacQuarantineNoticeShown();
    }
  }, []);

  // null: the change wasn't saved (the panel says why), so the stars stay as they were.
  const handleToggleElevenFavorite = (voiceId: string) => {
    const next = toggleFavoriteVoiceId("elevenlabs", voiceId);
    if (next) setElevenFavoriteIds(next);
  };
  const handleToggleKokoroFavorite = (voiceId: string) => {
    const next = toggleFavoriteVoiceId("kokoro", voiceId);
    if (next) setKokoroFavoriteIds(next);
  };

  const REALISM_PRESETS_V2 = {
    narration: { stability: 70, similarity: 85, style: 0 },
    expressive: { stability: 45, similarity: 80, style: 20 },
    calm: { stability: 85, similarity: 85, style: 0 },
  } as const;

  // v3's own docs: stability is the same 0-100 slider as v2, but v3 reads it
  // as three zones — low ("Creative", most expressive + most responsive to
  // audio tags), middle ("Natural"), high ("Robust", stable but "less
  // responsive to directional prompts like Audio Tags"). Pushed lower across
  // the board than the v2 table so tags actually register — a starting
  // point, not an empirically-tuned value; adjust from the Advanced sliders
  // per voice/script if a preset doesn't land right.
  const REALISM_PRESETS_V3 = {
    narration: { stability: 45, similarity: 85, style: 0 },
    expressive: { stability: 20, similarity: 80, style: 30 },
    calm: { stability: 65, similarity: 85, style: 0 },
  } as const;

  // v4 documents Stability only as "lower values allow more expressive,
  // varied delivery; higher values keep the performance closer to a fixed
  // baseline" — no zones like v3's. Starting points around ElevenLabs' own
  // usual 50/75, spread the same way as the other tables; style is not sent
  // for v4 at all (kept here only so the table has the same shape).
  const REALISM_PRESETS_V4 = {
    narration: { stability: 50, similarity: 80, style: 0 },
    expressive: { stability: 30, similarity: 75, style: 0 },
    calm: { stability: 70, similarity: 80, style: 0 },
  } as const;

  let REALISM_PRESETS: typeof REALISM_PRESETS_V2 | typeof REALISM_PRESETS_V3 | typeof REALISM_PRESETS_V4 = REALISM_PRESETS_V2;
  if (elevenModel === "v3") REALISM_PRESETS = REALISM_PRESETS_V3;
  else if (elevenModel === "v4") REALISM_PRESETS = REALISM_PRESETS_V4;

  const handleSelectRealismPreset = (preset: "narration" | "expressive" | "calm") => {
    setRealismPreset(preset);
    const p = REALISM_PRESETS[preset];
    setStability(p.stability);
    setSimilarity(p.similarity);
    setStyle(p.style);
  };

  // Switching the model (v2/v3/v4) changes which table REALISM_PRESETS points to (see
  // above) — without this, the currently-selected preset button would stay
  // highlighted while the actual Stability/Similarity/Style values silently
  // kept whichever model's numbers were applied last, until the user
  // happened to reclick the same preset. Re-applies automatically instead;
  // only touches values when a preset (not custom Advanced tuning) is active.
  useEffect(() => {
    if (realismMode !== "automatic") return;
    const p = REALISM_PRESETS[realismPreset];
    setStability(p.stability);
    setSimilarity(p.similarity);
    setStyle(p.style);
  }, [elevenModel]);

  // Curated output-format list; see elevenlabs.ts's ElevenLabsOutputFormat doc
  // comment for why it stops here (no raw PCM/Opus/mu-law) although ElevenLabs'
  // API supports more. The tier requirements below come from the installed
  // SDK's request-type doc comments (the same wording as ElevenLabs' API
  // reference). Not enforced client-side: a lower-tier account just gets a
  // normal API error back if it picks a gated format.
  // - mp3 32/64/96/128kbps: no tier requirement (works on Free).
  // - mp3 192kbps: Creator tier or above.
  // - wav_44100 (and pcm at 44.1kHz, not exposed here): Pro tier or above; the
  //   only tier note ElevenLabs' docs give for any wav/pcm format.
  // - wav_48000: not covered by that note or anywhere else in ElevenLabs'
  //   docs/SDK. Almost certainly needs at least Pro (48kHz is above the 44.1kHz
  //   tier gate), possibly higher (Scale), so it is labeled as unconfirmed
  //   rather than naming a tier that can't be verified.
  const elevenOutputFormatOptions: VoicePickerOption[] = useMemo(
    () => [
      { id: "mp3_44100_32", label: tr("MP3 · 32 kbps (smallest file)"), group: tr("MP3 (compressed)") },
      { id: "mp3_44100_64", label: tr("MP3 · 64 kbps"), group: tr("MP3 (compressed)") },
      { id: "mp3_44100_96", label: tr("MP3 · 96 kbps"), group: tr("MP3 (compressed)") },
      { id: "mp3_44100_128", label: tr("MP3 · 128 kbps (default)"), group: tr("MP3 (compressed)") },
      { id: "mp3_44100_192", label: tr("MP3 · 192 kbps (Creator tier+)"), group: tr("MP3 (compressed)") },
      { id: "wav_44100", label: tr("WAV · 44.1kHz (lossless, Pro tier+)"), group: tr("WAV (uncompressed)") },
      { id: "wav_48000", label: tr("WAV · 48kHz (lossless, may need a higher ElevenLabs plan)"), group: tr("WAV (uncompressed)") },
    ],
    [uiLanguage],
  );

  // ElevenLabs' documented v3 language list (elevenlabs.io/docs/overview/models;
  // see the languageOverrideEnabled comment above for the two left out) with
  // standard ISO 639-1 codes. "" (Auto) lets the user turn Language Override
  // back off without a separate control.
  const elevenLanguageOptions: VoicePickerOption[] = useMemo(
    () => [
      { id: "", label: tr("Auto-detect") },
      { id: "af", label: tr("Afrikaans") },
      { id: "ar", label: tr("Arabic") },
      { id: "hy", label: tr("Armenian") },
      { id: "as", label: tr("Assamese") },
      { id: "az", label: tr("Azerbaijani") },
      { id: "be", label: tr("Belarusian") },
      { id: "bn", label: tr("Bengali") },
      { id: "bs", label: tr("Bosnian") },
      { id: "bg", label: tr("Bulgarian") },
      { id: "ca", label: tr("Catalan") },
      { id: "hr", label: tr("Croatian") },
      { id: "cs", label: tr("Czech") },
      { id: "da", label: tr("Danish") },
      { id: "nl", label: tr("Dutch") },
      { id: "en", label: tr("English") },
      { id: "et", label: tr("Estonian") },
      { id: "fi", label: tr("Finnish") },
      { id: "fr", label: tr("French") },
      { id: "gl", label: tr("Galician") },
      { id: "ka", label: tr("Georgian") },
      { id: "de", label: tr("German") },
      { id: "el", label: tr("Greek") },
      { id: "gu", label: tr("Gujarati") },
      { id: "ha", label: tr("Hausa") },
      { id: "he", label: tr("Hebrew") },
      { id: "hi", label: tr("Hindi") },
      { id: "hu", label: tr("Hungarian") },
      { id: "is", label: tr("Icelandic") },
      { id: "id", label: tr("Indonesian") },
      { id: "ga", label: tr("Irish") },
      { id: "it", label: tr("Italian") },
      { id: "ja", label: tr("Japanese") },
      { id: "jv", label: tr("Javanese") },
      { id: "kn", label: tr("Kannada") },
      { id: "kk", label: tr("Kazakh") },
      { id: "ky", label: tr("Kirghiz") },
      { id: "ko", label: tr("Korean") },
      { id: "lv", label: tr("Latvian") },
      { id: "ln", label: tr("Lingala") },
      { id: "lt", label: tr("Lithuanian") },
      { id: "lb", label: tr("Luxembourgish") },
      { id: "mk", label: tr("Macedonian") },
      { id: "ms", label: tr("Malay") },
      { id: "ml", label: tr("Malayalam") },
      { id: "zh", label: tr("Mandarin Chinese") },
      { id: "mr", label: tr("Marathi") },
      { id: "ne", label: tr("Nepali") },
      { id: "no", label: tr("Norwegian") },
      { id: "ny", label: tr("Chichewa") },
      { id: "ps", label: tr("Pashto") },
      { id: "fa", label: tr("Persian") },
      { id: "pl", label: tr("Polish") },
      { id: "pt", label: tr("Portuguese") },
      { id: "pa", label: tr("Punjabi") },
      { id: "ro", label: tr("Romanian") },
      { id: "ru", label: tr("Russian") },
      { id: "sr", label: tr("Serbian") },
      { id: "sd", label: tr("Sindhi") },
      { id: "sk", label: tr("Slovak") },
      { id: "sl", label: tr("Slovenian") },
      { id: "so", label: tr("Somali") },
      { id: "es", label: tr("Spanish") },
      { id: "sw", label: tr("Swahili") },
      { id: "sv", label: tr("Swedish") },
      { id: "ta", label: tr("Tamil") },
      { id: "te", label: tr("Telugu") },
      { id: "th", label: tr("Thai") },
      { id: "tr", label: tr("Turkish") },
      { id: "uk", label: tr("Ukrainian") },
      { id: "ur", label: tr("Urdu") },
      { id: "vi", label: tr("Vietnamese") },
      { id: "cy", label: tr("Welsh") },
    ],
    [uiLanguage],
  );

  // Grouped, favorites-aware ElevenLabs voice list — "My Voices" (anything
  // not ElevenLabs' own "premade" stock category: cloned/professional/
  // generated) ahead of "Stock voices", so a user's own saved voices are
  // the first thing they see rather than buried in ~20 stock defaults.
  const elevenVoiceOptions: VoicePickerOption[] = useMemo(() => {
    const toOption = (v: ElevenLabsVoice, group: string): VoicePickerOption => ({
      id: v.voiceId,
      label: v.name + (v.labels ? ` — ${v.labels}` : ""),
      shortLabel: v.name,
      group,
    });
    const mine = voices.filter((v) => v.category !== "premade").map((v) => toOption(v, tr("My Voices")));
    const stock = voices.filter((v) => v.category === "premade").map((v) => toOption(v, tr("Stock voices")));
    return [...mine, ...stock];
  }, [voices, uiLanguage]);

  // Grouped by language so the English and multilingual voices (Spanish, French,
  // Hindi, Italian, Brazilian Portuguese) don't show up as one flat list. Group
  // labels match the languages this panel exposes, not every code in Kokoro's
  // registry.
  const KOKORO_LANGUAGE_ORDER = ["en-us", "en-gb", "es", "fr", "it", "pt-br", "hi"];
  const KOKORO_LANGUAGE_GROUPS: Record<string, string> = {
    "en-us": tr("English (US)"),
    "en-gb": tr("English (UK)"),
    "es": tr("Spanish"),
    "fr": tr("French"),
    "hi": tr("Hindi"),
    "it": tr("Italian"),
    "pt-br": tr("Portuguese (Brazil)"),
  };
  // A dedicated language filter (its own small VoicePicker, not a native
  // <select>: this CEP panel's webview doesn't reliably render native select
  // popups, the same reason VoicePicker is custom-built) narrows the voice list
  // below to one language at a time.
  const kokoroLanguageOptions: VoicePickerOption[] = useMemo(() => {
    const present = new Set(kokoroVoices.map((v) => v.language));
    const opts: VoicePickerOption[] = [{ id: "", label: tr("All languages") }];
    for (const lang of KOKORO_LANGUAGE_ORDER) {
      if (present.has(lang)) opts.push({ id: lang, label: KOKORO_LANGUAGE_GROUPS[lang] || lang });
    }
    return opts;
  }, [kokoroVoices, uiLanguage]);
  const kokoroVoiceOptions: VoicePickerOption[] = useMemo(() => {
    const filtered = kokoroLanguageFilter ? kokoroVoices.filter((v) => v.language === kokoroLanguageFilter) : kokoroVoices;
    const sorted = [...filtered].sort((a, b) => KOKORO_LANGUAGE_ORDER.indexOf(a.language) - KOKORO_LANGUAGE_ORDER.indexOf(b.language));
    return sorted.map((v) => ({
      id: v.id,
      label: `${v.name} (${v.gender})`,
      shortLabel: v.name,
      // No group headers needed once a single language is already selected
      // above — only useful for the "All languages" view.
      group: kokoroLanguageFilter ? undefined : KOKORO_LANGUAGE_GROUPS[v.language] || v.language,
    }));
  }, [kokoroVoices, kokoroLanguageFilter, uiLanguage]);

  // Lightly polls the current timeline selection while this tab is open: the
  // panel's CEP/ExtendScript bridge has no selection-changed event wired up, so
  // a slow poll is used, as for window-height tracking below. getSelectedClipInfoIfAny
  // never throws (returns null instead), so this can run continuously
  // without ever surfacing an error banner for "nothing selected," which is
  // the normal state most of the time.
  useEffect(() => {
    if (tab !== "voice") return;
    let cancelled = false;
    const check = async () => {
      try {
        const info = await evalTS("getSelectedClipInfoIfAny");
        if (cancelled) return;
        setVoiceTabSelectedClip(info);
        const meta = info && info.mediaPath ? readGenerationMetadata(info.mediaPath) : null;
        if (!info || !meta) {
          setDetectedClip(null);
          return;
        }
        setDetectedClip({ mediaPath: info.mediaPath, nodeId: info.nodeId, meta });
        if (autoFilledMediaPathRef.current !== info.mediaPath) {
          autoFilledMediaPathRef.current = info.mediaPath;
          // Only overwrite the Text field if it's empty or still exactly what this poll
          // last auto-filled, i.e. the user hasn't started writing or editing since:
          // clicking around the timeline while drafting a script (landing on an
          // already-generated clip) must never replace what is being typed.
          const current = voiceTextRef.current;
          if (current.trim() === "" || current === lastAutoFilledTextRef.current) {
            lastAutoFilledTextRef.current = meta.text;
            setVoiceText(meta.text);
            setTextLoadedFor(info.mediaPath);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setDetectedClip(null);
          setVoiceTabSelectedClip(null);
        }
      }
    };
    check();
    const pollId = window.setInterval(check, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [tab]);

  // Same pattern as the AI Voice tab's poll right above — keeps clipInfo (the
  // "currently selected clip" badge near Scan) honest about the *live*
  // timeline selection instead of frozen at whatever Scan last saw. Null
  // whenever nothing, or more than one clip, is selected — including right
  // after Cut (multiple pieces end up selected), which is expected: the
  // badge is about "what would Scan analyze right now," not a record of past
  // Cuts (see lastCutSourceInfo for that).
  useEffect(() => {
    if (tab !== "cut") return;
    let cancelled = false;
    const check = async () => {
      try {
        const info = await evalTS("getSelectedClipInfoIfAny");
        if (cancelled) return;
        setClipInfo(info);
        // When the live selection no longer matches what Scan analyzed (a different
        // clip, or nothing/multiple selected), clear the scan itself, so the tab
        // returns to its plain "select a clip and click Scan" state instead of
        // showing the previous clip's waveform and results under a warning.
        //
        // Exception: `info` is also null right after a successful Cut, which leaves
        // all its new pieces selected (more than one item, which
        // getSelectedClipInfoIfAny treats like "nothing selected"). The clear is
        // skipped when a still-current Cut result's source matches this scan's;
        // selecting something else still clears.
        const scanned = scannedClipInfoRef.current;
        // Only suppresses the "nothing/multiple selected" branch — a real
        // "user selected a different single clip" mismatch (info truthy,
        // different mediaPath) still clears normally regardless.
        const justCutThisScan =
          !info &&
          !!(
            cutResultRef.current &&
            lastCutSourceInfoRef.current &&
            scanned &&
            lastCutSourceInfoRef.current.mediaPath === scanned.mediaPath
          );
        if (scanned && !justCutThisScan && (!info || info.mediaPath !== scanned.mediaPath)) {
          setScanResult(null);
          setScannedClipInfo(null);
          setScanError(null);
          setRegionOverrides({});
        }
      } catch (e) {
        if (!cancelled) setClipInfo(null);
      }
    };
    check();
    const pollId = window.setInterval(check, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, [tab]);

  // "Next to project" needs a saved project; until then everything goes to
  // Documents. Said once per session, the first time it happens: in a neutral
  // banner above the tabs (until closed, until a later lookup finds the saved
  // project, or until Save Renders is set to Documents) and in the session log.
  const unsavedProjectNoted = useRef(false);
  const [unsavedProjectNotice, setUnsavedProjectNotice] = useState<string | null>(null);

  const handleOutputLocationChange = (location: OutputLocation) => {
    setOutputLocation(location);
    saveOutputLocation(location);
    if (location !== "project") setUnsavedProjectNotice(null);
  };

  const handleFirstRunOutputChoice = (location: OutputLocation) => {
    handleOutputLocationChange(location);
    setFirstRunOutputPromptOpen(false);
  };

  /** Resolves the project's own folder for the "save next to project"
   *  option (only ExtendScript can read app.project.path) — returns null
   *  (falling back to Documents) both when the setting is off and when the
   *  project has never been saved yet. */
  const resolveProjectFolderIfEnabled = async (): Promise<string | null> => {
    if (outputLocation !== "project") return null;
    try {
      const res = await evalTS("getProjectFolderPath");
      if (!res.path) noteUnsavedProject();
      else setUnsavedProjectNotice(null);
      return res.path;
    } catch (e) {
      return null;
    }
  };

  const noteUnsavedProject = () => {
    if (unsavedProjectNoted.current) return;
    unsavedProjectNoted.current = true;
    const note = tr(
      "The project hasn't been saved yet, so new files go to Documents/AI Voice Master Tool instead of next to the project. Save the project once to use the project folder.",
    );
    setUnsavedProjectNotice(note);
    appendLog(note);
  };
  /** For the steps that pick their folder on the ExtendScript side (renders):
   *  the same note when "Next to project" can't be used yet, and the note
   *  cleared once the project has been saved. */
  const checkProjectFolderAvailable = async () => {
    if (outputLocation !== "project") return;
    try {
      const res = await evalTS("getProjectFolderPath");
      if (!res.path) noteUnsavedProject();
      else setUnsavedProjectNotice(null);
    } catch (e) {
      // unknown: no note
    }
  };

  // Reloads the voice picker whenever the saved key changes (including once,
  // on mount, if a key was already saved from a previous session) — plus a
  // manual reloadToken bump, since re-saving the *same* key string (e.g.
  // retrying after a transient fetch failure) wouldn't otherwise re-run this
  // effect at all (React skips it when the dependency's value is unchanged),
  // leaving no way to recover from a one-time failure short of restarting
  // the whole panel. The "Reload voices" button below bumps this token.
  useEffect(() => {
    setApiKeyVerified(false);
    if (!apiKey) {
      setVoices([]);
      return;
    }
    // A saved key can still be malformed: say what is wrong with it instead of
    // letting the request fail with the browser's own header error.
    const storedProblem = apiKeyProblem(apiKey);
    if (storedProblem) {
      setVoices([]);
      setVoicesError(tr(storedProblem));
      setApiKeyInvalid(true);
      return;
    }
    let cancelled = false;
    setVoicesLoading(true);
    setVoicesError(null);
    import("../lib/elevenlabs")
      .then(({ listVoices }) => listVoices(apiKey))
      .then((v) => {
        if (cancelled) return;
        setApiKeyInvalid(false);
        setApiKeyVerified(true);
        setVoices(v);
        // Revalidate, don't just fill in a default when empty — `prev` can
        // be a voice ID left over from a *different* ElevenLabs account's
        // key (this effect's own deps include `apiKey`, so it re-runs on a
        // genuine key change), which wouldn't exist in this account's own
        // voice list at all. Falling through to Generate/Batch/Voice
        // Changer with that stale ID either errors or, worse, silently
        // hits an unrelated voice if the ID happens to collide with a
        // shared/premade one. Same revalidation as the Kokoro language
        // filter's onChange.
        setSelectedVoiceId((prev) => (prev && v.some((voice) => voice.voiceId === prev) ? prev : v[0]?.voiceId || ""));
        if (v.length === 0) setVoicesError(tr("No voices returned for this key — check it's correct and active."));
      })
      .catch((e) => {
        if (cancelled) return;
        setVoicesError(describeError(e));
        appendLog(`Voice list failed: ${rawErrorForLog(e)}`);
        if (isInvalidApiKeyError(e)) setApiKeyInvalid(true);
      })
      .finally(() => {
        if (!cancelled) setVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey, voicesReloadToken]);

  // Loads the Kokoro model (and its voice list) the first time that engine tab
  // is opened, not on mount: loading it is a real cost for anyone who only uses
  // ElevenLabs. kokoroReloadToken lets "Retry" force a fresh attempt even though
  // kokoroLoadAttemptedRef would otherwise block re-running after the first
  // (possibly failed) try. That ref is deliberately not state and not in this
  // effect's dependency array; see its declaration.
  useEffect(() => {
    if (voiceEngine !== "kokoro" || kokoroLoadAttemptedRef.current) return;
    kokoroLoadAttemptedRef.current = true;
    let cancelled = false;
    setKokoroVoicesLoading(true);
    setKokoroVoicesError(null);
    listKokoroVoices()
      .then((v) => {
        // Written before the `cancelled` check on purpose — see
        // kokoroVoicesCacheRef's own comment above this state block.
        kokoroVoicesCacheRef.value = v;
        if (cancelled) return;
        setKokoroVoices(v);
        // Default to English (language filter + first English voice) once the list
        // resolves; see selectedKokoroVoiceId's declaration comment for why English.
        // The `prev || …` guards mean this only fills in an actually-empty choice and
        // never overwrites one the user (or a restored favourite/session state)
        // already made.
        const firstEnglish = v.find((voice) => voice.language === "en-us") || v.find((voice) => voice.language === "en-gb");
        setKokoroLanguageFilter((prev) => prev || firstEnglish?.language || prev);
        setSelectedKokoroVoiceId((prev) => prev || firstEnglish?.id || prev);
        if (v.length === 0) {
          const diag = getKokoroDiagnostics();
          const detail = diag.lastError ? `: ${diag.lastError}` : "";
          setKokoroVoicesError(tr("Kokoro model failed to load{detail}.", { detail }));
        }
      })
      .catch((e) => {
        if (!cancelled) setKokoroVoicesError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setKokoroVoicesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [voiceEngine, kokoroReloadToken]);

  // The same default when the list came from the window-level cache (a panel
  // reload keeps the voices but not this component's choice): without it the
  // list shows and Generate stays disabled with nothing selected.
  useEffect(() => {
    if (kokoroVoices.length === 0) return;
    const firstEnglish =
      kokoroVoices.find((voice) => voice.language === "en-us") || kokoroVoices.find((voice) => voice.language === "en-gb");
    setKokoroLanguageFilter((prev) => prev || firstEnglish?.language || prev);
    setSelectedKokoroVoiceId((prev) => prev || firstEnglish?.id || prev);
  }, [kokoroVoices]);

  // Docked CEP panels in Premiere Pro don't reliably tell their CEF render
  // surface about the workspace's real allocated dock area, a documented
  // Adobe/CEP limitation, not a CSS bug: CSInterface's resizeContent() doc says
  // "does not work... Premiere Pro", and Adobe staff on the community forum
  // confirm "once panels are docked, the Workspace, not the panel, determines
  // dimensions." So `.app`'s `height: 100%`/`100vh` can be correct on paper
  // while tracking the wrong underlying size, if the host never triggers the
  // layout recompute a real resize would. Best-effort mitigation: read
  // `window.innerHeight` directly (the browser's most direct size signal,
  // independent of the vh/% cascade) on mount, on every native resize event,
  // via a ResizeObserver on <html> (size changes that dispatch no `resize`
  // event), and on a slow poll (a delayed dock-settle resize with no event at
  // all), written to a CSS custom property `.app` reads instead of a
  // percentage/viewport unit. If Premiere never updates the render surface's
  // real size at all, nothing JS-side can fix that, but this is the most direct
  // signal available if it does.
  useEffect(() => {
    const applyRealHeight = () => {
      const h = window.innerHeight;
      if (h > 0) document.documentElement.style.setProperty("--real-height", `${h}px`);
    };
    applyRealHeight();
    window.addEventListener("resize", applyRealHeight);
    const ro = new ResizeObserver(applyRealHeight);
    ro.observe(document.documentElement);
    const pollId = window.setInterval(applyRealHeight, 1000);
    return () => {
      window.removeEventListener("resize", applyRealHeight);
      ro.disconnect();
      window.clearInterval(pollId);
    };
  }, []);

  // Resolves ExtendScript's real Documents-folder path once, early, so
  // getGeneratedAudioDir (genAudioDir.ts) uses it instead of its own
  // Node-side naive fallback for the rest of the session — see that file's
  // own comment on why the two can otherwise silently disagree (Windows +
  // OneDrive's Documents redirect).
  useEffect(() => {
    primeDocumentsPathCache();
  }, []);

  // Close the settings popover on an outside click or Escape — standard
  // dropdown behavior, expected by anyone used to Premiere's own panels.
  useEffect(() => {
    if (!settingsOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

  // Once a scan comes back, default the Advanced threshold to halfway between
  // the detected noise floor and speech level (dB), so the slider starts
  // somewhere sensible.
  useEffect(() => {
    if (scanResult) {
      setAdvDb(Math.round((scanResult.floorDb + scanResult.speechDb) / 2));
    }
  }, [scanResult]);

  const appendLog = (msg: string) => setLog((l) => [...l, msg]);

  // ExtendScript (ppro.ts/aeft.ts) runs in a separate runtime without this
  // file's i18n dictionaries, so every warning it returns is plain English
  // whatever the panel's language. Rather than making every host call site
  // return {template, params}, the dynamic part is matched back out of the
  // formatted English string and re-rendered through tr()'s {placeholder}
  // substitution (see lib/i18n/index.ts). Falls back to the raw string if
  // nothing matches: never throws, never hides a warning.
  const WARNING_PATTERNS: { re: RegExp; key: string; paramNames: string[] }[] = [
    {
      re: /Note: a clip from another file \("([^"]+)"\) is close to this Cut on the same track\. J\/L Pacing on either file may be blocked later as a safety measure\. If you plan to use J\/L Pacing on either one, do it now, before cutting anything else nearby, or leave more space between the files' cuts \(or use a different track\)\./,
      key: 'Note: a clip from another file ("{clipName}") is close to this Cut on the same track. J/L Pacing on either file may be blocked later as a safety measure. If you plan to use J/L Pacing on either one, do it now, before cutting anything else nearby, or leave more space between the files\' cuts (or use a different track).',
      paramNames: ["clipName"],
    },
    {
      // See ppro.ts's doc comment on ANCHOR_DRIFT_TOLERANCE_SEC.
      re: /Note: these pieces now sit at ([\d.]+)s, far from where Cut placed them \(([\d.]+)s\), so they were rebuilt where they are now, not moved back\./,
      key: "Note: these pieces now sit at {currentSec}s, far from where Cut placed them ({originalSec}s), so they were rebuilt where they are now, not moved back.",
      paramNames: ["currentSec", "originalSec"],
    },
  ];
  const translateWarning = (raw: string): string => {
    // Every ExtendScript message has a translation in lib/i18n/hostMessages.ts.
    // The two patterns above stay as a fallback for their messages turning up
    // inside a longer string.
    const { text } = splitHostDiagnostics(raw);
    if (!text) return "";
    const whole = translateHostMessage(text);
    if (whole !== text) return whole;
    let out = text;
    for (const { re, key, paramNames } of WARNING_PATTERNS) {
      out = out.replace(re, (...args) => {
        const vars: Record<string, string> = {};
        paramNames.forEach((name, i) => (vars[name] = args[i + 1]));
        return tr(key, vars);
      });
    }
    return out;
  };
  // The warnings a banner shows: translated, without diagnostic notes and lines.
  const shownWarnings = (warnings: string[]): string[] => warnings.map(translateWarning).filter((w) => w);

  // When the selected preset found pauses but cut none, say why and what to do
  // instead of leaving "0 cuts" unexplained: typically every pause is shorter
  // than the shortest pause Normal and Gentle cut. Points to Aggressive (when it
  // does cut this clip) or to Advanced, where the minimum pause is set by hand.
  // Reads scan facts only.
  const pauseTooShortHint: string | null = (() => {
    if (!scanResult || detectMode !== "simple") return null;
    const stats = scanResult.pauseStatsByMode?.[simpleMode];
    if (!stats || stats.detectedCount === 0) return null;
    const pick = (name: string) => scanResult.segmentsByModeWordSnapped?.[name] ?? scanResult.segmentsByMode[name] ?? [];
    if (pick(simpleMode).length > 1) return null; // this preset does cut something
    const shortName: Record<string, string> = { aggressive: "Aggressive", normal: "Normal", gentle: "Gentle" };
    const vars = {
      mode: tr(shortName[simpleMode] ?? simpleMode),
      count: stats.detectedCount,
      longest: stats.longestSec.toFixed(2),
      min: stats.minCuttableSec.toFixed(2),
    };
    const aggressiveCuts = simpleMode !== "aggressive" && pick("aggressive").length > 1;
    return aggressiveCuts
      ? tr(
          "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. Aggressive does cut this clip, or you can set your own minimum pause in Advanced.",
          vars,
        )
      : tr(
          "No pause in this clip is long enough for {mode}: the detector found {count}, the longest is {longest} s, and {mode} only cuts pauses longer than about {min} s. To cut them anyway, set your own minimum pause in Advanced.",
          vars,
        );
  })();

  // What the algorithm detected, before any manual click-to-toggle. Cheap
  // re-derivation, no re-transcription: `words` was computed once by Scan, so
  // this can re-run on every slider tick like buildSegmentsAdvanced does. Uses
  // the same shared, lenient wordSnapEnergyGate as the presets, not Advanced
  // mode's live dB threshold (see ScanResult.wordSnapEnergyGate in analyze.ts):
  // a strict manual threshold would make word-snap unable to rescue a quiet but
  // real word ending.
  const autoSegments: CutSegment[] = useMemo(
    () => computeAutoSegments(scanResult, detectMode, simpleMode, advDb, advMinSilence, localSafetyCheck),
    [scanResult, detectMode, simpleMode, advDb, advMinSilence, localSafetyCheck],
  );

  // autoSegments (kept) turned into a full timeline of keep/cut regions —
  // the waveform preview clicks flip individual regions here.
  const baseRegions: Region[] = useMemo(() => {
    if (!scanResult) return [];
    const regions: Region[] = [];
    let cursor = 0;
    for (const seg of autoSegments) {
      if (seg.start > cursor) regions.push({ start: cursor, end: seg.start, keep: false });
      regions.push({ start: seg.start, end: seg.end, keep: true, confidence: seg.confidence });
      cursor = seg.end;
    }
    if (cursor < scanResult.durationSec) regions.push({ start: cursor, end: scanResult.durationSec, keep: false });
    return regions;
  }, [autoSegments, scanResult]);

  // Reset manual overrides whenever the underlying detection changes — a
  // stale override index pointing at a region that no longer exists (or
  // means something different) is worse than just clearing it. A stale
  // boundary index is exactly as wrong as a stale keep/cut one, so both
  // reset together.
  useEffect(() => {
    setRegionOverrides({});
    setBoundaryOverrides({});
    setRangeOverrides([]);
    setToggleHistory([]);
  }, [baseRegions]);

  const finalRegions: Region[] = useMemo(() => {
    const withKeep = baseRegions.map((r, i) => (i in regionOverrides ? { ...r, keep: regionOverrides[i] } : r));
    const boundaryKeys = Object.keys(boundaryOverrides);
    let withBoundaries = withKeep;
    if (boundaryKeys.length > 0) {
      // A dragged boundary moves the shared edge between two adjacent
      // regions — cloning first so neither mutation touches withKeep's own
      // (possibly still-referenced-elsewhere) objects.
      const result = withKeep.map((r) => ({ ...r }));
      for (const key of boundaryKeys) {
        const i = Number(key);
        const t = boundaryOverrides[i];
        if (result[i]) result[i].end = t;
        if (result[i + 1]) result[i + 1].start = t;
      }
      withBoundaries = result;
    }
    if (rangeOverrides.length === 0) return withBoundaries;
    // Range-select: carve each drag-selected [start,end) into the region
    // list, in the order the drags happened. A region entirely outside is
    // untouched; entirely inside just gets re-labeled; a region straddling
    // an edge is split into up to 3 pieces (only the inside one relabeled).
    // Adjacent same-keep regions are merged afterward so repeated drags
    // don't leave the list fragmented into many same-state neighbors.
    let carved = withBoundaries;
    for (const range of rangeOverrides) {
      const next: Region[] = [];
      for (const r of carved) {
        if (range.end <= r.start || range.start >= r.end) {
          next.push(r);
          continue;
        }
        if (r.start < range.start) next.push({ start: r.start, end: range.start, keep: r.keep });
        next.push({ start: Math.max(r.start, range.start), end: Math.min(r.end, range.end), keep: range.keep });
        if (r.end > range.end) next.push({ start: range.end, end: r.end, keep: r.keep });
      }
      carved = next;
    }
    const merged: Region[] = [];
    for (const r of carved) {
      const last = merged[merged.length - 1];
      if (last && last.keep === r.keep && Math.abs(last.end - r.start) < 1e-6) last.end = r.end;
      else merged.push({ ...r });
    }
    return merged;
  }, [baseRegions, regionOverrides, boundaryOverrides, rangeOverrides]);
  // Read by the memoized adjustBoundary below, which must keep a stable identity.
  const finalRegionsRef = useRef<Region[]>(finalRegions);
  finalRegionsRef.current = finalRegions;

  // The Waveform reports indices into finalRegions. Region and boundary
  // overrides are keyed by baseRegions indices, which only match while no
  // range selection has split or merged regions; after one, a click or a
  // boundary drag is recorded as a range override instead (applied last, so
  // the newest edit wins).
  const toggleRegion = (index: number) => {
    const region = finalRegions[index];
    if (!region) return;
    setToggleHistory((prev) => [...prev, snapshotOverrides()]);
    if (rangeOverrides.length > 0) {
      setRangeOverrides((prev) => [...prev, { start: region.start, end: region.end, keep: !region.keep }]);
      return;
    }
    setRegionOverrides((prev) => ({ ...prev, [index]: !region.keep }));
  };

  const undoLastToggle = () => {
    setToggleHistory((prev) => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setRegionOverrides(snap.regionOverrides);
      setBoundaryOverrides(snap.boundaryOverrides);
      setRangeOverrides(snap.rangeOverrides);
      return prev.slice(0, -1);
    });
  };

  // Commits a manually dragged boundary (Waveform.tsx already clamps it against
  // the two regions' current start/end before calling this, so it isn't
  // re-clamped here). Memoized (stable identity across renders): Waveform's
  // drag effect has this in its dependency array, and re-creating it on every
  // App render would tear down and reattach that effect's window-level
  // mousemove/mouseup listeners mid-drag whenever App re-renders for an
  // unrelated reason (e.g. a polling interval elsewhere in this file). Reads
  // the override refs (not the state) for the same reason; see the comment
  // above regionOverridesRef.
  const adjustBoundary = useCallback((index: number, time: number) => {
    setToggleHistory((prev) => [...prev, snapshotOverrides()]);
    if (rangeOverridesRef.current.length > 0) {
      const left = finalRegionsRef.current[index];
      const right = finalRegionsRef.current[index + 1];
      if (!left || !right) return;
      const was = left.end;
      if (time > was) setRangeOverrides((prev) => [...prev, { start: was, end: time, keep: left.keep }]);
      else if (time < was) setRangeOverrides((prev) => [...prev, { start: time, end: was, keep: right.keep }]);
      return;
    }
    setBoundaryOverrides((prev) => ({ ...prev, [index]: time }));
  }, []);

  // Commits a drag-selected range (Waveform.tsx's own range-select drag) —
  // memoized for the same reason adjustBoundary is (Waveform's range-drag
  // effect has this in its own dependency array).
  const selectRange = useCallback((start: number, end: number, keep: boolean) => {
    setToggleHistory((prev) => [...prev, snapshotOverrides()]);
    setRangeOverrides((prev) => [...prev, { start, end, keep }]);
  }, []);

  // Clear any previous preview-audio URL whenever the scanned clip identity
  // changes (a fresh Scan, on the same or a different clip) — a stale URL
  // pointing at a since-rescanned clip would otherwise silently keep
  // "playing back" the wrong content's timeline coordinates.
  useEffect(() => {
    setPreviewAudioUrl(null);
    setPreviewAudioError(null);
  }, [scannedClipInfo]);

  // Playback uses a plain `<audio src="file://...">` pointing at the original
  // source file: full original quality and channels, no re-decode, and known to
  // work in CEP's Chromium. (Playing the mono 16 kHz decode the waveform is
  // drawn from would sound noticeably worse.) `url.pathToFileURL` builds the URL
  // correctly for spaces and non-ASCII characters, rather than a hand-made
  // string. The waveform/RMS analysis still uses the lower-resolution decode,
  // which is fine for that.
  const ensurePreviewAudio = async (): Promise<string | null> => {
    if (previewAudioUrlRef.current) return previewAudioUrlRef.current;
    if (!scannedClipInfo) {
      setPreviewAudioError(tr("Scan a clip first."));
      return null;
    }
    try {
      const fileUrl = url.pathToFileURL(scannedClipInfo.mediaPath).href;
      setPreviewAudioUrl(fileUrl);
      setPreviewAudioError(null);
      return fileUrl;
    } catch (e: any) {
      setPreviewAudioError(describeError(e));
      return null;
    }
  };

  // What actually gets cut, after manual review — merges adjacent kept regions.
  const segmentsToCut: CutSegment[] = useMemo(() => mergeAdjacentSegments(finalRegions.filter((r) => r.keep)), [finalRegions]);
  const selectionNotScanned = !!(scannedClipInfo && clipInfo && isOtherClipOfScannedFile(clipInfo, scannedClipInfo));
  const textOverModelLimit = voiceEngine === "elevenlabs" && voiceText.trim().length > ELEVEN_MAX_CHARS[elevenModel];
  const batchOverModelLimit =
    voiceEngine === "elevenlabs" && batchItems.some((it) => it.text.trim().length > ELEVEN_MAX_CHARS[elevenModel]);

  const totalSpeechSec = useMemo(() => segmentsToCut.reduce((a, s) => a + (s.end - s.start), 0), [segmentsToCut]);

  const previewSemitones = useMemo(() => computeSemitones(speedPercent), [speedPercent]);

  // The panel's Undo/Revert buttons live in its memory only; a new Scan or Cut
  // drops the previous clip's ones. Notes it in the session log (Diagnostics
  // report) when that actually loses one.
  const noteDroppedReverts = (includeRenderRevert: boolean = true) => {
    if (cutResult?.undoInfo || naturalPitchInfo || (includeRenderRevert && renderUndoInfo)) {
      appendLog(
        tr(
          "Starting over: the plugin's Undo and Revert for the previous clip are no longer available (Cmd/Ctrl+Z in Premiere still works).",
        ),
      );
    }
  };

  const handleScan = async () => {
    if (busy) return;
    setBusy(true);
    setBusyLabel(tr("Scanning audio…"));
    setScanError(null);
    setScanResult(null);
    setClipInfo(null);
    setScannedClipInfo(null);
    try {
      const info = await evalTS("getSelectedClipInfo");
      setClipInfo(info);
      if (!info.mediaPath) {
        throw new Error(tr("Selected clip has no linked media file on disk."));
      }
      // Before the linked-channels check: a camera file with each channel as
      // its own stream shows up as linked clips, and unlinking wouldn't help.
      const layoutRefusal = await audioLayoutRefusal(info.mediaPath);
      if (layoutRefusal) throw new Error(layoutRefusal);
      if (info.otherLinkedAudioTracks && info.otherLinkedAudioTracks.length > 0) {
        throw new Error(
          tr(
            "This clip has more linked audio channels on audio track(s) {tracks}. Cut works on one channel, so the others would go out of sync: Alt/Option-click the channel you don't need and delete it (the clip stays linked to its video), then Scan again. Scan hears the file's full mix, so if that channel carries other sound, export the voice channel as its own mono file first.",
            { tracks: info.otherLinkedAudioTracks.join(", ") },
          ),
        );
      }
      // Scan only the clip's own trimmed range, not the whole underlying
      // file — a segment boundary Silero/energy finds outside a
      // deliberately-trimmed range must never be able to reintroduce
      // content the user already cut away on the timeline (see ppro.ts's
      // getSelectedClipInfo/cutSelectedClip comments).
      const result = await scanAudioFile(info.mediaPath, {
        startSec: info.sourceInPoint,
        endSec: info.sourceOutPoint,
      });
      // Only now, with the new scan in hand, does the previous clip's memory
      // go: a Scan that fails (nothing selected, two clips, a refused layout)
      // leaves the last Cut's Undo and Natural pitch's Revert in place. The
      // full-render Revert is not dropped by a Scan.
      noteDroppedReverts(false);
      setCutResult(null);
      setLastCutSegments(null);
      setLastCutSourceInfo(null);
      setJlCutResult(null);
      lastJLApplied.current = null;
      setJlCutError(null);
      setJlCutEverRan(false);
      setNaturalPitchInfo(null);
      setNaturalPitchResult(null);
      setNaturalPitchError(null);
      setScanResult(result);
      setScannedClipInfo(info);
      const wordSnapNote = result.words ? `, word-snap: on (${result.words.length} words)` : ", word-snap: unavailable";
      appendLog(
        `Scanned "${info.clipName}" — ${result.durationSec.toFixed(1)}s, floor ${fmtDb(
          result.floorDb,
        )}, speech ${fmtDb(result.speechDb)}, VAD: ${result.vadFlags ? "Silero" : "energy-only fallback"}${wordSnapNote}.`,
      );
    } catch (e: any) {
      setScanError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCut = async () => {
    if (busy) return;
    if (!segmentsToCut.length) return;
    setBusy(true);
    setBusyLabel(tr("Cutting silence…"));
    setCutError(null);
    try {
      const res = await evalTS(
        "cutSelectedClip",
        segmentsToCut,
        scannedClipInfo?.nodeId,
        scannedClipInfo?.sourceInPoint,
        scannedClipInfo?.sourceOutPoint,
        scannedClipInfo?.speedFactor,
      );
      // Only clear the previous J/L Pacing state once this Cut has actually
      // succeeded: cutSelectedClip can still throw (no active sequence, no
      // segments, clip with no source media), and resetting jlCutEverRan/
      // jlCutResult beforehand would wipe the still-valid summary of a previous,
      // still-standing Cut although this attempt never touched the timeline.
      if (naturalPitchInfo || renderUndoInfo) noteDroppedReverts();
      setJlCutResult(null);
      lastJLApplied.current = null;
      setJlCutError(null);
      setJlCutEverRan(false);
      setRenderUndoInfo(null);
      setRenderUndoResult(null);
      setRenderUndoError(null);
      setNaturalPitchInfo(null);
      setNaturalPitchResult(null);
      setNaturalPitchError(null);
      setCutResult(res);
      setLastCutSegments(segmentsToCut);
      setLastCutSourceInfo(scannedClipInfo ? { mediaPath: scannedClipInfo.mediaPath, clipName: scannedClipInfo.clipName } : null);
      appendLog(`Cut complete: ${res.segmentsCut} segments — they're now selected on the timeline.`);
      if (res.stereoForced) {
        appendLog(`Sequence audio was mono — switched to stereo so plugins can be applied.`);
      }
      appendLog(`Go to the Pacing tab for J/L Pacing, Speed, and/or Pitch on what was just cut.`);
    } catch (e: any) {
      appendLog(`Cut failed: ${describeError(e)}`);
      setCutError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // Some actions ask Premiere something (an effects summary, a placement check)
  // before they set `busy`, so a second click in that wait would start the action
  // twice — for Generate, a second paid request. singleRun sets this flag
  // synchronously on the click and clears it when the action ends, so a click
  // while another action is pending does nothing.
  const actionPendingRef = useRef(false);
  const singleRun =
    <A extends unknown[]>(action: (...args: A) => Promise<void>) =>
    async (...args: A): Promise<void> => {
      if (actionPendingRef.current) return;
      actionPendingRef.current = true;
      try {
        await action(...args);
      } finally {
        actionPendingRef.current = false;
      }
    };

  /** Reads the effects on the clips an operation is about to replace and, when
   *  there are any it won't carry over, asks before going on. Pitch Shifter is
   *  not counted as lost when every audio piece has it (`restorePitch`), because
   *  Pitch is then applied again afterwards; pass `pitchComesBack` when the
   *  caller restores Pitch in its own way. A failed read never blocks. */
  const confirmRebuildEffects = async (
    action: string,
    readSummary: () => Promise<RebuildEffectSummary>,
    pitchComesBack = false,
  ): Promise<{ proceed: boolean; restorePitch: boolean }> => {
    // A new rebuild starts: the last Pitch Shifter restore's warnings no longer apply.
    setPitchApplyResult(null);
    let summary: RebuildEffectSummary | null = null;
    try {
      summary = await readSummary();
    } catch (e) {
      summary = null;
    }
    if (!summary) return { proceed: true, restorePitch: false };
    const restorePitch = summary.audioClips > 0 && summary.audioClipsWithPitch === summary.audioClips;
    const lost = restorePitch || pitchComesBack ? summary.nonPitchEffects : summary.effects;
    if (lost.length === 0) return { proceed: true, restorePitch };
    const proceed = await new Promise<boolean>((resolve) => {
      effectsWarningResolve.current = resolve;
      setEffectsWarning({ action, effects: lost });
    });
    return { proceed, restorePitch };
  };

  const closeEffectsWarning = (proceed: boolean) => {
    const resolve = effectsWarningResolve.current;
    effectsWarningResolve.current = null;
    setEffectsWarning(null);
    if (resolve) resolve(proceed);
  };

  /** Applies Pitch again to the selection after an operation rebuilt pieces that
   *  all had Pitch Shifter (each rebuild selects the pieces it placed). */
  const restorePitchAfterRebuild = async () => {
    setBusyLabel(tr("Restoring Pitch…"));
    try {
      setPitchApplyResult(await evalTS("applyPitchToSelection"));
    } catch (e: any) {
      appendLog(`Restoring Pitch failed: ${describeError(e)}`);
      setPitchApplyResult({ clipsProcessed: 0, skippedNoSpeedChange: 0, warnings: [describeError(e)], debugInfo: [], stereoForced: false });
    }
  };

  const handleUndoCut = singleRun(async () => {
    if (busy) return;
    if (!cutResult?.undoInfo) return;
    if (naturalPitchInfo && naturalPitchOnRememberedCut(naturalPitchInfo, cutResult.undoInfo)) {
      setCutError(
        tr("Natural pitch is applied to the cut pieces. Revert it first (Pacing → Pitch correction → Natural), then undo the Cut."),
      );
      return;
    }
    const undoInfo = cutResult.undoInfo;
    const fx = await confirmRebuildEffects(tr("Undo"), () => evalTS("getCutSpanEffectSummary", undoInfo));
    if (!fx.proceed) return;
    setBusy(true);
    setBusyLabel(tr("Undoing Cut…"));
    setCutError(null);
    try {
      // Deterministic rebuild (undoCutViaRazor), not a Premiere undo-stack rewind:
      // cutSelectedClip's razor/delete/move mechanism has an unpredictable
      // undo-stack footprint, so no number of Premiere undo steps is safe to
      // rewind. See CutResult.undoInfo's comment (ppro.ts).
      const undoSegments =
        lastCutSegments && lastCutSourceInfo && lastCutSourceInfo.mediaPath === undoInfo.mediaPath
          ? lastCutSegments.map((seg) => ({ start: seg.start + undoInfo.sourceInPoint, end: seg.end + undoInfo.sourceInPoint }))
          : null;
      const res = await evalTS("undoCutViaRazor", cutResult.undoInfo, undoSegments ?? undefined);
      appendLog("Cut undone — the original clip was restored.");
      if (fx.restorePitch) await restorePitchAfterRebuild();
      if (res.warnings.length) appendLog(res.warnings.join(" "));
      // The Cut this just reverted no longer reflects what's on the
      // timeline — without clearing it, the "Segments cut" banner stays
      // visible pointing at an edit that was just undone.
      setCutResult(null);
      // The restored clip is a new track item with its own nodeId, while the
      // scan remembers the removed one; it covers exactly the scanned range,
      // so the scan adopts it and CUT stays available for another preset.
      // Otherwise the selection poll's own banner asks for a new Scan.
      try {
        const restored = await evalTS("getSelectedClipInfoIfAny");
        const scanned = scannedClipInfoRef.current;
        if (
          restored &&
          scanned &&
          restored.mediaPath === scanned.mediaPath &&
          Math.abs(restored.sourceInPoint - scanned.sourceInPoint) <= 0.01 &&
          Math.abs(restored.sourceOutPoint - scanned.sourceOutPoint) <= 0.25
        ) {
          setScannedClipInfo({ ...scanned, nodeId: restored.nodeId, speedFactor: restored.speedFactor });
        }
      } catch (e) {
        // the selection poll handles it
      }
    } catch (e: any) {
      appendLog(`Undo failed: ${describeError(e)}`);
      setCutError(describeError(e));
    } finally {
      setBusy(false);
    }
  });

  // runSmoothCuts below is the one implementation of J/L Pacing, used by the
  // "Make J/L Cut" button and by Apply Speed's re-apply. Deliberately raw: no `busy` handling,
  // no error swallowing, no busy label. It throws on failure and each caller
  // decides what that means; the Speed path in particular must not report a J/L
  // failure as a Speed failure (see handleApplySpeed).
  //
  // mapNaturalPitchSegments: J/L Pacing measures overlaps on the scanned source
  // file. A piece Natural pitch replaced plays its rendered file instead, so its
  // reported range is in that file's stretched seconds. Maps such a piece back
  // to the source (rendered second t = rangeStart + t * factor in the source)
  // and reports the factor in `stretch`; every other piece passes through
  // unchanged with stretch 1, so without Natural pitch nothing here changes.
  const mapNaturalPitchSegments = (
    segs: { start: number; end: number; mediaPath: string }[],
  ): { segments: { start: number; end: number; mediaPath: string }[]; stretch: number[] } => {
    const stretch = segs.map(() => 1);
    if (!naturalPitchInfo) return { segments: segs, stretch };
    const norm = (p: string) => (p || "").replace(/\\/g, "/").toLowerCase();
    const segments = segs.map((seg, i) => {
      const r = naturalPitchInfo.renders.find((x) => norm(x.filePath) === norm(seg.mediaPath));
      if (!r) return seg;
      stretch[i] = r.speedFactor;
      return { start: r.rangeStart + seg.start * r.speedFactor, end: r.rangeStart + seg.end * r.speedFactor, mediaPath: r.mediaPath };
    });
    return { segments, stretch };
  };

  const runSmoothCuts = async (preset: JLCutPreset): Promise<JLCutResult> => {
    const { segments: liveSegments, stretch } = mapNaturalPitchSegments(await evalTS("getSelectedCutPieceInfo"));
    if (liveSegments.length < 2) {
      throw new Error(tr("Select at least 2 of the pieces Cut just made (they're left selected right after Cut)."));
    }
    const mixedFiles = mixedFilesRefusal(liveSegments);
    if (mixedFiles) throw new Error(mixedFiles);
    // Sanity check: computeJLCutOverlaps looks up scanResult.weightedRmsValues at
    // each piece's source position, which is meaningless (silently wrong, not an
    // error) for a piece from other media. Prefers lastCutSourceInfo (set by Cut,
    // so it is what was actually cut) and falls back to scannedClipInfo (set by
    // Scan alone), so after a Premiere restart a re-Scan without re-Cutting is
    // enough. Lowercased before comparing: getMediaPath() can return different
    // casing across reads on a case-insensitive filesystem (macOS/Windows), which
    // ppro.ts's other mediaPath comparisons allow for too.
    //
    // Pieces of another file than the scan (e.g. Cut file A, Cut file B, then go
    // back to A's pieces) are not refused: a scanResult that doesn't match the
    // selection is treated like no scan at all, and the overlaps come from
    // getFallbackJLCutOverlaps (no source-file data needed), as on the "no scan
    // data" path.
    const expectedMediaPath = (lastCutSourceInfo?.mediaPath ?? scannedClipInfo?.mediaPath)?.toLowerCase();
    const hasForeignPiece = !!expectedMediaPath && liveSegments.some((s) => s.mediaPath && s.mediaPath.toLowerCase() !== expectedMediaPath);
    // The scan covers one range of the file (Scan decodes the clip's own range
    // only), so pieces outside it (another soundbite from the same interview
    // file) have no measurement data: computeJLCutOverlaps would find no quiet
    // frames and give every boundary the floor. Treated like no scan at all.
    const scanIn = scannedClipInfo?.sourceInPoint;
    const scanOut = scannedClipInfo?.sourceOutPoint;
    const outsideScanRange =
      !hasForeignPiece &&
      !!scanResult &&
      typeof scanIn === "number" &&
      typeof scanOut === "number" &&
      liveSegments.some((s) => s.start < scanIn - 0.25 || s.end > scanOut + 0.25);
    const usableScanResult = hasForeignPiece || outsideScanRange ? null : scanResult;
    // lastCutSegments belongs to whatever file was cut LAST this session
    // — meaningless to compare the CURRENT selection's own count against
    // it when that selection is a different (foreign) file's pieces, for
    // the exact same reason usableScanResult above is skipped in that
    // case.
    const isPartialSelection = !hasForeignPiece && !!lastCutSegments && liveSegments.length < lastCutSegments.length;
    if (isPartialSelection) {
      appendLog(
        `J/L Pacing: running on a partial selection — ${liveSegments.length} of the last Cut's ${lastCutSegments?.length} pieces are currently selected.`,
      );
    }
    let overlapResult: JLCutOverlapResult;
    if (usableScanResult) {
      // The scan's times start at the scanned clip's source in-point (Scan
      // decodes only the clip's own range); live pieces report source-file
      // time. Shift them onto the scan's time base for a head-trimmed clip.
      const scanOffset = scannedClipInfo?.sourceInPoint ?? 0;
      const scanSegments = scanOffset
        ? liveSegments.map((seg) => ({ ...seg, start: seg.start - scanOffset, end: seg.end - scanOffset }))
        : liveSegments;
      overlapResult = computeJLCutOverlaps(usableScanResult, scanSegments, preset);
    } else {
      // getFallbackJLCutOverlaps (not the single-boundary
      // getFallbackJLCutOverlapSec) — applies the same per-piece duration
      // caps computeJLCutOverlaps' real measurement gets, so a short piece
      // can't end up with combined overlap approaching or exceeding its
      // own length just because this path has no waveform to measure
      // against.
      overlapResult = getFallbackJLCutOverlaps(liveSegments, preset);
      let fallbackNote =
        "J/L Pacing: no scan data available — using a flat, un-measured overlap for this run (re-Scan the source file for waveform-tuned pacing).";
      if (hasForeignPiece) {
        fallbackNote = `J/L Pacing: the current scan data belongs to a different file ("${lastCutSourceInfo?.clipName ?? scannedClipInfo?.clipName ?? "?"}") — using a flat, un-measured overlap for this run (re-Scan this file for waveform-tuned pacing).`;
      } else if (outsideScanRange) {
        fallbackNote =
          "J/L Pacing: the current scan covers another range of this file than the selected pieces — using a flat, un-measured overlap for this run (Scan the clip these pieces came from for waveform-tuned pacing).";
      }
      appendLog(fallbackNote);
    }
    const { overlapsSec: overlaps, tailFadeFrames, headFadeFrames } = overlapResult;
    // Logs the effective floor, not only the preset's nominal one: on noisy
    // material syntheticScore scales the floor down (to 0 at the noisy end),
    // which is why pieces can overlap much less than the preset suggests.
    // The floor line only means something on a measured run; the no-scan
    // path has already logged that it used a flat, un-measured value.
    if (usableScanResult) {
      appendLog(
        `J/L Pacing floor (${preset}): preset ${Math.round(getJLCutPresetConfig(preset).minOverlapSec * 1000)}ms, file medianSnrDb=${usableScanResult.medianSnrDb.toFixed(
          1,
        )} -> syntheticScore=${overlapResult.syntheticScore.toFixed(2)} -> effective floor ${Math.round(
          overlapResult.effectiveFloorSec * 1000,
        )}ms (before per-piece length caps).`,
      );
    } else {
      appendLog(`J/L Pacing (${preset}): flat un-measured overlap ${Math.round(overlapResult.effectiveFloorSec * 1000)}ms per boundary.`);
    }
    // Per-run numbers, not just pass/fail: how many boundaries overlapped, the
    // average and longest overlap, and the tightest piece's share of its length
    // inside overlaps (against the 60% combined cap).
    const nonZero = overlaps.filter((o) => o > 0.001);
    const avgMs = nonZero.length ? Math.round((nonZero.reduce((a, b) => a + b, 0) / nonZero.length) * 1000) : 0;
    const maxMs = nonZero.length ? Math.round(Math.max(...nonZero) * 1000) : 0;
    appendLog(
      `J/L Pacing overlap stats (${preset}): ${nonZero.length}/${overlaps.length} boundaries overlapped, avg ${avgMs}ms, max ${maxMs}ms.`,
    );
    // Reports the actual combined incoming+outgoing overlap ratio of the tightest
    // piece on this run (computeJLCutOverlaps in analyze.ts caps it at 60% of the
    // piece's duration), so it can be checked from the log rather than judged by
    // eye: at some zoom levels Premiere's fixed-size transition icon looks large
    // whatever the real overlap is.
    let tightestRatio = 0;
    let tightestIndex = -1;
    for (let i = 1; i < liveSegments.length - 1; i++) {
      const segDur = liveSegments[i].end - liveSegments[i].start;
      if (segDur <= 0) continue;
      const combined = overlaps[i - 1] + overlaps[i];
      const ratio = combined / segDur;
      if (ratio > tightestRatio) {
        tightestRatio = ratio;
        tightestIndex = i;
      }
    }
    if (tightestIndex >= 0) {
      const segDur = liveSegments[tightestIndex].end - liveSegments[tightestIndex].start;
      appendLog(
        `J/L Pacing tightest piece: #${tightestIndex} (${segDur.toFixed(2)}s long) has ${(tightestRatio * 100).toFixed(
          0,
        )}% of its own duration inside combined incoming+outgoing overlap (cap is 60%).`,
      );
    }
    // On a partial selection, the ORIGINAL Cut's first-piece position is
    // meaningless as an anchor if that specific piece was one of the
    // deleted ones — forcing placement there would shift the whole
    // remaining selection to a stale position instead of wherever it
    // already sits. Passing null lets applyJLCutSmoothing fall back to
    // the current selection's own live position (its existing, established
    // fallback — see its own doc comment on originalAnchorStart) instead.
    const anchorStart = isPartialSelection ? null : (cutResult?.undoInfo?.timelineStart ?? null);
    // A natural-pitch piece plays at 100% but holds audio stretched by its
    // factor, so a source-seconds overlap is that many times shorter on the
    // timeline — the division applyJLCutSmoothing does itself for a piece's
    // Premiere speed. stretch is 1 for every other piece, leaving them as before.
    const timelineOverlaps = overlaps.map((o, b) => o / (stretch[b + 1] || 1));
    const res = await evalTS("applyJLCutSmoothing", timelineOverlaps, anchorStart, tailFadeFrames, headFadeFrames);
    // Said in the result banner, not only in the session log: a run on the
    // flat fallback looks like a measured one otherwise.
    if (!usableScanResult) {
      res.warnings = [
        ...res.warnings,
        tr(
          "No waveform measurement for these pieces: a flat, un-measured overlap was used at every boundary. Scan the clip these pieces came from, then run J/L Pacing again for measured pacing.",
        ),
      ];
    }
    if (naturalPitchInfo) jlChangedAfterNatural.current = true;
    lastJLApplied.current = {
      overlapsSec: overlaps,
      tailFadeFrames,
      headFadeFrames,
      anchorStart,
      preset,
      pieces: liveSegments.map((seg) => ({ start: seg.start, mediaPath: seg.mediaPath })),
    };
    setJlCutResult(res);
    setJlCutEverRan(true);
    appendLog(
      `J/L Cut (${preset}): ${res.clipsProcessed} pieces, ${res.overlapsApplied} boundaries overlapped, ${res.fadesApplied} fades applied.`,
    );
    if (res.warnings.length) {
      for (const w of res.warnings) appendLog(`J/L Cut warning: ${w}`);
    }
    return res;
  };

  // J/L Pacing (the "Make J/L Cut" button): a separate follow-up step, never
  // touches cutSelectedClip. Reads the selected pieces live
  // (getSelectedCutPieceInfo), measures how much each boundary can overlap from
  // the scan's RMS data (analyze.ts's computeJLCutOverlaps; a flat fallback
  // without matching scan data), then ppro.ts's applyJLCutSmoothing alternates
  // the pieces across two tracks, shifts each one earlier by its boundary's
  // overlap and adds a short declick fade at each edge.
  //
  // Safe to click again with a different preset without Reset first:
  // applyJLCutSmoothing re-places the currently selected pieces from their own
  // source in/out points and computes every position from one anchor, so runs
  // don't compound. The anchor is cutResult.undoInfo.timelineStart (null on a
  // partial selection, which falls back to the selection's own position; see
  // applyJLCutSmoothing's doc comment on originalAnchorStart).
  const handleSmoothCuts = singleRun(async (preset: JLCutPreset = jlCutPreset) => {
    if (busy) return;
    const fx = await confirmRebuildEffects(tr("J/L Pacing"), () => evalTS("getSelectionEffectSummary"));
    if (!fx.proceed) return;
    setBusy(true);
    setBusyLabel(tr("Making J/L Cut…"));
    setJlCutError(null);
    try {
      await runSmoothCuts(preset);
      if (fx.restorePitch) await restorePitchAfterRebuild();
    } catch (e: any) {
      appendLog(`J/L Cut failed: ${describeError(e)}`);
      setJlCutError(describeError(e));
    } finally {
      setBusy(false);
    }
  });

  // Undoing J/L Pacing alone (leaving the Cut in place) never goes through
  // Premiere's undo stack: how many steps a remove + placement + fade
  // sequence leaves there is not known, and reverting too many would eat into
  // Cut's own pieces. Reset below calls the same applyJLCutSmoothing with every
  // boundary's overlap forced to 0, which puts every piece back on the original
  // track, sequential and non-overlapping, anchored at Cut's original
  // timelineStart (see handleSmoothCuts' comment above) rather than wherever the
  // pieces currently sit.
  const handleResetSmoothCuts = singleRun(async () => {
    if (busy) return;
    const fx = await confirmRebuildEffects(tr("Reset"), () => evalTS("getSelectionEffectSummary"));
    if (!fx.proceed) return;
    setBusy(true);
    setBusyLabel(tr("Resetting J/L Cut…"));
    setJlCutError(null);
    try {
      // Reads the live selection (getSelectedCutPieceInfo, like handleSmoothCuts
      // above) rather than sizing zeroOverlaps off lastCutSegments.length: a
      // partial selection gets the right number of zero overlaps, and Reset works
      // after a Premiere restart (when lastCutSegments is gone), since every
      // overlap is a flat 0 and needs no scan data.
      const liveSegments = await evalTS("getSelectedCutPieceInfo");
      if (liveSegments.length < 2) {
        throw new Error(tr("Select at least 2 of the pieces Cut just made (they're left selected right after Cut)."));
      }
      const mixedFiles = mixedFilesRefusal(mapNaturalPitchSegments(liveSegments).segments);
      if (mixedFiles) throw new Error(mixedFiles);
      const isPartialSelection = !!lastCutSegments && liveSegments.length < lastCutSegments.length;
      const anchorStart = isPartialSelection ? null : (cutResult?.undoInfo?.timelineStart ?? null);
      const zeroOverlaps = new Array(liveSegments.length - 1).fill(0);
      const res = await evalTS("applyJLCutSmoothing", zeroOverlaps, anchorStart);
      const mapped = mapNaturalPitchSegments(liveSegments).segments;
      const lower = (p: string) => (p || "").toLowerCase();
      // The remembered J/L run is forgotten only when this Reset worked on its
      // clips; a Reset of some other file's pieces leaves it for Speed to re-apply.
      const jlFiles = lastJLApplied.current ? lastJLApplied.current.pieces.map((p) => lower(p.mediaPath)) : null;
      if (!jlFiles || mapped.every((s) => jlFiles.includes(lower(s.mediaPath)))) {
        setJlCutResult(null);
        lastJLApplied.current = null;
      }
      // Reset puts the selected pieces back on the original track, sequential,
      // without fades (applyJLCutSmoothing's isReset branch), i.e. back to Cut's
      // own shape. Cut's Undo clears only that track, so it is offered again
      // only when this Reset covered every piece of the remembered Cut (same
      // file, same count, same source starts); after a partial Reset, or a Reset
      // of another Cut's pieces, J/L pieces may still sit on the second track.
      const cutMedia = lower(cutResult?.undoInfo?.mediaPath ?? "");
      const cutOffset = cutResult?.undoInfo?.sourceInPoint ?? 0;
      const resetCoversCut =
        !!cutMedia &&
        !!lastCutSegments &&
        mapped.length === lastCutSegments.length &&
        mapped.every((s, i) => lower(s.mediaPath) === cutMedia && Math.abs(s.start - cutOffset - lastCutSegments[i].start) < 0.1);
      if (resetCoversCut) {
        setJlCutEverRan(false);
      } else if (jlCutEverRan && cutResult?.undoInfo) {
        appendLog(
          "J/L Pacing reset, but not on every piece of the last Cut: that Cut's Undo stays off until all of its pieces are selected and reset.",
        );
      }
      if (naturalPitchInfo) jlChangedAfterNatural.current = true;
      appendLog(`J/L Cut reset: ${res.clipsProcessed} pieces back to sequential placement.`);
      if (res.warnings.length) {
        for (const w of res.warnings) appendLog(`Reset warning: ${w}`);
      }
      if (fx.restorePitch) await restorePitchAfterRebuild();
    } catch (e: any) {
      appendLog(`Reset failed: ${describeError(e)}`);
      setJlCutError(describeError(e));
    } finally {
      setBusy(false);
    }
  });

  // Apply Speed. Whenever this Cut's original segments are still tracked
  // (`lastCutSegments` + `cutResult.undoInfo`, both set at Cut time and never
  // touched by Speed), Speed goes through `rebuildCutFromOriginal`: it doesn't
  // read the current state of the pieces, clears this run's footprint and
  // rebuilds every piece from the original segment boundaries, applying the new
  // speed during that rebuild. Nothing carries over from a previous round, so
  // repeated Speed / J/L cycles can't accumulate drift (re-timing the current
  // clips every round lets frame snapping and pairing compound into a visible
  // audio/video divergence). Falls back to `applySpeedToSelection` when there's
  // no tracked Cut to rebuild from (e.g. Speed on a hand-picked selection that
  // never went through this panel's Cut), or when the pieces changed since the
  // Cut (see below).
  const handleApplySpeed = singleRun(async () => {
    if (busy) return;
    // Natural-pitch pieces already play at 100% with the tempo baked in;
    // Speed on them would resample the rendered audio (the pitch shift
    // Natural pitch exists to avoid), and its rebuild-from-Cut path knows
    // nothing about the rendered files. Refused when Natural pitch replaced
    // pieces of the remembered Cut (the rebuild would wipe its renders); other
    // clips get Speed as usual, and the file-name check below still catches a
    // render in the selection.
    if (naturalPitchInfo && naturalPitchOnRememberedCut(naturalPitchInfo, cutResult?.undoInfo)) {
      setSpeedApplyResult({
        clipsProcessed: 0,
        warnings: [
          tr(
            "Natural pitch is applied to these pieces. Revert it first (Pitch correction → Natural), change Speed, then apply Natural pitch again.",
          ),
        ],
        debugInfo: [],
      });
      return;
    }
    // Natural pitch's rendered pieces play at 100% with the tempo baked in, and
    // the panel may have forgotten them (new Scan, reload). Recognised by file
    // name, so Speed never resamples them.
    try {
      const selected = await evalTS("getSelectedCutPieceInfo");
      if (selected.some((p) => /[\\/]natural-pitch-[^\\/]*\.wav$/i.test(p.mediaPath || ""))) {
        setSpeedApplyResult({
          clipsProcessed: 0,
          warnings: [
            tr(
              "The selection contains Natural pitch renders, which already play at the new tempo. Revert Natural pitch first, or select the original pieces.",
            ),
          ],
          debugInfo: [],
        });
        return;
      }
    } catch (e) {
      // selection unreadable: the Speed step reports it
    }
    // The rebuild right after Cut, and the J/L re-apply after Speed, place fresh
    // clips: warn about effects first. Pitch is applied again at the end when
    // every audio piece had it, since its ratio depends on the new speed on
    // either path.
    let fx = { proceed: true, restorePitch: false };
    if ((lastCutSegments && cutResult?.undoInfo) || jlCutResult) {
      fx = await confirmRebuildEffects(tr("Apply Speed"), () => evalTS("getSelectionEffectSummary"));
      if (!fx.proceed) return;
    } else {
      try {
        const summary = await evalTS("getSelectionEffectSummary");
        fx.restorePitch = summary.audioClips > 0 && summary.audioClipsWithPitch === summary.audioClips;
      } catch (e) {
        // selection unreadable: Pitch is left as it is
      }
    }
    setBusy(true);
    setBusyLabel(tr("Applying Speed…"));
    setSpeedApplyResult(null);
    const hadSmoothCuts = !!jlCutResult;
    try {
      let res;
      // Choose between the two Speed paths by what is actually on the timeline, not
      // merely by whether a Cut is remembered. `rebuildCutFromOriginal` is
      // deliberately destructive (it rebuilds every piece from the original Cut
      // segments): right for repeated Speed runs, but it discards any manual edit
      // made after Cut, such as pieces razored by hand. So when the live selection
      // no longer matches the remembered Cut, the non-destructive in-place path is
      // used and the log says why. A failed read counts as "edited": not knowing
      // picks the path that can't lose anything.
      let livePieces:
        | { start: number; end: number; mediaPath: string; timelineStart?: number; timelineEnd?: number; frameSec?: number }[]
        | null = null;
      let liveReadFailed = false;
      try {
        livePieces = await evalTS("getSelectedCutPieceInfo");
      } catch (e) {
        liveReadFailed = true;
      }
      const liveCount = livePieces ? livePieces.length : null;
      // Same count, but a piece trimmed by hand (or from other media) since the
      // Cut: the rebuild would bring the trimmed part back, so that counts as
      // edited too. Live pieces report source-file time, the Cut's segments are
      // relative to the scanned clip's source in-point. Starts are compared
      // tightly: inPoint * speed is exact to well under a millisecond, but Cut
      // put each edit on the nearest frame, so an untouched piece starts up to
      // half a frame from its segment. The tolerance is half a frame of the
      // sequence, never less than 0.02 s (0.021 s at 24 fps); a start moved by
      // more than that counts as trimmed. Ends the same way, with that half
      // frame times the piece's own speed, at least 1 (its end is its timeline
      // length times its speed).
      let piecesChangedSinceCut = false;
      if (livePieces && lastCutSegments && livePieces.length === lastCutSegments.length) {
        const cutMediaPath = (cutResult?.undoInfo?.mediaPath ?? "").toLowerCase();
        const sourceOffset = cutResult?.undoInfo?.sourceInPoint ?? 0;
        for (let i = 0; i < livePieces.length; i++) {
          const live = livePieces[i];
          const orig = lastCutSegments[i];
          const frameSec = typeof live.frameSec === "number" && live.frameSec > 0 ? live.frameSec : 1 / 25;
          const startTolerance = Math.max(0.02, frameSec / 2) + 0.001;
          const otherMedia = !!cutMediaPath && !!live.mediaPath && live.mediaPath.toLowerCase() !== cutMediaPath;
          const startMoved = Math.abs(live.start - sourceOffset - orig.start) > startTolerance;
          // A piece's end is its timeline length times its speed, so half a frame
          // of the timeline is half a frame times the piece's own speed there,
          // never less than at 100%.
          const tlLen =
            typeof live.timelineEnd === "number" && typeof live.timelineStart === "number" ? live.timelineEnd - live.timelineStart : 0;
          const pieceSpeed = tlLen > 0 ? Math.max(1, (live.end - live.start) / tlLen) : 1;
          const endMoved = Math.abs(live.end - sourceOffset - orig.end) > startTolerance * pieceSpeed + 0.001;
          if (otherMedia || startMoved || endMoved) {
            piecesChangedSinceCut = true;
            break;
          }
        }
      }
      // Pieces dragged elsewhere on the timeline since the Cut: the rebuild
      // would put them back at the Cut's position. Three signs, any one is
      // enough: the first piece is not where the Cut put it (J/L Pacing never
      // moves it); a gap of more than 2 s between two pieces (Cut and J/L leave
      // none); or, when the last J/L run's overlaps are known, a piece that is
      // not where the previous piece's end and that overlap put it.
      const piecesMovedOnTimeline = (() => {
        if (!livePieces || livePieces.length === 0 || !cutResult?.undoInfo) return false;
        const first = livePieces[0].timelineStart;
        if (typeof first !== "number") return false;
        const TOL = 0.25;
        if (Math.abs(first - cutResult.undoInfo.timelineStart) > TOL) return true;
        // The last run's overlaps matter only while J/L Pacing is in effect.
        const prev = hadSmoothCuts ? lastJLApplied.current : null;
        const overlapsKnown = !!prev && prev.pieces.length === livePieces.length;
        let expected = first;
        for (let i = 0; i < livePieces.length; i++) {
          const p = livePieces[i];
          if (typeof p.timelineStart !== "number") return false;
          // Timeline length of a piece: reported, or its source length (speed 1).
          const tlEndOf = (q: { start: number; end: number; timelineStart?: number; timelineEnd?: number }): number =>
            typeof q.timelineEnd === "number" ? q.timelineEnd : (q.timelineStart as number) + (q.end - q.start);
          if (i > 0) {
            const prevPiece = livePieces[i - 1];
            const prevStart = prevPiece.timelineStart as number;
            const gap = p.timelineStart - tlEndOf(prevPiece);
            if (gap > 2) return true;
            if (overlapsKnown) {
              // The applied shift is the source-seconds overlap at the piece's
              // own playback rate (applyJLCutSmoothing divides by its speed).
              const srcDur = p.end - p.start;
              const tlDur = tlEndOf(p) - p.timelineStart;
              const rate = tlDur > 0 ? srcDur / tlDur : 1;
              const shift = (prev!.overlapsSec[i - 1] || 0) / (rate || 1);
              expected = expected + (tlEndOf(prevPiece) - prevStart) - shift;
              if (Math.abs(p.timelineStart - expected) > TOL) return true;
            }
          }
        }
        return false;
      })();
      const timelineWasEdited =
        liveReadFailed ||
        piecesChangedSinceCut ||
        piecesMovedOnTimeline ||
        (liveCount !== null && lastCutSegments != null && liveCount !== lastCutSegments.length);
      if (piecesMovedOnTimeline) {
        appendLog(
          tr(
            "The pieces were moved on the timeline since the Cut — applying Speed to the current selection in place instead of rebuilding, so they stay where they are.",
          ),
        );
      } else if (piecesChangedSinceCut) {
        appendLog(
          tr(
            "Some pieces were trimmed or changed since the Cut — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.",
          ),
        );
      } else if (liveReadFailed && lastCutSegments) {
        appendLog(
          tr(
            "Couldn't read the current selection, so Speed is applied to the selected clips in place instead of rebuilding them from the original Cut. Nothing you edited by hand can be lost this way.",
          ),
        );
      } else if (timelineWasEdited) {
        appendLog(
          tr(
            "The timeline no longer matches the original Cut ({live} pieces selected vs {expected} from that Cut) — applying Speed to the current selection instead of rebuilding, so your manual edits are kept.",
            { live: String(liveCount), expected: String(lastCutSegments!.length) },
          ),
        );
      }
      if (!timelineWasEdited && lastCutSegments && lastCutSegments.length >= 1 && cutResult?.undoInfo) {
        // The Cut's segments are relative to the scanned clip's source in-point;
        // the rebuild places pieces by source-file time, so add that in-point
        // back for a head-trimmed clip.
        const rebuildOffset = cutResult.undoInfo.sourceInPoint;
        const rebuildSegments = rebuildOffset
          ? lastCutSegments.map((seg) => ({ start: seg.start + rebuildOffset, end: seg.end + rebuildOffset }))
          : lastCutSegments;
        res = await evalTS(
          "rebuildCutFromOriginal",
          rebuildSegments,
          cutResult.undoInfo.mediaPath,
          cutResult.undoInfo.timelineStart,
          cutResult.undoInfo.trackIndex,
          cutResult.undoInfo.videoTrackIndex,
          speedPercent,
          cutResult.undoInfo.projectItemNodeId,
          cutResult.undoInfo.sequenceId,
          cutResult.undoInfo.sequenceName,
        );
      } else {
        res = await evalTS("applySpeedToSelection", speedPercent);
      }
      setSpeedApplyResult(res);
      // The J/L re-apply below has its own try: inside Speed's try, a J/L failure
      // would overwrite Speed's already-recorded result with `clipsProcessed: 0` and
      // the J/L error, inviting a second Speed run that applies the change twice.
      // It calls `runSmoothCuts`, the same code the manual button runs, which reads
      // the live selection. Speed changes every piece's duration, so leaving the old
      // overlaps in place is not an option: re-applying is the only way the pacing
      // survives Speed.
      // Re-applied only to clips the remembered J/L run worked on: the panel
      // remembers one run, and Speed on clips of another file (or on a single
      // clip) must not chain them back to back on two tracks.
      const jlFiles = lastJLApplied.current
        ? lastJLApplied.current.pieces.map((p) => (p.mediaPath || "").toLowerCase())
        : [(cutResult?.undoInfo?.mediaPath ?? "").toLowerCase()];
      const liveFiles = livePieces ? mapNaturalPitchSegments(livePieces).segments.map((s) => (s.mediaPath || "").toLowerCase()) : [];
      const jlCoversSelection = liveFiles.length >= 2 && liveFiles.every((f) => !!f && jlFiles.includes(f));
      if (hadSmoothCuts && !jlCoversSelection) {
        appendLog(
          "J/L Pacing not re-applied after Speed: the selected clips aren't the pieces the last J/L Pacing run worked on. Run Make J/L Cut again on them if they need pacing.",
        );
      }
      if (hadSmoothCuts && jlCoversSelection) {
        try {
          // Replay the same source-seconds overlaps the last run applied, rather than
          // recomputing them from the timeline as it stands after Speed.
          // applyJLCutSmoothing divides each overlap by the shifted piece's new speed,
          // which is the recalculation this step needs. Replays only when it is
          // provably the same job: the same preset and the same pieces (same count,
          // same source file, same source start per piece; a source start doesn't move
          // when Speed runs, see getSelectedCutPieceInfo). Anything else, including no
          // stored run (J/L from a previous panel session, say), recomputes from the
          // live selection. The log says which one ran.
          const prev = lastJLApplied.current;
          const samePieces =
            !!prev &&
            !!livePieces &&
            livePieces.length === prev.pieces.length &&
            livePieces.every(
              (p, i) =>
                (p.mediaPath || "").toLowerCase() === (prev.pieces[i].mediaPath || "").toLowerCase() &&
                Math.abs(p.start - prev.pieces[i].start) < 0.1,
            );
          if (prev && prev.preset === jlCutPreset && samePieces) {
            const jl = await evalTS("applyJLCutSmoothing", prev.overlapsSec, prev.anchorStart, prev.tailFadeFrames, prev.headFadeFrames);
            setJlCutResult(jl);
            if (jl.warnings.length) {
              for (const w of jl.warnings) appendLog(`J/L Pacing re-apply warning: ${w}`);
            }
            appendLog(`J/L Pacing (${jlCutPreset}) reapplied after Speed: same overlaps as the last run, rescaled to the new speed.`);
          } else {
            await runSmoothCuts(jlCutPreset);
            appendLog(`J/L Pacing (${jlCutPreset}) recomputed after Speed for the current selection.`);
          }
        } catch (jlErr: any) {
          // Speed itself is done and its result stands. Shown in the Speed
          // banner as well as the session log, so nobody re-runs Speed on
          // already-sped-up clips.
          const jlFailNote = tr(
            "Speed was applied, but re-applying J/L Pacing afterwards failed: {error}. Don't run Speed again; re-apply J/L Pacing from the Pacing tab.",
            // The template ends the error's sentence itself.
            { error: describeError(jlErr).replace(/[.\s]+$/, "") },
          );
          appendLog(jlFailNote);
          setSpeedApplyResult((r) => (r ? { ...r, warnings: [...r.warnings, jlFailNote] } : r));
        }
      }
      if (fx.restorePitch) await restorePitchAfterRebuild();
    } catch (e: any) {
      setSpeedApplyResult({ clipsProcessed: 0, warnings: [describeError(e)], debugInfo: [] });
    } finally {
      setBusy(false);
    }
  });

  const handleReadClipSpeed = async () => {
    setReadClipSpeedError(null);
    setReadClipSpeedMixed(null);
    try {
      const res = await evalTS("getSelectedClipsSpeed");
      if (res.mixed) {
        setReadClipSpeedMixed(res.speeds);
        return;
      }
      const speed = res.speeds[0];
      setSpeedPercent(speed);
      setSpeedInput(String(speed));
    } catch (e: any) {
      setReadClipSpeedError(describeError(e));
    }
  };

  // J/L Pacing's per-piece fades, for placeNaturalPitch to put back on the
  // replacement clips. Only when J/L is currently applied; the exact sizes
  // when the last J/L run covered this same set of pieces, else the
  // default size. (A piece's source start is compared with a loose 1 s
  // tolerance: the check only needs to tell the same set of pieces from a
  // different one.)
  // The same rule for "Revert to segments": J/L's fades come back on the
  // restored pieces when J/L is applied to them, with the exact sizes when the
  // last J/L run covered this same set of pieces.
  const renderUndoFadesFor = (pieces: RenderUndoPiece[]): NaturalPitchFades => {
    if (!jlCutResult) return { apply: false };
    const prev = lastJLApplied.current;
    const same =
      !!prev && prev.pieces.length === pieces.length && pieces.every((p, i) => Math.abs(p.sourceInPoint - prev.pieces[i].start) < 1.0);
    return same && prev ? { apply: true, tailFadeFrames: prev.tailFadeFrames, headFadeFrames: prev.headFadeFrames } : { apply: true };
  };

  const naturalPitchFadesFor = (plan: NaturalPitchPlan): NaturalPitchFades => {
    if (!jlCutResult) return { apply: false };
    const prev = lastJLApplied.current;
    const same =
      !!prev && prev.pieces.length === plan.pieces.length && plan.pieces.every((p, i) => Math.abs(p.sourceIn - prev.pieces[i].start) < 1.0);
    return same && prev ? { apply: true, tailFadeFrames: prev.tailFadeFrames, headFadeFrames: prev.headFadeFrames } : { apply: true };
  };

  // Natural pitch: read the selection, render one pitch-preserving file per
  // (source, speed) with the bundled ffmpeg, then replace each sped-up piece
  // with its stretch of that file at 100% speed (ppro.ts placeNaturalPitch).
  // Revert below puts the originals back in one click.
  const handleApplyNaturalPitch = async () => {
    if (busy) return;
    setNaturalPitchResult(null);
    setNaturalPitchError(null);
    setBusy(true);
    setBusyLabel(tr("Reading the selected pieces…"));
    try {
      await checkProjectFolderAvailable();
      const plan: NaturalPitchPlan = await evalTS("getNaturalPitchPlan", outputLocation === "project");
      // The rendered pieces play at 100%, so a plan over them has nothing to
      // render: when they are what is selected, say so instead of "no speed
      // change". Other clips go ahead; the remembered run is then replaced
      // (one Revert record at a time), and the result says so.
      const selectsRenders = plan.pieces.some((p) => /[\\/]natural-pitch-[^\\/]*\.wav$/i.test(p.mediaPath || ""));
      if (plan.renders.length === 0) {
        if (naturalPitchInfo && selectsRenders) {
          setNaturalPitchError(tr("Natural pitch is already applied to these pieces. Revert it first to apply it again."));
          return;
        }
        setNaturalPitchResult({ replaced: 0, skipped: plan.skippedNoSpeedChange, warnings: [] });
        return;
      }
      const replacesEarlierRun = !!naturalPitchInfo;
      // Before any render: nothing has changed on the timeline yet.
      for (const rd of plan.renders) {
        const layoutRefusal = await audioLayoutRefusal(rd.mediaPath);
        if (layoutRefusal) throw new Error(layoutRefusal);
      }
      for (let r = 0; r < plan.renders.length; r++) {
        const rd = plan.renders[r];
        setBusyLabel(tr("Rendering natural pitch ({n} of {total})…", { n: r + 1, total: plan.renders.length }));
        await renderNaturalPitch(rd.mediaPath, rd.rangeStart, rd.rangeEnd, rd.speedFactor, rd.outPath);
      }
      setBusyLabel(tr("Replacing the pieces…"));
      const fades = naturalPitchFadesFor(plan);
      const res: PlaceNaturalPitchResult = await evalTS(
        "placeNaturalPitch",
        plan,
        plan.renders.map((r) => r.outPath),
        fades,
      );
      if (res.undoPieces.length > 0) {
        jlChangedAfterNatural.current = false;
        naturalClipsReplaced.current = false;
        setNaturalPitchInfo({
          renders: plan.renders.map((r) => ({
            filePath: r.outPath,
            mediaPath: r.mediaPath,
            speedFactor: r.speedFactor,
            rangeStart: r.rangeStart,
          })),
          pieces: res.undoPieces,
          tailFadeFrames: res.undoTailFadeFrames,
          headFadeFrames: res.undoHeadFadeFrames,
          linkedVideoIds: res.undoLinkedVideoIds,
          hadPitch: res.undoPieces.map((u) => {
            const p = plan.pieces.find((x) => Math.abs(x.start - u.timelineStart) < 0.001);
            return !!p && p.hadPitch;
          }),
          jlBefore: { result: jlCutResult, everRan: jlCutEverRan, last: lastJLApplied.current },
          sequenceId: res.sequenceId,
          sequenceName: res.sequenceName,
          placedNodeIds: res.placedNodeIds,
          placedRenderPaths: res.placedRenderPaths,
        });
      }
      if (replacesEarlierRun && res.undoPieces.length > 0) {
        res.warnings.push(
          tr(
            "Revert now covers only this run. The pieces of the earlier Natural pitch run stay as rendered; Premiere's own undo history still has them.",
          ),
        );
      }
      setNaturalPitchResult({ replaced: res.replaced, skipped: plan.skippedNoSpeedChange, warnings: res.warnings });
      appendLog(
        `Natural pitch: ${res.replaced} piece(s) replaced from ${plan.renders.length} ffmpeg render(s) (${plan.renders
          .map((r) => `${Math.round(r.speedFactor * 10000) / 100}%`)
          .join(", ")})${fades.apply ? `, ${res.fadesApplied} J/L fade(s) restored` : ""}.`,
      );
      for (const w of res.warnings) appendLog(`Natural pitch warning: ${w}`);
    } catch (e: any) {
      appendLog(`Natural pitch failed: ${describeError(e)}`);
      setNaturalPitchError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRevertNaturalPitch = singleRun(async () => {
    if (busy || !naturalPitchInfo) return;
    const info = naturalPitchInfo;
    const renderPaths = info.renders.map((r) => r.filePath);
    const fx = await confirmRebuildEffects(tr("Revert"), () => evalTS("getMediaClipsEffectSummary", renderPaths), true);
    if (!fx.proceed) return;
    setBusy(true);
    setBusyLabel(tr("Reverting to the original pieces…"));
    setNaturalPitchError(null);
    try {
      const res: UndoNaturalPitchResult = await evalTS(
        "undoNaturalPitch",
        info.renders.map((r) => r.filePath),
        info.pieces,
        info.tailFadeFrames,
        info.headFadeFrames,
        info.linkedVideoIds,
        info.sequenceId,
        info.sequenceName,
        info.placedNodeIds,
        info.placedRenderPaths,
        jlChangedAfterNatural.current || naturalClipsReplaced.current,
      );
      // Pitch Shifter comes back the way "Revert to segments" brings it back:
      // applyPitchToSelection derives it from each restored piece's speed.
      // Only when every replaced piece had it — otherwise it would also land
      // on pieces that never had it.
      const withPitch = info.hadPitch.filter(Boolean).length;
      if (withPitch > 0 && withPitch === info.hadPitch.length && res.piecesRestored > 0) {
        setBusyLabel(tr("Restoring Pitch…"));
        try {
          setPitchApplyResult(await evalTS("applyPitchToSelection"));
        } catch (e: any) {
          res.warnings.push(tr("Restoring Pitch failed: {error}", { error: describeError(e) }));
        }
      } else if (withPitch > 0) {
        res.warnings.push(
          tr(
            "Some of the original pieces had Pitch Shifter and some didn't — add it again where you need it (Calculator gives the values).",
          ),
        );
      }
      setJlCutResult(info.jlBefore.result);
      setJlCutEverRan(info.jlBefore.everRan);
      lastJLApplied.current = info.jlBefore.last;
      if (jlChangedAfterNatural.current) {
        res.warnings.push(
          tr(
            "J/L Pacing was run after Natural pitch. The replaced pieces are back where they were before Natural pitch; pieces at 100% speed keep their later J/L position. Run Reset and Make J/L Cut again to line everything up.",
          ),
        );
      }
      jlChangedAfterNatural.current = false;
      naturalClipsReplaced.current = false;
      setNaturalPitchInfo(null);
      setNaturalPitchResult(null);
      appendLog(`Natural pitch reverted: ${res.piecesRestored} original piece(s) restored.`);
      if (shownWarnings(res.warnings).length) setNaturalPitchError(shownWarnings(res.warnings).join(" "));
      for (const w of res.warnings) appendLog(`Natural pitch revert warning: ${w}`);
    } catch (e: any) {
      appendLog(`Natural pitch revert failed: ${describeError(e)}`);
      setNaturalPitchError(describeError(e));
    } finally {
      setBusy(false);
    }
  });

  const handleSaveApiKey = () => {
    const key = cleanApiKey(apiKeyInput);
    if (!key) return;
    const problem = apiKeyProblem(key);
    if (problem) {
      setApiKeyInputError(tr(problem));
      return;
    }
    setApiKeyInputError(null);
    saveElevenLabsApiKey(key);
    setApiKeyInput("");
    setApiKeyEditing(false);
    setApiKeyInvalid(false);
    setApiKey(key);
    setVoicesReloadToken((n) => n + 1);
  };

  const handleReloadElevenLabsVoices = () => {
    if (!apiKey) return;
    setVoicesReloadToken((n) => n + 1);
  };

  const assistantKey = assistantProvider === "openai" ? openaiKey : anthropicKey;

  // Live model list for whichever provider is currently selected — mirrors
  // the ElevenLabs voices-loading effect's own shape (cancelled flag,
  // loading/error state). Re-fetches whenever the key or the provider changes;
  // a list fetched earlier for a provider stays in state, so the picker still
  // shows it while the new fetch runs. A fetch failure doesn't block "Improve for
  // voice" itself — improveScript() falls back to a hardcoded model id if
  // none is set, so this only affects whether the picker below is usable.
  useEffect(() => {
    // Clear any stale error/loading state from the previous provider before the
    // early return below; otherwise switching to Claude with no key yet would
    // leave an OpenAI failure banner describing the wrong provider's problem.
    setModelsError(null);
    if (!assistantKey) {
      setModelsLoading(false);
      return;
    }
    const storedProblem = apiKeyProblem(assistantKey);
    if (storedProblem) {
      setModelsLoading(false);
      setModelsError(tr(storedProblem));
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    import("../lib/scriptAssistant")
      .then(({ listOpenAiModels, listAnthropicModels, pickDefaultModel }) => {
        const loader = assistantProvider === "openai" ? listOpenAiModels : listAnthropicModels;
        return loader(assistantKey).then((models) => ({ models, pickDefaultModel }));
      })
      .then(({ models, pickDefaultModel }) => {
        if (cancelled) return;
        if (assistantProvider === "openai") {
          setOpenaiModels(models);
          setOpenaiModelId((prev) => {
            if (prev && models.some((m) => m.id === prev)) return prev;
            const picked = pickDefaultModel(models, "openai");
            // Persist the auto-correction, not just the in-memory value —
            // otherwise a deprecated saved id gets silently re-applied from
            // disk at the start of every future session, before this same
            // effect corrects it again each time.
            saveOpenAiModelId(picked);
            return picked;
          });
        } else {
          setClaudeModels(models);
          setClaudeModelId((prev) => {
            if (prev && models.some((m) => m.id === prev)) return prev;
            const picked = pickDefaultModel(models, "claude");
            saveAnthropicModelId(picked);
            return picked;
          });
        }
      })
      .catch((e) => {
        if (!cancelled) setModelsError(describeError(e));
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assistantKey, assistantProvider]);

  const scriptModelOptions: VoicePickerOption[] = useMemo(() => {
    const models = assistantProvider === "openai" ? openaiModels : claudeModels;
    const opts: VoicePickerOption[] = [];
    for (let i = 0; i < models.length; i++) opts.push({ id: models[i].id, label: models[i].label });
    return opts;
  }, [assistantProvider, openaiModels, claudeModels]);
  const scriptModelId = assistantProvider === "openai" ? openaiModelId : claudeModelId;
  const setScriptModelId = (id: string) => {
    if (assistantProvider === "openai") {
      setOpenaiModelId(id);
      saveOpenAiModelId(id);
    } else {
      setClaudeModelId(id);
      saveAnthropicModelId(id);
    }
  };

  const handleSaveAssistantKey = () => {
    const key = cleanApiKey(assistantKeyInput);
    if (!key) return;
    const problem = apiKeyProblem(key);
    if (problem) {
      setAssistantKeyInputError(tr(problem));
      return;
    }
    setAssistantKeyInputError(null);
    if (assistantProvider === "openai") {
      saveOpenAiApiKey(key);
      setOpenaiKey(key);
    } else {
      saveAnthropicApiKey(key);
      setAnthropicKey(key);
    }
    setAssistantKeyInput("");
    setAssistantKeyEditing(false);
  };

  const handleImproveScript = async () => {
    if (!assistantKey) {
      setAssistantKeyEditing(true);
      setAssistantKeyInput("");
      return;
    }
    setImprovingScript(true);
    setImproveError(null);
    const textAtStart = voiceText;
    try {
      let style: ScriptStyle = "plain";
      if (voiceEngine === "elevenlabs" && elevenModel === "v3") style = "v3-tags";
      else if (voiceEngine === "elevenlabs" && elevenModel === "v4") style = "v4-tags";
      const { improveScript } = await import("../lib/scriptAssistant");
      const improved = await improveScript(
        assistantProvider,
        assistantKey,
        textAtStart.trim(),
        style,
        scriptIntensity,
        scriptModelId || undefined,
      );
      // The Text field stays editable during this (multi-second) request —
      // if the user typed something new while waiting, applying the
      // improved rewrite of the *old* text here would silently discard
      // their edit with no way to recover it (Undo only ever restores the
      // pre-improve text, not whatever they typed after clicking).
      if (voiceTextRef.current !== textAtStart) {
        setImproveError(
          tr(
            'Improved text was generated, but you edited the script while waiting — your edit was kept and the improvement wasn\'t applied. Run "Improve for voice" again if you still want it.',
          ),
        );
      } else {
        setLastImprovedFrom(textAtStart);
        setVoiceText(improved);
      }
    } catch (e: any) {
      setImproveError(describeError(e));
    } finally {
      setImprovingScript(false);
    }
  };

  const handleUndoImprove = () => {
    if (lastImprovedFrom === null) return;
    setVoiceText(lastImprovedFrom);
    setLastImprovedFrom(null);
  };

  const handleRetryKokoro = () => {
    kokoroLoadAttemptedRef.current = false;
    setKokoroReloadToken((n) => n + 1);
  };

  // The full ElevenLabs voice settings from the current sliders/toggles,
  // recomputed on every render. Voice Changer sends them as they are;
  // text-to-speech (Generate/Insert, Replace, Batch) sends them through
  // elevenTtsVoiceSettings below.
  const elevenVoiceSettings: VoiceSettings = {
    stability: stability / 100,
    similarityBoost: similarity / 100,
    style: style / 100,
    speed: speed / 100,
    useSpeakerBoost,
  };
  // Text-to-speech only (Generate/Replace/Batch): v4 takes Stability and
  // Similarity alone, v3 Stability alone (ElevenLabs' text-to-speech guide: no
  // Speed, Similarity or Speaker Boost on v3). Voice Changer keeps the full set
  // above — its own model (eleven_multilingual_sts_v2) is unaffected by the
  // v2/v3/v4 choice.
  let elevenTtsVoiceSettings: VoiceSettings = elevenVoiceSettings;
  if (elevenModel === "v4") elevenTtsVoiceSettings = { stability: stability / 100, similarityBoost: similarity / 100 };
  else if (elevenModel === "v3") elevenTtsVoiceSettings = { stability: stability / 100 };
  const elevenTtsModelId = ELEVEN_TTS_MODEL_IDS[elevenModel];
  // Sliders are shown only where they are sent: Speed, Style and Speaker Boost
  // for v2 and for Voice Changer whatever the model choice; Similarity for
  // every model but v3.
  const elevenSpeedStyleApply = elevenModel === "v2" || voiceMode === "voice-changer";
  const elevenSimilarityApplies = elevenModel !== "v3" || voiceMode === "voice-changer";
  // Only ever sent when v3 or v4 is selected — see languageOverrideEnabled's
  // own state comment above for why v2 would just ignore it anyway.
  const elevenLanguageCodeForCall = elevenModel !== "v2" && languageOverrideEnabled && languageCode ? languageCode : undefined;

  // The Text field holds the selected generated clip's own script: loaded from
  // it (and maybe edited since), or the same text.
  const textMatchesDetectedClip =
    !!detectedClip && (textLoadedFor === detectedClip.mediaPath || voiceText.trim() === detectedClip.meta.text.trim());
  const loadDetectedClipText = () => {
    if (!detectedClip) return;
    lastAutoFilledTextRef.current = detectedClip.meta.text;
    setVoiceText(detectedClip.meta.text);
    setTextLoadedFor(detectedClip.mediaPath);
    setGenError(null);
  };

  const handleGenerate = singleRun(async (mode: "insert" | "replace") => {
    if (busy) return;
    if (!voiceText.trim()) return;
    if (voiceEngine === "elevenlabs" && (!apiKey || !selectedVoiceId)) return;
    if (voiceEngine === "kokoro" && !selectedKokoroVoiceId) return;

    // Captured now, before generateSpeech/generateKokoroSpeech below (a
    // network TTS call or local inference that can take several seconds to
    // tens of seconds) — importAudioAndPlaceOnTimeline uses this to verify
    // the selection hasn't moved to a different clip in that window before
    // muting/overwriting it. Same reasoning as Voice Changer's
    // rendered.clipNodeId (handleConvertVoice below).
    const expectedClipNodeId = mode === "replace" ? detectedClip?.nodeId : undefined;

    // Replace Voice speaks whatever the Text field holds. When that isn't the
    // selected clip's own script (the field held other text when the clip was
    // selected, so it wasn't loaded), the first click only says so; a second
    // click with the same clip and text goes ahead.
    if (mode === "replace" && detectedClip && !textMatchesDetectedClip) {
      const key = detectedClip.mediaPath + "\n" + voiceText.trim();
      if (replaceOtherTextConfirmed.current !== key) {
        replaceOtherTextConfirmed.current = key;
        setGenError(
          tr(
            'The Text field holds different text from the selected clip. Click "Load its text" above to use the clip\'s own text, or click "Replace Voice" again to speak the Text field\'s text over the clip.',
          ),
        );
        return;
      }
    }
    replaceOtherTextConfirmed.current = null;

    // Checked before the (paid) generation: where the new audio will go.
    setGenError(null);
    try {
      await evalTS(mode === "insert" ? "checkInsertSpot" : "checkReplaceTarget");
    } catch (e: any) {
      setGenError(describeError(e));
      return;
    }

    setBusy(true);
    setBusyLabel(tr("Generating voice-over…"));
    // The previous placement's result (and its Undo) stays until this attempt
    // places something; a failure leaves the timeline, and so the Undo, as it was.
    setGenError(null);
    let generatedFilePath: string | null = null;
    try {
      const projectFolderPath = await resolveProjectFolderIfEnabled();
      const gen =
        voiceEngine === "elevenlabs"
          ? await (
              await import("../lib/elevenlabs")
            ).generateSpeech(
              apiKey,
              selectedVoiceId,
              voices.find((v) => v.voiceId === selectedVoiceId)?.name || selectedVoiceId,
              voiceText.trim(),
              elevenTtsModelId,
              elevenTtsVoiceSettings,
              projectFolderPath,
              elevenOutputFormat,
              elevenLanguageCodeForCall,
            )
          : await generateKokoroSpeech(
              voiceText.trim(),
              selectedKokoroVoiceId,
              kokoroVoices.find((v) => v.id === selectedKokoroVoiceId)?.name || selectedKokoroVoiceId,
              projectFolderPath,
            );
      generatedFilePath = gen.filePath;
      const res = await evalTS("importAudioAndPlaceOnTimeline", gen.filePath, mode === "replace", expectedClipNodeId);
      for (const w of gen.warnings || []) appendLog(w);
      // Generation warnings (Kokoro's "generated in N parts") belong in the
      // result banner, not only in the session log.
      if (gen.warnings && gen.warnings.length) res.warnings = [...res.warnings, ...gen.warnings];
      setGenResult(res);
      setLastGenerateMode(mode);
      setUnplacedTake(null);
      appendLog(
        mode === "replace"
          ? `Replaced the selected clip's voice at ${res.placedAtSeconds.toFixed(2)}s${
              res.mutedInsteadOfRemoved
                ? " — the new take is on the track below; the previous take is disabled, not deleted (right-click it > Enable, or use Undo, to bring it back)."
                : "."
            }`
          : `Generated voice-over inserted at ${res.placedAtSeconds.toFixed(2)}s — go to Silence Cut or Pacing to process it.`,
      );
      if (mode === "replace") {
        setDetectedClip(null);
        autoFilledMediaPathRef.current = null;
      }
    } catch (e: any) {
      setGenError(describeError(e));
      appendLog(`Generate failed: ${rawErrorForLog(e)}`);
      if (generatedFilePath) {
        // Generated and saved, refused at placement: offered for placing again.
        setUnplacedTake({ filePath: generatedFilePath, mode, expectedClipNodeId });
        appendLog(`The generated file is kept at ${generatedFilePath} — "Place it again" places it without generating again.`);
      }
      if (isInvalidApiKeyError(e)) {
        setApiKeyInvalid(true);
        setApiKeyVerified(false);
      }
    } finally {
      setBusy(false);
    }
  });

  // Places the last generated-but-unplaced take (see unplacedTake): the same
  // placement call as Generate, with the same checks, and no generation.
  const handlePlaceAgain = singleRun(async () => {
    if (busy || !unplacedTake) return;
    const take = unplacedTake;
    setBusy(true);
    setBusyLabel(tr("Placing the generated voice-over…"));
    setGenError(null);
    setConvertError(null);
    try {
      const res = await evalTS("importAudioAndPlaceOnTimeline", take.filePath, take.mode === "replace", take.expectedClipNodeId);
      setGenResult(res);
      // The result and its Undo show in the view the take came from.
      setLastGenerateMode(take.fromConvert ? "convert" : take.mode);
      setUnplacedTake(null);
      appendLog(`Placed the previously generated voice-over at ${res.placedAtSeconds.toFixed(2)}s.`);
      if (take.mode === "replace" && !take.fromConvert) {
        setDetectedClip(null);
        autoFilledMediaPathRef.current = null;
      }
    } catch (e: any) {
      if (take.fromConvert) setConvertError(describeError(e));
      else setGenError(describeError(e));
      appendLog(`Placing again failed: ${rawErrorForLog(e)}`);
    } finally {
      setBusy(false);
    }
  });

  // Removes exactly the clip this placement put down and turns a muted
  // original back on (ppro.ts undoGeneratedPlacement) — not a number of
  // Premiere undo steps, which would also undo the user's own later edits.
  const handleUndoGenerate = async () => {
    if (!genResult || !canUndoGenerated(genResult)) return;
    setGenError(null);
    setConvertError(null);
    try {
      const res: UndoGeneratedResult = await evalTS(
        "undoGeneratedPlacement",
        [genResult.placedNodeId],
        [genResult.filePath],
        genResult.mutedOriginalNodeId,
        genResult.sequenceId,
        genResult.sequenceName,
      );
      appendLog(`Undo: removed ${res.removed} generated clip(s)${res.unmuted ? ", original take turned back on" : ""}.`);
      if (shownWarnings(res.warnings).length) {
        const text = shownWarnings(res.warnings).join(" ");
        if (lastGenerateMode === "convert") setConvertError(text);
        else setGenError(text);
      }
      // The Undo record stays while the new take is still on the timeline
      // (a removal that failed), so Undo can be tried again after the cause
      // is fixed.
      if (!res.remaining) setGenResult(null);
    } catch (e: any) {
      appendLog(`Undo failed: ${describeError(e)}`);
      if (lastGenerateMode === "convert") setConvertError(describeError(e));
      else setGenError(describeError(e));
    }
  };

  // Batch generation — splits the textarea on newlines into queued items.
  // Appends rather than replaces so adding more lines after a partial run
  // doesn't disturb already-queued items' status.
  const handleAddToBatch = () => {
    const lines = batchText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length === 0) return;
    const newItems: BatchItem[] = [];
    for (let i = 0; i < lines.length; i++) {
      newItems.push({ id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`, text: lines[i], status: "pending" });
    }
    setBatchItems((prev) => [...prev, ...newItems]);
    setBatchText("");
    setBatchNotice(null);
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleClearBatch = () => {
    setBatchItems([]);
    setBatchImportResult(null);
    setBatchError(null);
    setBatchNotice(null);
  };

  // Sequential, not Promise.all — respects ElevenLabs' own rate limits and
  // avoids concurrent writes against the same Premiere timeline state.
  // Best-effort per item (matches forEachSelectedQEClip's established
  // convention elsewhere in this codebase): one item failing marks it
  // "failed" with its own error and the loop continues, rather than
  // aborting the whole batch. Items already "done" from an earlier partial
  // run are skipped and their stored filePath is reused, so adding more
  // lines and re-running doesn't regenerate everything from scratch.
  const handleRunBatch = async () => {
    if (voiceEngine !== "elevenlabs" && voiceEngine !== "kokoro") return;
    if (batchItems.length === 0) return;
    if (voiceEngine === "elevenlabs" && (!apiKey || !selectedVoiceId)) return;
    if (voiceEngine === "kokoro" && !selectedKokoroVoiceId) return;

    setBatchRunning(true);
    setBatchError(null);
    setBatchNotice(null);
    const previousImport = batchImportResult;
    try {
      const items = [...batchItems];
      if (items.every((it) => it.placed)) {
        const note = tr("Every line is already on the timeline. Add new lines, or use Undo to place them again.");
        setBatchNotice(note);
        appendLog(note);
        return;
      }
      // Checked before anything is generated, so a paid generation never ends
      // in a refused placement: the target track and, after an earlier run,
      // the sequence it was placed in.
      await evalTS("checkBatchPlacementSpot", previousImport?.sequenceId, previousImport?.sequenceName);
      const projectFolderPath = await resolveProjectFolderIfEnabled();
      const filePaths: string[] = [];
      // Imported once before the loop (module-resolution is cached after the
      // first `import()` anyway, but no reason to re-await it every item).
      const generateElevenLabsSpeech = voiceEngine === "elevenlabs" ? (await import("../lib/elevenlabs")).generateSpeech : null;
      // Request stitching: each line is sent with the end of the line before it and
      // the start of the line after it, so the voice doesn't restart its intonation
      // at every clip. v2 and v4 only (not available on v3). Capped at
      // STITCH_CONTEXT_CHARS a side: ElevenLabs doesn't document whether this
      // neighbouring text is billed, so the `character-cost` it reports is logged
      // per line below.
      const stitch = voiceEngine === "elevenlabs" && elevenModel !== "v3";
      const neighbour = (index: number, side: "previous" | "next"): string | undefined => {
        const t = items[index]?.text?.trim();
        if (!t) return undefined;
        return side === "previous" ? t.slice(-STITCH_CONTEXT_CHARS) : t.slice(0, STITCH_CONTEXT_CHARS);
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // Re-check against the *live* queue, not this loop's own snapshot —
        // if the user removed this item (still-pending "x" click) since the
        // run started, skip it entirely: no API call, not placed on the
        // timeline, matching what the visible queue now shows.
        if (!batchItemsRef.current.some((it) => it.id === item.id)) continue;
        if (item.placed) continue;
        if (item.status === "done" && item.filePath) {
          filePaths.push(item.filePath);
          continue;
        }
        setBatchItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "generating", error: undefined } : it)));
        try {
          const gen =
            voiceEngine === "elevenlabs"
              ? await generateElevenLabsSpeech!(
                  apiKey,
                  selectedVoiceId,
                  voices.find((v) => v.voiceId === selectedVoiceId)?.name || selectedVoiceId,
                  item.text,
                  elevenTtsModelId,
                  elevenTtsVoiceSettings,
                  projectFolderPath,
                  elevenOutputFormat,
                  elevenLanguageCodeForCall,
                  stitch ? { previousText: neighbour(i - 1, "previous"), nextText: neighbour(i + 1, "next") } : undefined,
                )
              : await generateKokoroSpeech(
                  item.text,
                  selectedKokoroVoiceId,
                  kokoroVoices.find((v) => v.id === selectedKokoroVoiceId)?.name || selectedKokoroVoiceId,
                  projectFolderPath,
                );
          filePaths.push(gen.filePath);
          if ("characterCost" in gen && gen.characterCost !== undefined) {
            appendLog(
              `Batch line ${i + 1}: ${item.text.trim().length} characters, ElevenLabs reported character-cost=${gen.characterCost}${
                stitch ? " (with neighbouring-line context)" : ""
              }.`,
            );
          }
          setBatchItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "done", filePath: gen.filePath } : it)));
        } catch (e: any) {
          const msg = describeError(e);
          setBatchItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, status: "failed", error: msg } : it)));
        }
      }

      if (filePaths.length === 0) {
        setBatchError(tr("No items generated successfully — nothing to place on the timeline."));
        return;
      }
      // An earlier run's sequence is passed so the host refuses to place in
      // another one: the merged Undo record below must stay in one sequence.
      const res = await evalTS("importAudioAndPlaceSequentially", filePaths, previousImport?.sequenceId, previousImport?.sequenceName);
      const normPath = (p: string) => (p || "").replace(/\\/g, "/").toLowerCase();
      const placedPaths = res.placedFilePaths.map(normPath);
      setBatchItems((prev) =>
        prev.map((it) => (it.filePath && placedPaths.includes(normPath(it.filePath)) ? { ...it, placed: true } : it)),
      );
      // Undo removes every batch clip still on the timeline, this run's and earlier runs'.
      setBatchImportResult(
        previousImport
          ? {
              ...res,
              placedNodeIds: [...previousImport.placedNodeIds, ...res.placedNodeIds],
              placedFilePaths: [...previousImport.placedFilePaths, ...res.placedFilePaths],
            }
          : res,
      );
      appendLog(`Batch: ${res.imported}/${filePaths.length} generated clips placed sequentially from the playhead.`);
      if (res.warnings.length) {
        for (const w of res.warnings) appendLog(`Batch placement warning: ${w}`);
      }
    } catch (e: any) {
      setBatchError(describeError(e));
    } finally {
      setBatchRunning(false);
    }
  };

  const handleUndoBatch = async () => {
    if (!batchImportResult) return;
    setBatchError(null);
    setBatchNotice(null);
    try {
      const res: UndoGeneratedResult = await evalTS(
        "undoGeneratedPlacement",
        batchImportResult.placedNodeIds,
        batchImportResult.placedFilePaths,
        "",
        batchImportResult.sequenceId,
        batchImportResult.sequenceName,
      );
      appendLog(`Undo: removed ${res.removed} batch clip(s).`);
      if (shownWarnings(res.warnings).length) setBatchError(shownWarnings(res.warnings).join(" "));
      // While any placed clip is still on the timeline (a removal that
      // failed), the rows stay placed and the Undo record stays, so the queue
      // can't place them a second time and Undo can be tried again.
      if (!res.remaining) {
        setBatchItems((prev) => prev.map((it) => (it.placed ? { ...it, placed: false } : it)));
        setBatchImportResult(null);
      }
    } catch (e: any) {
      appendLog(`Undo failed: ${describeError(e)}`);
      setBatchError(describeError(e));
    }
  };

  // Voice Changer pipeline: render the selected clip to WAV (baking in any
  // Speed/Pitch already applied) → wait until the rendered file is complete
  // (see waitForFileStable; a Media Encoder fallback finishes later) → send it
  // to ElevenLabs' speech-to-speech endpoint → place the result through the
  // same mute-based Replace path text-to-speech Generate uses. Uses `busy` (a deliberate,
  // user-clicked multi-step action like Generate/Cut/Send to AE, not a
  // background load like voicesLoading).
  const handleConvertVoice = async () => {
    if (busy) return;
    if (voiceEngine !== "elevenlabs" || !apiKey || !selectedVoiceId || !voiceTabSelectedClip) return;
    if (voiceTabSelectedClip.trackType !== "audio") return;

    setBusy(true);
    setBusyLabel(tr("Converting voice…"));
    setConvertError(null);
    setGenError(null);
    let convertedFilePath: string | null = null;
    let convertedClipNodeId: string | undefined;
    try {
      const presetPath = getExportPresetPath();
      // Captured before the render is even queued — waitForFileStable
      // requires the output file's own mtime to be at or after this, so a
      // stale leftover file (e.g. from a failed delete) can never look
      // "stable" on its own; only a genuinely fresh write can.
      const notBeforeMs = Date.now();
      setConvertStage(tr("Rendering selected clip…"));
      await checkProjectFolderAvailable();
      const rendered = await evalTS("renderSelectedClipToWav", presetPath, outputLocation === "project");
      appendLog(
        rendered.renderedBy === "premiere"
          ? "Voice Changer: rendered inside Premiere."
          : "Voice Changer: Premiere couldn't render the clip itself; the render went to Adobe Media Encoder's queue.",
      );
      setConvertStage(tr("Waiting for the render to finish writing…"));
      await waitForFileStable(rendered.filePath, notBeforeMs, { timeoutMs: 120000, renderedBy: rendered.renderedBy });
      setConvertStage(tr("Converting voice…"));
      const projectFolderPath = await resolveProjectFolderIfEnabled();
      const { convertSpeechToSpeech } = await import("../lib/elevenlabs");
      const converted = await convertSpeechToSpeech(
        apiKey,
        selectedVoiceId,
        voices.find((v) => v.voiceId === selectedVoiceId)?.name || selectedVoiceId,
        rendered.filePath,
        "eleven_multilingual_sts_v2",
        elevenVoiceSettings,
        projectFolderPath,
        elevenOutputFormat,
      );
      setConvertStage(tr("Placing on timeline…"));
      // Passing rendered.clipNodeId verifies the clip being replaced is
      // still the same one that was actually rendered/converted — this
      // whole pipeline can take several seconds to tens of seconds, and
      // nothing stops the user from selecting a different clip on the real
      // Premiere timeline in that window otherwise.
      convertedFilePath = converted.filePath;
      convertedClipNodeId = rendered.clipNodeId;
      const res = await evalTS("importAudioAndPlaceOnTimeline", converted.filePath, true, rendered.clipNodeId);
      setGenResult(res);
      setLastGenerateMode("convert");
      setUnplacedTake(null);
      appendLog(
        `Voice Changer: converted clip placed at ${res.placedAtSeconds.toFixed(2)}s${
          res.mutedInsteadOfRemoved
            ? " — the new take is on the track below; the previous take is disabled, not deleted (right-click it > Enable, or use Undo, to bring it back)."
            : "."
        }`,
      );
    } catch (e: any) {
      setConvertError(describeError(e));
      if (convertedFilePath) {
        // Converted (paid) and saved, refused at placement: offered for placing again.
        setUnplacedTake({ filePath: convertedFilePath, mode: "replace", expectedClipNodeId: convertedClipNodeId, fromConvert: true });
        appendLog(`The converted file is kept at ${convertedFilePath} — "Place it again" places it without converting again.`);
      }
    } finally {
      setConvertStage(null);
      setBusy(false);
    }
  };

  // sendToAfterEffects never renders (it refuses Pitch or any other unsupported
  // effect; see its doc comment), so this only reconstructs position and speed.
  // Nothing is queued, so there is no waitForFileStable step.
  const handleSendToAE = async () => {
    if (busy) return;
    setBusy(true);
    setBusyLabel(tr("Sending to After Effects…"));
    setSendResult(null);
    setSendError(null);
    try {
      // sendToAfterEffects renders nothing and writes its manifest under
      // Documents, so neither the export preset nor the project folder is
      // needed for it; a missing preset must not block sending.
      let presetPath = "";
      try {
        presetPath = getExportPresetPath();
      } catch (e) {
        presetPath = "";
      }
      const res = await evalTS("sendToAfterEffects", presetPath, outputLocation === "project");
      setSendResult(res);
    } catch (e: any) {
      const raw = String(e?.message || e);
      // After Natural pitch the selection can mix rendered files with untouched
      // pieces (or two speeds), which Send to AE sends as separate media.
      const hint =
        /All selected clips must come from the same source media/.test(raw) && (naturalPitchInfo || renderUndoInfo)
          ? " " +
            tr(
              "After Natural pitch or a full-timeline render, the pieces come from more than one file. Send each group separately (select pieces of one kind), or use Render full timeline for AE.",
            )
          : "";
      setSendError(describeError(e) + hint);
    } finally {
      setBusy(false);
    }
  };

  // Pacing tab's alternative to Send to AE for a selection with Pitch (or
  // another unsupported effect); see renderFullTimelineForAE's doc comment. Two
  // ExtendScript calls, not one: the render may go to Media Encoder's queue and
  // finish later, so this waits (waitForFileStable, like Voice Changer's render step) for it to
  // finish writing before calling placeFullTimelineRender, which replaces the
  // original pieces with the rendered file on the timeline, so the bake is
  // visible in Premiere rather than silently updating a hand-off file.
  // Afterwards the new clip (plus any untouched linked video) is selected, and
  // the ordinary "Send to After Effects" button is the next step.
  const handleRenderFullTimeline = async () => {
    if (busy) return;
    setBusy(true);
    setBusyLabel(tr("Rendering full timeline for After Effects…"));
    setRenderPlaceResult(null);
    setRenderPlaceError(null);
    // The previous render's Revert is replaced below, once this render has
    // placed its file; a render that fails before that leaves it available.
    setRenderUndoResult(null);
    setRenderUndoError(null);
    try {
      const presetPath = getExportPresetPath();
      const notBeforeMs = Date.now();
      await checkProjectFolderAvailable();
      const rendered: FullTimelineRenderResult = await evalTS("renderFullTimelineForAE", presetPath, outputLocation === "project");
      appendLog(
        rendered.renderedBy === "premiere"
          ? "Render full timeline: rendered inside Premiere."
          : "Render full timeline: Premiere couldn't render it itself; the render went to Adobe Media Encoder's queue.",
      );
      setBusyLabel(tr("Waiting for Premiere to finish rendering the full timeline…"));
      // 120 s instead of waitForFileStable's 25 s default: this bakes the
      // whole selected span in one job, and a Media Encoder fallback
      // finishes later still.
      await waitForFileStable(rendered.filePath, notBeforeMs, { timeoutMs: 120000, renderedBy: rendered.renderedBy });
      setBusyLabel(tr("Replacing the original pieces with the rendered clip…"));
      const placed: PlaceFullTimelineRenderResult = await evalTS(
        "placeFullTimelineRender",
        rendered.filePath,
        rendered.firstAudioStart,
        rendered.audioNodeIds,
        rendered.pieces,
        rendered.audioSpans,
      );
      setRenderPlaceResult(placed);
      // Only offer "Revert to segments" once the pieces were actually
      // captured (best-effort in renderFullTimelineForAE — see
      // RenderUndoPiece's own comment) — an empty array here means nothing
      // could be restored anyway.
      if (rendered.pieces && rendered.pieces.length > 0) {
        setRenderUndoInfo({
          filePath: rendered.filePath,
          timelineStart: rendered.firstAudioStart,
          pieces: rendered.pieces,
          fades: renderUndoFadesFor(rendered.pieces),
          sequenceId: rendered.sequenceId,
          sequenceName: rendered.sequenceName,
          placedNodeId: placed.placedNodeId,
        });
      } else {
        setRenderUndoInfo(null);
      }
    } catch (e: any) {
      setRenderPlaceError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  // "Revert to segments" — undoes handleRenderFullTimeline: removes the one
  // baked clip and restores every original piece's position/source range/
  // Speed via undoFullTimelineRender (ppro.ts). Pitch Shifter's ratio needs
  // no capture (applyPitchToSelection derives it from each clip's restored
  // speed; see undoFullTimelineRender's doc comment); only whether a piece
  // had Pitch is captured (RenderUndoPiece.hadPitch). Pitch is re-applied to
  // the restored (and selected) pieces only when every sped-up piece had it;
  // a mix gets a warning instead. applyPitchToSelection skips pieces at 100%
  // speed, so this never adds a spurious Pitch Shifter.
  const handleUndoRenderFullTimeline = singleRun(async () => {
    if (busy) return;
    if (!renderUndoInfo) return;
    const renderedPath = renderUndoInfo.filePath;
    const fx = await confirmRebuildEffects(tr("Revert to segments"), () => evalTS("getMediaClipsEffectSummary", [renderedPath]), true);
    if (!fx.proceed) return;
    setBusy(true);
    setBusyLabel(tr("Reverting to the original pieces…"));
    setRenderUndoResult(null);
    setRenderUndoError(null);
    try {
      const res: UndoFullTimelineRenderResult = await evalTS(
        "undoFullTimelineRender",
        renderUndoInfo.filePath,
        renderUndoInfo.timelineStart,
        renderUndoInfo.pieces,
        renderUndoInfo.fades.apply,
        renderUndoInfo.fades.tailFadeFrames,
        renderUndoInfo.fades.headFadeFrames,
        renderUndoInfo.sequenceId,
        renderUndoInfo.sequenceName,
        renderUndoInfo.placedNodeId,
      );
      // Pitch comes back only where it was: when every sped-up piece had it
      // (applyPitchToSelection skips pieces at 100% on its own).
      const spedUp = renderUndoInfo.pieces.filter((p) => Math.abs(p.speedFactor - 1) >= 0.0001);
      const spedUpWithPitch = spedUp.filter((p) => p.hadPitch).length;
      if (spedUp.length > 0 && spedUpWithPitch > 0 && spedUpWithPitch < spedUp.length) {
        res.warnings.push(
          tr(
            "Some of the original pieces had Pitch Shifter and some didn't — add it again where you need it (Calculator gives the values).",
          ),
        );
      }
      if (spedUp.length > 0 && spedUpWithPitch === spedUp.length && res.piecesRestored > 0) {
        setBusyLabel(tr("Restoring Pitch…"));
        try {
          const pitchRes = await evalTS("applyPitchToSelection");
          setPitchApplyResult(pitchRes);
        } catch (e: any) {
          res.warnings.push(tr("Restoring Pitch failed: {error}", { error: describeError(e) }));
        }
      }
      setRenderUndoResult(res);
      // Revert to segments places Natural pitch's clips again as new track
      // items, so Natural pitch's own Revert must look for them by file, as it
      // does after J/L Pacing moved them.
      if (naturalPitchInfo) naturalClipsReplaced.current = true;
      // The render this just reverted no longer reflects what's on the
      // timeline, and the rendered clip it replaced no longer exists —
      // clearing both keeps the button itself from being clicked again on
      // an already-restored timeline.
      setRenderPlaceResult(null);
      setRenderUndoInfo(null);
      appendLog(`Reverted to ${res.piecesRestored} original piece(s).`);
      if (res.warnings.length) appendLog(res.warnings.join(" "));
    } catch (e: any) {
      appendLog(`Revert to segments failed: ${describeError(e)}`);
      setRenderUndoError(describeError(e));
    } finally {
      setBusy(false);
    }
  });

  // Everything runDiagnostics() itself can't see — it runs in ExtendScript,
  // with zero visibility into this panel's own JS-side state (Scan/Cut/
  // Speed/Pitch/Render/Send results, the session log, Whisper's load
  // state). Folded into the same file so a user only ever has to hand over
  // one report, not separately describe what they clicked and in what
  // order — appended, not replacing, ppro.ts's own QE/Premiere-state dump.
  const buildJsDiagnosticsSummary = (): string => {
    const lines: string[] = [
      `AI Voice Master Tool v${__APP_VERSION__} (${__SECURE_BUILD__ ? "secure" : __RELEASE_BUILD__ ? "release" : "dev"} build)`,
    ];
    // Which host build and system the report comes from (os.release() is the
    // kernel version: Darwin 22 = macOS 13 … 25 = macOS 26; on Windows the
    // build number).
    {
      let host = "unknown";
      try {
        const env = csi.getHostEnvironment();
        host = `${env.appName} ${env.appVersion} (UI ${env.appUILocale || "?"}, locale ${env.appLocale || "?"})`;
      } catch (e) {
        // not in a CEP host (preview): leave "unknown"
      }
      let system = "unknown";
      try {
        system = `${os.platform()} ${os.release()} ${os.arch()}`;
      } catch (e) {
        // no Node: leave "unknown"
      }
      lines.push(`host: ${host}`, `system: ${system}`);
    }
    lines.push("--- JS plugin state ---");
    if (scanResult) {
      lines.push(
        `scanResult: duration=${scanResult.durationSec.toFixed(1)}s floor=${scanResult.floorDb.toFixed(
          1,
        )}dB speech=${scanResult.speechDb.toFixed(1)}dB vad=${
          scanResult.vadFlags ? "Silero" : "energy-only fallback"
        } sourceChannels=${scanResult.sourceChannels ?? "unknown"}`,
      );
      // Per-phase timing, so a report from a slower machine says where the time
      // went; see ScanTimingMs's doc comment (analyze.ts) for what each phase
      // covers.
      {
        const t = scanResult.scanTimingMs;
        lines.push(
          `  scan timing: decode=${t.decode}ms vad=${t.vad}ms sharedSignals=${t.sharedSignals}ms viterbi=${t.viterbi}ms whisper=${t.whisper}ms wordSnap=${t.wordSnap}ms total=${t.total}ms`,
        );
      }
      // Per-file signal quality (from ScanResult): what explains why one file cuts
      // differently from another.
      lines.push(
        `  signal quality: gaussianSeparability=${scanResult.gaussianSeparability.toFixed(2)} noiseFraction=${scanResult.noiseFraction.toFixed(
          3,
        )} noiseFloorRms=${scanResult.noiseFloorRms.toFixed(2)} medianSnrDb=${scanResult.medianSnrDb.toFixed(1)}dB`,
      );
      for (const mode of MODES) {
        const segs = scanResult.segmentsByMode[mode.name] || [];
        const kept = segs.reduce((a, s) => a + (s.end - s.start), 0);
        const cutPct = scanResult.durationSec > 0 ? (1 - kept / scanResult.durationSec) * 100 : 0;
        lines.push(`  mode ${mode.name}: ${segs.length} segments, ${kept.toFixed(1)}s kept (${cutPct.toFixed(1)}% cut)`);
      }
      lines.push(`  words: ${scanResult.words ? `${scanResult.words.length} words` : "null (unavailable)"}`);
      if (scanResult.pauseStatsByMode) {
        for (const mode of MODES) {
          const ps = scanResult.pauseStatsByMode[mode.name];
          if (ps) {
            lines.push(
              `  pauses ${mode.name}: detected=${ps.detectedCount} longest=${ps.longestSec.toFixed(3)}s shortestCuttable~${ps.minCuttableSec.toFixed(2)}s`,
            );
          }
        }
      }
      lines.push(`  wordSnapEnergyGate: ${scanResult.wordSnapEnergyGate.toFixed(2)} (linear RMS)`);
      // Boundary-confidence spread. attachBoundaryConfidence annotates every
      // segment, but only the waveform markers read it; an aggregate here says
      // whether a file was decided confidently or was borderline throughout.
      {
        const snapped = scanResult.segmentsByModeWordSnapped?.[simpleMode] ?? scanResult.segmentsByMode[simpleMode] ?? [];
        const confs = snapped.map((s) => s.confidence).filter((c): c is number => typeof c === "number");
        if (confs.length) {
          const sorted = confs.slice().sort((a, b) => a - b);
          const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
          const lowCount = confs.filter((c) => c < 0.5).length;
          lines.push(
            `  boundary confidence (${simpleMode}): n=${confs.length} p10=${q(0.1).toFixed(2)} p50=${q(0.5).toFixed(2)} p90=${q(
              0.9,
            ).toFixed(2)} below0.5=${lowCount}`,
          );
        }
      }
      if (scanResult.segmentsByModeWordSnapped) {
        for (const mode of MODES) {
          const segs = scanResult.segmentsByModeWordSnapped[mode.name] || [];
          const kept = segs.reduce((a, s) => a + (s.end - s.start), 0);
          lines.push(`  mode ${mode.name} (word-snapped): ${segs.length} segments, ${kept.toFixed(1)}s kept`);
        }
      }
    } else {
      lines.push("scanResult: none (Scan not run this session)");
    }
    lines.push(`active tab=${tab}`);
    lines.push(`detectMode=${detectMode} simpleMode=${simpleMode}`);
    // The active preset's tuning constants, verbatim, so a report shows which
    // values were actually running on that machine.
    {
      const active = MODES.find((m) => m.name === simpleMode);
      if (active) {
        const { name, label, description, ...tuning } = active;
        lines.push(`mode config (${name}): ${JSON.stringify(tuning)}`);
      }
    }
    // The Pacing side's equivalent: without it, a report about J/L overlap feel
    // can't say which floor/ceiling were in effect.
    lines.push(`J/L config (${jlCutPreset}): ${JSON.stringify(getJLCutPresetConfig(jlCutPreset))}`);
    // Core count matters directly: whisper takes most of Scan's time, and its
    // thread count is derived from this number (see whisperThreadCount), so a
    // "slow on weaker hardware" report needs both it and the threads actually
    // used (getWhisperDiagnostics' `lastThreads`).
    lines.push(
      `platform: ${navigator.platform ?? "?"} cores=${(navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency ?? "?"} ua=${(
        navigator.userAgent ?? ""
      ).slice(0, 120)}`,
    );
    lines.push(`whisper: ${JSON.stringify(getWhisperDiagnostics())}`);
    lines.push(`silero: ${JSON.stringify(getSileroDiagnostics())}`);
    // ExtendScript load status, reported here and as an in-panel banner instead
    // of a modal dialog (see evalES).
    lines.push(`jsx load: ${JSON.stringify(getJsxLoadDiagnostics())}`);
    if (hostDiagnosticNotes.length) lines.push(`host diagnostic notes (from errors): ${hostDiagnosticNotes.join(" | ")}`);
    if (cutResult) lines.push(`last Cut: ${JSON.stringify(cutResult)}`);
    if (jlCutResult) lines.push(`last J/L Cut (${jlCutPreset}): ${JSON.stringify(jlCutResult)}`);
    if (speedApplyResult) lines.push(`last Apply Speed: ${JSON.stringify(speedApplyResult)}`);
    if (pitchApplyResult) lines.push(`last Pitch restore: ${JSON.stringify(pitchApplyResult)}`);
    lines.push(`pitch mode=${pitchMode}`);
    if (naturalPitchResult) lines.push(`last Natural pitch: ${JSON.stringify(naturalPitchResult)}`);
    if (naturalPitchInfo) {
      lines.push(
        `Natural pitch applied: ${naturalPitchInfo.pieces.length} piece(s), renders ${naturalPitchInfo.renders
          .map((r) => `${Math.round(r.speedFactor * 10000) / 100}% from ${r.rangeStart.toFixed(2)}s`)
          .join("; ")}, J/L changed after=${jlChangedAfterNatural.current}`,
      );
    }
    if (naturalPitchError) lines.push(`last Natural pitch error: ${naturalPitchError}`);
    // Errors the panel shows that no result above carries.
    const shownErrors: [string, string | null][] = [
      ["Scan", scanError],
      ["Cut", cutError],
      ["J/L Cut", jlCutError],
      ["read clip speed", readClipSpeedError],
      ["Send to AE", sendError],
      ["Render full timeline for AE", renderPlaceError],
      ["revert full-timeline render", renderUndoError],
      ["audio preview", previewAudioError],
    ];
    for (const [what, err] of shownErrors) if (err) lines.push(`last ${what} error: ${err}`);
    if (sendResult) lines.push(`last Send to AE: ${JSON.stringify(sendResult)}`);
    if (renderPlaceResult) lines.push(`last Render full timeline for AE: ${JSON.stringify(renderPlaceResult)}`);
    lines.push(
      `AI Voice tab: voiceMode=${voiceMode} engine=${voiceEngine} elevenlabs(hasKey=${!!apiKey} model=${elevenModel} outputFormat=${elevenOutputFormat} speed=${speed / 100} speakerBoost=${useSpeakerBoost} languageOverride=${elevenLanguageCodeForCall ?? "off"} voices=${
        voices.length
      } error=${voicesError ?? "none"}) kokoro(${JSON.stringify(getKokoroDiagnostics())} voices=${
        kokoroVoices.length
      } error=${kokoroVoicesError ?? "none"})`,
    );
    if (genResult) lines.push(`last Generate/Insert: ${redactScriptInFileNames(JSON.stringify(genResult))}`);
    if (genError) lines.push(`last Generate error: ${genError}`);
    // Batch, Voice Changer and Improve for voice (scriptAssistant.ts) are
    // summarised here too. Item text is deliberately not logged (as voiceText
    // isn't above): only counts, statuses and errors, enough to diagnose without
    // exporting the user's script.
    {
      const byStatus: Record<string, number> = {};
      for (const it of batchItems) byStatus[it.status] = (byStatus[it.status] || 0) + 1;
      lines.push(
        `Batch: ${batchItems.length} item(s) [${JSON.stringify(byStatus)}] running=${batchRunning} error=${
          batchError ?? "none"
        }${batchImportResult ? ` lastImport=${redactScriptInFileNames(JSON.stringify(batchImportResult))}` : ""}`,
      );
    }
    lines.push(`Voice Changer: stage=${convertStage ?? "none"} error=${convertError ?? "none"}`);
    lines.push(
      `Improve for voice: provider=${assistantProvider} hasKey=${!!assistantKey} intensity=${scriptIntensity} models(loading=${modelsLoading} error=${
        modelsError ?? "none"
      } openai=${openaiModels.length} claude=${claudeModels.length}) improving=${improvingScript} error=${improveError ?? "none"}`,
    );
    // Folds kokoro.ts's own crash-survival step log into this one report and
    // clears it (see drainKokoroDiagnosticLog's own comment) — the user
    // should never need to separately notice or attach a second file.
    lines.push("--- kokoro step-by-step load log (since last Diagnostics run) ---");
    lines.push(drainKokoroDiagnosticLog());
    lines.push("--- session log ---");
    lines.push(...(log.length ? log : ["(empty)"]));
    return lines.join("\n");
  };

  const handleDiagnostics = async () => {
    if (busy) return;
    setBusy(true);
    setBusyLabel(tr("Running diagnostics…"));
    setDiagPath(null);
    setDiagError(null);
    try {
      const res = await evalTS("runDiagnostics", buildJsDiagnosticsSummary());
      setDiagPath(res.path);
    } catch (e: any) {
      setDiagError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleClearData = async () => {
    if (busy) return;
    setConfirmClearOpen(false);
    setBusy(true);
    setBusyLabel(tr("Clearing data…"));
    setClearResult(null);
    setClearError(null);
    try {
      const res = await evalTS("clearAllData");
      // Keys, presets and settings too, then a fresh start: the panel reloads
      // with nothing remembered, as on first install. Once the settings file is
      // gone the reload happens whatever the Documents folder did: the panel
      // must not keep working with keys that no longer exist on disk (the next
      // settings write would put them back). What was left behind is shown
      // after the reload.
      const settingsCleared = clearLocalSettings();
      if (settingsCleared) {
        if (!res.cleared) {
          try {
            window.localStorage.setItem(CLEAR_DATA_NOTE_KEY, JSON.stringify(res));
          } catch (e) {
            // no storage: the note is lost, the reload still happens
          }
        }
        window.location.reload();
        return;
      }
      setClearResult({ ...res, cleared: false });
      if (res.cleared) {
        // The files these results/paths point at (the Send to AE manifest in the
        // Bridge folder, the Diagnostics report) were just deleted from disk —
        // without resetting them, the panel can keep showing paths to files that
        // no longer exist.
        setSendResult(null);
        setDiagPath(null);
      }
    } catch (e: any) {
      setClearError(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleGiveFeedback = () => {
    if (loadSkipExternalLinkConfirm()) {
      openFeedbackLink();
      return;
    }
    setRememberLinkChoice(false);
    setConfirmLinkOpen(true);
  };

  const openFeedbackLink = () => {
    try {
      window.cep.util.openURLInDefaultBrowser(FEEDBACK_URL);
    } catch (e) {
      // best effort — nothing else to fall back to here
    }
  };

  const handleConfirmOpenLink = () => {
    if (rememberLinkChoice) saveSkipExternalLinkConfirm(true);
    setConfirmLinkOpen(false);
    openFeedbackLink();
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const updated = savePreset({ name, cutThresholdDb: advDb, minSilenceSec: advMinSilence });
    // null: not saved (the panel says why); the list and the typed name stay.
    if (!updated) return;
    setPresets(updated);
    setSelectedPresetName(name);
    setPresetName("");
  };

  const handleDeletePreset = (name: string) => {
    const updated = deletePreset(name);
    if (!updated) return;
    setPresets(updated);
    if (selectedPresetName === name) setSelectedPresetName("");
  };

  const handleSelectPreset = (name: string) => {
    setSelectedPresetName(name);
    const p = presets.find((x) => x.name === name);
    if (p) {
      setAdvDb(p.cutThresholdDb);
      setAdvMinSilence(p.minSilenceSec);
    }
  };

  // Display labels for JLCutPreset's lowercase keys: each needs its own tr()
  // call with the exact display string, which a capitalized runtime key can't
  // give.
  const jlPresetLabels: Record<JLCutPreset, string> = {
    aggressive: tr("Aggressive"),
    normal: tr("Normal"),
    gentle: tr("Gentle"),
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <h1>AI Voice Master Tool</h1>
        </div>
        <div className="header-right">
          {clipInfo && <div className="clip-badge">{clipInfo.clipName}</div>}
          <div className="settings-menu" ref={settingsRef}>
            <button className="icon-btn" aria-label={tr("Diagnostics & feedback")} onClick={() => setSettingsOpen((o) => !o)}>
              <GearIcon />
            </button>
            {settingsOpen && (
              <div className="settings-popover" role="menu">
                <button onClick={() => setGuideOpen(true)}>{tr("Guide / FAQ")}</button>

                <div className="divider" />

                <label>{tr("Language")}</label>
                <div className="segmented">
                  <button className={getLanguage() === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
                    English
                  </button>
                  <button className={getLanguage() === "ru" ? "active" : ""} onClick={() => setLanguage("ru")}>
                    Русский
                  </button>
                  <button className={getLanguage() === "es" ? "active" : ""} onClick={() => setLanguage("es")}>
                    Español
                  </button>
                </div>

                <div className="divider" />

                <label>{tr("Save Renders")}</label>
                <div className="segmented">
                  <button
                    className={outputLocation === "documents" ? "active" : ""}
                    onClick={() => handleOutputLocationChange("documents")}
                  >
                    {tr("Documents")}
                  </button>
                  <button className={outputLocation === "project" ? "active" : ""} onClick={() => handleOutputLocationChange("project")}>
                    {tr("Next to project")}
                  </button>
                </div>
                <p className="hint">
                  {tr(
                    '"Next to project" saves beside your .prproj file instead of Documents, and survives "Clear all data" below (which never touches the project folder).',
                  )}
                </p>

                <div className="divider" />

                <button onClick={() => setConfirmClearOpen(true)} disabled={busy}>
                  {busy ? tr("Clearing…") : tr("Clear all data")}
                </button>
                <p className="hint">
                  {tr(
                    'Deletes everything under "AI Voice Master Tool" in Documents — Renders, voice-overs, Diagnostics reports — and your API keys, presets and settings. Any generated clip already on your timeline goes offline immediately (Premiere links to that file by path).',
                  )}
                </p>
                {clearResult && (
                  <div className={clearResult.cleared ? "banner success" : "banner warning"}>
                    {clearResult.cleared
                      ? tr("Cleared.")
                      : tr("Some files couldn't be removed (in use elsewhere?) — check {path}.", { path: clearResult.path })}
                  </div>
                )}
                {clearError && <div className="banner error">{clearError}</div>}

                <div className="divider" />

                <button onClick={handleDiagnostics} disabled={busy}>
                  {busy ? tr("Running…") : tr("Run Diagnostics")}
                </button>
                <p className="hint">{tr("Saves a troubleshooting report to your Documents folder.")}</p>
                {diagPath && (
                  <div className="banner success">
                    {tr("Saved to")} <code>{diagPath}</code>.
                  </div>
                )}
                {diagError && <div className="banner error">{diagError}</div>}

                <div className="divider" />

                <button onClick={handleGiveFeedback}>{tr("Give Feedback")}</button>

                <div className="divider" />

                <button onClick={() => setLicenseOpen(true)}>{tr("License")}</button>

                <div className="divider" />

                <button onClick={() => setLicensesOpen(true)}>{tr("Licenses / Third-party notices")}</button>

                <p className="hint" style={{ textAlign: "center", opacity: 0.6 }}>
                  v{__APP_VERSION__} · {__SECURE_BUILD__ ? tr("secure build") : __RELEASE_BUILD__ ? tr("release build") : tr("dev build")}
                </p>
              </div>
            )}
          </div>
        </div>
      </header>

      <nav className="tabs">
        {(["voice", "cut", "speed", "send"] as Tab[]).map((t) => (
          <button key={t} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "cut" && tr("Silence Cut")}
            {t === "speed" && tr("Pacing")}
            {t === "voice" && tr("AI Voice")}
            {t === "send" && tr("Send to AE")}
          </button>
        ))}
      </nav>

      <main className="panel-body">
        {/* Above the tabs, not inside Silence Cut: a failed ExtendScript load breaks
            every tab, and each action's own error alone wouldn't explain why. */}
        {jsxLoadError && (
          <div className="banner error">
            {tr(
              "The plugin's scripting part didn't load, so nothing that works on the timeline can run. Quit and reopen Premiere Pro; if that doesn't help, reinstall the plugin.",
            )}{" "}
            {jsxLoadError}
          </div>
        )}
        {dataFileProblems.map((problem) => (
          <div key={problem.file} className="banner warning">
            {describeDataFileProblem(problem)}
          </div>
        ))}
        {/* Above the tabs: the step that finds the project unsaved can be in the Pacing
            tab (Natural pitch, the full-timeline render) or in the AI Voice tab. */}
        {unsavedProjectNotice && (
          <div className="banner">
            {unsavedProjectNotice} <button onClick={() => setUnsavedProjectNotice(null)}>{tr("Close")}</button>
          </div>
        )}
        {tab === "cut" && (
          <section>
            <div className="row">
              <button className="primary" style={{ flex: 1 }} onClick={handleScan} disabled={busy}>
                {busy ? tr("Scanning…") : tr("SCAN CLIP")}
              </button>
            </div>

            {!scanResult && !scanError && <p className="hint">{tr("Select one clip on the timeline, then click Scan Clip.")}</p>}

            {scanError && <div className="banner error">{scanError}</div>}

            {clipInfo && clipInfo.fpsMismatch && (
              <div className="banner warning">
                {tr(
                  "The sequence runs at {seqFps} fps and the clip at {srcFps} fps, so audio and video may drift. Consider a {srcFps} fps sequence.",
                  {
                    seqFps: clipInfo.sequenceFps.toFixed(2),
                    srcFps: clipInfo.sourceFps.toFixed(2),
                  },
                )}
              </div>
            )}

            {selectionNotScanned && scannedClipInfo && (
              <div className="banner warning">
                {tr(
                  `The selected clip isn't the one that was scanned: it's another part of "{name}", or it was trimmed since Scan. Select the scanned clip again, or Scan this one, before cutting.`,
                  { name: scannedClipInfo.clipName },
                )}
              </div>
            )}

            {/* A fallback: the selection poll clears the scan in the same update in
                which the selection stops matching it, so the two messages of the banner
                below show mainly when the poll's selection read fails (clipInfo is then
                null and the scan stays). */}
            {scannedClipInfo &&
              (!clipInfo || clipInfo.mediaPath !== scannedClipInfo.mediaPath) &&
              // Same exception as the polling effect above: Cut deliberately
              // leaves multiple pieces selected, which reads as "nothing
              // selected" here — don't warn about that right after a Cut
              // that just successfully cut this exact scanned clip.
              !(!clipInfo && cutResult && lastCutSourceInfo && lastCutSourceInfo.mediaPath === scannedClipInfo.mediaPath) && (
                <div className="banner warning">
                  {!clipInfo
                    ? tr(
                        `Nothing is currently selected on the timeline (or more than one clip) — this is still showing the last Scan's results for "{name}". Re-select it before cutting.`,
                        { name: scannedClipInfo.clipName },
                      )
                    : tr(
                        `Selected clip has changed since Scan (was "{prev}", now "{current}") — Cut would apply to what's selected now, not what was analyzed. Scan again before cutting.`,
                        { prev: scannedClipInfo.clipName, current: clipInfo.clipName },
                      )}
                </div>
              )}

            {/* Same clip, but its Speed changed since Scan (e.g. through Premiere's
                Speed/Duration dialog before Cut). Scan's segment boundaries are
                speed-independent and Cut reads the clip's current speed fresh, so this is
                very likely handled correctly, but it is flagged rather than silently
                trusted, like the "clip changed since Scan" warning. Warn-only: Cut stays
                clickable. */}
            {scannedClipInfo &&
              clipInfo &&
              clipInfo.mediaPath === scannedClipInfo.mediaPath &&
              Math.abs(clipInfo.speedFactor - scannedClipInfo.speedFactor) > 0.001 && (
                <div className="banner warning">
                  {tr(
                    "This clip's Speed has changed since Scan (was {prev}%, now {current}%) — Cut should still apply correctly (Scan's own analysis doesn't depend on Speed), but Scan again first if the cut looks wrong.",
                    {
                      prev: (scannedClipInfo.speedFactor * 100).toFixed(0),
                      current: (clipInfo.speedFactor * 100).toFixed(0),
                    },
                  )}
                </div>
              )}

            {cutResult && cutResult.stereoForced && (
              <div className="banner warning">
                {tr(
                  "Sequence audio was mono — Cut switched it to stereo so audio plugins can be applied; levels or panning may sound different afterwards.",
                )}
              </div>
            )}

            {scanResult && (
              <div className="scan-summary">
                <div className="stat">
                  <span className="label">{tr("duration")}</span>
                  <span className="value">{scanResult.durationSec.toFixed(1)}s</span>
                </div>
                <div className="stat">
                  <span className="label">{tr("noise")}</span>
                  <span className="value">{fmtDb(scanResult.floorDb)}</span>
                </div>
                <div className="stat">
                  <span className="label">{tr("speech")}</span>
                  <span className="value">{fmtDb(scanResult.speechDb)}</span>
                </div>
                <div className="stat">
                  <span className="label">{tr("segments")}</span>
                  <span className="value">{segmentsToCut.length}</span>
                </div>
              </div>
            )}

            {scanResult && (
              <p className="hint">
                {tr("Speech detection:")} {scanResult.vadFlags ? tr("AI model") : tr("level-based fallback")} · {tr("Word check:")}{" "}
                {scanResult.words ? tr("on (words: {count})", { count: scanResult.words.length }) : tr("unavailable")}
              </p>
            )}

            {scanResult && (
              <>
                <div className="row" style={{ margin: "16px 0 0" }}>
                  <div className="segmented" style={{ flex: 1 }}>
                    <button className={detectMode === "simple" ? "active" : ""} onClick={() => setDetectMode("simple")}>
                      {tr("Automatic")}
                    </button>
                    <button className={detectMode === "advanced" ? "active" : ""} onClick={() => setDetectMode("advanced")}>
                      {tr("Advanced")}
                    </button>
                  </div>
                </div>

                {detectMode === "simple" && (
                  <div className="mode-list">
                    {MODES.map((m: ModeConfig) => {
                      // The same word-snapped, merged list Cut uses for this preset.
                      const segs = mergeAdjacentSegments(
                        scanResult.segmentsByModeWordSnapped?.[m.name] ?? scanResult.segmentsByMode[m.name] ?? [],
                      );
                      const speech = segs.reduce((a, s) => a + (s.end - s.start), 0);
                      return (
                        <button
                          key={m.name}
                          className={simpleMode === m.name ? "mode-card active" : "mode-card"}
                          onClick={() => setSimpleMode(m.name)}
                        >
                          <span className="mode-dot" aria-hidden="true" />
                          <div className="mode-copy">
                            <div className="mode-title">{tr(m.label)}</div>
                            <div className="mode-desc">{tr(m.description)}</div>
                            <div className="mode-stats">
                              {tr("Segments: {count} · cuts {pct}", { count: segs.length, pct: fmtPct(speech, scanResult.durationSec) })}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {detectMode === "simple" && pauseTooShortHint && <div className="banner warning">{pauseTooShortHint}</div>}

                {detectMode === "advanced" && (
                  <div className="advanced-controls">
                    <div className="hint-row">
                      {tr("noise {floor} · speech {speech}", { floor: fmtDb(scanResult.floorDb), speech: fmtDb(scanResult.speechDb) })}
                    </div>

                    <label>
                      <span className="row" style={{ margin: 0 }}>
                        {tr("cut threshold: {value}", { value: fmtDb(advDb) })}
                      </span>
                      <input
                        type="range"
                        min={-99}
                        max={0}
                        step={1}
                        value={advDb}
                        onChange={(e) => setAdvDb(Number(e.target.value))}
                        style={fillStyle(advDb, -99, 0)}
                      />
                    </label>

                    <label>
                      <span className="row" style={{ margin: 0 }}>
                        {tr("min. silence: {value}s", { value: advMinSilence.toFixed(2) })}
                      </span>
                      <input
                        type="range"
                        min={0.03}
                        max={1.5}
                        step={0.01}
                        value={advMinSilence}
                        onChange={(e) => setAdvMinSilence(Number(e.target.value))}
                        style={fillStyle(advMinSilence, 0.03, 1.5)}
                      />
                    </label>

                    <label className="row">
                      <input type="checkbox" checked={localSafetyCheck} onChange={(e) => setLocalSafetyCheck(e.target.checked)} />
                      {tr("Local threshold safety check")}
                    </label>

                    <div className="preview">
                      {tr("Segments: {count} · cuts {pct}", {
                        count: segmentsToCut.length,
                        pct: fmtPct(totalSpeechSec, scanResult.durationSec),
                      })}
                    </div>

                    <div className="row" style={{ margin: 0 }}>
                      <span className="hint" style={{ margin: 0 }}>
                        {tr("Presets")}
                      </span>
                    </div>
                    <div className="preset-row">
                      <input
                        type="text"
                        placeholder={tr("name this preset")}
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                      />
                      <button onClick={handleSavePreset}>{tr("Save")}</button>
                    </div>

                    {presets.length > 0 && (
                      <div className="preset-list">
                        {presets.map((p) => (
                          <div
                            key={p.name}
                            className={p.name === selectedPresetName ? "preset-chip active" : "preset-chip"}
                            onClick={() => handleSelectPreset(p.name)}
                          >
                            {p.name}
                            <span
                              className="delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(p.name);
                              }}
                            >
                              ×
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="row" style={{ margin: "12px 0 0" }}>
                  <span className="hint" style={{ margin: 0 }}>
                    {tr("Preview")}
                  </span>
                </div>
                <Waveform
                  rmsValues={scanResult.rmsValues}
                  durationSec={scanResult.durationSec}
                  regions={finalRegions}
                  onToggleRegion={toggleRegion}
                  onUndoToggle={undoLastToggle}
                  canUndoToggle={toggleHistory.length > 0}
                  audioUrl={previewAudioUrl}
                  audioError={previewAudioError}
                  onRequestAudio={ensurePreviewAudio}
                  audioOffsetSec={scannedClipInfo?.sourceInPoint ?? 0}
                  onAdjustBoundary={adjustBoundary}
                  onSelectRange={selectRange}
                />

                <div className="row">
                  <div className="row" style={{ margin: 0 }}>
                    <button className="primary" onClick={handleCut} disabled={busy || segmentsToCut.length === 0 || selectionNotScanned}>
                      {busy ? tr("Cutting…") : tr("CUT")}
                    </button>
                  </div>
                  <div className="row" style={{ margin: 0 }}>
                    <button onClick={handleUndoCut} disabled={busy || jlCutEverRan || !cutResult?.undoInfo}>
                      {tr("Undo")}
                    </button>
                  </div>
                </div>

                {cutResult && (
                  <div className={shownWarnings(cutResult.warnings).length ? "banner warning" : "banner success"}>
                    {tr("Segments cut: {count}.", { count: cutResult.segmentsCut })}
                    {shownWarnings(cutResult.warnings).map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
                {cutError && <div className="banner error">{cutError}</div>}
                {jlCutEverRan && (
                  <p className="hint">
                    {tr(
                      "J/L Pacing has run since this Cut. To use Undo again, select every piece of this Cut and click Reset in the Pacing tab; or use Cmd/Ctrl+Z repeatedly to go back to before Cut.",
                    )}
                  </p>
                )}
              </>
            )}

            {!scanResult && cutResult?.undoInfo && (
              <div className="row" style={{ margin: "16px 0 0", alignItems: "center" }}>
                <button onClick={handleUndoCut} disabled={busy || jlCutEverRan}>
                  {tr("Undo")}
                </button>
                <p className="hint" style={{ margin: 0 }}>
                  {tr("Undo of the last Cut is still available; the scan was cleared when another clip was selected.")}
                </p>
              </div>
            )}

            <div className="tab-footer" aria-hidden="true">
              {[5, 10, 6, 14, 8, 4, 8, 14, 6, 10, 5].map((h, i) => (
                <span key={i} style={{ height: h }} />
              ))}
            </div>
          </section>
        )}

        {tab === "speed" && (
          <section className="speed-tab">
            <div className="field-group">
              <label className="row field-label">{tr("J/L Pacing")}</label>
              {(!cutResult || !lastCutSegments || lastCutSegments.length < 2) && (
                <p className="hint">
                  {tr(
                    "Works on the pieces a Cut created — run Cut in Silence Cut, or just select already-cut pieces directly on the timeline (e.g. after reopening this project).",
                  )}
                </p>
              )}
              {cutResult && lastCutSegments && lastCutSegments.length >= 2 && lastCutSourceInfo && (
                <p className="hint">
                  {tr('Working on: pieces cut from "{name}" earlier this session.', { name: lastCutSourceInfo.clipName })}
                </p>
              )}
              <div className="segmented">
                {(["aggressive", "normal", "gentle"] as JLCutPreset[]).map((p) => (
                  <button key={p} className={jlCutPreset === p ? "active" : ""} onClick={() => setJlCutPreset(p)} disabled={busy}>
                    {jlPresetLabels[p]}
                  </button>
                ))}
              </div>
              <p className="hint">
                {jlCutPreset === "aggressive" && tr("Tightest pacing: the longest overlaps (recommended).")}
                {jlCutPreset === "normal" && tr("Balanced: clear pacing, with shorter overlaps than Aggressive.")}
                {jlCutPreset === "gentle" &&
                  tr("Lightest: small overlaps only where the audio allows them, plus a short fade at each edit.")}
              </p>

              <div className="row">
                <div className="row" style={{ margin: 0 }}>
                  <button className="primary" onClick={() => handleSmoothCuts()} disabled={busy}>
                    {busy ? tr("Working…") : tr("Make J/L Cut")}
                  </button>
                </div>
                {/* Also after a partial Reset (jlCutEverRan stays true until every
                    piece is reset), so the rest can be reset as the hint says. */}
                {(jlCutResult || jlCutEverRan) && (
                  <div className="row" style={{ margin: 0 }}>
                    <button onClick={handleResetSmoothCuts} disabled={busy}>
                      {tr("Reset")}
                    </button>
                  </div>
                )}
              </div>

              {jlCutResult && (
                <div className="banner success">
                  {tr("{pieces} pieces · {overlaps} boundaries overlapped · {fades} fades applied.", {
                    pieces: jlCutResult.clipsProcessed,
                    overlaps: jlCutResult.overlapsApplied,
                    fades: jlCutResult.fadesApplied,
                  })}
                </div>
              )}
              {jlCutResult && shownWarnings(jlCutResult.warnings).length > 0 && (
                <div className="banner warning">{shownWarnings(jlCutResult.warnings).join(" ")}</div>
              )}
              {jlCutError && <div className="banner error">{jlCutError}</div>}
            </div>

            <div className="divider" />

            <div className="field-group">
              <label className="row field-label">
                {tr("Speed %")}
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={speedInput}
                  onChange={(e) => {
                    const text = e.target.value;
                    setSpeedInput(text);
                    const n = Number(text);
                    if (text.trim() !== "" && !isNaN(n) && n > 0) setSpeedPercent(n);
                  }}
                  onBlur={() => {
                    const n = Number(speedInput);
                    if (speedInput.trim() === "" || isNaN(n) || n <= 0) {
                      setSpeedInput("100");
                      setSpeedPercent(100);
                    } else {
                      setSpeedInput(String(n));
                    }
                  }}
                />
              </label>

              {speedPercent > 105 && (
                <div className="banner warning">
                  {tr(
                    "Above 105%, AI voice often picks up audible artifacts. Stay at 105% or below, or correct the pitch with Pitch correction below.",
                  )}
                </div>
              )}

              <div className="row">
                <button className="primary" onClick={handleApplySpeed} disabled={busy}>
                  {busy ? tr("Applying…") : tr("Apply Speed")}
                </button>
              </div>
              {speedApplyResult && (
                <div className={shownWarnings(speedApplyResult.warnings).length ? "banner warning" : "banner success"}>
                  {speedApplyResult.clipsProcessed > 0 &&
                    tr("Speed applied to {count} clip(s).", { count: speedApplyResult.clipsProcessed })}
                  {shownWarnings(speedApplyResult.warnings).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="field-group">
              <label className="row field-label">{tr("Pitch correction")}</label>

              <div className="row">
                <div className="segmented" style={{ flex: 1, margin: 0 }}>
                  <button className={pitchMode === "natural" ? "active" : ""} onClick={() => setPitchMode("natural")}>
                    {tr("Natural")}
                  </button>
                  <button className={pitchMode === "calculator" ? "active" : ""} onClick={() => setPitchMode("calculator")}>
                    {tr("Calculator")}
                  </button>
                </div>
              </div>

              {pitchMode === "calculator" && (
                <div className="field-group">
                  <div className="row compact">
                    <button onClick={handleReadClipSpeed} disabled={busy}>
                      {tr("Read from selected clip")}
                    </button>
                  </div>
                  {readClipSpeedError && <div className="banner error">{readClipSpeedError}</div>}
                  {readClipSpeedMixed && (
                    <div className="banner warning">
                      {tr(
                        "Selected clips have different speeds ({speeds}%) — type one manually above, or use Natural instead (it corrects each piece at its own speed).",
                        { speeds: readClipSpeedMixed.join("%, ") },
                      )}
                    </div>
                  )}
                  {previewSemitones !== null ? (
                    <div className="preview">
                      <span>{tr("values for Speed % above — type into your plugin's own controls")}</span>
                      <span>
                        {tr("{semitones} semitones · {cents} cents · Ratio {ratio}", {
                          semitones: previewSemitones.toFixed(2),
                          cents: (previewSemitones * 100).toFixed(1),
                          ratio: semitonesToLiteralRatio(previewSemitones).toFixed(4),
                        })}
                      </span>
                    </div>
                  ) : (
                    <p className="hint">{tr("Speed % above is at 100 — nothing to compute yet.")}</p>
                  )}
                  <p className="hint">
                    {tr("Recommended:")} <strong>kHs Pitch Shifter</strong> {tr("(Kilohearts AB,")}{" "}
                    <code>kilohearts.com/products/pitch_shifter</code>
                    {tr(
                      ") — open its Pitch slider (shown in semitones) and type the semitones value above. Premiere's scripting can't set a third-party plugin's controls reliably, so type the value into the plugin's own window. This is an independent recommendation, not a partnership, sponsorship, or endorsement by Kilohearts AB — AI Voice Master Tool doesn't bundle, download, or install it; get it directly from them under their own terms.",
                    )}
                  </p>
                </div>
              )}
              {pitchMode === "natural" && (
                <>
                  <p className="hint">
                    {tr(
                      "Re-renders each sped-up piece with ffmpeg so it keeps the original pitch, and puts it back in the same place at 100% speed. Uses each piece's current speed — set it with Speed % above first. J/L Pacing and Send to After Effects keep working on the result; send pieces from one file at a time (the rendered pieces of one speed, or the untouched ones).",
                    )}
                  </p>
                  <div className="row">
                    <button className="primary" onClick={handleApplyNaturalPitch} disabled={busy}>
                      {busy ? tr("Applying…") : tr("Apply Natural pitch")}
                    </button>
                    {naturalPitchInfo && (
                      <button onClick={handleRevertNaturalPitch} disabled={busy}>
                        {tr("Revert")}
                      </button>
                    )}
                  </div>
                  {naturalPitchResult && (
                    <div className={shownWarnings(naturalPitchResult.warnings).length ? "banner warning" : "banner success"}>
                      {naturalPitchResult.replaced > 0 &&
                        tr("Natural pitch applied to {count} piece(s).", { count: naturalPitchResult.replaced })}
                      {naturalPitchResult.skipped > 0 &&
                        " " + tr("{count} clip(s) already at 100% speed — skipped.", { count: naturalPitchResult.skipped })}
                      {naturalPitchResult.replaced === 0 &&
                        naturalPitchResult.skipped === 0 &&
                        shownWarnings(naturalPitchResult.warnings).length === 0 &&
                        tr("No selected piece has a speed change — nothing to do.")}
                      {shownWarnings(naturalPitchResult.warnings).map((w, i) => (
                        <div key={i}>{w}</div>
                      ))}
                    </div>
                  )}
                  {naturalPitchInfo && (
                    <p className="hint">
                      {tr(
                        'To change the speed again, Revert first. The rendered files are in the "Renders" folder under "AI Voice Master Tool".',
                      )}
                    </p>
                  )}
                  {naturalPitchError && <div className="banner error">{naturalPitchError}</div>}
                </>
              )}
              {/* Pitch Shifter put back by a rebuild (Speed, J/L Pacing, Undo,
                  Revert to segments) when every piece had it: shown only when
                  that went wrong somewhere, since nothing else reports it. */}
              {pitchApplyResult && shownWarnings(pitchApplyResult.warnings).length > 0 && (
                <div className="banner warning">
                  {tr("Pitch Shifter couldn't be put back on every rebuilt piece:")}
                  {shownWarnings(pitchApplyResult.warnings).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="divider" />

            <div className="field-group">
              <label className="field-label">{tr("Render full timeline for AE")}</label>
              <p className="hint">
                {tr(
                  `Pitch, and any other effect besides Speed and J/L Pacing, exists only inside Premiere, so "Send to After Effects" (the Send to AE tab) refuses it. Finish your cut, pacing, speed and pitch edits, then click this: it bakes the selected audio span into one file (audio tracks without selected pieces, such as music, are muted for the render) and puts it on the timeline in place of the pieces. The render includes the track's fader and effects and the Master, which then apply to the new clip again: set them to their defaults first, or mix afterward. Then click "Send to After Effects" as usual. Video is not baked and is sent separately.`,
                )}
              </p>
              <div className="row">
                <button className="primary" onClick={handleRenderFullTimeline} disabled={busy}>
                  {busy ? tr("Rendering…") : tr("Render full timeline for AE")}
                </button>
                {renderUndoInfo && (
                  <button onClick={handleUndoRenderFullTimeline} disabled={busy}>
                    {busy ? tr("Reverting…") : tr("Revert to segments")}
                  </button>
                )}
              </div>
              {renderPlaceResult && (
                <div className={shownWarnings(renderPlaceResult.warnings).length ? "banner warning" : "banner success"}>
                  {tr(
                    'Replaced {count} piece(s) with one rendered clip at {seconds}s. It is selected: click "Send to After Effects" in the Send to AE tab next.',
                    { count: renderPlaceResult.clipsRemoved, seconds: renderPlaceResult.placedAtSeconds.toFixed(2) },
                  )}
                  {shownWarnings(renderPlaceResult.warnings).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
              {renderPlaceError && <div className="banner error">{renderPlaceError}</div>}
              {renderUndoResult && (
                <div className={shownWarnings(renderUndoResult.warnings).length ? "banner warning" : "banner success"}>
                  {tr("Reverted to {count} original piece(s).", { count: renderUndoResult.piecesRestored })}
                  {shownWarnings(renderUndoResult.warnings).map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
              )}
              {renderUndoError && <div className="banner error">{renderUndoError}</div>}
            </div>

            <div className="tab-footer" aria-hidden="true">
              {[5, 10, 6, 14, 8, 4, 8, 14, 6, 10, 5].map((h, i) => (
                <span key={i} style={{ height: h }} />
              ))}
            </div>
          </section>
        )}

        {tab === "voice" && (
          <section className="voice-tab">
            <p className="hint">
              {tr("Generate a voice-over from text. The result is an ordinary clip: Silence Cut and Pacing work on it as on any other.")}
            </p>

            {detectedClip && (
              <div className="banner detected-clip">
                {tr("Selected clip was generated with")} <strong>{detectedClip.meta.voiceName}</strong>{" "}
                {tr("({engine}):", { engine: detectedClip.meta.engine === "elevenlabs" ? "ElevenLabs" : "Kokoro" })} "
                {detectedClip.meta.text.length > 80 ? detectedClip.meta.text.slice(0, 80) + "…" : detectedClip.meta.text}"{" "}
                {textMatchesDetectedClip ? (
                  tr('— text loaded below. Pick a different voice and click "Replace Voice" to swap it in place.')
                ) : (
                  <>
                    {tr(
                      '— the Text field below holds other text, so this clip\'s text was not loaded. "Replace Voice" speaks what the Text field holds.',
                    )}{" "}
                    <button onClick={loadDetectedClipText} disabled={busy}>
                      {tr("Load its text")}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="engine-picker">
              <button className={voiceEngine === "elevenlabs" ? "active" : ""} onClick={() => setVoiceEngine("elevenlabs")}>
                ElevenLabs
              </button>
              <button className={voiceEngine === "kokoro" ? "active" : ""} onClick={() => setVoiceEngine("kokoro")}>
                {tr("Kokoro (offline)")}
              </button>
            </div>

            {voiceEngine && (
              <div className="segmented">
                <button className={voiceMode === "tts" ? "active" : ""} onClick={() => setVoiceMode("tts")}>
                  {tr("Text to Speech")}
                </button>
                {voiceEngine === "elevenlabs" && (
                  <button className={voiceMode === "voice-changer" ? "active" : ""} onClick={() => setVoiceMode("voice-changer")}>
                    {tr("Voice Changer")}
                  </button>
                )}
                <button className={voiceMode === "batch" ? "active" : ""} onClick={() => setVoiceMode("batch")}>
                  {tr("Batch")}
                </button>
              </div>
            )}

            {voiceEngine === "elevenlabs" && (
              <>
                <div className="field-group">
                  <label className="row field-label">
                    {tr("ElevenLabs API key")}
                    <span
                      className={`status-dot ${!apiKey || apiKeyInvalid ? "bad" : apiKeyVerified ? "ok" : "pending"}`}
                      aria-hidden="true"
                    />
                    {apiKey && !apiKeyEditing && (
                      <button
                        onClick={() => {
                          setApiKeyEditing(true);
                          setApiKeyInput("");
                        }}
                      >
                        {tr("Edit")}
                      </button>
                    )}
                  </label>
                  {(!apiKey || apiKeyEditing) && (
                    <div className="row">
                      <input
                        type="password"
                        placeholder="sk_..."
                        value={apiKeyInput}
                        onChange={(e) => {
                          setApiKeyInput(e.target.value);
                          setApiKeyInputError(null);
                        }}
                      />
                      <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()}>
                        {tr("Save")}
                      </button>
                      {apiKey && (
                        <button onClick={() => setApiKeyEditing(false)} className="ghost">
                          {tr("Cancel")}
                        </button>
                      )}
                    </div>
                  )}
                  {apiKeyInputError && <div className="banner error">{apiKeyInputError}</div>}
                  {voicesError && <div className="banner error">{voicesError}</div>}
                </div>

                <div className="divider" />

                <div className="field-group">
                  <label className="row field-label">{tr("Voice")}</label>
                  <div className="row">
                    <VoicePicker
                      options={elevenVoiceOptions}
                      value={selectedVoiceId}
                      onChange={setSelectedVoiceId}
                      disabled={voices.length === 0}
                      placeholder={!apiKey ? tr("Save an API key first") : voicesLoading ? tr("Loading voices…") : tr("No voices found")}
                      favoriteIds={elevenFavoriteIds}
                      onToggleFavorite={handleToggleElevenFavorite}
                    />
                    <button onClick={handleReloadElevenLabsVoices} disabled={!apiKey || voicesLoading}>
                      {voicesLoading ? tr("Loading…") : tr("Reload voices")}
                    </button>
                  </div>
                  <p className="hint">
                    {tr(
                      'Don\'t see a voice you want to use? Add it to your ElevenLabs account first — favorite, clone, or design it at elevenlabs.io or in their own app — then click "Reload voices" above to pick it up here.',
                    )}
                  </p>
                </div>

                <div className="divider" />

                <div className="field-group">
                  <label className="row field-label">{tr("Model")}</label>
                  <div className="segmented">
                    <button className={elevenModel === "v2" ? "active" : ""} onClick={() => setElevenModel("v2")}>
                      {tr("v2 (stable)")}
                    </button>
                    <button className={elevenModel === "v3" ? "active" : ""} onClick={() => setElevenModel("v3")}>
                      {tr("v3 (expressive)")}
                    </button>
                    <button className={elevenModel === "v4" ? "active" : ""} onClick={() => setElevenModel("v4")}>
                      {tr("v4 (newest)")}
                    </button>
                  </div>
                  {!elevenSpeedStyleApply && elevenModel === "v4" && (
                    <p className="hint">
                      {tr("v4 has no Speed, Style or Speaker Boost setting — set the pace with punctuation and tags in the text instead.")}
                    </p>
                  )}
                  {!elevenSpeedStyleApply && elevenModel === "v3" && (
                    <p className="hint">
                      {tr(
                        "v3 takes Stability only: it has no Similarity, Style, Speed or Speaker Boost setting. Set the pace and delivery with punctuation and audio tags in the text instead.",
                      )}
                    </p>
                  )}
                </div>

                {elevenSpeedStyleApply && (
                  <>
                    <div className="divider" />

                    <div className="field-group">
                      <label>
                        <span className="row" style={{ margin: 0 }}>
                          {tr("Speed: {value}x", { value: (speed / 100).toFixed(2) })}
                        </span>
                        <input
                          type="range"
                          min={70}
                          max={120}
                          value={speed}
                          onChange={(e) => setSpeed(Number(e.target.value))}
                          style={fillStyle(speed, 70, 120)}
                        />
                      </label>
                      <p className="hint">
                        {tr(
                          "Speed of the generation itself — separate from Speed in the Pacing tab, which retimes audio already on the timeline.",
                        )}
                      </p>
                    </div>
                  </>
                )}

                <div className="divider" />

                <div className="field-group">
                  <label className="row field-label">{tr("Output Quality")}</label>
                  <div className="row">
                    <VoicePicker
                      options={elevenOutputFormatOptions}
                      value={elevenOutputFormat}
                      onChange={(id) => {
                        const format = id as ElevenLabsOutputFormat;
                        setElevenOutputFormat(format);
                        saveElevenOutputFormat(format);
                      }}
                      placeholder={tr("Choose a quality")}
                    />
                  </div>
                  <p className="hint">
                    {tr(
                      "Higher bitrate or WAV sounds clearer but makes a bigger file. 128 kbps MP3 is a good default for voice-over and works on every ElevenLabs plan, including Free. 192 kbps MP3 and WAV need a paid ElevenLabs plan; if your plan doesn't include a format, ElevenLabs returns an error.",
                    )}
                  </p>
                </div>

                {elevenModel !== "v2" && voiceMode !== "voice-changer" && (
                  <>
                    <div className="divider" />
                    <div className="field-group">
                      <label className="row">
                        <input
                          type="checkbox"
                          checked={languageOverrideEnabled}
                          onChange={(e) => {
                            setLanguageOverrideEnabled(e.target.checked);
                            if (!e.target.checked) setLanguageCode("");
                          }}
                        />
                        {tr("Language Override")}
                      </label>
                      {languageOverrideEnabled && (
                        <div className="row">
                          <VoicePicker
                            options={elevenLanguageOptions}
                            value={languageCode}
                            onChange={setLanguageCode}
                            placeholder={tr("Auto-detect")}
                          />
                        </div>
                      )}
                      <p className="hint">
                        {tr(
                          "Forces v3/v4 to read the text in a specific language instead of auto-detecting it — only useful for short/ambiguous text the model might otherwise misread. Ignored on v2 (it always auto-detects).",
                        )}
                      </p>
                    </div>
                  </>
                )}

                {elevenSpeedStyleApply && (
                  <>
                    <div className="divider" />

                    <div className="field-group">
                      <label className="row">
                        <input type="checkbox" checked={useSpeakerBoost} onChange={(e) => setUseSpeakerBoost(e.target.checked)} />
                        {tr("Speaker Boost")}
                      </label>
                      <p className="hint">
                        {tr("Boosts similarity to the original voice; generation takes slightly longer. Worth leaving on.")}
                      </p>
                    </div>
                  </>
                )}
              </>
            )}

            {voiceEngine === "kokoro" && (
              <div className="field-group">
                <p className="hint">
                  {tr(
                    "Kokoro comes with the plugin and runs fully offline, without an API key or internet connection. It has English (American and British), Spanish, French, Hindi, Italian and Brazilian Portuguese voices. It has no fine-grained stability or style sliders like ElevenLabs; the result depends mostly on the voice preset and on clean, well-punctuated text in that voice's language.",
                  )}
                </p>
                <label className="row field-label">{tr("Language")}</label>
                <div className="row">
                  <VoicePicker
                    options={kokoroLanguageOptions}
                    value={kokoroLanguageFilter}
                    onChange={(lang) => {
                      setKokoroLanguageFilter(lang);
                      const stillValid = kokoroVoices.find((v) => v.id === selectedKokoroVoiceId && (!lang || v.language === lang));
                      if (!stillValid) {
                        const firstMatch = kokoroVoices.find((v) => !lang || v.language === lang);
                        setSelectedKokoroVoiceId(firstMatch?.id || "");
                      }
                    }}
                    disabled={kokoroVoices.length === 0}
                    placeholder={tr("All languages")}
                  />
                </div>

                <label className="row field-label">{tr("Voice")}</label>
                <div className="row">
                  <VoicePicker
                    options={kokoroVoiceOptions}
                    value={selectedKokoroVoiceId}
                    onChange={setSelectedKokoroVoiceId}
                    disabled={kokoroVoices.length === 0}
                    placeholder={kokoroVoicesLoading ? tr("Loading model…") : tr("Unavailable")}
                    favoriteIds={kokoroFavoriteIds}
                    onToggleFavorite={handleToggleKokoroFavorite}
                  />
                  {/* Shown whenever there's no voice list yet, not only on kokoroVoicesError: a
                      panel reload can leave this on "Loading model…" with no error ever set (the
                      in-flight promise never resolves on this component instance). Never
                      `disabled` on `kokoroVoicesLoading`, since that is exactly the flag that can
                      stay `true` in that case, which would make this way out unclickable.
                      Clicking re-runs the effect, which (see kokoroVoicesCacheRef above) picks up
                      the shared, likely already-loaded model instantly if it loaded anywhere in
                      this window. */}
                  {kokoroVoices.length === 0 && <button onClick={handleRetryKokoro}>{tr("Retry")}</button>}
                </div>
                {kokoroVoicesError && <div className="banner error">{kokoroVoicesError}</div>}
              </div>
            )}

            {voiceEngine && voiceMode === "tts" && (
              <>
                <div className="divider" />
                <div className="field-group">
                  <label className="row field-label">{tr("Text")}</label>
                  <textarea
                    rows={5}
                    value={voiceText}
                    onChange={(e) => {
                      setVoiceText(e.target.value);
                      if (lastImprovedFrom !== null) setLastImprovedFrom(null);
                    }}
                    placeholder={tr("Type or paste the narration to generate…")}
                  />
                  {voiceEngine === "elevenlabs" && elevenModel !== "v3" && voiceText.trim().length > ELEVEN_MAX_CHARS[elevenModel] && (
                    <div className="banner warning">
                      {tr(
                        "{count} characters — this model takes up to 10,000 per generation. Split the text into several generations, for example with Batch.",
                        {
                          count: voiceText.trim().length.toLocaleString(),
                        },
                      )}
                    </div>
                  )}
                  {voiceEngine === "elevenlabs" && elevenModel === "v3" && voiceText.trim().length > V3_MAX_CHARS && (
                    <div className="banner warning">
                      {tr(
                        "{count} characters — v3 caps requests at 5,000. Split this into multiple generations or switch to v2 or v4 above.",
                        {
                          count: voiceText.trim().length.toLocaleString(),
                        },
                      )}
                    </div>
                  )}
                </div>

                <div className="divider" />
                <div className="field-group">
                  <div className="row compact">
                    <button onClick={handleImproveScript} disabled={!voiceText.trim() || improvingScript}>
                      {improvingScript ? tr("Improving…") : tr("Improve for voice")}
                    </button>
                    <div className="segmented" style={{ margin: 0 }}>
                      <button
                        className={assistantProvider === "openai" ? "active" : ""}
                        onClick={() => {
                          setAssistantProvider("openai");
                          setAssistantKeyEditing(false);
                          setAssistantKeyInput("");
                        }}
                      >
                        OpenAI
                      </button>
                      <button
                        className={assistantProvider === "claude" ? "active" : ""}
                        onClick={() => {
                          setAssistantProvider("claude");
                          setAssistantKeyEditing(false);
                          setAssistantKeyInput("");
                        }}
                      >
                        Claude
                      </button>
                    </div>
                  </div>
                  <div className="row compact">
                    <div className="segmented" style={{ margin: 0 }}>
                      <button
                        className={scriptIntensity === "pacing" ? "active" : ""}
                        onClick={() => {
                          setScriptIntensity("pacing");
                          saveScriptIntensity("pacing");
                        }}
                      >
                        {tr("Pacing only")}
                      </button>
                      <button
                        className={scriptIntensity === "natural" ? "active" : ""}
                        onClick={() => {
                          setScriptIntensity("natural");
                          saveScriptIntensity("natural");
                        }}
                      >
                        {tr("Natural")}
                      </button>
                      {voiceEngine === "elevenlabs" && (elevenModel === "v3" || elevenModel === "v4") && (
                        <button
                          className={scriptIntensity === "expressive" ? "active" : ""}
                          onClick={() => {
                            setScriptIntensity("expressive");
                            saveScriptIntensity("expressive");
                          }}
                        >
                          {tr("Expressive")}
                        </button>
                      )}
                    </div>
                  </div>
                  {assistantKey && scriptModelOptions.length > 0 && (
                    <div className="row compact">
                      <VoicePicker
                        options={scriptModelOptions}
                        value={scriptModelId}
                        onChange={setScriptModelId}
                        placeholder={modelsLoading ? tr("Loading models…") : tr("Choose a model")}
                      />
                    </div>
                  )}
                  {modelsError && (
                    <div className="banner warning">
                      {modelsError} {tr("— using a built-in fallback model instead.")}
                    </div>
                  )}
                  {lastImprovedFrom !== null && (
                    <div className="row">
                      <button onClick={handleUndoImprove}>{tr("Undo")}</button>
                    </div>
                  )}
                  <p className="hint">
                    {tr(
                      "Sends your text to OpenAI or Anthropic, whichever you pick, with your own API key, and puts the rewrite back in the Text field: one click instead of copy-pasting your script into ChatGPT or Claude and back. On v2 and Kokoro it changes only wording and punctuation; on v3 and v4, which understand audio tags, it can also add them.",
                    )}
                  </p>
                  {(!assistantKey || assistantKeyEditing) && (
                    <div className="row compact">
                      <input
                        type="password"
                        placeholder={assistantProvider === "openai" ? "sk-..." : "sk-ant-..."}
                        value={assistantKeyInput}
                        onChange={(e) => {
                          setAssistantKeyInput(e.target.value);
                          setAssistantKeyInputError(null);
                        }}
                      />
                      <button onClick={handleSaveAssistantKey} disabled={!assistantKeyInput.trim()}>
                        {tr("Save")}
                      </button>
                      {assistantKey && (
                        <button onClick={() => setAssistantKeyEditing(false)} className="ghost">
                          {tr("Cancel")}
                        </button>
                      )}
                    </div>
                  )}
                  {assistantKeyInputError && <div className="banner error">{assistantKeyInputError}</div>}
                  {improveError && <div className="banner error">{improveError}</div>}
                </div>

                {voiceEngine === "elevenlabs" && (
                  <>
                    <div className="divider" />
                    <div className="field-group">
                      <label className="row field-label">{tr("Realism")}</label>
                      <div className="row">
                        <div className="segmented" style={{ flex: 1, margin: 0 }}>
                          <button className={realismMode === "automatic" ? "active" : ""} onClick={() => setRealismMode("automatic")}>
                            {tr("Automatic")}
                          </button>
                          <button className={realismMode === "advanced" ? "active" : ""} onClick={() => setRealismMode("advanced")}>
                            {tr("Advanced")}
                          </button>
                        </div>
                      </div>

                      {realismMode === "automatic" ? (
                        <div className="segmented">
                          <button
                            className={realismPreset === "narration" ? "active" : ""}
                            onClick={() => handleSelectRealismPreset("narration")}
                          >
                            {tr("Narration")}
                          </button>
                          <button
                            className={realismPreset === "expressive" ? "active" : ""}
                            onClick={() => handleSelectRealismPreset("expressive")}
                          >
                            {tr("Expressive")}
                          </button>
                          <button className={realismPreset === "calm" ? "active" : ""} onClick={() => handleSelectRealismPreset("calm")}>
                            {tr("Calm & Steady")}
                          </button>
                        </div>
                      ) : (
                        <div className="field-group">
                          <label>
                            <span className="row" style={{ margin: 0 }}>
                              {tr("Stability: {value}%", { value: stability })}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={stability}
                              onChange={(e) => setStability(Number(e.target.value))}
                              style={fillStyle(stability, 0, 100)}
                            />
                          </label>

                          {elevenSimilarityApplies && (
                            <label>
                              <span className="row" style={{ margin: 0 }}>
                                {tr("Similarity / Clarity: {value}%", { value: similarity })}
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={similarity}
                                onChange={(e) => setSimilarity(Number(e.target.value))}
                                style={fillStyle(similarity, 0, 100)}
                              />
                            </label>
                          )}

                          {elevenSpeedStyleApply && (
                            <label>
                              <span className="row" style={{ margin: 0 }}>
                                {tr("Style: {value}%", { value: style })}
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={style}
                                onChange={(e) => setStyle(Number(e.target.value))}
                                style={fillStyle(style, 0, 100)}
                              />
                            </label>
                          )}
                        </div>
                      )}

                      <div className="row compact" style={{ justifyContent: "center" }}>
                        <button type="button" className={"disclosure" + (tipsOpen ? " open" : "")} onClick={() => setTipsOpen((o) => !o)}>
                          <span className="disclosure-caret" aria-hidden="true">
                            {tipsOpen ? "▾" : "▸"}
                          </span>
                          {tipsOpen ? tr("Hide tips") : tr("Tips for realistic voice")}
                        </button>
                      </div>
                      {tipsOpen && elevenModel === "v2" && (
                        <p className="hint">
                          <strong>{tr("Voice choice matters more than any setting here")}</strong>{" "}
                          {tr(
                            "— pick (or clone) a voice whose natural register already matches the delivery you want, rather than forcing a mismatched voice via sliders.",
                          )}{" "}
                          <strong>{tr("Pacing/pauses")}</strong>{" "}
                          {tr(
                            `come from punctuation — commas, ellipses ("…"), and paragraph breaks are the main lever, on every model. This is generating with ElevenLabs'`,
                          )}{" "}
                          <code>eleven_multilingual_v2</code> {tr("model, which also takes an explicit pause tag,")}{" "}
                          <code>&lt;break time="1.0s" /&gt;</code>{" "}
                          {tr("(up to 3 seconds) — the only model here that does. Bracketed emotion tags like")} <code>[whispers]</code>/
                          <code>[sighs]</code> {tr("only work on v3 and v4 (switch above), so they won't do anything here.")}
                        </p>
                      )}
                      {tipsOpen && elevenModel === "v4" && (
                        <p className="hint">
                          <strong>{tr("Voice choice still matters most")}</strong>{" "}
                          {tr("— audio tags shape an already-fitting voice, they don't fix a mismatched one.")}{" "}
                          <strong>{tr("Bracket audio tags")}</strong> {tr("like")} <code>[whispers]</code>/<code>[laughs]</code>/
                          <code>[excited]</code>{" "}
                          {tr("— v4 follows them more reliably than v3, also takes short directions in plain words, e.g.")}{" "}
                          <code>[said warmly]</code>
                          {tr(", and performs several tags in a row in the order written.")} <strong>{tr("Pacing")}</strong>{" "}
                          {tr("comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) and the plain")}{" "}
                          <code>[pause]</code>/<code>[long pause]</code> {tr("tags — v4 has no")} <code>&lt;break time="x.xs" /&gt;</code>{" "}
                          {tr("tag and no Speed setting.")} <strong>{tr("Hard-to-pronounce words")}</strong>{" "}
                          {tr("(invented names, foreign words) can be respelled inline with IPA in forward slashes, e.g.")}{" "}
                          <code>/ʃaʊˈdeɪ/</code> {tr('— "Improve for voice" applies this automatically when v4 is selected.')}
                        </p>
                      )}
                      {tipsOpen && elevenModel === "v3" && (
                        <p className="hint">
                          <strong>{tr("Voice choice still matters most")}</strong>{" "}
                          {tr("— audio tags shape an already-fitting voice, they don't fix a mismatched one.")}{" "}
                          <strong>{tr("Bracket audio tags")}</strong> {tr("like")} <code>[excited]</code>/<code>[whispers]</code>/
                          <code>[sigh]</code>{" "}
                          {tr(
                            `only register reliably when Realism sits toward the lower/"Creative" end of Stability — the "Expressive" preset above is tuned for this; high stability ("Robust") mostly ignores them.`,
                          )}{" "}
                          <strong>{tr("Pacing")}</strong>{" "}
                          {tr("still comes from punctuation (ellipses for a pause and weight, CAPS for emphasis) — v3 has no")}{" "}
                          <code>&lt;break time="x.xs" /&gt;</code> {tr("tag at all.")} <strong>{tr("Hard-to-pronounce words")}</strong>{" "}
                          {tr("(invented names, foreign words) can be respelled inline with IPA in forward slashes, e.g.")}{" "}
                          <code>/ʃaʊˈdeɪ/</code> {tr('— "Improve for voice" applies this automatically when v3 is selected.')}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div className="divider" />
                <div className="row">
                  <button
                    className="primary"
                    style={{ flex: 1 }}
                    onClick={() => handleGenerate("insert")}
                    disabled={
                      busy ||
                      !voiceText.trim() ||
                      textOverModelLimit ||
                      (voiceEngine === "elevenlabs" && (!apiKey || !selectedVoiceId)) ||
                      (voiceEngine === "kokoro" && !selectedKokoroVoiceId)
                    }
                  >
                    {busy && lastGenerateMode === "insert" ? tr("Generating…") : tr("Generate & Insert")}
                  </button>
                  {detectedClip && (
                    <button
                      className="primary"
                      style={{ flex: 1 }}
                      onClick={() => handleGenerate("replace")}
                      disabled={
                        busy ||
                        !voiceText.trim() ||
                        textOverModelLimit ||
                        (voiceEngine === "elevenlabs" && (!apiKey || !selectedVoiceId)) ||
                        (voiceEngine === "kokoro" && !selectedKokoroVoiceId)
                      }
                    >
                      {busy && lastGenerateMode === "replace" ? tr("Replacing…") : tr("Replace Voice")}
                    </button>
                  )}
                </div>

                {genResult && lastGenerateMode !== "convert" && !genError && (
                  <div className={shownWarnings(genResult.warnings).length ? "banner warning" : "banner success"}>
                    {genResult.imported &&
                      tr("Placed at {seconds}s on audio track {track}.", {
                        seconds: genResult.placedAtSeconds.toFixed(2),
                        track: genResult.trackIndex + 1,
                      })}
                    {shownWarnings(genResult.warnings).map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
                {genError && <div className="banner error">{genError}</div>}
                {unplacedTake && (
                  <div className="banner warning">
                    {tr(
                      "The last take was generated and saved, but not placed. Fix the spot on the timeline, then place it without generating again.",
                    )}
                    <div className="row" style={{ margin: "8px 0 0" }}>
                      <button onClick={handlePlaceAgain} disabled={busy}>
                        {tr("Place it again")}
                      </button>
                    </div>
                  </div>
                )}

                {genResult && lastGenerateMode !== "convert" && (
                  <UndoGeneratedRow result={genResult} onUndo={handleUndoGenerate} busy={busy} />
                )}
              </>
            )}

            {voiceEngine === "elevenlabs" && voiceMode === "voice-changer" && (
              <>
                <div className="divider" />
                <div className="field-group">
                  <label className="row field-label">{tr("Selected clip")}</label>
                  {voiceTabSelectedClip && voiceTabSelectedClip.trackType === "audio" ? (
                    <p className="hint">{tr("Selected: {name}", { name: voiceTabSelectedClip.clipName })}</p>
                  ) : (
                    <p className="hint">{tr("Select one audio clip on the timeline to convert.")}</p>
                  )}
                </div>

                <div className="divider" />
                <div className="row">
                  <button
                    className="primary"
                    style={{ flex: 1 }}
                    onClick={handleConvertVoice}
                    disabled={busy || !apiKey || !selectedVoiceId || !voiceTabSelectedClip || voiceTabSelectedClip.trackType !== "audio"}
                  >
                    {convertStage || (busy ? tr("Converting…") : tr("Convert Selected Clip's Voice"))}
                  </button>
                </div>

                {genResult && lastGenerateMode === "convert" && !convertError && (
                  <div className={shownWarnings(genResult.warnings).length ? "banner warning" : "banner success"}>
                    {genResult.imported &&
                      tr("Placed at {seconds}s on audio track {track}.", {
                        seconds: genResult.placedAtSeconds.toFixed(2),
                        track: genResult.trackIndex + 1,
                      })}
                    {shownWarnings(genResult.warnings).map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
                {convertError && <div className="banner error">{convertError}</div>}
                {unplacedTake && (
                  <div className="banner warning">
                    {tr(
                      "The last take was generated and saved, but not placed. Fix the spot on the timeline, then place it without generating again.",
                    )}
                    <div className="row" style={{ margin: "8px 0 0" }}>
                      <button onClick={handlePlaceAgain} disabled={busy}>
                        {tr("Place it again")}
                      </button>
                    </div>
                  </div>
                )}
                {genResult && lastGenerateMode === "convert" && (
                  <UndoGeneratedRow result={genResult} onUndo={handleUndoGenerate} busy={busy} />
                )}
              </>
            )}

            {voiceEngine && voiceMode === "batch" && (
              <>
                <div className="divider" />
                <div className="field-group">
                  <label className="row field-label">{tr("Batch script")}</label>
                  <textarea
                    rows={4}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder={tr("One line per clip, e.g.:\nWelcome back to the show.\nToday we're covering three topics.")}
                  />
                  <div className="row compact">
                    <button onClick={handleAddToBatch} disabled={!batchText.trim()}>
                      {tr("Add to Queue")}
                    </button>
                    {batchItems.length > 0 && (
                      <button className="ghost" onClick={handleClearBatch} disabled={batchRunning}>
                        {tr("Clear queue")}
                      </button>
                    )}
                  </div>
                </div>

                {batchItems.length > 0 && (
                  <div className="field-group">
                    <label className="row field-label">{tr("Queue ({count})", { count: batchItems.length })}</label>
                    {batchItems.map((item) => (
                      <div className="row compact" key={item.id}>
                        <span style={{ flex: 1, overflowWrap: "anywhere" }}>
                          {item.status === "pending" && "○ "}
                          {item.status === "generating" && "… "}
                          {item.status === "done" && "✓ "}
                          {item.status === "failed" && "✗ "}
                          {item.text.length > 60 ? item.text.slice(0, 60) + "…" : item.text}
                          {voiceEngine === "elevenlabs" && elevenModel === "v3" && item.text.trim().length > V3_MAX_CHARS && (
                            <span className="hint">
                              {" "}
                              {tr("— {count} chars, over v3's 5,000 cap", { count: item.text.trim().length.toLocaleString() })}
                            </span>
                          )}
                        </span>
                        {item.status === "failed" && item.error && <span className="hint">{item.error}</span>}
                        {item.status === "pending" && (
                          <button className="ghost" onClick={() => handleRemoveBatchItem(item.id)}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {voiceEngine === "elevenlabs" &&
                      elevenModel === "v3" &&
                      batchItems.some((it) => it.text.trim().length > V3_MAX_CHARS) && (
                        <div className="banner warning">
                          {tr(
                            "One or more queued lines exceed v3's 5,000-character cap (marked above). Split them into shorter lines or switch to v2 or v4 — Generate All stays off until then.",
                          )}
                        </div>
                      )}
                    {voiceEngine === "elevenlabs" && elevenModel !== "v3" && batchOverModelLimit && (
                      <div className="banner warning">
                        {tr(
                          "One or more queued lines exceed this model's 10,000-character limit. Split them into shorter lines — Generate All stays off until then.",
                        )}
                      </div>
                    )}
                    {voiceEngine === "elevenlabs" && (
                      <p className="hint">
                        {(() => {
                          const pendingChars = batchItems.reduce((sum, it) => (it.status === "done" ? sum : sum + it.text.length), 0);
                          return tr(
                            "{count} characters still to generate — roughly {count} ElevenLabs credits at the standard 1 credit/character rate (exact cost depends on your plan and the model used).",
                            { count: pendingChars.toLocaleString() },
                          );
                        })()}
                      </p>
                    )}
                  </div>
                )}

                <div className="divider" />
                <div className="row">
                  <button
                    className="primary"
                    onClick={handleRunBatch}
                    disabled={
                      batchRunning ||
                      batchItems.length === 0 ||
                      batchOverModelLimit ||
                      (voiceEngine === "elevenlabs" && (!apiKey || !selectedVoiceId)) ||
                      (voiceEngine === "kokoro" && !selectedKokoroVoiceId)
                    }
                  >
                    {batchRunning ? tr("Generating…") : tr("Generate All")}
                  </button>
                </div>

                {batchImportResult && (
                  <div className={shownWarnings(batchImportResult.warnings).length ? "banner warning" : "banner success"}>
                    {tr("{count} clip(s) placed sequentially from the playhead.", { count: batchImportResult.imported })}
                    {shownWarnings(batchImportResult.warnings).map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                )}
                {batchImportResult && (
                  <div className="row">
                    <button onClick={handleUndoBatch} disabled={batchRunning}>
                      {tr("Undo")}
                    </button>
                  </div>
                )}
                {batchNotice && <div className="banner">{batchNotice}</div>}
                {batchError && <div className="banner error">{batchError}</div>}
              </>
            )}

            <div className="tab-footer" aria-hidden="true">
              {[5, 10, 6, 14, 8, 4, 8, 14, 6, 10, 5].map((h, i) => (
                <span key={i} style={{ height: h }} />
              ))}
            </div>
          </section>
        )}

        {tab === "send" && (
          <section>
            <div className="row">
              <button className="primary" style={{ flex: 1 }} onClick={handleSendToAE} disabled={busy}>
                {busy ? tr("Sending…") : tr("Send to After Effects")}
              </button>
            </div>
            {sendResult && (
              <div className="banner success">
                {tr("Sent {count} {kind}", {
                  count: sendResult.itemCount,
                  kind: tr("segment(s)"),
                })}
                {sendResult.videoItemCount > 0 && tr(" + {count} video piece(s)", { count: sendResult.videoItemCount })}.{" "}
                {tr('Open After Effects and use the "AI Voice Master Tool Bridge" plugin there to place them.')}
                {/* The bridge panel in After Effects shows the path it reads from (its
                    "Reading:" line, under Details); if the AE panel shows stale info, compare
                    that path with this one. */}
                <details className="diag">
                  <summary>{tr("Details")}</summary>
                  {tr("Send to AE file written to: {path}", { path: sendResult.manifestPath })}
                </details>
              </div>
            )}
            {sendResult && shownWarnings(sendResult.warnings).length > 0 && (
              <div className="banner warning">
                {shownWarnings(sendResult.warnings).map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            )}
            {sendError && <div className="banner error">{sendError}</div>}
          </section>
        )}
      </main>

      {firstRunLanguagePromptOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>{tr("Choose your interface language")}</h2>
            <p>{tr("You can change this anytime from the gear icon.")}</p>
            <div className="engine-picker">
              <button onClick={() => handleFirstRunLanguageChoice("en")}>English</button>
              <button onClick={() => handleFirstRunLanguageChoice("ru")}>Русский</button>
              <button onClick={() => handleFirstRunLanguageChoice("es")}>Español</button>
            </div>
          </div>
        </div>
      )}

      {firstRunOutputPromptOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="modal-card" role="dialog" aria-modal="true">
            <h2>{tr("Where should rendered audio be saved?")}</h2>
            <p>
              {tr(
                "Rendered audio (Render full timeline, Natural pitch, Voice Changer) and AI Voice's generated voice-overs need somewhere to live on disk. Pick a default now — you can change it anytime from the gear icon.",
              )}
            </p>
            <div className="engine-picker">
              <button onClick={() => handleFirstRunOutputChoice("documents")}>{tr("Documents")}</button>
              <button onClick={() => handleFirstRunOutputChoice("project")}>{tr("Next to project")}</button>
            </div>
            <p className="hint">
              {tr(
                '"Documents" is the recommended default. "Next to project" saves beside your .prproj file instead, and survives "Clear all data" (which never touches the project folder).',
              )}
            </p>
          </div>
        </div>
      )}

      {effectsWarning && (
        <div className="modal-overlay" role="presentation" onClick={() => closeEffectsWarning(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Effects on these pieces will be removed")}</h2>
            <p>
              {tr(
                "{action} places fresh clips from the source file, so effects, volume and Motion changes and keyframes on the current pieces are not kept.",
                { action: effectsWarning.action },
              )}
            </p>
            <p className="modal-warning">{tr("Found: {effects}", { effects: effectsWarning.effects.join(", ") })}</p>
            <p>{tr("Tip: add effects after Cut, J/L Pacing and Speed, as the last step.")}</p>
            <div className="modal-actions">
              <button onClick={() => closeEffectsWarning(false)}>{tr("Cancel")}</button>
              <button className="danger" onClick={() => closeEffectsWarning(true)}>
                {tr("Continue")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmClearOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirmClearOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Clear all data?")}</h2>
            <p>
              {tr(
                'Deletes everything under "AI Voice Master Tool" in Documents — Renders, generated voice-overs, Diagnostics reports, and any pending Send to AE data.',
              )}
            </p>
            <p className="modal-warning">
              {tr("If you haven't saved the rendered voice pieces (WAV files) somewhere else yet, they will be permanently lost.")}
            </p>
            <p className="modal-warning">
              {tr(
                "Any generated voice-over already placed on your timeline goes offline immediately — Premiere links to that file by path, and this deletes it.",
              )}
            </p>
            <p className="modal-warning">
              {tr("Also removes your API keys, presets and settings from this computer. The plugin then restarts as on first install.")}
            </p>
            <p className="modal-warning">{tr("This can't be undone.")}</p>
            <div className="modal-actions">
              <button onClick={() => setConfirmClearOpen(false)}>{tr("Cancel")}</button>
              <button className="danger" onClick={handleClearData} disabled={busy}>
                {busy ? tr("Clearing…") : tr("Delete everything")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLinkOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setConfirmLinkOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Open link in your browser?")}</h2>
            <p>
              {tr("This opens")} <code>{FEEDBACK_URL}</code> {tr("in your default browser, outside of Premiere.")}
            </p>
            <label className="row">
              <input type="checkbox" checked={rememberLinkChoice} onChange={(e) => setRememberLinkChoice(e.target.checked)} />
              {tr("Remember my choice")}
            </label>
            <div className="modal-actions">
              <button onClick={() => setConfirmLinkOpen(false)}>{tr("Cancel")}</button>
              <button className="primary" onClick={handleConfirmOpenLink}>
                {tr("Open")}
              </button>
            </div>
          </div>
        </div>
      )}

      {licenseOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setLicenseOpen(false)}>
          <div className="modal-card doc-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{LICENSE_TITLE}</h2>
            <div className="doc-body">
              <p className="doc-copyright">{LICENSE_COPYRIGHT}</p>
              {LICENSE_SECTIONS.map((section) => (
                <div key={section.heading} className="doc-section">
                  <h3>{section.heading}</h3>
                  {section.paragraphs.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setLicenseOpen(false)}>
                {tr("Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setGuideOpen(false)}>
          <div className="modal-card doc-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr(GUIDE_TITLE)}</h2>
            <div className="doc-body">
              {GUIDE_SECTIONS.map((section) => (
                <div key={section.heading} className="doc-section">
                  <h3>{tr(section.heading)}</h3>
                  {section.paragraphs.map((para, i) => (
                    <p key={i}>{tr(para)}</p>
                  ))}
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setGuideOpen(false)}>
                {tr("Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {licensesOpen && (
        <div className="modal-overlay" role="presentation" onClick={() => setLicensesOpen(false)}>
          <div className="modal-card doc-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tr("Licenses / Third-party notices")}</h2>
            <div className="doc-body">
              <pre className="notices-pre">{THIRD_PARTY_NOTICES}</pre>
            </div>
            <div className="modal-actions">
              <button className="primary" onClick={() => setLicensesOpen(false)}>
                {tr("Close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="busy-overlay" role="presentation">
          <div className="busy-card" role="alert" aria-live="polite">
            <div className="busy-bar-track">
              <div className="busy-bar-thumb" />
            </div>
            <div className="busy-label">{busyLabel}</div>
          </div>
        </div>
      )}
    </div>
  );
};
