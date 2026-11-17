# Security

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue for them.

These details help when you assess a report:

- The plugin runs with Node.js enabled inside Adobe's CEP runtime, so it can read and write files and start the bundled tools (FFmpeg, whisper.cpp, eSpeak NG).
- API keys for ElevenLabs, OpenAI and Anthropic are stored in plain text in the local settings file (`~/Library/Application Support/AI Voice Master Tool/settings.json`, or `%APPDATA%\AI Voice Master Tool\settings.json` on Windows), and each key is sent only to its own provider. Anyone or anything that can read your user account's files can read that file, so give the plugin a key of its own with a spending limit set in the provider's dashboard, and revoke the key there if you think it leaked.
- The plugin makes no other network calls. `src/js/lib/networkGuard.ts` refuses every other connection from the plugin, no Node.js networking module is loaded, and the release packages contain no CEP `.debug` file (so no remote-debugging port is opened).
