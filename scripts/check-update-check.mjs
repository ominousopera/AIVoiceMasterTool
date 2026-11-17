#!/usr/bin/env node
// Standalone dev-only check (not shipped). Exercises updateCheck.ts against a
// fake `fetch`, so nothing goes online:
//   - versions: only `1.2.3` / `v1.2.3` count; numbers compare as numbers;
//   - rhythm: a check is due with no earlier good check, after three days, or
//     when the clock went backwards;
//   - only this project's release pages are ever opened;
//   - the request goes to the fixed API address, without credentials or any
//     header that identifies the user;
//   - every kind of bad answer is an error, never a version, and GitHub's
//     request limit (403 / 429) comes back as "limit";
//   - on the request limit only, one more request to the fixed raw
//     package.json address, also without credentials or headers; a failure
//     or a version that isn't a plain X.Y.Z there stays "limit".
// Exits 1 if any check fails.
//
// Usage (from the project root):  node scripts/check-update-check.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(path.join(ROOT, "package.json"));
const esbuild = req("esbuild");

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
};

const out = path.join(ROOT, "scripts", `.tmp-update-check-${Date.now()}.cjs`);
await esbuild.build({
  entryPoints: [path.join(ROOT, "src/js/lib/updateCheck.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: out,
  logLevel: "silent",
});
let mod;
try {
  mod = req(out);
} finally {
  fs.unlinkSync(out);
}
const { parseVersion, isNewer, isDue, releasePageFor, fetchLatestRelease, RELEASES_URL, CHECK_INTERVAL_MS, REPO } = mod;

// ---------- versions ----------
check("parse 1.2.3", JSON.stringify(parseVersion("1.2.3")) === "[1,2,3]");
check("parse v1.2.3 with spaces", JSON.stringify(parseVersion(" v1.2.3 ")) === "[1,2,3]");
for (const bad of ["v1.1.0-beta", "1.2", "1.2.3.4", "V1.2.3", "", "latest", null, 123, "12345.0.0"])
  check(`not a version: ${JSON.stringify(bad)}`, parseVersion(bad) === null);
check("1.10.0 is newer than 1.9.9", isNewer("1.10.0", "1.9.9"));
check("1.0.1 is newer than 1.0.0", isNewer("1.0.1", "1.0.0"));
check("2.0.0 is newer than 1.99.99", isNewer("2.0.0", "1.99.99"));
check("same version is not newer", !isNewer("1.0.0", "1.0.0"));
check("older is not newer", !isNewer("0.9.9", "1.0.0"));
check("a bad version is never newer", !isNewer("9.9.9-rc1", "1.0.0") && !isNewer("1.0.1", "dev"));

// ---------- rhythm ----------
const now = 1_800_000_000_000;
check("due with no earlier check", isDue(undefined, now) && isDue(null, now) && isDue("123", now) && isDue(NaN, now));
check("not due within three days", !isDue(now - CHECK_INTERVAL_MS + 60_000, now) && !isDue(now, now));
check("due after three days", isDue(now - CHECK_INTERVAL_MS, now));
check("due when the clock went backwards", isDue(now + 60_000, now));

// ---------- release page ----------
const own = `https://github.com/${REPO}/releases/tag/v2.3.4`;
check("this project's release page is used", releasePageFor(own) === own);
for (const foreign of [
  "https://github.com/someone/else/releases/tag/v9.9.9",
  `https://github.com/${REPO}.evil/releases`,
  `http://github.com/${REPO}/releases/tag/v2.3.4`,
  `https://example.com/https://github.com/${REPO}/`,
  42,
])
  check(`a foreign or bad link is replaced: ${JSON.stringify(foreign)}`, releasePageFor(foreign) === RELEASES_URL);

// ---------- the request ----------
const answer = (status, body) => ({ status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const run = async (respond, isOnline = () => true) => {
  const calls = [];
  const fake = (url, init) => {
    calls.push({ url, init });
    return respond(url, init);
  };
  try {
    return { release: await fetchLatestRelease(fake, isOnline), calls };
  } catch (e) {
    return { error: e, calls };
  }
};

{
  const { release, calls } = await run(async () =>
    answer(200, { tag_name: "v2.3.4", html_url: own, name: "2.3.4", body: "notes", assets: [] }),
  );
  check("a good answer gives the version and the page", release?.version === "2.3.4" && release?.url === own, JSON.stringify(release));
  check("one request", calls.length === 1);
  const { url, init } = calls[0];
  check("request goes only to the API address", url === `https://api.github.com/repos/${REPO}/releases/latest`, url);
  check(
    "GET without credentials, cache or referrer",
    init.method === "GET" && init.credentials === "omit" && init.cache === "no-store" && init.referrerPolicy === "no-referrer",
  );
  const headerNames = Object.keys(init.headers || {}).map((h) => h.toLowerCase());
  check("only the Accept header is set", headerNames.length === 1 && headerNames[0] === "accept", headerNames.join(","));
  check("the request has no body", init.body === undefined);
}
{
  const { release } = await run(async () =>
    answer(200, { tag_name: "1.2.0", html_url: "https://github.com/other/repo/releases/tag/1.2.0" }),
  );
  check("a foreign html_url falls back to the releases page", release?.url === RELEASES_URL && release?.version === "1.2.0");
}

const expectError = async (label, respond, kind, isOnline) => {
  const { release, error } = await run(respond, isOnline);
  check(label, !release && error?.kind === kind, release ? `gave ${JSON.stringify(release)}` : `${error?.kind}: ${error?.message}`);
};
await expectError("404 is an error", async () => answer(404, { message: "Not Found" }), "status");
await expectError("500 is an error", async () => answer(500, "oops"), "status");
await expectError("403 is the request limit", async () => answer(403, { message: "API rate limit exceeded" }), "limit");
await expectError("429 is the request limit", async () => answer(429, ""), "limit");

// ---------- the fallback on the request limit ----------
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main/package.json`;
const limited = (fallback) => async (url, init) =>
  url === API ? answer(403, { message: "API rate limit exceeded" }) : fallback(url, init);
{
  const { release, calls } = await run(limited(async () => answer(200, { name: "x", version: "1.0.2" })));
  check(
    "403: the version comes from the project's package.json",
    release?.version === "1.0.2" && release?.url === RELEASES_URL,
    JSON.stringify(release),
  );
  check(
    "403: the second request goes only to the fixed raw address",
    calls.length === 2 && calls[1].url === RAW,
    calls.map((c) => c.url).join(" "),
  );
  const init = calls[1]?.init || {};
  check(
    "403: the second request has no credentials and no headers",
    init.method === "GET" && init.credentials === "omit" && Object.keys(init.headers || {}).length === 0 && init.body === undefined,
  );
}
{
  const { calls } = await run(async () => answer(404, { message: "Not Found" }));
  check("no second request for any other refusal than the limit", calls.length === 1);
}
await expectError(
  "403 and the fallback answers 404: still the limit",
  limited(async () => answer(404, "")),
  "limit",
);
await expectError(
  "403 and a pre-release version in package.json: still the limit",
  limited(async () => answer(200, { version: "1.1.0-beta" })),
  "limit",
);
await expectError(
  "403 and no version in package.json: still the limit",
  limited(async () => answer(200, { name: "x" })),
  "limit",
);
await expectError(
  "403 and the fallback is unreachable: still the limit",
  limited(async () => {
    throw new TypeError("Failed to fetch");
  }),
  "limit",
);
await expectError("bad JSON is an error", async () => answer(200, "<html>"), "answer");
await expectError("JSON null is an error", async () => answer(200, "null"), "answer");
await expectError("no tag_name is an error", async () => answer(200, { name: "1.0.1" }), "answer");
await expectError("a pre-release tag is an error", async () => answer(200, { tag_name: "v1.1.0-beta" }), "answer");
await expectError("an oversized answer is an error", async () => answer(200, "x".repeat(1024 * 1024 + 1)), "answer");
await expectError(
  "an unreadable body is an error",
  async () => ({
    status: 200,
    text: async () => {
      throw new Error("stream");
    },
  }),
  "answer",
);
await expectError(
  "a network error while offline",
  async () => {
    throw new TypeError("Failed to fetch");
  },
  "offline",
  () => false,
);
await expectError(
  "a network error while online",
  async () => {
    throw new TypeError("Failed to fetch");
  },
  "unreachable",
  () => true,
);

// Timeout: setTimeout is shortened for this one case so the check doesn't
// wait the real ten seconds.
{
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => realSetTimeout(fn, 5);
  try {
    await expectError(
      "no answer in time is a timeout",
      (url, init) =>
        new Promise((resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      "timeout",
    );
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll update-check checks passed.");
process.exit(failures ? 1 : 0);
