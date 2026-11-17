#!/usr/bin/env node
// Standalone dev-only check (not shipped). Exercises scriptAssistant.ts and
// elevenlabs.ts against a fake `fetch` — no network, no API keys, nothing
// billed — and checks the exact requests the official SDKs build:
//   - OpenAI goes through the Responses API, sends `temperature` only to the
//     old gpt-4/3.5 families, never stores the script (`store: false`), and
//     the default model pick skips codex/-pro/search/deep-research;
//   - Claude goes through Messages, and its text is read past a leading
//     thinking block (Claude 5 models think by default);
//   - ElevenLabs eleven_v4 sends only stability + similarity, eleven_v3 only
//     stability, v2 the full voice_settings, and request-stitching context and the
//     `character-cost` header come through;
//   - for OpenAI and Claude, environment variables of the host application
//     (another key, address, extra headers, an organization or project)
//     change neither the model list nor the rewrite request.
// Re-run after any SDK update. Exits 1 if any check fails.
//
// Usage (from the project root):  node scripts/check-api-requests.mjs
import fs from "node:fs";
import os from "node:os";
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

// The panel's own Node shim (src/js/lib/cep/node.ts) only hands out real
// modules when window.cep exists, and a dependency reads navigator.
Object.defineProperty(globalThis, "navigator", {
  value: { appVersion: "MacIntel", userAgent: "Macintosh", platform: "MacIntel" },
  configurable: true,
});
globalThis.window = { cep: {}, require: (m) => req(m) };

