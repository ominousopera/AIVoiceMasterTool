#!/usr/bin/env node
// Builds a release in one go:
// - the normal, readable build (`npm run zip`) into release/Extension (Unpacked)/;
// - one package per platform (TARGET_PLATFORM, see vite.config.ts) into
//   release/packages/: "AI-Voice-Master-Tool-macOS.zxp" and
//   "AI-Voice-Master-Tool-Windows.zxp", each with only its own native
//   binaries (no spaces or brackets: GitHub renames release files that have
//   them, and the names must match SHA256SUMS.txt and the README links);
// - removes the dev CEP symlink, so it never shadows an installed copy;
// - then spot-checks the packages (signatures, network guard, ExtendScript
//   form, no .debug file, no build-machine paths, per-platform binaries).
//
// The packages are release builds by default (`npm run zip:release`: plain,
// readable ExtendScript, no jsxbin; the panel says "release build").
// `--jsxbin` builds them with `npm run zip:secure` instead (jsxbin, "secure
// build"); see vite.config.ts for what SECURE_BUILD changes.
//
// Signing: vite-cep-plugin signs every package with a new self-signed
// certificate made from cep.config.ts's zxp fields. To sign the packages with
// one certificate of your own instead, set ZXP_CERT to its .p12 file and
// ZXP_CERT_PASSWORD_FILE to a file that holds only its password (keep both
// outside the repository). Each package is then signed again, from the same
// build folder, with that certificate, and the check below compares the
// signer with it (needs `openssl` to read the .p12).
//
// Adobe's jsxbin compiler runs locally as an ordinary npm package with fixed
// options. The one network call is the signing step: ZXPSignCmd timestamps
// each package through the TSA servers in cep.config.ts (zxp.tsa), and
// allowSkipTSA is false, so packaging without a connection fails.
//
// Usage (from the project root):
//   [ZXP_CERT=<file.p12> ZXP_CERT_PASSWORD_FILE=<file>] node scripts/release.mjs [--jsxbin]
import { execFileSync, spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkExtendScriptSource } from "./check-extendscript.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Both output folders go into a git-ignored release/ folder; RELEASE_OUT
// overrides that location.
const outRoot = process.env.RELEASE_OUT ? path.resolve(process.env.RELEASE_OUT) : path.join(ROOT, "release");
const unpackedDir = path.join(outRoot, "Extension (Unpacked)");
const zxpInstallerDir = path.join(outRoot, "packages");
const PLATFORM_PACKAGES = [
  {
    target: "mac",
    label: "macOS",
    file: path.join(zxpInstallerDir, "AI-Voice-Master-Tool-macOS.zxp"),
    ownBin: "assets/bin/mac/",
    otherBin: "assets/bin/win/",
  },
  {
    target: "win",
    label: "Windows",
    file: path.join(zxpInstallerDir, "AI-Voice-Master-Tool-Windows.zxp"),
    ownBin: "assets/bin/win/",
    otherBin: "assets/bin/mac/",
  },
];
const distCep = path.join(ROOT, "dist", "cep");
const distZxpDir = path.join(ROOT, "dist", "zxp");

