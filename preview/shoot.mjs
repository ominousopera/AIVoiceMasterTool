// Dev-only: screenshots of the real panel UI in headless Chrome, with the
// host faked by shims.js. Usage (from the project root):
//   node preview/shoot.mjs [outDir] [shotName ...]   (default outDir: preview/out)
// Starts the preview Vite server, drives Chrome over the DevTools protocol,
// writes one PNG per shot, and prints any console errors the page logged.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const outDir = path.resolve(process.argv[2] || path.join(here, "out"));
const only = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

const CHROME =
  process.env.PREVIEW_CHROME ||
  path.join(
    os.homedir(),
    ".cache/puppeteer/chrome-headless-shell/mac_arm-150.0.7871.24/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  );
const BASE = "http://localhost:5199";
const WIDTH = Number(process.env.PREVIEW_WIDTH || 380);
// Tallest picture taken, in CSS pixels; a taller panel is cut off at the bottom.
const MAX_HEIGHT = Number(process.env.PREVIEW_MAX_HEIGHT || 4000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- shots ----------
// Each step is JS run in the page; helpers from HELPERS are available.
// A step "probe:<expr>" prints the expression's value instead of acting.
const SHOTS = [
  { name: "01-voice-engine", url: "/preview/index.html?clip=1", steps: [] },
  { name: "02-voice-elevenlabs", url: "/preview/index.html?clip=1", steps: ['clickText("ElevenLabs")'] },
  { name: "03-voice-kokoro", url: "/preview/index.html?clip=1", steps: ['clickText("Kokoro (offline)")'] },
  { name: "04-voice-batch", url: "/preview/index.html?clip=1", steps: ['clickText("ElevenLabs")', 'clickText("Batch")'] },
  { name: "05-cut-empty", url: "/preview/index.html?clip=1", steps: ["clickTab(1)"] },
  { name: "06-cut-scanned", url: "/preview/index.html?clip=1", steps: ["clickTab(1)", "clickMain(0)", "wait(900)"] },
  {
    name: "07-cut-advanced",
    url: "/preview/index.html?clip=1",
    steps: ["clickTab(1)", "clickMain(0)", "wait(900)", 'clickText("Advanced")'],
  },
  { name: "08-pacing", url: "/preview/index.html?clip=1", steps: ["clickTab(2)"] },
  { name: "09-send", url: "/preview/index.html?clip=1", steps: ["clickTab(3)"] },
  { name: "10-settings", url: "/preview/index.html?clip=1", steps: ["clickGear()"] },
  { name: "11-first-run", url: "/preview/index.html?firstrun=1", steps: [] },
  { name: "12-bridge", url: "/preview/bridge.html", steps: ["wait(600)"] },
  { name: "12b-bridge-sent", url: "/preview/bridge.html?sent=1", steps: ["wait(600)"] },
  {
    name: "14-cut-advanced-ru",
    url: "/preview/index.html?clip=1&lang=ru",
    steps: ["clickTab(1)", "clickMain(0)", "wait(900)", 'clickText("Расширенно")'],
  },
  { name: "15-pacing-ru", url: "/preview/index.html?clip=1&lang=ru", steps: ["clickTab(2)"] },
  { name: "16-settings-ru", url: "/preview/index.html?clip=1&lang=ru", steps: ["clickGear()"] },
  { name: "17-voice-es", url: "/preview/index.html?clip=1&lang=es", steps: ['clickText("ElevenLabs")'] },
  {
    name: "18-cut-advanced-es",
    url: "/preview/index.html?clip=1&lang=es",
    steps: ["clickTab(1)", "clickMain(0)", "wait(900)", 'clickText("Avanzado")'],
  },
  { name: "19-pacing-es", url: "/preview/index.html?clip=1&lang=es", steps: ["clickTab(2)"] },
  { name: "20-bridge-sent-ru", url: "/preview/bridge.html?sent=1&lang=ru", steps: ["wait(600)"] },
  {
    name: "21-voice-v4",
    url: "/preview/index.html?clip=1&key=1",
    steps: ['clickText("ElevenLabs")', 'clickText("v4 (newest)")', '__q("button.disclosure")[0].click()'],
  },
  {
    name: "22-voice-v4-ru",
    url: "/preview/index.html?clip=1&key=1&lang=ru",
    steps: ['clickText("ElevenLabs")', 'clickText("v4 (новейшая)")', '__q("button.disclosure")[0].click()'],
  },
  {
    name: "23-voice-v2-tips",
    url: "/preview/index.html?clip=1&key=1",
    steps: ['clickText("ElevenLabs")', '__q("button.disclosure")[0].click()'],
  },
  { name: "24-license", url: "/preview/index.html?clip=1", steps: ["clickGear()", 'clickText("License")'] },
  {
    name: "probe-network-guard",
    url: "/preview/index.html?clip=1",
    steps: [
      `probe:(async () => {
        const out = {};
        const tryFetch = async (u) => { try { await fetch(u); return "allowed"; } catch (e) { return "blocked: " + e.message; } };
        out.cdn = await tryFetch("https://cdn.jsdelivr.net/npm/x");
        out.hf = await tryFetch("https://huggingface.co/x");
        out.plainHttpToProvider = await tryFetch("http://api.openai.com/v1/models");
        try { const x = new XMLHttpRequest(); x.open("GET", "https://example.com/"); out.xhr = "allowed"; } catch (e) { out.xhr = "blocked: " + e.message; }
        try { new WebSocket("wss://example.com/"); out.ws = "allowed"; } catch (e) { out.ws = "blocked: " + e.message; }
        out.beacon = navigator.sendBeacon("https://example.com/b", "x") ? "sent" : "blocked";
        out.localPreviewServer = await tryFetch("/preview/index.html");
        out.wsStatics = [WebSocket.CONNECTING, WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED].join(",");
        out.esStatics = [EventSource.CONNECTING, EventSource.OPEN, EventSource.CLOSED].join(",");
        out.appRendered = !!document.querySelector("#app > *");
        return out;
      })()`,
    ],
  },
  { name: "13-voice-ru", url: "/preview/index.html?clip=1&lang=ru", steps: ['clickText("ElevenLabs")'] },
  { name: "25-pacing-natural", url: "/preview/index.html?clip=1", steps: ["clickTab(2)", 'clickText("Natural")'] },
  { name: "26-pacing-natural-ru", url: "/preview/index.html?clip=1&lang=ru", steps: ["clickTab(2)", 'clickText("Естественно")'] },
  { name: "27-pacing-natural-es", url: "/preview/index.html?clip=1&lang=es", steps: ["clickTab(2)", 'clickText("Natural")'] },
];

const HELPERS = `
  window.__q = (sel) => Array.from(document.querySelectorAll(sel));
  window.clickText = (text) => {
    const el = __q("button, label, [role=tab], .tab").find(
      (b) => b.textContent.trim().toLowerCase() === text.toLowerCase()
    );
    if (!el) throw new Error("no element with text " + text);
    el.click();
  };
  window.clickTab = (i) => {
    const tabs = __q("nav.tabs button");
    if (!tabs[i]) throw new Error("no tab " + i);
    tabs[i].click();
  };
  window.clickMain = (i) => {
    const b = __q("button.primary")[i];
    if (!b) throw new Error("no main button " + i);
    b.click();
  };
  window.clickGear = () => {
    const b = document.querySelector("button[aria-label='Diagnostics & feedback'], .icon-btn");
    if (!b) throw new Error("no gear");
    b.click();
  };
  window.wait = () => {};
`;

// ---------- infra ----------
const waitFor = async (fn, ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {}
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await sleep(200);
  }
};

const vite = spawn(path.join(ROOT, "node_modules/.bin/vite"), ["--config", "preview/vite.preview.config.ts"], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
});
vite.stderr.on("data", (d) => process.stderr.write("[vite] " + d));
await waitFor(async () => (await fetch(BASE + "/preview/index.html")).ok);

