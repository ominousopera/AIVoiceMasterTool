#!/usr/bin/env node
// Standalone dev-only check (not shipped). Lists every UI string that is
// missing from ru.ts/es.ts — literal tr("...") keys plus every string in
// guideText.ts (the Guide is translated paragraph by paragraph) — and the
// dictionary keys that no source string uses any more. Exits 1 if anything
// is missing, so it can gate a release.
//
// Usage (from the project root):  node scripts/check-i18n.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ts = createRequire(path.join(ROOT, "package.json"))("typescript");

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const parse = (f) =>
  ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isStr = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);

const used = new Set();
const allLiterals = new Set();
const srcDir = path.join(ROOT, "src");
for (const f of walk(srcDir).filter((f) => /\.(ts|tsx)$/.test(f) && !/i18n[\\/](ru|es)\.ts$/.test(f))) {
  const guide = /guideText\.ts$/.test(f);
  const visit = (n) => {
    if (isStr(n)) {
      allLiterals.add(n.text);
      if (guide && n.text.length > 0) used.add(n.text);
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "tr" && n.arguments[0] && isStr(n.arguments[0])) {
      used.add(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(parse(f));
}

const keysOf = (f) => {
  const out = new Set();
  const visit = (n) => {
    // Quoted or bare (`License: ...`) keys alike.
    if (ts.isPropertyAssignment(n) && (isStr(n.name) || ts.isIdentifier(n.name))) out.add(n.name.text);
    ts.forEachChild(n, visit);
  };
  visit(parse(f));
  return out;
};
const dicts = {
  ru: keysOf(path.join(srcDir, "js/lib/i18n/ru.ts")),
  es: keysOf(path.join(srcDir, "js/lib/i18n/es.ts")),
};

let missingAny = false;
console.log(`UI strings checked: ${used.size}`);
for (const [lang, keys] of Object.entries(dicts)) {
  const missing = [...used].filter((k) => !keys.has(k));
  if (missing.length) missingAny = true;
  console.log(`missing in ${lang}: ${missing.length}`);
  for (const k of missing) console.log("  - " + JSON.stringify(k));
}
// Host-message keys are matched by pattern at runtime (hostMessages.ts),
// so some dictionary keys legitimately match no literal; listed, not failed.
const unused = [...dicts.ru].filter((k) => !allLiterals.has(k));
console.log(`dictionary keys matching no source literal: ${unused.length}`);
for (const k of unused) console.log("  - " + JSON.stringify(k));
process.exit(missingAny ? 1 : 0);