const certPath = process.env.ZXP_CERT ? path.resolve(process.env.ZXP_CERT) : null;
const certPasswordFile = process.env.ZXP_CERT_PASSWORD_FILE ? path.resolve(process.env.ZXP_CERT_PASSWORD_FILE) : null;
if (Boolean(certPath) !== Boolean(certPasswordFile)) throw new Error("set both ZXP_CERT and ZXP_CERT_PASSWORD_FILE, or neither");
for (const f of [certPath, certPasswordFile]) if (f && !fs.existsSync(f)) throw new Error(`not found: ${f}`);
const zxpSignCmd = path.join(
  ROOT,
  "node_modules",
  "vite-cep-plugin",
  "lib",
  "bin",
  os.platform() === "win32" ? "ZXPSignCmd.exe" : "ZXPSignCmd",
);
// The same timestamp servers, in the same order, as cep.config.ts's zxp.tsa.
const tsaServers = [
  ...(fs.readFileSync(path.join(ROOT, "cep.config.ts"), "utf8").match(/\btsa:\s*\[([^\]]*)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g),
].map((m) => m[1]);
if (certPath && !tsaServers.length) throw new Error("no timestamp servers found in cep.config.ts (zxp.tsa)");

// Signs dist/cep (the folder vite-cep-plugin just signed) into outFile with
// ZXP_CERT. spawnSync, not execFileSync: execFileSync's error message repeats
// the command line, which holds the password.
const signWithOwnCertificate = (outFile) => {
  const password = fs.readFileSync(certPasswordFile, "utf8").trim();
  const hide = (text) => (password ? String(text).split(password).join("***") : String(text));
  for (const tsa of tsaServers) {
    fs.rmSync(outFile, { force: true });
    const r = spawnSync(zxpSignCmd, ["-sign", distCep, outFile, certPath, password, "-tsa", tsa], {
      cwd: path.dirname(zxpSignCmd),
      encoding: "utf8",
    });
    if (r.status === 0) {
      console.log(`signed ${path.basename(outFile)} with ${path.basename(certPath)} (timestamp: ${tsa})`);
      return;
    }
    console.warn(`signing with timestamp server ${tsa} failed (exit ${r.status}): ${hide(`${r.stdout || ""}${r.stderr || ""}`).trim()}`);
  }
  fs.rmSync(outFile, { force: true });
  throw new Error(`could not sign ${path.basename(outFile)} with ${certPath} through any timestamp server`);
};

// The signer's certificate inside a package (the first X509Certificate in
// META-INF/signatures.xml; a later one belongs to the timestamp).
const packageSigner = (zxp) => {
  const xml = execFileSync("unzip", ["-p", zxp, "META-INF/signatures.xml"]).toString();
  const b64 = xml.match(/<X509Certificate>([^<]+)<\/X509Certificate>/)?.[1];
  if (!b64) throw new Error(`${path.basename(zxp)} has no signer certificate in META-INF/signatures.xml`);
  return new X509Certificate(Buffer.from(b64.replace(/\s/g, ""), "base64"));
};

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const extensionId = pkg.name; // e.g. "com.aivoicemastertool.pro" — matches cep.config.ts's own `id`
const devSymlinkPath = path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", extensionId);

const useJsxBin = process.argv.includes("--jsxbin");
const packageScript = useJsxBin ? "zip:secure" : "zip:release";

const failures = [];
const step = (label, fn) => {
  process.stdout.write(`\n=== ${label} ===\n`);
  fn();
};
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
const runQuiet = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT }).toString();

step("Regenerate the npm license file shipped in assets/licenses", () => {
  run("node", ["scripts/collect-licenses.mjs"]);
});

step("Normal build (readable, no jsxbin) → npm run zip", () => {
  run("npm", ["run", "zip"]);
});

step('Refresh "Extension (Unpacked)/" from the normal build', () => {
  fs.rmSync(unpackedDir, { recursive: true, force: true });
  fs.mkdirSync(unpackedDir, { recursive: true });
  fs.cpSync(distCep, unpackedDir, { recursive: true });
});

for (const pkgInfo of PLATFORM_PACKAGES) {
  step(
    `${useJsxBin ? "Secure" : "Release"} build for ${pkgInfo.label} (TARGET_PLATFORM=${pkgInfo.target}) → npm run ${packageScript}`,
    () => {
      execFileSync("npm", ["run", packageScript], {
        cwd: ROOT,
        stdio: "inherit",
        env: { ...process.env, TARGET_PLATFORM: pkgInfo.target },
      });
    },
  );

  step(
    certPath ? `Sign the ${pkgInfo.label} package with ZXP_CERT into packages/` : `Copy the ${pkgInfo.label} .zxp into packages/`,
    () => {
      const zxpSource = path.join(distZxpDir, `${extensionId}.zxp`);
      if (!fs.existsSync(zxpSource)) throw new Error(`Expected ${packageScript} zxp not found at ${zxpSource}`);
      fs.mkdirSync(zxpInstallerDir, { recursive: true });
      if (!certPath) {
        fs.copyFileSync(zxpSource, pkgInfo.file);
        return;
      }
      signWithOwnCertificate(pkgInfo.file);
      // Same files as the package vite-cep-plugin signed, apart from the signature.
      const contents = (zxp) =>
        runQuiet("unzip", ["-Z1", zxp])
          .split("\n")
          .filter((e) => e && !e.startsWith("META-INF/") && e !== "mimetype")
          .sort()
          .join("\n");
      if (contents(pkgInfo.file) !== contents(zxpSource))
        throw new Error(`${path.basename(pkgInfo.file)} does not hold the same files as ${zxpSource}`);
    },
  );
}

step("Remove the dev CEP symlink (so it never shadows an installed copy)", () => {
  // Guarded with lstatSync().isSymbolicLink(): a ZXP installer may put a
  // real install at this same per-user path (one folder per extension ID),
  // so an unconditional rmSync could delete a genuine installed copy, not
  // just the dev symlink vite-cep-plugin recreates on every local build.
  // Only a symlink is removed; a real directory is left alone.
  try {
    if (fs.lstatSync(devSymlinkPath).isSymbolicLink()) {
      fs.rmSync(devSymlinkPath, { force: true });
    }
  } catch (e) {
    // ENOENT — nothing there, nothing to do.
  }
});

