import { fs, path } from "./cep/node";
import { createDataFile, getAppDataDir } from "./dataFile";
import { ScriptIntensity } from "./scriptAssistant";
// Type-only — must not become a value import, since elevenlabs.ts pulls in
// the @elevenlabs SDK and main.tsx deliberately lazy-loads it (see main.tsx's
// own comment on this) rather than bundling it into the panel's initial load.
import type { ElevenLabsOutputFormat } from "./elevenlabs";

// Same on-disk convention as presets.ts: a plain JSON file in this app's own
// settings folder (see dataFile.ts for how read errors are handled). No OS
// keychain: it would add a native dependency to a CEP panel. API keys are
// stored in plain text in settings.json; the Guide and SECURITY.md say so.

/** Deletes this computer's settings folder: API keys, presets, language and
 *  every other choice (settings.json, presets.json and their backups). Part
 *  of "Clear all data". Files are removed one by one, then the folder, which
 *  works on every Node version CEP has shipped. Returns false if anything
 *  is left. */
export const clearLocalSettings = (): boolean => {
  const dir = getAppDataDir();
  if (!fs.existsSync(dir)) return true;
  for (const name of fs.readdirSync(dir)) {
    try {
      fs.unlinkSync(path.join(dir, name));
    } catch (e) {
      // left behind; reported through the return value
    }
  }
  try {
    fs.rmdirSync(dir);
  } catch (e) {
    // not empty or locked
  }
  return !fs.existsSync(dir);
};

/**
 * Where renders and AI Voice's generated output are written. "documents"
 * (default) uses Documents (see getGeneratedAudioDir/ppro.ts's getSubFolder);
 * "project" saves next to the open project file, so output doesn't have to
 * be dragged into the project folder by hand and survives "Clear all data"
 * (which never touches the project folder; see ppro.ts's clearAllData),
 * like any other project asset next to Premiere's autosaves. Falls back to
 * Documents, with a one-time note in the panel, while the project has never
 * been saved (no folder to place anything next to).
 */
export type OutputLocation = "documents" | "project";

/** Interface language — see `src/js/lib/i18n/index.ts` for the lookup
 *  mechanism itself. English is the only language every string is
 *  guaranteed to have; `en` also doubles as the fallback `tr()` uses for
 *  any key still missing from `ru`/`es`, so this list can grow without a
 *  half-translated locale ever showing a blank string. */
export type UiLanguage = "en" | "ru" | "es";

interface Settings {
  elevenLabsApiKey?: string;
  /** BYO keys for "Improve for voice" (see scriptAssistant.ts) — same
   *  local-plaintext-file storage as elevenLabsApiKey above, one per
   *  provider so the user can save both and switch freely. */
  openaiApiKey?: string;
  anthropicApiKey?: string;
  /** Which model the user picked from the live GET /v1/models list (see
   *  scriptAssistant.ts's listOpenAiModels/listAnthropicModels) — persisted
   *  so the choice survives a panel reload instead of resetting to the
   *  cheap-tier default every time. */
  openaiModelId?: string;
  anthropicModelId?: string;
  /** How much the "Improve for voice" rewrite is allowed to do — see
   *  scriptAssistant.ts's ScriptIntensity. */
  scriptIntensity?: ScriptIntensity;
  /**
   * Output format for ElevenLabs generation (text-to-speech and Voice Changer);
   * see elevenlabs.ts's ElevenLabsOutputFormat.
   */
  elevenOutputFormat?: ElevenLabsOutputFormat;
  outputLocation?: OutputLocation;
  uiLanguage?: UiLanguage;
  /** Starred voice IDs per engine, for the AI Voice tab's quick-access
   *  chips — a short "go-to voices" row above the full picker, so switching
   *  voice doesn't require opening the dropdown every time. */
  favoriteVoiceIds?: { elevenlabs?: string[]; kokoro?: string[] };
  /** "Remember my choice" from the confirm-before-leaving-Premiere dialog
   *  shown by "Give Feedback" (see main.tsx's confirmLinkOpen) — once true,
   *  that button opens the browser directly without asking again. */
  skipExternalLinkConfirm?: boolean;
  /**
   * Has the one-time session-log notice about ffmpegPath.ts's macOS
   * quarantine-clearing self-heal been shown on this machine? See main.tsx's
   * mount effect and ffmpegPath.ts's hasMacQuarantineEventEverLogged. A plain
   * boolean (not the never-set-vs-defaulted pattern of outputLocation and
   * uiLanguage above): it is simply true once the notice has been shown.
   */
  macQuarantineNoticeShown?: boolean;
}

