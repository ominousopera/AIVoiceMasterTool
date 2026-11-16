#!/usr/bin/env node
// Puts the large and third-party files the source repository does not store
// (models, voices, native binaries, source archives) in place, from the pinned
// sources listed in scripts/assets-manifest.json, and checks every file's
// SHA-256. Files already present with the right hash are left alone, so it is
// safe to re-run. Node built-ins only; the third-party archive is unpacked with
// the system `tar` (bsdtar on macOS and Windows 10+, which reads .zip).
//
// Usage (from the project root):
//   node scripts/fetch-assets.mjs           # download what is missing
//   node scripts/fetch-assets.mjs --check   # verify only, download nothing
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "assets-manifest.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const checkOnly = process.argv.includes("--check");

const sha256File = (p) =>
  new Promise((resolve, reject) => {
    const h = createHash("sha256");
    fs.createReadStream(p)
      .on("data", (d) => h.update(d))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject);
  });

const isGood = async (entry) => {
  const abs = path.join(ROOT, entry.path);
  if (!fs.existsSync(abs)) return false;
  if (fs.statSync(abs).size !== entry.size) return false;
  return (await sha256File(abs)) === entry.sha256;
};

const download = async (url, dest) => {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  const out = fs.createWriteStream(tmp);
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!out.write(value)) await new Promise((r) => out.once("drain", r));
  }
  await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
  fs.renameSync(tmp, dest);
};

const releaseUrl = (bundle) => {
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const m = repo && /github\.com[/:]([^/]+)\/([^/.]+)/.exec(repo);
  if (!m) {
    throw new Error(
      'package.json has no GitHub "repository" field, so the third-party archive cannot be located. ' +
        "Build the binaries yourself (docs/BUILDING-THIRD-PARTY.md) or set the field.",
    );
  }
  return `https://github.com/${m[1]}/${m[2]}/releases/download/${bundle.release}/${bundle.file}`;
};

const missing = [];
for (const entry of manifest.files) {
  if (!(await isGood(entry))) missing.push(entry);
}
console.log(`${manifest.files.length - missing.length}/${manifest.files.length} files present and verified.`);
if (!missing.length) process.exit(0);
if (checkOnly) {
  for (const e of missing) console.log(`  missing or different: ${e.path}`);
  process.exit(1);
}

let failed = 0;
const fail = (entry, why) => {
  failed++;
  console.error(`  FAILED ${entry.path}: ${why}`);
};

// 1. Files copied from an installed npm package (needs `npm ci` first).
for (const entry of missing.filter((e) => e.copyFrom)) {
  const src = path.join(ROOT, entry.copyFrom);
  if (!fs.existsSync(src)) {
    fail(entry, `${entry.copyFrom} not found — run \`npm ci\` first`);
    continue;
  }
  fs.mkdirSync(path.dirname(path.join(ROOT, entry.path)), { recursive: true });
  fs.copyFileSync(src, path.join(ROOT, entry.path));
  if (await isGood(entry)) console.log(`  copied ${entry.path}`);
  else fail(entry, "copied file does not match the pinned SHA-256 (different onnxruntime-web version installed?)");
}

// 2. Single files from pinned upstream URLs.
for (const entry of missing.filter((e) => e.url)) {
  process.stdout.write(`  downloading ${entry.path} (${(entry.size / 1048576).toFixed(1)} MB)… `);
  try {
    await download(entry.url, path.join(ROOT, entry.path));
    if (await isGood(entry)) console.log("ok");
    else {
      console.log("");
      fs.rmSync(path.join(ROOT, entry.path), { force: true });
      fail(entry, "downloaded file does not match the pinned SHA-256 — removed");
    }
  } catch (e) {
    console.log("");
    fail(entry, e.message);
  }
}

// 3. Files that come together in one release archive.
const bundled = missing.filter((e) => e.bundle);
for (const name of [...new Set(bundled.map((e) => e.bundle))]) {
  const bundle = manifest.bundles[name];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-assets-"));
  const archive = path.join(tmpDir, bundle.file);
  try {
    const url = releaseUrl(bundle);
    console.log(`  downloading ${bundle.file}…`);
    await download(url, archive);
    if ((await sha256File(archive)) !== bundle.sha256) throw new Error(`${bundle.file} does not match the pinned SHA-256`);
    const x = spawnSync("tar", ["-xf", archive, "-C", tmpDir], { stdio: "inherit" });
    if (x.status !== 0) throw new Error("could not unpack the archive with tar");
    for (const entry of bundled.filter((e) => e.bundle === name)) {
      const from = path.join(tmpDir, entry.path);
      if (!fs.existsSync(from)) {
        fail(entry, `not in ${bundle.file}`);
        continue;
      }
      fs.mkdirSync(path.dirname(path.join(ROOT, entry.path)), { recursive: true });
      fs.copyFileSync(from, path.join(ROOT, entry.path));
      if (!entry.path.endsWith(".exe") && entry.path.includes("/bin/mac/")) fs.chmodSync(path.join(ROOT, entry.path), 0o755);
      if (await isGood(entry)) console.log(`  unpacked ${entry.path}`);
      else fail(entry, "unpacked file does not match the pinned SHA-256");
    }
  } catch (e) {
    for (const entry of bundled.filter((x) => x.bundle === name)) fail(entry, e.message);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

if (failed) {
  console.error(`\n${failed} file(s) could not be put in place.`);
  process.exit(1);
}
console.log("\nAll assets in place.");