step("Spot-check: ad-hoc code signatures survived the copy", () => {
  for (const bin of ["ffmpeg", "whisper-cli", "espeak-ng"]) {
    const p = path.join(unpackedDir, "assets", "bin", "mac", bin);
    // codesign -dv writes its report to stderr, and execFileSync returns only
    // stdout, so spawnSync captures both streams.
    const res = spawnSync("codesign", ["-dv", p], { encoding: "utf8" });
    const out = `${res.stdout || ""}${res.stderr || ""}`;
    if (!/Signature=adhoc/.test(out)) failures.push(`${bin}: signature is not adhoc (codesign output: ${out.trim() || "empty"})`);
  }
});

step("Spot-check: each package's signature verifies, is timestamped and names the expected signer", () => {
  let expected = null;
  if (certPath) {
    // -passin file: keeps the password off the command line.
    const r = spawnSync("openssl", ["pkcs12", "-in", certPath, "-nokeys", "-clcerts", "-passin", `file:${certPasswordFile}`], {
      encoding: "utf8",
    });
    const pem = (r.stdout || "").match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
    if (r.status !== 0 || !pem) failures.push(`could not read the certificate in ${certPath} with openssl: ${(r.stderr || "").trim()}`);
    else expected = new X509Certificate(pem).fingerprint256;
  }
  const signers = new Set();
  for (const pkgInfo of PLATFORM_PACKAGES) {
    const r = spawnSync(zxpSignCmd, ["-verify", pkgInfo.file, "-certInfo", "-skipOnlineRevocationChecks"], {
      cwd: path.dirname(zxpSignCmd),
      encoding: "utf8",
    });
    const out = `${r.stdout || ""}${r.stderr || ""}`;
    if (r.status !== 0 || !/Signature verified successfully/.test(out))
      failures.push(`${pkgInfo.label} package: signature does not verify:\n${out.trim()}`);
    if (!/^Timestamp:\s*\S/m.test(out) || /^Timestamp:\s*None/m.test(out)) failures.push(`${pkgInfo.label} package has no timestamp`);
    const signer = packageSigner(pkgInfo.file);
    signers.add(signer.fingerprint256);
    console.log(
      `${pkgInfo.label}: ${signer.subject.split("\n").join(", ")}; valid until ${signer.validTo}; SHA-256 ${signer.fingerprint256}`,
    );
    if (expected && signer.fingerprint256 !== expected) failures.push(`${pkgInfo.label} package is not signed with ${certPath}`);
  }
  if (certPath && signers.size !== 1) failures.push("the packages are signed with different certificates");
});

step("Spot-check: package sizes (printed for review; no threshold)", () => {
  console.log(runQuiet("du", ["-sh", unpackedDir, ...PLATFORM_PACKAGES.map((p) => p.file)]));
});

