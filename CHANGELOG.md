# Changelog

## 1.0.0 (first public release)

AI Voice Master Tool is free software under GPL-3.0-or-later. It needs Adobe Premiere Pro 2025 or later (and After Effects 2025 or later for Send to After Effects) and, on a Mac, macOS 13 or later.

- Silence Cut, built on Silero VAD and spectral measurements, HMM decoding and word-boundary snapping with whisper.cpp. It has Aggressive, Normal and Gentle presets and an Advanced mode with a manual threshold. In the waveform preview you can switch a cut off, drag its edges, or drag across a stretch to make all of it kept or cut.
- J/L Pacing with declick fades.
- Speed, which keeps the J/L overlaps.
- Pitch correction. Natural re-renders the pieces at their original pitch with FFmpeg's time-stretch, and Calculator shows the values to type into a pitch plugin of your own.
- Send to After Effects, which rebuilds the pieces as layers with their speed and J/L overlaps, stacked as a staircase. Render full timeline for AE bakes effects that only Premiere can play (such as Pitch Shifter) into one audio file, so they reach After Effects.
- AI Voice:
  - offline Kokoro (6 languages);
  - ElevenLabs v2, v3 and v4: text to speech, Voice Changer, and Batch (one clip per line) that keeps intonation across lines (v2 and v4);
  - script polishing with OpenAI or Anthropic.
- English, Russian and Spanish interface.
- Separate macOS and Windows packages.
- Bundled tools: FFmpeg 8.1.3, whisper.cpp 1.9.5 and eSpeak NG 1.52.0. Their source archives ship inside every package and in the `third-party-v1` release, and the build scripts are in `src/assets/licenses/build-scripts/`. FFmpeg is built with only the containers and audio codecs of files Premiere Pro imports. If FFmpeg gets stuck on a file, the plugin stops the Scan or Natural pitch render.
