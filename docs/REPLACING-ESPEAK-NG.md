# Replacing the bundled eSpeak NG binary with your own build

GPLv3 §6 ("Installation Information") lets users run their own modified versions of the
GPL components. Nothing in this plugin prevents replacing the bundled eSpeak NG binary.

## How it works

`src/js/lib/espeakPhonemize.ts` runs whatever binary is at `assets/bin/mac/espeak-ng`
(macOS) or `assets\bin\win\espeak-ng.exe` (Windows) inside the installed plugin, as

```sh
espeak-ng --ipa -q -v <locale> \
  --path <espeak-ng-data> --stdin
```

where `<espeak-ng-data>` is the plugin's bundled data folder. For the Spanish, French,
Hindi, Italian and Brazilian Portuguese voices it also passes `--tie=^`.

No hash of the binary is checked and nothing refuses a replacement. On macOS the plugin
clears a quarantine flag on it and, if its code signature does not verify, signs it ad
hoc before the first run (`prepareMacBinary` in `src/js/lib/ffmpegPath.ts`). The
replacement must accept the same command-line flags as eSpeak NG 1.52.0 and work with
the bundled data files. A quick check, from the installed plugin's folder:

```sh
echo "hello world" | \
  assets/bin/mac/espeak-ng --ipa -q \
  -v en-us \
  --path assets/espeak-ng-data \
  --stdin
```

It should print `həlˈoʊ wˈɜːld`.

## Steps, per platform

### macOS

Install or build an espeak-ng 1.52.0-compatible binary, for example:

```sh
brew install espeak-ng
```

Check which libraries it loads with `otool -L "$(which espeak-ng)"`. A Homebrew binary
keeps loading its libraries from Homebrew, so the copy works only while that package
stays installed; a static build (see BUILDING-THIRD-PARTY.md) has no such dependency.

Go to the installed plugin (adjust the path if your ZXP installer used another one):

```sh
cd ~/Library/"Application Support"
cd Adobe/CEP/extensions
cd com.aivoicemastertool.pro
```

Back up the original first:

```sh
cd assets/bin/mac
cp espeak-ng espeak-ng.original
```

Replace it:

```sh
cp "$(which espeak-ng)" espeak-ng
chmod +x espeak-ng
```

Then restart Premiere Pro (or reopen the plugin).

### Windows

Locate the installed plugin under
`%APPDATA%\Adobe\CEP\extensions\com.aivoicemastertool.pro`, replace
`assets\bin\win\espeak-ng.exe` with your own build, and restart Premiere Pro. The plugin
finds the binary the same way as on macOS (`espeakPath.ts`'s `getEspeakPath()`), only in
the `win` folder.

## What this does not change

Phoneme output depends on the replacement behaving like eSpeak NG 1.52.0 for the flags
this plugin uses (`--ipa`, `-q`, `-v <locale>`, `--path`, `--stdin`, and `--tie=^` for
the non-English voices). A sufficiently different fork can produce different (or broken)
phoneme output. That is a quality question, not a licensing one: the plugin does not
validate the replacement's behaviour and only runs whatever is at the expected path.
