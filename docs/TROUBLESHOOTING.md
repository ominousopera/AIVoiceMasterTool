# Troubleshooting

## The plugin does not appear

1. Restart Premiere Pro (and After Effects, for the Bridge plugin) after installing.
2. Open **Window → Extensions → AI Voice Master Tool** in Premiere Pro, and **Window → Extensions → AI Voice Master Tool Bridge** in After Effects.
3. Check the version: the plugin needs Premiere Pro 2025 or later, and the Bridge plugin needs After Effects 2025 or later. On a Mac they need macOS 13 Ventura or later.
4. Install the package again with your ZXP installer, then restart.

The release packages are signed, so they need no `PlayerDebugMode`. That setting is only for an unsigned build from source; see [BUILDING.md](BUILDING.md).

## macOS: Scan, Natural or Kokoro fail

The plugin bundles three command-line tools (FFmpeg, whisper.cpp and eSpeak NG). They are built from source and signed ad hoc, without an Apple Developer ID or notarization. The first time one of them is used, the plugin clears the macOS download flag on these three files only, re-signs a tool ad hoc if its signature no longer verifies, and records either change in `Documents/AI Voice Master Tool/Diagnostics/macos-quarantine-clear.log`.

Managed Macs and strict security software can block that step. Scan, Natural and Kokoro then fail, because they run these tools, and Cut needs a Scan first. To allow the tools by hand, run this in Terminal:

```sh
cd ~/Library/"Application Support"
cd Adobe/CEP/extensions
cd com.aivoicemastertool.pro
xattr -dr com.apple.quarantine \
  assets/bin/mac
```

If your ZXP installer put the plugin in a different folder, use that one. Every release lists the SHA-256 checksums of its packages, and you can build everything from source.

## Windows: the word check or Kokoro fails

Scan's word check (whisper.cpp) and Kokoro (eSpeak NG) run two bundled command-line tools that read file paths in Windows' language for non-Unicode programs. If the name of your user folder (`C:\Users\…`) has letters that this language doesn't include, for example Cyrillic letters on an English Windows, the tools can't open their files: Scan shows "Word check: unavailable" and works without it, and Kokoro generation can fail. Setting the language for non-Unicode programs to one that has those letters (Control Panel → Region → Administrative → Change system locale, then restart) lets the tools open the files.

## Something else went wrong

Gear icon → **Run Diagnostics** writes a plain-text report to `Documents/AI Voice Master Tool/Diagnostics/`. The Bridge plugin in After Effects has the same button and saves its report to `Documents/AI Voice Master Tool/Bridge Diagnostics/`. Open the report and paste its text into a [bug report](https://github.com/ominousopera/AIVoiceMasterTool/issues/new/choose) (attach the file if it is too long). It contains no API keys, and your home folder is shortened to `~`. Read it first: it lists clip, sequence and file names.
