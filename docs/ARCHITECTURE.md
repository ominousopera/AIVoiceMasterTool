# Architecture

AI Voice Master Tool is an Adobe CEP extension built on [Bolt CEP](https://github.com/hyperbrew/bolt-cep) (Vite, React, TypeScript). It has two CEP panels and two ExtendScript sides.

```
Premiere Pro
┌──────────────────────────────┐
│ Main CEP panel               │
│ src/js/main/ (React, Node)   │
│ analysis, AI voice, UI       │
└──────────────┬───────────────┘
               │ evalTS
┌──────────────┴───────────────┐
│ ExtendScript: src/jsx/ppro/  │
│ timeline edits               │
└──────────────┬───────────────┘
               │ manifest
               │ (JSON file)
After Effects  ▼
┌──────────────────────────────┐
│ ExtendScript: src/jsx/aeft/  │
│ rebuilds the cut as layers   │
└──────────────┬───────────────┘
               │ evalTS
┌──────────────┴───────────────┐
│ Bridge CEP panel             │
│ src/js/bridge/ (React, Node) │
│ polls for a sent cut         │
└──────────────────────────────┘
```

The CEP panels run in Adobe's embedded Chromium with Node.js enabled, so they can read files and start processes. ExtendScript is the hosts' own ES3-era scripting engine, the only way to change a timeline. The two sides talk through `evalTS` (`src/js/lib/utils/bolt.ts`), which calls a typed function in `src/jsx/` and returns its JSON result.

## Folders

- `src/js/main/`: the Premiere CEP panel, with `main.tsx` (all four tabs and their handlers), `Waveform.tsx` (the preview where cuts are reviewed and toggled) and `guideText.ts` (the plugin's built-in guide).
- `src/js/bridge/`: the After Effects CEP panel.
- `src/js/lib/analyze.ts`: silence detection and J/L overlap sizing, written in TypeScript, with the audio decoded by the bundled FFmpeg. `inspect-cuts.mjs` and `inspect-degenerate-cases.mjs` run it too.
- `src/js/lib/silero.ts`, `whisper.ts`, `wordSnap.ts`: the voice-activity model, word timestamps, and moving cut points to word boundaries.
- `src/js/lib/kokoro.ts`, `espeakPhonemize.ts`: offline text-to-speech.
- `src/js/lib/elevenlabs.ts`, `scriptAssistant.ts`: the ElevenLabs, OpenAI and Anthropic clients, which use the official SDKs and the user's own keys.
- `src/js/lib/i18n/`: `tr()`, the Russian and Spanish dictionaries, and `hostMessages.ts`, which translates messages coming back from ExtendScript.
- `src/js/lib/networkGuard.ts`: refuses every network request except HTTPS to the AI providers' API hosts and to `api.github.com` and `raw.githubusercontent.com` for the update notice (none for the After Effects CEP panel). Both CEP panels install it in their `index-react.tsx` before the React app starts.
- `src/js/lib/updateCheck.ts`: the optional update notice. It reads the newest release number from GitHub's API (from the repository's `package.json` when the API's request limit is reached), compares it with the installed version and gives the release page to open; it never downloads anything.
- `src/js/lib/settings.ts`: the settings file, `~/Library/Application Support/AI Voice Master Tool/settings.json` on macOS and `%APPDATA%\AI Voice Master Tool\settings.json` on Windows.
- `src/jsx/ppro/ppro.ts`: everything that edits the Premiere timeline.
- `src/jsx/aeft/aeft.ts`: placing a cut in an After Effects composition.
- `src/assets/`: native tools, models and license texts. The large files are fetched; see BUILDING.md.
- `src/voices/`: Kokoro voice files (fetched).
- `scripts/`: release, asset and check scripts, plus `inspect-cuts.mjs` and `inspect-degenerate-cases.mjs` for looking at cut decisions.
- `preview/`: a browser preview of the plugin with the hosts faked, and screenshots of it.

## Silence Cut

`scanAudioFile` (`analyze.ts`) runs once per clip; the result is cached and every preset is computed from it, so switching presets is instant.

1. The bundled FFmpeg decodes the clip's audio to 16 kHz mono PCM. A stereo file's two channels are mixed; files with more channels or several audio streams are refused before Scan.
2. For each 30 ms frame, `scanAudioFile` measures:
   - K-weighted loudness;
   - Silero VAD speech probability;
   - per-band signal-to-noise ratio;
   - tonality;
   - a high-band SNR term that keeps sibilants from being taken for noise.
3. A two-Gaussian fit separates speech and noise loudness. The measurements are fused into one log-likelihood ratio per frame.
4. A Viterbi decoder over a hidden Markov model with minimum speech and silence durations turns the frames into speech segments. Each preset is a set of decoder and padding parameters (`MODES`).
5. The gentler presets keep a little padding around the speech, applied only where the boundary is uncertain. Then cut points move to word boundaries from whisper.cpp (`wordSnap.ts`), so a cut does not clip a word.

The waveform preview shows the result. The user can turn any cut off or draw one by hand. `cutSelectedClip` (`ppro.ts`) then razors the clip and removes the cut pieces; `undoCutViaRazor` rebuilds the original clip.

## J/L Pacing

`computeJLCutOverlaps` (`analyze.ts`) decides, per boundary between two pieces, how far the next piece may start under the end of the previous one. It measures the quiet tail and quiet head frame by frame, stops at the first loud frame or at a sustained or rising pitch, and caps the result by the preset ceiling and by the length of the pieces. The overlap is the smaller of the two quiet runs; Aggressive and Normal raise it to a preset minimum on clean voice.

`applyJLCutSmoothing` (`ppro.ts`) puts the pieces on two alternating audio tracks (and video tracks, for linked video), positions them with those overlaps, and adds a short Constant Power fade at each edge.

## Speed and pitch

Apply Speed rebuilds the last Cut from its original source ranges at the new speed (`rebuildCutFromOriginal`). When there is no Cut to rebuild from, or its pieces were edited since, `applySpeedToSelection` changes the selected pieces in place instead. The plugin then re-applies the J/L overlaps, rescaled to the speed. When every rebuilt piece had Premiere's Pitch Shifter, `applyPitchToSelection` adds it again with the correction for each piece's own speed.

Natural pitch (`getNaturalPitchPlan`, `renderNaturalPitch` in `naturalPitch.ts`, `placeNaturalPitch`) renders one file per source file and speed with FFmpeg's `atempo`, which keeps the pitch, and replaces each piece with its stretch of that file at 100% speed. The pieces then share one source again, so J/L Pacing and Send to After Effects work on them as on any Cut.

## Send to After Effects

`sendToAfterEffects` (`ppro.ts`) writes `Documents/AI Voice Master Tool/Bridge/manifest.json`. It lists the source media and, for each piece, the source in and out points, the position on the timeline and the speed.

The Bridge plugin in After Effects polls for that file. `placeFromManifest` (`aeft.ts`) then imports the source once per piece and sets each layer's stretch, start, in and out points to match Premiere. The layers are stacked as a staircase, the earliest piece lowest; where pieces with picture overlap, the one on the higher Premiere track stays above (`stackingOrder`).

Effects that only exist in Premiere's playback engine, such as Pitch Shifter, cannot be rebuilt that way. For those, Render full timeline for AE (`renderFullTimelineForAE`) first bakes the audio into one file.

## AI Voice

Generated audio is written under `Documents/AI Voice Master Tool/Generated/`, or next to the project if the user chooses. `importAudioAndPlaceOnTimeline` (`ppro.ts`) places it at the playhead. Replace Voice and Voice Changer put the new take on the audio track below and disable the previous one (Clip > Enable brings it back); without a free track below they refuse before anything is generated. If Premiere refuses the new take, the previous one is turned back on.

- Kokoro runs the ONNX model through Transformers.js and ONNX Runtime Web (WebAssembly). The bundled eSpeak NG binary, run as a separate process, turns the text into phonemes.
- ElevenLabs, OpenAI and Anthropic are called through their official SDKs directly from the plugin, with keys the user stores locally.

## ExtendScript rules

Code under `src/jsx/` is compiled to ES3 and runs in ExtendScript:
- no `Array.prototype.map/filter/forEach/indexOf/…`, no `Object.keys`, no spread;
- no nested ternaries (the `.jsxbin` compiler cannot parse them);
- in a regex literal, escape every `/`, even inside a character class (`/[\\\/]/`, not `/[\\/]/`): ExtendScript ends the literal at an unescaped one, and one parse error stops the whole host script from loading;
- non-ASCII characters in the source are fine: the build writes each one as a `\u` escape (`asciiOnly` in `vite.es.config.ts`, the last step before jsxBin), because Premiere Pro loads the host script in an 8-bit encoding.

`src/jsx/lib/json2.js` provides `JSON`. Premiere's undocumented QE DOM (`app.enableQE()`) is used where the documented API has no equivalent: razor, speed, transitions. Treat every QE call as fragile.
