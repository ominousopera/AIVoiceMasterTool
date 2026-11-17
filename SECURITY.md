# Security

Please report security problems privately through GitHub: **Security → Report a vulnerability** on this repository. Do not open a public issue for them.

These details help when you assess a report:

- The plugin runs with Node.js enabled inside Adobe's CEP runtime, so it can read and write files and start the bundled tools (FFmpeg, whisper.cpp, eSpeak NG).
- API keys for ElevenLabs, OpenAI and Anthropic are stored in plain text in the local settings file (`~/Library/Application Support/AI Voice Master Tool/settings.json`, or `%APPDATA%\AI Voice Master Tool\settings.json` on Windows), and each key is sent only to its own provider. Anyone or anything that can read your user account's files can read that file, so give the plugin a key of its own with a spending limit set in the provider's dashboard, and revoke the key there if you think it leaked.
- The only other network call is the optional update notice (off unless the user turns it on): a GET of `https://api.github.com/repos/ominousopera/AIVoiceMasterTool/releases/latest` without credentials or identifying headers (GitHub sees the IP address and the browser's standard User-Agent), read for the version number and the release-page link only, and the link is used only if it points into this repository (`src/js/lib/updateCheck.ts`). When that address refuses for GitHub's request limit, the plugin reads the version from `https://raw.githubusercontent.com/ominousopera/AIVoiceMasterTool/main/package.json` instead, also without credentials. Nothing is downloaded or installed. `src/js/lib/networkGuard.ts` refuses every other connection from the plugin, no Node.js networking module is loaded, and the release packages contain no CEP `.debug` file (so no remote-debugging port is opened).