const STRING_FIELDS = [
  "elevenLabsApiKey",
  "openaiApiKey",
  "anthropicApiKey",
  "openaiModelId",
  "anthropicModelId",
  "scriptIntensity",
  "elevenOutputFormat",
  "outputLocation",
  "uiLanguage",
];
const BOOLEAN_FIELDS = ["skipExternalLinkConfirm", "macQuarantineNoticeShown"];

/** A field of the wrong type (a damaged or hand-edited file) is left out, as
 *  if it had never been set, so one bad value can't break the code that
 *  reads it. Every other field, API keys included, is kept. Favourite lists
 *  keep only their string entries. */
const withValidFields = (raw: Record<string, unknown>): Settings => {
  const out: Record<string, unknown> = { ...raw };
  for (const field of STRING_FIELDS) {
    if (field in out && typeof out[field] !== "string") delete out[field];
  }
  for (const field of BOOLEAN_FIELDS) {
    if (field in out && typeof out[field] !== "boolean") delete out[field];
  }
  if ("favoriteVoiceIds" in out) {
    const favorites = out.favoriteVoiceIds;
    if (!favorites || typeof favorites !== "object" || Array.isArray(favorites)) {
      delete out.favoriteVoiceIds;
    } else {
      const valid: { elevenlabs?: string[]; kokoro?: string[] } = {};
      const engines: VoiceEngineKey[] = ["elevenlabs", "kokoro"];
      for (const engine of engines) {
        const ids = (favorites as Record<string, unknown>)[engine];
        if (Array.isArray(ids)) valid[engine] = ids.filter((id): id is string => typeof id === "string");
      }
      out.favoriteVoiceIds = valid;
    }
  }
  return out as Settings;
};

// Valid JSON that isn't an object (null, an array, a number) is as unusable
// as unparsable text: every reader below reads fields from it.
const settingsFile = createDataFile<Settings>(
  "settings.json",
  (parsed) => (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? withValidFields(parsed as Record<string, unknown>) : null),
  () => ({}),
);

const readSettings = (): Settings => settingsFile.load().value;

/** True when `field` holds a value, and also when settings.json couldn't be
 *  read: a one-time prompt or notice isn't shown again just because the saved
 *  answer couldn't be read this time (and its save would be skipped). */
const isSetOrUnreadable = (field: keyof Settings): boolean => {
  const { value, failed } = settingsFile.load();
  return failed || value[field] !== undefined;
};

/** Reads the file, applies `change` and writes it back. Skipped (returns
 *  false) when the file couldn't be read safely; dataFile.ts records why for
 *  the panel's message. */
const updateSettings = (change: (settings: Settings) => void): boolean => {
  const settings = settingsFile.readForSave();
  if (!settings) return false;
  change(settings);
  settingsFile.write(settings);
  return true;
};

export const loadElevenLabsApiKey = (): string => readSettings().elevenLabsApiKey || "";

export const saveElevenLabsApiKey = (key: string): void => {
  updateSettings((settings) => {
    settings.elevenLabsApiKey = key;
  });
};

export const loadOpenAiApiKey = (): string => readSettings().openaiApiKey || "";

export const saveOpenAiApiKey = (key: string): void => {
  updateSettings((settings) => {
    settings.openaiApiKey = key;
  });
};

export const loadAnthropicApiKey = (): string => readSettings().anthropicApiKey || "";

