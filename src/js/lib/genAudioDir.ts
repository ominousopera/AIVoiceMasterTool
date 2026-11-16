import { fs, os, path } from "./cep/node";
import { evalTS } from "./utils/bolt";

/**
 * Best-effort cache of ExtendScript's Folder.myDocuments resolution (see
 * ppro.ts's getDocumentsFolderPath): the real Documents path, following
 * Windows' "Known Folder Move" (OneDrive's Documents redirect). Node's
 * os.homedir()+"Documents" doesn't follow that redirect, so it can point to a
 * different folder than ExtendScript's (ppro.ts's clearAllData would then miss
 * files written here). Primed early from main.tsx's mount effect
 * (primeDocumentsPathCache); falls back to the naive join below if a caller
 * runs before that completes.
 */
let documentsPathCache: string | null = null;

/** Call once, early (see main.tsx's app-mount effect) to populate
 *  documentsPathCache from ExtendScript's real Folder.myDocuments. Safe to
 *  call more than once — later calls just re-resolve the same value. */
export const primeDocumentsPathCache = async (): Promise<void> => {
  try {
    const res = await evalTS("getDocumentsFolderPath");
    if (res && res.path) documentsPathCache = res.path;
  } catch (e) {
    // best effort — getDocumentsDir's own naive fallback still works
  }
};

export const getDocumentsDir = (): string => documentsPathCache || path.join(os.homedir(), "Documents");

/** Where generated voice-over audio (ElevenLabs or Kokoro output) is written
 *  before being handed to importAudioAndPlaceOnTimeline (ExtendScript side).
 *  Mirrors ppro.ts's getSubFolder("Generated") under the same
 *  "AI Voice Master Tool" folder used for Renders — but computed here via
 *  Node's os/path/fs instead of ExtendScript's Folder, since the file is
 *  written from the JS side (ElevenLabs SDK / Kokoro output), which ExtendScript has no
 *  access to. Persistent by design, not a scratch/tmp file — once imported,
 *  Premiere's project item links directly to this path, so deleting it
 *  later (e.g. via "Clear all data") would leave any already-placed clip
 *  offline.
 *
 *  `projectFolderPath`, when given (the current project's own containing
 *  folder, resolved via evalTS("getProjectFolderPath") — only ExtendScript
 *  can read app.project.path), saves here instead of Documents, per the
 *  "save output next to project" setting (settings.ts's outputLocation).
 *  Documents remains the default and the only location "Clear all data"
 *  ever touches — see settings.ts's own comment on why. */
export const getGeneratedAudioDir = (projectFolderPath?: string | null): string => {
  const dir = projectFolderPath
    ? path.join(projectFolderPath, "AI Voice Master Tool", "Generated")
    : path.join(getDocumentsDir(), "AI Voice Master Tool", "Generated");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const slugify = (s: string, maxLen: number): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/g, "");

/**
 * Builds a scannable generated-file name,
 * `{prefix}_{voice}_{text}_{timestamp}.{ext}`, instead of a bare timestamp, so
 * files in a project's Generated/ folder can be told apart at a glance. The
 * ISO timestamp stays the final component, so names stay unique and sort
 * chronologically. Slugifies to ASCII [a-z0-9-] only; voice names or scripts
 * in non-Latin scripts (Cyrillic, CJK, etc.) would strip to nothing, so both
 * slugs fall back to a generic word then rather than a name that's just
 * "__2026-....mp3".
 */
export const buildGeneratedFileName = (
  prefix: "elevenlabs" | "elevenlabs-vc" | "kokoro",
  voiceName: string,
  text: string,
  ext: string,
): string => {
  const voiceSlug = slugify(voiceName, 30) || "voice";
  const textSlug = slugify(text, 40) || "voiceover";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}_${voiceSlug}_${textSlug}_${stamp}.${ext}`;
};
