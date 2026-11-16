// Checks a built ExtendScript file (default: dist/cep/jsx/index.js) for code
// that the ExtendScript parser in Premiere Pro and After Effects rejects,
// although Node and TypeScript accept it. One parse error there stops the
// whole file from loading, and every panel button that calls the host fails.
//
// - The file must parse as ECMAScript 3 (acorn, ecmaVersion 3; reserved words
//   are allowed as property names, as ExtendScript allows them).
// - No regex literal may hold an unescaped "/": ExtendScript ends the literal
//   there even inside a character class, so /[\\/]x/ must be written /[\\\/]x/.
// - Only ASCII characters: Premiere Pro loads the file in a legacy 8-bit
//   encoding, so "—" in a message would show as garbled text there. The build
//   writes them as \u escapes (vite.es.config.ts, asciiOnly).
//
// Usage: node scripts/check-extendscript.mjs [file ...]
// Exit code 1 when a file fails. acorn is not listed in package.json: it is
// installed with vite-cep-plugin's dependencies (through ts-node).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(path.join(ROOT, "package.json"));
const acorn = require("acorn");

export const checkExtendScriptSource = (src) => {
  const problems = [];
  const nonAscii = src.search(/[^\x00-\x7f]/);
  if (nonAscii !== -1) {
    const line = src.slice(0, nonAscii).split(/\r\n|\r|\n/).length;
    problems.push(`line ${line}: non-ASCII character "${src[nonAscii]}" (the build should write it as a \\u escape)`);
  }
  try {
    acorn.parse(src, { ecmaVersion: 3, allowReserved: true });
  } catch (e) {
    problems.push(`does not parse as ECMAScript 3: ${e.message}`);
    return problems;
  }
  for (const t of acorn.tokenizer(src, { ecmaVersion: 3, allowReserved: true, locations: true })) {
    if (t.type.label !== "regexp") continue;
    const p = t.value.pattern;
    for (let i = 0; i < p.length; i++) {
      if (p[i] === "\\") {
        i++;
        continue;
      }
      if (p[i] === "/") {
        problems.push(`line ${t.loc.start.line}: regex /${p}/${t.value.flags} has an unescaped "/" (write it as \\/)`);
        break;
      }
    }
  }
  return problems;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const files = process.argv.slice(2);
  if (files.length === 0) files.push(path.join(ROOT, "dist", "cep", "jsx", "index.js"));
  let failed = false;
  for (const f of files) {
    if (!fs.existsSync(f)) {
      console.error(`${f}: not found (build first: npm run build)`);
      failed = true;
      continue;
    }
    const problems = checkExtendScriptSource(fs.readFileSync(f, "utf8"));
    if (problems.length) {
      failed = true;
      console.error(`${f}: FAIL\n` + problems.map((p) => `- ${p}`).join("\n"));
    } else {
      console.log(`${f}: OK`);
    }
  }
  process.exit(failed ? 1 : 0);
}