step("Spot-check: the shipped panels load no Node networking module and keep the network guard", () => {
  const assetsDir = path.join(unpackedDir, "assets");
  const bundles = fs
    .readdirSync(assetsDir)
    .filter((f) => f.endsWith(".cjs"))
    .map((f) => path.join(assetsDir, f));
  const nodeNet = /require\(["'`](node:)?(http|https|http2|net|tls|dgram|dns)["'`]\)/;
  for (const b of bundles) {
    if (nodeNet.test(fs.readFileSync(b, "utf8"))) failures.push(`${path.basename(b)} loads a Node networking module`);
  }
  const all = bundles.map((b) => fs.readFileSync(b, "utf8")).join("\n");
  if (!all.includes("[network guard] blocked a request to"))
    failures.push("the network guard (src/js/lib/networkGuard.ts) is missing from the built panels");
});

step(`Spot-check: the packages' ExtendScript is ${useJsxBin ? "jsxbin" : "plain text (no jsxbin)"}`, () => {
  // jsxBin "replace" ships jsx/index.jsxbin instead of jsx/index.js.
  for (const pkgInfo of PLATFORM_PACKAGES) {
    const entries = runQuiet("unzip", ["-Z1", pkgInfo.file]).split("\n");
    const has = (e) => entries.includes(e);
    const ok = useJsxBin ? has("jsx/index.jsxbin") && !has("jsx/index.js") : has("jsx/index.js") && !has("jsx/index.jsxbin");
    if (!ok)
      failures.push(
        `${pkgInfo.label} package: expected ${useJsxBin ? "jsx/index.jsxbin only" : "jsx/index.js only (plain text)"}, found ${entries.filter((e) => e.startsWith("jsx/index")).join(", ") || "neither"}`,
      );
  }
});

step("Spot-check: the ExtendScript parses the way Premiere Pro and After Effects parse it (scripts/check-extendscript.mjs)", () => {
  // The readable build always has jsx/index.js; a jsxbin package has no plain
  // text to check, so only plain-text packages are read.
  const sources = [["normal build", fs.readFileSync(path.join(unpackedDir, "jsx", "index.js"), "utf8")]];
  if (!useJsxBin)
    for (const pkgInfo of PLATFORM_PACKAGES)
      sources.push([
        `${pkgInfo.label} package`,
        execFileSync("unzip", ["-p", pkgInfo.file, "jsx/index.js"], { maxBuffer: 64 * 1024 * 1024 }).toString(),
      ]);
  for (const [label, src] of sources)
    for (const problem of checkExtendScriptSource(src)) failures.push(`${label}: jsx/index.js ${problem}`);
});

step("Spot-check: no CEP .debug file in the packages (it would open remote-debugging ports on every machine)", () => {
  for (const pkgInfo of PLATFORM_PACKAGES) {
    const entries = runQuiet("unzip", ["-Z1", pkgInfo.file]).split("\n");
    if (entries.some((e) => e === ".debug" || e.endsWith("/.debug"))) failures.push(`${pkgInfo.label} package contains a .debug file`);
  }
});

step("Spot-check: no build-machine paths (user name, temp folders) inside the bundled native binaries", () => {
  const bins = ["mac", "win"].flatMap((p) =>
    fs.readdirSync(path.join(unpackedDir, "assets", "bin", p)).map((f) => path.join(unpackedDir, "assets", "bin", p, f)),
  );
  const r = spawnSync("node", ["scripts/scrub-build-paths.mjs", "--check", ...bins], { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) failures.push(`Build-machine paths found in native binaries — run scripts/scrub-build-paths.mjs:\n${r.stdout}`);
});

step("Spot-check: each platform package holds its own native binaries and none of the other platform's", () => {
  for (const pkgInfo of PLATFORM_PACKAGES) {
    const entries = runQuiet("unzip", ["-Z1", pkgInfo.file]).split("\n");
    const own = entries.filter((e) => e.startsWith(pkgInfo.ownBin) && !e.endsWith("/"));
    const other = entries.filter((e) => e.startsWith(pkgInfo.otherBin));
    console.log(`${pkgInfo.label}: ${own.length} own binaries, ${other.length} of the other platform's`);
    if (own.length < 3) failures.push(`${pkgInfo.label} package is missing its own binaries (found: ${own.join(", ") || "none"})`);
    if (other.length) failures.push(`${pkgInfo.label} package contains the other platform's binaries:\n${other.join("\n")}`);
  }
});

step(
  'Spot-check: no Cyrillic text in shipped source outside src/js/lib/i18n/ (the Russian UI dictionary, shared by both panels) and main.tsx\'s "Русский" language label',
  () => {
    // Plain Node, not `grep -P`: macOS ships BSD grep, which has no -P (PCRE)
    // support.
    const cyrillic = /[Ѐ-ӿ]/;
    const hits = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "i18n") continue;
          walk(full);
        } else if (/\.(ts|tsx|md)$/.test(entry.name)) {
          let text = fs.readFileSync(full, "utf8");
          if (entry.name === "main.tsx") text = text.split("Русский").join("");
          if (cyrillic.test(text)) hits.push(full);
        }
      }
    };
    walk(path.join(ROOT, "src"));
    const readmePath = path.join(ROOT, "README.md");
    if (fs.existsSync(readmePath) && cyrillic.test(fs.readFileSync(readmePath, "utf8"))) hits.push(readmePath);
    if (hits.length) failures.push(`Cyrillic text found in source:\n${hits.join("\n")}`);
  },
);

step(
  "Spot-check: no direct network calls (fetch/XMLHttpRequest/WebSocket) in src/; ElevenLabs, OpenAI and Anthropic go through their official SDKs",
  () => {
    try {
      const out = execFileSync(
        "grep",
        ["-rn", "fetch(\\|XMLHttpRequest(\\|new WebSocket", path.join(ROOT, "src"), "--include=*.ts", "--include=*.tsx"],
        { cwd: ROOT },
      ).toString();
      if (out.trim()) failures.push(`Direct network call(s) in src/ (the AI providers must go through their official SDKs):\n${out}`);
    } catch {
      // grep exits 1 on no match at all: the expected, healthy result.
    }
  },
);

step(
  "Spot-check: no source maps shipped inside the actual .zxp (would let anyone reconstruct original TypeScript source, comments included, via browser devtools)",
  () => {
    for (const pkgInfo of PLATFORM_PACKAGES) {
      const out = runQuiet("unzip", ["-l", pkgInfo.file]);
      const mapLines = out.split("\n").filter((l) => l.includes(".map"));
      if (mapLines.length) failures.push(`Source map(s) found inside the ${pkgInfo.label} .zxp:\n${mapLines.join("\n")}`);
    }
  },
);

if (failures.length) {
  console.error(`\n${failures.length} spot-check(s) FAILED:\n` + failures.map((f) => `- ${f}`).join("\n"));
  process.exit(1);
}
console.log(`\nAll spot-checks passed. ${unpackedDir} and ${zxpInstallerDir} are up to date.`);
