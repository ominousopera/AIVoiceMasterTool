# Contributing

Bug reports, translations and pull requests are welcome.

## Reporting a bug

Open an issue with:

- what you did and what happened instead;
- your system, Premiere Pro / After Effects version and the plugin's version (shown at the bottom of the gear menu);
- the Diagnostics report: gear icon → **Run Diagnostics**, then open the file it saves in `Documents/AI Voice Master Tool/Diagnostics/` (for a problem in After Effects, use the same button in the Bridge plugin, which saves to `Documents/AI Voice Master Tool/Bridge Diagnostics/`) and paste its text into the issue (attach the file if it is too long). It does not contain API keys; read it first, since it lists clip, sequence and file names.

## Before a pull request

```sh
npx tsc -p tsconfig-build.json --noEmit
npm run format:check
node scripts/check-i18n.mjs
node scripts/check-api-requests.mjs
node scripts/check-update-check.mjs
```

CI runs the same checks.

- Format the code with Prettier (`npm run format`).
- Write interface text in English in the code and wrap it in `tr("…")`. Add the Russian and Spanish translations to `src/js/lib/i18n/ru.ts` and `es.ts`; `check-i18n.mjs` lists any that are missing.
- The ExtendScript code in `src/jsx/` is ES3. Do not use array iteration methods, `Object.keys`, spread or nested ternaries there, and escape every `/` inside a regex literal. `node scripts/check-extendscript.mjs` checks the build. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- For cutting, J/L and speed behaviour, a pull request that changes `analyze.ts`, `wordSnap.ts` or the timeline code in `ppro.ts` should say what the change does on real audio. To see how Silence Cut decides on one of your own recordings, run `node scripts/inspect-cuts.mjs <audioFile> <mode>`, where `<mode>` is `aggressive`, `normal` or `gentle`. The script runs on macOS only.
- Test timeline-editing changes on a duplicate sequence in Premiere Pro, not on real work.

## License

By contributing you agree that your contribution is licensed under the project's license, GPL-3.0-or-later.
