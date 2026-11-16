#!/usr/bin/env node
// Standalone dev-only check (not shipped). Runs the real settings.ts and
// presets.ts against files that are missing, damaged or unreadable, in a
// temporary home folder, and checks the rules in src/js/lib/dataFile.ts:
//
// - missing (ENOENT / ENOTDIR): defaults, no message, saves work;
// - damaged (not JSON, wrong shape): an identical copy is kept, the file stays
//   in place, nothing is saved over it in that session; in the next panel load
//   the next change replaces it, and no second copy is made;
// - unreadable (EACCES, EBUSY, EPERM, EISDIR): defaults, a message, saves are
//   skipped and the file keeps every byte; once it can be read again, a save
//   keeps every other value.
//
// "Session" here is one load of the bundled modules, as one panel load in
// Premiere. Exits 1 if any check fails.
//
// Usage (from the project root):  node scripts/check-data-files.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB = path.join(ROOT, "src", "js", "lib");
const esbuild = await import("esbuild");
const require = createRequire(import.meta.url);

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "aivmt-data-files-"));
const bundle = async (name, contents) => {
  const outfile = path.join(tmpRoot, name + ".cjs");
  await esbuild.build({
    stdin: { contents, resolveDir: LIB, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "silent",
  });
  return outfile;
};
const storeBundle = await bundle(
  "stores",
  `export * from "./settings"; export * from "./presets"; export { getAppDataDir, getDataFileProblems } from "./dataFile";`,
);
const messagesBundle = await bundle("messages", `export * from "./dataFileMessages"; export { setLanguage } from "./i18n";`);

// lib/cep/node.ts loads Node's modules only inside CEP (window.cep present).
globalThis.window = { cep: {}, setTimeout };
// dataFile.ts logs each problem it records; the checks below read them instead.
console.warn = () => {};

/** One panel session in a fresh home folder (or `home` to reuse one). */
const session = (home) => {
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  delete require.cache[require.resolve(storeBundle)];
  return require(storeBundle);
};
const newHome = (label) => {
  const home = path.join(tmpRoot, label);
  fs.mkdirSync(home, { recursive: true });
  return home;
};

let failures = 0;
let current = "";
const check = (ok, what) => {
  if (!ok) {
    failures++;
    console.log(`  FAIL [${current}] ${what}`);
  }
};
const runCase = (label, fn) => {
  current = label;
  const before = failures;
  try {
    fn();
  } catch (e) {
    failures++;
    console.log(`  FAIL [${label}] threw: ${e && e.stack ? e.stack : e}`);
  }
  console.log(`${failures === before ? "PASS" : "FAIL"}  ${label}`);
};

const isWin = process.platform === "win32";
const isRoot = typeof process.getuid === "function" && process.getuid() === 0;
const canTestPermissions = !isWin && !isRoot;

const listCopies = (dir, name) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(name + ".corrupted-")) : []);
const leftoverTemps = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.includes(".tmp-")) : []);
const problemsOf = (m) => m.getDataFileProblems().map((p) => p.file + ":" + p.kind + (p.code ? ":" + p.code : ""));
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf-8"));

const SETTINGS_WITH_KEYS = JSON.stringify(
  { elevenLabsApiKey: "eleven-key", openaiApiKey: "openai-key", anthropicApiKey: "anthropic-key", uiLanguage: "ru" },
  null,
  2,
);
const PRESETS_TWO = JSON.stringify(
  [
    { name: "Podcast", cutThresholdDb: -42, minSilenceSec: 0.4 },
    { name: "Voice-over", cutThresholdDb: -38, minSilenceSec: 0.25 },
  ],
  null,
  2,
);

/** Simulates a read error with `code` on every read of `file`. */
const withReadError = (file, code, fn) => {
  const original = fs.readFileSync;
  fs.readFileSync = function (p, ...rest) {
    if (path.resolve(String(p)) === path.resolve(file)) {
      const e = new Error(code + ": simulated read error");
      e.code = code;
      throw e;
    }
    return original.call(this, p, ...rest);
  };
  try {
    fn();
  } finally {
    fs.readFileSync = original;
  }
};

