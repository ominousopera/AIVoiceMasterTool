#!/usr/bin/env node
// Replaces build-machine paths that compilers embed in native binaries (the
// configure prefix FFmpeg prints in `-version`, __FILE__ paths in whisper.cpp
// assertion messages, debug-info paths) with a neutral placeholder of the
// same length, so a shipped binary does not reveal the user name or folder
// layout of the machine that built it. Only string bytes change, never code:
// every replacement keeps its length, and a macOS binary that was signed is
// re-signed ad hoc afterwards by this script.
//
// Usage (from the project root):
//   node scripts/scrub-build-paths.mjs <file>...           # scrub in place
//   node scripts/scrub-build-paths.mjs --check <file>...   # report only, exit 1 if any path is found
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const files = args.filter((a) => a !== "--check");
if (!files.length) {
  console.error("usage: node scripts/scrub-build-paths.mjs [--check] <file>...");
  process.exit(2);
}

// Build-machine path shapes. Each match is overwritten with "/build" padded
// with "_" to the same length; the path that follows it stays readable, e.g.
// ".../build/whisper.cpp/src/whisper.cpp".
const PATTERNS = [
  /\/private\/tmp\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/[0-9a-f-]{36}/g, // per-session temp build folders
  /\/private\/var\/folders\/[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+\/T/g, // macOS per-user temp folder
  /\/var\/folders\/[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+\/T/g,
  /\/Users\/[A-Za-z0-9_.-]+/g, // a macOS home folder
  /[A-Za-z]:\\Users\\[A-Za-z0-9_. -]+/g, // a Windows home folder
];
const placeholder = (len) => ("/build" + "_".repeat(Math.max(0, len - 6))).slice(0, len);

let found = 0;
for (const file of files) {
  const buf = fs.readFileSync(file);
  // latin1 maps every byte to one char, so string offsets are byte offsets.
  const text = buf.toString("latin1");
  const hits = [];
  for (const re of PATTERNS) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(text)); ) hits.push({ index: m.index, length: m[0].length, value: m[0] });
  }
  found += hits.length;
  const distinct = [...new Set(hits.map((h) => h.value))];
  console.log(`${file}: ${hits.length} build-machine path(s)${distinct.length ? " — " + distinct.slice(0, 3).join(" | ") : ""}`);
  if (checkOnly || !hits.length) continue;

  for (const h of hits) buf.write(placeholder(h.length), h.index, h.length, "latin1");
  const wasSigned = process.platform === "darwin" && spawnSync("codesign", ["-dv", file], { encoding: "utf8" }).status === 0;
  fs.writeFileSync(file, buf);
  if (wasSigned) {
    const r = spawnSync("codesign", ["--force", "--sign", "-", file], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`re-signing ${file} failed: ${r.stderr}`);
    console.log(`  re-signed ad hoc`);
  }
}
if (checkOnly && found) process.exit(1);
