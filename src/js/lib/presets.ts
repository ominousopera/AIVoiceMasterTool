import { createDataFile } from "./dataFile";

export interface Preset {
  name: string;
  cutThresholdDb: number;
  minSilenceSec: number;
}

/** An entry of a damaged or hand-edited presets.json that isn't a complete
 *  preset is skipped, so the list and the saved thresholds stay usable. */
const isValidPreset = (p: unknown): p is Preset => {
  if (!p || typeof p !== "object") return false;
  const preset = p as Record<string, unknown>;
  return (
    typeof preset.name === "string" &&
    typeof preset.cutThresholdDb === "number" &&
    Number.isFinite(preset.cutThresholdDb) &&
    typeof preset.minSilenceSec === "number" &&
    Number.isFinite(preset.minSilenceSec)
  );
};

// Stored in the app's own settings folder next to settings.json; see
// dataFile.ts for how read errors are handled. Anything but a list is a
// damaged file.
const presetsFile = createDataFile<Preset[]>(
  "presets.json",
  (parsed) => (Array.isArray(parsed) ? parsed.filter(isValidPreset) : null),
  () => [],
);

export const loadPresets = (): Preset[] => presetsFile.load().value;

/** Returns the new list, or null when the change couldn't be saved because
 *  presets.json couldn't be read safely (the caller keeps the old list). */
export const savePreset = (preset: Preset): Preset[] | null => {
  const current = presetsFile.readForSave();
  if (!current) return null;
  const presets = current.filter((p) => p.name !== preset.name);
  presets.push(preset);
  presetsFile.write(presets);
  return presets;
};

/** Returns the new list, or null as savePreset. */
export const deletePreset = (name: string): Preset[] | null => {
  const current = presetsFile.readForSave();
  if (!current) return null;
  const presets = current.filter((p) => p.name !== name);
  presetsFile.write(presets);
  return presets;
};
