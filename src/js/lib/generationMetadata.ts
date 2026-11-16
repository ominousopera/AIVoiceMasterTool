import { fs } from "./cep/node";

// Sidecar JSON written next to every generated audio file (elevenlabs.ts/
// kokoro.ts), so a later session can look at a selected timeline clip's
// linked media path and recover *what was used to generate it* — the text
// and voice — without any separate database. This is what makes the AI
// Voice tab's "quick voice swap" possible: select a clip, its original text
// comes back, pick a different voice, regenerate, replace in place.
// Deliberately just a same-named `<file>.meta.json` next to the audio, not
// a shared index file, so it is kept or deleted together with its audio file
// (Clear all data removes both from Documents; output saved next to the
// project keeps both), with no extra bookkeeping to keep in sync.

export interface GenerationMetadata {
  engine: "elevenlabs" | "kokoro";
  text: string;
  voiceId: string;
  voiceName: string;
}

const sidecarPathFor = (audioFilePath: string): string => `${audioFilePath}.meta.json`;

export const writeGenerationMetadata = (audioFilePath: string, meta: GenerationMetadata): void => {
  try {
    fs.writeFileSync(sidecarPathFor(audioFilePath), JSON.stringify(meta, null, 2), "utf-8");
  } catch (e) {
    // best effort — losing the sidecar just means "quick voice swap" won't
    // recognize this clip later; the generation itself already succeeded
  }
};

export const readGenerationMetadata = (audioFilePath: string): GenerationMetadata | null => {
  const sidecarPath = sidecarPathFor(audioFilePath);
  if (!fs.existsSync(sidecarPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
  } catch (e) {
    return null;
  }
};
