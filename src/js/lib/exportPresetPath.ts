import { fs, path } from "./cep/node";
import { csi } from "./utils/bolt";

/**
 * Resolves the bundled Premiere export preset (.epr) that
 * renderSelectedClipToWav (Voice Changer input) and renderFullTimelineForAE
 * ("Render full timeline for AE") pass to Sequence.exportAsMediaDirect() and,
 * as the fallback, to app.encoder.encodeSequence().
 *
 * encodeSequence() needs a real .epr file: with an empty preset path it still
 * returns a job ID, but no file is written and no job appears in Premiere's
 * Background Tasks panel. Built-in presets have no documented, stable
 * location to look up from a script, so the extension ships one preset,
 * saved from Premiere's File > Export > Media > Save Preset.
 */
export const getExportPresetPath = (): string => {
  const extRoot = csi.getSystemPath("extension");
  const presetPath = path.join(extRoot, "assets", "presets", "wav-export.epr");

  if (!fs.existsSync(presetPath)) {
    throw new Error(`Bundled export preset not found at ${presetPath}. Reinstall the plugin.`);
  }

  return presetPath;
};