// ---------------------------------------------------------------- settings.json

runCase("settings missing: defaults, no message, save works", () => {
  const m = session(newHome("s-missing"));
  const dir = m.getAppDataDir();
  check(!fs.existsSync(dir), "the settings folder does not exist yet");
  check(m.loadElevenLabsApiKey() === "", "API key is empty");
  check(m.hasUiLanguageBeenSet() === false, "first-run language prompt would show");
  check(problemsOf(m).length === 0, "no message: " + problemsOf(m));
  m.saveElevenLabsApiKey("k1");
  check(readJson(path.join(dir, "settings.json")).elevenLabsApiKey === "k1", "the key was saved");
  check(leftoverTemps(dir).length === 0, "no temp file left");
});

runCase("settings missing (ENOTDIR: the folder's path is a file): defaults, no message", () => {
  const home = newHome("s-enotdir");
  const m = session(home);
  const dir = m.getAppDataDir();
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  fs.writeFileSync(dir, "not a folder");
  check(m.loadElevenLabsApiKey() === "", "API key is empty");
  check(problemsOf(m).length === 0, "no message: " + problemsOf(m));
  check(fs.readFileSync(dir, "utf-8") === "not a folder", "the file in the folder's place is untouched");
});

const corruptSettingsCase = (label, text) =>
  runCase(`settings damaged (${label}): copy kept, no save this session, next panel load replaces`, () => {
    const home = newHome("s-corrupt-" + label.replace(/\W+/g, "-"));
    let m = session(home);
    const dir = m.getAppDataDir();
    const file = path.join(dir, "settings.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
    const bytes = fs.readFileSync(file);

    check(m.loadElevenLabsApiKey() === "", "API key shows as empty");
    check(m.hasUiLanguageBeenSet() === true, "first-run prompt suppressed");
    check(JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:corrupt"]), "message: corrupt, got " + problemsOf(m));
    const copies = listCopies(dir, "settings.json");
    check(copies.length === 1, "exactly one copy, got " + copies.length);
    check(copies.length === 1 && fs.readFileSync(path.join(dir, copies[0])).equals(bytes), "the copy has the same bytes");
    check(fs.existsSync(file) && fs.readFileSync(file).equals(bytes), "the damaged file stays in place, unchanged");
    const shown = m.getDataFileProblems()[0];
    check(
      shown && shown.copyPath.startsWith("~") && shown.copyPath.endsWith(copies[0]),
      "the message names the copy: " + (shown && shown.copyPath),
    );

    m.saveOpenAiApiKey("new-key");
    m.saveUiLanguage("es");
    check(m.toggleFavoriteVoiceId("kokoro", "af_heart") === null, "favourite toggle reports not saved");
    check(fs.readFileSync(file).equals(bytes), "saves in the same session didn't touch the file");
    m.loadOpenAiApiKey();
    check(listCopies(dir, "settings.json").length === 1, "repeated reads make no more copies");
    check(leftoverTemps(dir).length === 0, "no temp file left");

    // Next panel load: the identical copy exists, so the next change replaces the file.
    m = session(home);
    check(m.loadElevenLabsApiKey() === "", "next panel load: API key still shows as empty");
    check(
      JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:corrupt-copied-before"]),
      "next panel load message: copied before, got " + problemsOf(m),
    );
    check(listCopies(dir, "settings.json").length === 1, "next panel load: no second copy");
    m.saveOpenAiApiKey("new-key");
    check(JSON.stringify(readJson(file)) === JSON.stringify({ openaiApiKey: "new-key" }), "next panel load: the save replaced the file");
    check(fs.readFileSync(path.join(dir, copies[0])).equals(bytes), "the copy still holds the old bytes");
  });

corruptSettingsCase("cut-off JSON", SETTINGS_WITH_KEYS.slice(0, 60));
corruptSettingsCase("empty file", "");
corruptSettingsCase("array", "[1, 2, 3]");
corruptSettingsCase("null", "null");
corruptSettingsCase("string", '"elevenLabsApiKey"');

const unreadableSettingsCase = (label, makeUnreadable, makeReadable) =>
  runCase(`settings unreadable (${label}): defaults, message, save skipped, file kept`, () => {
    const home = newHome("s-unreadable-" + label.replace(/\W+/g, "-"));
    const m = session(home);
    const dir = m.getAppDataDir();
    const file = path.join(dir, "settings.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, SETTINGS_WITH_KEYS);
    const bytes = fs.readFileSync(file);

    makeUnreadable(file, () => {
      check(m.loadElevenLabsApiKey() === "", "API key shows as empty");
      check(m.hasUiLanguageBeenSet() === true && m.hasOutputLocationBeenSet() === true, "first-run prompts suppressed");
      check(m.hasMacQuarantineNoticeBeenShown() === true, "one-time notice not repeated");
      const code = m.getDataFileProblems()[0] && m.getDataFileProblems()[0].code;
      check(
        JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:unreadable:" + code]),
        "message: unreadable, got " + problemsOf(m),
      );
      m.saveOpenAiApiKey("new-key");
      check(m.toggleFavoriteVoiceId("elevenlabs", "voice-1") === null, "favourite toggle reports not saved");
      check(
        JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:save-skipped:" + code]),
        "message: save skipped, got " + problemsOf(m),
      );
      check(m.loadElevenLabsApiKey() === "" && problemsOf(m)[0].includes("save-skipped"), "a later read keeps the save-skipped message");
    });
    makeReadable(file);
    check(fs.readFileSync(file).equals(bytes), "the file kept every byte");
    check(listCopies(dir, "settings.json").length === 0, "no copy made (the file isn't damaged)");
    check(leftoverTemps(dir).length === 0, "no temp file left");

    // Readable again in the same session: a save keeps every other value.
    m.saveOpenAiApiKey("new-key");
    const now = readJson(file);
    check(
      now.elevenLabsApiKey === "eleven-key" &&
        now.anthropicApiKey === "anthropic-key" &&
        now.uiLanguage === "ru" &&
        now.openaiApiKey === "new-key",
      "after it is readable again, the save kept the other keys: " + JSON.stringify(now),
    );
  });

if (canTestPermissions) {
  unreadableSettingsCase(
    "no read permission, real EACCES",
    (file, fn) => {
      fs.chmodSync(file, 0o000);
      fn();
    },
    (file) => fs.chmodSync(file, 0o644),
  );
} else {
  console.log("SKIP  settings unreadable (real EACCES): needs a non-root user on macOS/Linux");
}
for (const code of ["EBUSY", "EPERM", "EACCES", "EIO"]) {
  unreadableSettingsCase(
    "simulated " + code,
    (file, fn) => withReadError(file, code, fn),
    () => {},
  );
}

runCase("settings unreadable (EISDIR: settings.json is a folder): message, save skipped", () => {
  const m = session(newHome("s-eisdir"));
  const dir = m.getAppDataDir();
  const file = path.join(dir, "settings.json");
  fs.mkdirSync(file, { recursive: true });
  fs.writeFileSync(path.join(file, "keep.txt"), "x");
  check(m.loadElevenLabsApiKey() === "", "API key shows as empty");
  m.saveElevenLabsApiKey("k1");
  check(
    JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:save-skipped:EISDIR"]),
    "message: save skipped (EISDIR), got " + problemsOf(m),
  );
  check(fs.statSync(file).isDirectory() && fs.existsSync(path.join(file, "keep.txt")), "the folder is untouched");
});

if (canTestPermissions) {
  runCase("settings damaged and the copy can't be made: nothing saved over it, in any session", () => {
    const home = newHome("s-nocopy");
    let m = session(home);
    const dir = m.getAppDataDir();
    const file = path.join(dir, "settings.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, "{ damaged");
    const bytes = fs.readFileSync(file);
    fs.chmodSync(dir, 0o555);
    try {
      check(m.loadElevenLabsApiKey() === "", "API key shows as empty");
      check(JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:corrupt-no-copy"]), "message: no copy, got " + problemsOf(m));
      m.saveElevenLabsApiKey("k1");
      m = session(home);
      m.saveElevenLabsApiKey("k1");
      check(
        JSON.stringify(problemsOf(m)) === JSON.stringify(["settings.json:corrupt-no-copy"]),
        "next panel load: still no copy, got " + problemsOf(m),
      );
    } finally {
      fs.chmodSync(dir, 0o755);
    }
    check(fs.readFileSync(file).equals(bytes), "the damaged file is unchanged");
    check(listCopies(dir, "settings.json").length === 0, "no copy exists");
  });
} else {
  console.log("SKIP  settings damaged, copy can't be made: needs a non-root user on macOS/Linux");
}

runCase("settings with a byte-order mark: read normally", () => {
  const m = session(newHome("s-bom"));
  const dir = m.getAppDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "settings.json"), String.fromCharCode(0xfeff) + SETTINGS_WITH_KEYS);
  check(m.loadElevenLabsApiKey() === "eleven-key", "API key read");
  check(problemsOf(m).length === 0, "no message: " + problemsOf(m));
});

runCase("settings fine: every value kept across saves", () => {
  const m = session(newHome("s-ok"));
  const dir = m.getAppDataDir();
  const file = path.join(dir, "settings.json");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, SETTINGS_WITH_KEYS);
  m.saveOutputLocation("project");
  check(JSON.stringify(m.toggleFavoriteVoiceId("kokoro", "af_heart")) === '["af_heart"]', "favourite toggled");
  const now = readJson(file);
  check(
    now.elevenLabsApiKey === "eleven-key" && now.openaiApiKey === "openai-key" && now.outputLocation === "project",
    "values kept: " + JSON.stringify(now),
  );
  check(problemsOf(m).length === 0, "no message");
});

// ---------------------------------------------------------------- presets.json

runCase("presets missing: empty list, no message, save works", () => {
  const m = session(newHome("p-missing"));
  check(m.loadPresets().length === 0, "empty list");
  const saved = m.savePreset({ name: "A", cutThresholdDb: -40, minSilenceSec: 0.3 });
  check(saved && saved.length === 1, "savePreset returned the new list");
  check(readJson(path.join(m.getAppDataDir(), "presets.json")).length === 1, "the preset was saved");
  check(problemsOf(m).length === 0, "no message: " + problemsOf(m));
});

const corruptPresetsCase = (label, text) =>
  runCase(`presets damaged (${label}): copy kept, no save this session, next panel load replaces`, () => {
    const home = newHome("p-corrupt-" + label.replace(/\W+/g, "-"));
    let m = session(home);
    const dir = m.getAppDataDir();
    const file = path.join(dir, "presets.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, text);
    const bytes = fs.readFileSync(file);

    check(m.loadPresets().length === 0, "list shows as empty");
    check(JSON.stringify(problemsOf(m)) === JSON.stringify(["presets.json:corrupt"]), "message: corrupt, got " + problemsOf(m));
    const copies = listCopies(dir, "presets.json");
    check(copies.length === 1 && fs.readFileSync(path.join(dir, copies[0])).equals(bytes), "one identical copy");
    check(m.savePreset({ name: "B", cutThresholdDb: -30, minSilenceSec: 0.2 }) === null, "savePreset reports not saved");
    check(m.deletePreset("Podcast") === null, "deletePreset reports not saved");
    check(fs.readFileSync(file).equals(bytes), "the damaged file is unchanged");

    m = session(home);
    m.loadPresets();
    check(
      JSON.stringify(problemsOf(m)) === JSON.stringify(["presets.json:corrupt-copied-before"]),
      "next panel load message: copied before, got " + problemsOf(m),
    );
    const saved = m.savePreset({ name: "B", cutThresholdDb: -30, minSilenceSec: 0.2 });
    check(saved && saved.length === 1 && readJson(file).length === 1, "next panel load: the save replaced the file");
    check(listCopies(dir, "presets.json").length === 1, "still one copy");
  });

corruptPresetsCase("cut-off JSON", PRESETS_TWO.slice(0, 50));
corruptPresetsCase("object instead of a list", '{ "name": "Podcast" }');

const unreadablePresetsCase = (label, makeUnreadable, makeReadable) =>
  runCase(`presets unreadable (${label}): empty list, message, save skipped, file kept`, () => {
    const m = session(newHome("p-unreadable-" + label.replace(/\W+/g, "-")));
    const dir = m.getAppDataDir();
    const file = path.join(dir, "presets.json");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, PRESETS_TWO);
    const bytes = fs.readFileSync(file);

    makeUnreadable(file, () => {
      check(m.loadPresets().length === 0, "list shows as empty");
      check(problemsOf(m)[0] && problemsOf(m)[0].startsWith("presets.json:unreadable:"), "message: unreadable, got " + problemsOf(m));
      check(m.savePreset({ name: "B", cutThresholdDb: -30, minSilenceSec: 0.2 }) === null, "savePreset reports not saved");
      check(m.deletePreset("Podcast") === null, "deletePreset reports not saved");
      check(problemsOf(m)[0] && problemsOf(m)[0].startsWith("presets.json:save-skipped:"), "message: save skipped, got " + problemsOf(m));
    });
    makeReadable(file);
    check(fs.readFileSync(file).equals(bytes), "the file kept every byte");
    check(listCopies(dir, "presets.json").length === 0, "no copy made");
    const saved = m.savePreset({ name: "B", cutThresholdDb: -30, minSilenceSec: 0.2 });
    check(saved && saved.length === 3 && readJson(file).length === 3, "after it is readable again, the save kept both presets");
  });

if (canTestPermissions) {
  unreadablePresetsCase(
    "no read permission, real EACCES",
    (file, fn) => {
      fs.chmodSync(file, 0o000);
      fn();
    },
    (file) => fs.chmodSync(file, 0o644),
  );
} else {
  console.log("SKIP  presets unreadable (real EACCES): needs a non-root user on macOS/Linux");
}
unreadablePresetsCase(
  "simulated EBUSY",
  (file, fn) => withReadError(file, "EBUSY", fn),
  () => {},
);

// ---------------------------------------------------------------- messages

runCase("messages: every kind, in en/ru/es, with every placeholder filled", () => {
  process.env.HOME = newHome("messages");
  process.env.USERPROFILE = process.env.HOME;
  const msg = require(messagesBundle);
  const kinds = ["unreadable", "save-skipped", "corrupt", "corrupt-copied-before", "corrupt-no-copy"];
  const seen = new Set();
  for (const language of ["en", "ru", "es"]) {
    msg.setLanguage(language);
    for (const file of ["settings.json", "presets.json"]) {
      for (const kind of kinds) {
        const copyPath = kind.startsWith("corrupt") && kind !== "corrupt-no-copy" ? "~/x/" + file + ".corrupted-1" : "";
        const code = kind === "unreadable" || kind === "save-skipped" ? "EBUSY" : "";
        const text = msg.describeDataFileProblem({ file, kind, copyPath, code });
        check(!/\{\w+\}/.test(text), `${language} ${file} ${kind}: no unfilled placeholder: ${text}`);
        check(
          text.includes(file) && (!code || text.includes(code)) && (!copyPath || text.includes(copyPath)),
          `${language} ${kind}: names the file, code and copy`,
        );
        if (language !== "en") check(/[^\x00-\x7f]/.test(text), `${language} ${kind}: translated`);
        seen.add(text);
      }
    }
  }
  check(seen.size === 3 * 2 * kinds.length, "every message is different");
});

// ---------------------------------------------------------------- done

const chmodBack = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    try {
      fs.chmodSync(p, entry.isDirectory() ? 0o755 : 0o644);
    } catch (e) {
      // best effort
    }
    if (entry.isDirectory()) chmodBack(p);
  }
};
chmodBack(tmpRoot);
fs.rmSync(tmpRoot, { recursive: true, force: true });

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