const bundle = async (entry) => {
  const out = path.join(ROOT, "scripts", `.tmp-api-check-${Date.now()}-${path.basename(entry, ".ts")}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(ROOT, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: out,
    logLevel: "silent",
  });
  try {
    return req(out);
  } finally {
    fs.unlinkSync(out);
  }
};

const calls = [];
const json = (o, headers = {}) =>
  new Response(JSON.stringify(o), { status: 200, headers: { "content-type": "application/json", ...headers } });
globalThis.fetch = async (url, init) => {
  const u = String(url);
  const body = init && typeof init.body === "string" ? JSON.parse(init.body) : null;
  calls.push({
    url: u.replace(/^https:\/\/[^/]+/, ""),
    host: (u.match(/^https?:\/\/[^/]+/) || [""])[0],
    headers: new Headers(init && init.headers),
    body,
  });
  if (u.includes("/v1/models") && u.includes("openai")) {
    return json({
      object: "list",
      data: [
        { id: "gpt-live-1", created: 301, object: "model" },
        { id: "gpt-5.6-sol", created: 300, object: "model" },
        { id: "gpt-5.3-codex-mini", created: 299, object: "model" },
        { id: "gpt-5.5-pro", created: 298, object: "model" },
        { id: "gpt-5-search-api-mini", created: 297, object: "model" },
        { id: "o3-deep-research", created: 296, object: "model" },
        { id: "gpt-realtime-mini", created: 295, object: "model" },
        { id: "gpt-5.6-luna", created: 290, object: "model" },
        { id: "gpt-4o-mini", created: 100, object: "model" },
      ],
    });
  }
  if (u.includes("/v1/models") && u.includes("anthropic")) {
    return json({
      data: [{ type: "model", id: "claude-haiku-5-5", display_name: "Claude Haiku 5.5", created_at: "2026-01-01T00:00:00Z" }],
      has_more: false,
      first_id: "claude-haiku-5-5",
      last_id: "claude-haiku-5-5",
    });
  }
  if (u.includes("/v1/responses")) {
    const cutOff = String(body.input).includes("CUT_OFF");
    return json({
      id: "resp_1",
      object: "response",
      created_at: 1,
      status: cutOff ? "incomplete" : "completed",
      ...(cutOff ? { incomplete_details: { reason: "max_output_tokens" } } : {}),
      model: body.model,
      output: [
        {
          type: "message",
          id: "m1",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "  Rewritten.  ", annotations: [] }],
        },
      ],
    });
  }
  if (u.includes("/v1/messages")) {
    return json({
      id: "msg_1",
      type: "message",
      role: "assistant",
      model: body.model,
      content: [
        // Claude 5 models think by default: the reply starts with a thinking block.
        ...(String(body.model).includes("-5-") ? [{ type: "thinking", thinking: "", signature: "sig" }] : []),
        { type: "text", text: "Claude text." },
      ],
      stop_reason: String(body.messages[0].content).includes("CUT_OFF")
        ? "max_tokens"
        : String(body.messages[0].content).includes("REFUSE")
          ? "refusal"
          : "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
  }
  if (u.includes("/v1/text-to-speech/")) {
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "audio/mpeg", "character-cost": "12" } });
  }
  return new Response("not found", { status: 404 });
};

// --- Script assistant ---
const assistant = await bundle("src/js/lib/scriptAssistant.ts");
const models = await assistant.listOpenAiModels("sk-test");
const ids = models.map((m) => m.id);
check(
  "OpenAI list drops realtime, live and deep-research models",
  !ids.includes("gpt-realtime-mini") && !ids.includes("gpt-live-1") && !ids.includes("o3-deep-research"),
  ids.join(", "),
);
const picked = assistant.pickDefaultModel(models, "openai");
check("OpenAI default pick is the cheap general model", picked === "gpt-5.6-luna", picked);
check("OpenAI empty-list fallback", assistant.pickDefaultModel([], "openai") === "gpt-6-luna");
for (const [id, wantTemp] of [
  ["gpt-5.6-luna", false],
  ["gpt-5.3-codex-mini", false],
  ["gpt-4o-mini", true],
]) {
  calls.length = 0;
  const out = await assistant.improveScript("openai", "sk-test", "hello world", "plain", "natural", id);
  const c = calls[0];
  check(`OpenAI ${id}: Responses API`, c.url === "/v1/responses", c.url);
  check(`OpenAI ${id}: temperature ${wantTemp ? "sent" : "omitted"}`, "temperature" in c.body === wantTemp);
  check(
    `OpenAI ${id}: store=false, instructions, input`,
    c.body.store === false && typeof c.body.instructions === "string" && c.body.input === "hello world",
  );
  check(`OpenAI ${id}: output text trimmed`, out === "Rewritten.", JSON.stringify(out));
}
calls.length = 0;
const claudeOut = await assistant.improveScript("claude", "sk-ant-test", "hello", "v4-tags", "natural", "claude-haiku-4-5-20251001");
check("Claude: Messages API", calls[0].url === "/v1/messages" && claudeOut === "Claude text.");
check("Claude: v4 prompt used for v4-tags", /"v4"/.test(calls[0].body.system));
calls.length = 0;
const thinkingOut = await assistant.improveScript("claude", "sk-ant-test", "hello", "plain", "natural", "claude-haiku-5-5");
check("Claude 5: text read past the leading thinking block", thinkingOut === "Claude text.", JSON.stringify(thinkingOut));
check("Claude 5: max_tokens leaves room for thinking", calls[0].body.max_tokens === 16000, String(calls[0].body.max_tokens));
check("Claude empty-list fallback", assistant.pickDefaultModel([], "claude") === "claude-haiku-5-5");
const rejection = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
};
const openAiCut = await rejection(() =>
  assistant.improveScript("openai", "sk-test", "long text CUT_OFF", "plain", "natural", "gpt-5.6-luna"),
);
check("OpenAI: an incomplete rewrite is refused, not returned", openAiCut === assistant.SCRIPT_REWRITE_INCOMPLETE, String(openAiCut));
const claudeCut = await rejection(() =>
  assistant.improveScript("claude", "sk-ant-test", "long text CUT_OFF", "plain", "natural", "claude-haiku-4-5-20251001"),
);
check("Claude: a rewrite cut at max_tokens is refused, not returned", claudeCut === assistant.SCRIPT_REWRITE_INCOMPLETE, String(claudeCut));
const claudeRefused = await rejection(() =>
  assistant.improveScript("claude", "sk-ant-test", "text REFUSE", "plain", "natural", "claude-haiku-5-5"),
);
check("Claude: a refusal keeps the user's text", claudeRefused === assistant.SCRIPT_REWRITE_NOT_FINISHED_CLAUDE, String(claudeRefused));

// Environment variables the SDKs would otherwise read: the panel's key stays
// the only credential, sent to the provider's own address, for the model list
// and the rewrite alike (scriptAssistant.ts's withProviderEnvHidden).
const ENV = {
  OPENAI_API_KEY: "env-key",
  OPENAI_BASE_URL: "https://proxy.invalid/v1",
  OPENAI_CUSTOM_HEADERS: "Authorization: Bearer env-key\nX-From-Env: 1",
  OPENAI_ORG_ID: "org-from-env",
  OPENAI_PROJECT_ID: "proj_from_env",
  ANTHROPIC_API_KEY: "env-key",
  ANTHROPIC_AUTH_TOKEN: "env-token",
  ANTHROPIC_BASE_URL: "https://proxy.invalid",
  ANTHROPIC_CUSTOM_HEADERS: "Authorization: Bearer env-key\nX-From-Env: 1",
};
Object.assign(process.env, ENV);
try {
  for (const [provider, key, host, model] of [
    ["openai", "sk-test", "https://api.openai.com", "gpt-5.6-luna"],
    ["claude", "sk-ant-test", "https://api.anthropic.com", "claude-haiku-5-5"],
  ]) {
    calls.length = 0;
    const failed = await rejection(async () => {
      await (provider === "openai" ? assistant.listOpenAiModels(key) : assistant.listAnthropicModels(key));
      await assistant.improveScript(provider, key, "hello", "plain", "natural", model);
    });
    const clean =
      !failed &&
      calls.length === 2 &&
      calls.every(
        (c) =>
          c.host === host &&
          c.headers.get("authorization") === `Bearer ${key}` &&
          !c.headers.has("x-from-env") &&
          !c.headers.has("x-api-key") &&
          !c.headers.has("openai-organization") &&
          !c.headers.has("openai-project"),
      );
    check(
      `${provider}: environment variables change neither the model list nor the rewrite request`,
      clean,
      failed || calls.map((c) => `${c.host}${c.url} ${c.headers.get("authorization")}`).join("; "),
    );
  }
  check(
    "environment variables are back after the clients were made",
    Object.entries(ENV).every(([k, v]) => process.env[k] === v),
  );
} finally {
  for (const k of Object.keys(ENV)) delete process.env[k];
}

// --- ElevenLabs ---
const eleven = await bundle("src/js/lib/elevenlabs.ts");
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "api-check-"));
try {
  calls.length = 0;
  const v4 = await eleven.generateSpeech(
    "xi-test",
    "voice123",
    "Voice",
    "Hello there.",
    "eleven_v4",
    { stability: 0.5, similarityBoost: 0.8 },
    tmpDir,
    "mp3_44100_128",
    "es",
    {
      previousText: "Before.",
      nextText: "After.",
    },
  );
  const b4 = calls[0].body;
  check("ElevenLabs v4: model id", b4.model_id === "eleven_v4");
  check(
    "ElevenLabs v4: only stability + similarity",
    JSON.stringify(Object.keys(b4.voice_settings).sort()) === '["similarity_boost","stability"]',
    JSON.stringify(b4.voice_settings),
  );
  check(
    "ElevenLabs v4: language code and stitching sent",
    b4.language_code === "es" && b4.previous_text === "Before." && b4.next_text === "After.",
  );
  check("ElevenLabs: character-cost header read", v4.characterCost === 12, String(v4.characterCost));

  calls.length = 0;
  await eleven.generateSpeech("xi-test", "voice123", "Voice", "Hello.", "eleven_v3", { stability: 0.45 }, tmpDir);
  check(
    "ElevenLabs v3: stability only",
    JSON.stringify(Object.keys(calls[0].body.voice_settings)) === '["stability"]',
    JSON.stringify(calls[0].body.voice_settings),
  );

  calls.length = 0;
  await eleven.generateSpeech(
    "xi-test",
    "voice123",
    "Voice",
    "Hello.",
    "eleven_multilingual_v2",
    { stability: 0.7, similarityBoost: 0.85, style: 0, speed: 1, useSpeakerBoost: true },
    tmpDir,
  );
  const b2 = calls[0].body;
  check(
    "ElevenLabs v2: full voice_settings",
    JSON.stringify(Object.keys(b2.voice_settings).sort()) === '["similarity_boost","speed","stability","style","use_speaker_boost"]',
    JSON.stringify(b2.voice_settings),
  );
  check(
    "ElevenLabs v2: no stitching or language unless asked",
    b2.previous_text == null && b2.next_text == null && b2.language_code == null,
    JSON.stringify({ p: b2.previous_text, n: b2.next_text, l: b2.language_code }),
  );
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