const port = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "preview-chrome-"));
const chrome = spawn(
  CHROME,
  [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--hide-scrollbars", "about:blank"],
  { stdio: "ignore" },
);

const target = await waitFor(async () => {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  return list.find((t) => t.type === "page");
});

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let seq = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method === "Runtime.exceptionThrown") {
    logs.push("EXCEPTION " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
  } else if (msg.method === "Runtime.consoleAPICalled" && (msg.params.type === "error" || msg.params.type === "warning")) {
    logs.push(msg.params.type.toUpperCase() + " " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
  } else if (msg.method === "Fetch.requestPaused") {
    proxyRequest(msg.params).catch((e) => logs.push("PROXY " + e.message));
  }
});

// The browser never opens a socket to the preview server itself: every
// request for BASE is intercepted and answered by this Node process, which
// fetches it from Vite. A firewall that asks about (or blocks) the headless
// browser connecting to localhost then has nothing to ask about.
const proxyRequest = async ({ requestId, request }) => {
  const headers = { ...request.headers };
  delete headers["Accept-Encoding"];
  delete headers["accept-encoding"];
  const res = await fetch(request.url, { method: request.method, headers, body: request.postData });
  const body = Buffer.from(await res.arrayBuffer());
  const responseHeaders = [];
  res.headers.forEach((value, name) => {
    if (name !== "content-encoding" && name !== "content-length") responseHeaders.push({ name, value });
  });
  await send("Fetch.fulfillRequest", { requestId, responseCode: res.status, responseHeaders, body: body.toString("base64") });
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

await send("Fetch.enable", { patterns: [{ urlPattern: BASE + "/*", requestStage: "Request" }] });
await send("Page.enable");
await send("Runtime.enable");

for (const shot of SHOTS) {
  if (only.length && !only.some((o) => shot.name.includes(o))) continue;
  logs.length = 0;
  await send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: 900, deviceScaleFactor: 2, mobile: false });
  await send("Page.navigate", { url: BASE + shot.url });
  try {
    await waitFor(() => evaluate("document.readyState === 'complete' && !!document.querySelector('#app > *')"));
  } catch (e) {
    // The panel never rendered: show what the page logged, then stop.
    console.log(`${shot.name}: panel did not render`);
    for (const l of logs) console.log("   ", l.slice(0, 600));
    try {
      console.log(
        "   ",
        JSON.stringify(
          await evaluate(
            `({ href: location.href, ready: document.readyState, app: (document.querySelector('#app') || {}).innerHTML?.slice(0, 200), scripts: performance.getEntriesByType('resource').map((r) => r.name.replace(location.origin, '') + ' ' + Math.round(r.duration) + 'ms').slice(-8) })`,
          ),
        ),
      );
    } catch (e2) {
      console.log("    (page state unavailable:", e2.message + ")");
    }
    throw e;
  }
  await sleep(700);
  await evaluate(HELPERS);
  for (const step of shot.steps) {
    const m = /^wait\((\d+)\)$/.exec(step);
    if (m) await sleep(Number(m[1]));
    else if (step.startsWith("probe:")) console.log("    probe", JSON.stringify(await evaluate(step.slice(6))));
    else {
      await evaluate(step);
      await sleep(350);
    }
  }
  await sleep(300);
  // The panel scrolls inside its own container (a docked panel has a fixed
  // height); for a full-length picture, let every container grow instead.
  await evaluate(`(() => {
    const s = document.createElement("style");
    s.textContent = "html, body, #app, .app { height: auto !important; min-height: 0 !important; overflow: visible !important; }" +
      ".panel-body { overflow: visible !important; flex: none !important; height: auto !important; }";
    document.head.appendChild(s);
  })()`);
  await sleep(200);
  const h = await evaluate("Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)");
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: Math.min(Math.max(h, 600), MAX_HEIGHT),
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(250);
  const shotRes = await send("Page.captureScreenshot", { format: "png" });
  const file = path.join(outDir, shot.name + ".png");
  fs.writeFileSync(file, Buffer.from(shotRes.data, "base64"));
  console.log("wrote", path.relative(process.cwd(), file), `(${WIDTH}x${h})`);
  for (const l of logs) console.log("   ", l.slice(0, 300));
}

ws.close();
const chromeExited = new Promise((r) => chrome.once("exit", r));
chrome.kill();
vite.kill();
await Promise.race([chromeExited, sleep(3000)]);
fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
process.exit(0);