export const saveAnthropicApiKey = (key: string): void => {
  updateSettings((settings) => {
    settings.anthropicApiKey = key;
  });
};

export const loadOpenAiModelId = (): string => readSettings().openaiModelId || "";

export const saveOpenAiModelId = (modelId: string): void => {
  updateSettings((settings) => {
    settings.openaiModelId = modelId;
  });
};

export const loadAnthropicModelId = (): string => readSettings().anthropicModelId || "";

export const saveAnthropicModelId = (modelId: string): void => {
  updateSettings((settings) => {
    settings.anthropicModelId = modelId;
  });
};

export const loadScriptIntensity = (): ScriptIntensity => readSettings().scriptIntensity || "natural";

export const saveScriptIntensity = (intensity: ScriptIntensity): void => {
  updateSettings((settings) => {
    settings.scriptIntensity = intensity;
  });
};

export const loadElevenOutputFormat = (): ElevenLabsOutputFormat => readSettings().elevenOutputFormat || "mp3_44100_128";

export const saveElevenOutputFormat = (format: ElevenLabsOutputFormat): void => {
  updateSettings((settings) => {
    settings.elevenOutputFormat = format;
  });
};

export const loadOutputLocation = (): OutputLocation => readSettings().outputLocation || "documents";

export const saveOutputLocation = (location: OutputLocation): void => {
  updateSettings((settings) => {
    settings.outputLocation = location;
  });
};

/** True once the user has ever explicitly chosen an output location (via the
 *  first-run prompt below or the gear-icon settings popover) — distinct from
 *  `loadOutputLocation()`, which always returns a value (defaulting silently
 *  to "documents") and so can't tell "never asked" apart from "explicitly
 *  picked Documents." Used only to decide whether to show the first-run
 *  prompt once, on this machine's very first launch. */
export const hasOutputLocationBeenSet = (): boolean => isSetOrUnreadable("outputLocation");

export const loadUiLanguage = (): UiLanguage => readSettings().uiLanguage || "en";

export const saveUiLanguage = (language: UiLanguage): void => {
  updateSettings((settings) => {
    settings.uiLanguage = language;
  });
};

/** Same "never asked yet" vs. "explicitly defaulted" distinction as
 *  `hasOutputLocationBeenSet` above — gates the first-run language step so
 *  it only ever appears once per machine. */
export const hasUiLanguageBeenSet = (): boolean => isSetOrUnreadable("uiLanguage");

export type VoiceEngineKey = "elevenlabs" | "kokoro";

export const loadFavoriteVoiceIds = (engine: VoiceEngineKey): string[] => readSettings().favoriteVoiceIds?.[engine] || [];

/** Returns the new list, or null when the change couldn't be saved (the
 *  caller keeps showing the old list). */
export const toggleFavoriteVoiceId = (engine: VoiceEngineKey, voiceId: string): string[] | null => {
  const settings = settingsFile.readForSave();
  if (!settings) return null;
  const current = settings.favoriteVoiceIds?.[engine] || [];
  const next = current.includes(voiceId) ? current.filter((id) => id !== voiceId) : [...current, voiceId];
  settings.favoriteVoiceIds = { ...settings.favoriteVoiceIds, [engine]: next };
  settingsFile.write(settings);
  return next;
};

export const loadSkipExternalLinkConfirm = (): boolean => readSettings().skipExternalLinkConfirm || false;

export const saveSkipExternalLinkConfirm = (value: boolean): void => {
  updateSettings((settings) => {
    settings.skipExternalLinkConfirm = value;
  });
};

/** Also true when settings.json couldn't be read, as isSetOrUnreadable. */
export const hasMacQuarantineNoticeBeenShown = (): boolean => {
  const { value, failed } = settingsFile.load();
  return failed || value.macQuarantineNoticeShown === true;
};

export const saveMacQuarantineNoticeShown = (): void => {
  updateSettings((settings) => {
    settings.macQuarantineNoticeShown = true;
  });
};
