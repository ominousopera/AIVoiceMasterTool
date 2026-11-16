#!/usr/bin/env node
// Packs the bundled native binaries and their source archives (every
// manifest entry with `"bundle": "third-party"`) into the one .zip that a
// GitHub Release carries for scripts/fetch-assets.mjs, and writes the zip's
// SHA-256 into scripts/assets-manifest.json. Run it when those binaries
// change, then attach the zip to a release tagged with the bundle's
// `release` name. Uses the system `tar` (bsdtar writes .zip on macOS).
//
// Usage (from the project root):  node scripts/pack-third-party.mjs [outDir]
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(ROOT, "scripts", "assets-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const outDir = path.resolve(process.argv[2] || path.join(ROOT, "release"));
const bundle = manifest.bundles["third-party"];
const files = manifest.files.filter((e) => e.bundle === "third-party");

for (const e of files) {
  const abs = path.join(ROOT, e.path);
  if (!fs.existsSync(abs)) throw new Error(`missing ${e.path}`);
  const sha = createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
  if (sha !== e.sha256)
    throw new Error(`${e.path} does not match the manifest — update the manifest entry first if this change is intended`);
}

// Never pack a binary that still names the machine it was built on.
const scrub = spawnSync(
  "node",
  ["scripts/scrub-build-paths.mjs", "--check", ...files.filter((e) => e.path.includes("/bin/")).map((e) => e.path)],
  {
    cwd: ROOT,
    stdio: "inherit",
  },
);
if (scrub.status !== 0) throw new Error("build-machine paths found in the binaries — run scripts/scrub-build-paths.mjs first");

fs.mkdirSync(outDir, { recursive: true });
const zip = path.join(outDir, bundle.file);
fs.rmSync(zip, { force: true });
const r = spawnSync("tar", ["-a", "-cf", zip, ...files.map((e) => e.path)], { cwd: ROOT, stdio: "inherit" });
if (r.status !== 0) throw new Error("tar failed");

bundle.sha256 = createHash("sha256").update(fs.readFileSync(zip)).digest("hex");
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${zip} (${(fs.statSync(zip).size / 1048576).toFixed(1)} MB), sha256 ${bundle.sha256}`);
console.log(`Attach it to a GitHub Release tagged "${bundle.release}".`);
