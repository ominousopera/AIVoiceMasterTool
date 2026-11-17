/**
 * Text shown in the "License" modal (gear-icon settings popover) of both
 * panels. Content only; each panel's main.tsx renders it. A GPL-3.0-or-later
 * notice plus the third-party, network and data sections; the full license
 * text ships as LICENSE in the source repository. English only: the GPL's
 * English text is the one that governs, so the dictionaries carry none of
 * these strings.
 */
export interface LicenseSection {
  heading: string;
  paragraphs: string[];
}

export const LICENSE_TITLE = "AI Voice Master Tool — License";
export const LICENSE_COPYRIGHT = "Copyright (C) 2026 Nikita Kolesov";

export const LICENSE_SECTIONS: LicenseSection[] = [
  {
    heading: "Free software",
    paragraphs: [
      "AI Voice Master Tool is a plugin for Adobe Premiere Pro and Adobe After Effects: silence removal (Silence Cut), J/L cut pacing, speed and pitch adjustment, sending cut segments to After Effects, and AI voice generation — offline with a bundled model, or through third-party cloud providers using your own account.",
      "This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.",
      "This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.",
      "The full license text is in the LICENSE file of the source repository, https://github.com/ominousopera/AIVoiceMasterTool, and at https://www.gnu.org/licenses/gpl-3.0.html.",
      'AI Voice Master Tool is an independent project, not affiliated with, sponsored by, or endorsed by Adobe Inc., ElevenLabs, OpenAI, or Anthropic. "Adobe Premiere Pro" and "Adobe After Effects" are named only to identify the host applications it runs inside.',
    ],
  },
  {
    heading: "Third-party components",
    paragraphs: [
      "The Software bundles the third-party components listed below. Each remains the property of its respective owner and is used under its own license, unmodified except where noted. Full license texts are included with the Software's installed files.",
      "FFmpeg (audio decoding, and writing WAV files for Natural pitch correction) — LGPL v2.1 or later. Built from unmodified official source (ffmpeg.org) with GPL-only and nonfree components disabled; invoked as a separate process, never linked into the Software's own code. The corresponding source for the exact version bundled is included alongside the Software's installed files, the same treatment given to eSpeak NG below.",
      "winpthreads (libwinpthread-1.dll, Windows only, a runtime library used by the bundled FFmpeg) — MIT and BSD-3-Clause, from the mingw-w64 project, https://www.mingw-w64.org. Unmodified.",
      "Silero VAD (voice activity detection model) — MIT. https://github.com/snakers4/silero-vad",
      "ONNX Runtime Web (runs the Silero VAD and Kokoro models) — MIT. https://github.com/microsoft/onnxruntime",
      "whisper.cpp (word timestamps for the word check during Scan) — MIT, https://github.com/ggml-org/whisper.cpp. Underlying OpenAI Whisper model weights are also MIT-licensed.",
      "Kokoro-82M (offline AI voice generation model) — Apache-2.0. https://github.com/hexgrad/kokoro",
      "@huggingface/transformers (runs the Kokoro model) — Apache-2.0. https://github.com/huggingface/transformers.js",
      "eSpeak NG (text-to-phoneme conversion for Kokoro) — GPL-3.0-or-later, https://github.com/espeak-ng/espeak-ng. Built from unmodified official source and invoked as a separate process, never linked into the Software's own code. The Corresponding Source for the exact version bundled is included alongside the Software's installed files, per GPLv3 Section 6.",
      "Sonic (speed library built into the bundled eSpeak NG binaries; not used for this plugin's IPA output) — Apache-2.0, https://github.com/waywardgeek/sonic. Its source is included alongside the Software's installed files, with eSpeak NG's.",
      "React / ReactDOM (the plugin's user interface) — MIT.",
      "Bolt CEP (Hyper Brew LLC — the CEP extension scaffold this Software is built on) — MIT.",
      "CSInterface.js — Adobe's own official CEP interoperability layer, used as intended for third-party Adobe extensions.",
      "openai (official SDK, used only if you enable a feature that calls OpenAI's API with your own key) — Apache-2.0.",
      "@anthropic-ai/sdk (official SDK, used only if you enable a feature that calls Anthropic's API with your own key) — Apache-2.0.",
      "@elevenlabs/elevenlabs-js (official SDK, used only for the AI Voice tab's optional ElevenLabs path, with your own key) — MIT.",
      "Code adapted from other projects: the razor-based clip cutting is adapted from DeadAir (MIT, https://github.com/nzalexgarciagil-ctrl/deadair-premiere); the phonemization that prepares text for Kokoro is a port of kokoro-js for English and follows misaki for the other languages (Apache-2.0, https://github.com/hexgrad/kokoro and https://github.com/hexgrad/misaki). Details are in Licenses / Third-party notices; the full license texts are included with the Software's installed files.",
      "On macOS only: the first time one of the bundled command-line tools above (FFmpeg, whisper.cpp, or eSpeak NG) is used in a session, the Software may clear an Apple \"quarantine\" attribute from that specific file, if one was attached to it during download or transfer, and may re-apply an ad-hoc code signature to it, but only if the file's existing code signature no longer verifies. Both steps let the tool run without triggering a Gatekeeper security prompt. This only ever affects the Software's own bundled files — never any other file on your system — and each step is only performed when it is actually needed. When either happens, a local, timestamped record is kept at Documents/AI Voice Master Tool/Diagnostics/macos-quarantine-clear.log, and a one-time note about it is added to the session log included in the Diagnostics report.",
    ],
  },
  {
    heading: "Third-party product mentions (not bundled)",
    paragraphs: [
      'The Pacing tab\'s Calculator pitch-correction mode names "kHs Pitch Shifter" (Kilohearts AB) as a recommended third-party VST plugin for users who want finer manual pitch control. This is a nominative reference to help you find a compatible tool — kHs Pitch Shifter is not bundled with, included in, sold with, or required by the Software, must be separately obtained and licensed directly from Kilohearts AB, and Kilohearts AB is not affiliated with, and does not endorse or sponsor, this project.',
    ],
  },
  {
    heading: "Network use and your own API keys",
    paragraphs: [
      "The Software does not collect telemetry or usage analytics. Apart from the AI Voice paths below, its only network request is the optional update notice, off until you turn it on: it asks GitHub for the newest release number of this project (api.github.com, or raw.githubusercontent.com when GitHub's request limit is reached), sends nothing about you or your projects, and never downloads or installs anything.",
      "The AI Voice tab's Kokoro path runs entirely locally and never sends data anywhere. Its ElevenLabs, OpenAI, and Anthropic paths are optional: they only activate if you supply your own API key for that provider, and calls are made directly from your machine to that provider's own servers using your key — never proxied through, or resold by, this project. Your use of any such provider is governed by that provider's own terms of service and privacy policy, not by this license.",
    ],
  },
  {
    heading: "Your data, backups, and editing risk",
    paragraphs: [
      "Several features directly modify your active Premiere Pro sequence — cutting, moving, or removing clips on the timeline — and read and write local files: renders and generated voice-overs (in your Documents folder, or next to your project file if you choose) and diagnostics reports (in your Documents folder).",
      "Back up your project and source media before using any feature that edits your timeline, and try it on a duplicate project before relying on it in production work. The software comes without any warranty (see above).",
    ],
  },
];
