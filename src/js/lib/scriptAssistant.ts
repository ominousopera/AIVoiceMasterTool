import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// Built on both providers' official SDKs (`openai`, `@anthropic-ai/sdk`).
// Both refuse to run in a browser-like environment by default (this panel's
// CEP webview is Chromium) unless `dangerouslyAllowBrowser` is set; this
// panel calls the APIs directly with the user's own key, so the flag is set.

// Both SDKs also take settings from the host application's environment
// variables: another address (OPENAI_BASE_URL, ANTHROPIC_BASE_URL), extra
// headers that can replace the key (OPENAI_CUSTOM_HEADERS,
// ANTHROPIC_CUSTOM_HEADERS), an organization or project (OPENAI_ORG_ID,
// OPENAI_PROJECT_ID). A request from this panel goes to the provider's own
// address with only the key entered in the panel, so every client is made by
// the two functions below: the address is given explicitly, and the
// provider's variables are hidden while the client is made, which is the only
// time the SDKs read them.
const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const ANTHROPIC_API_BASE_URL = "https://api.anthropic.com";

/** Runs `make` with every environment variable whose name starts with
 *  `prefix` (any letter case: Windows names are case-insensitive) removed,
 *  and puts them back afterwards. Synchronous, so no other code of this
 *  panel runs in between. */
const withProviderEnvHidden = <T>(prefix: string, make: () => T): T => {
  const env = typeof process !== "undefined" && process && process.env ? process.env : null;
  const hidden: Record<string, string> = {};
  if (env) {
    for (const name of Object.keys(env)) {
      if (name.toUpperCase().indexOf(prefix) !== 0) continue;
      const value = env[name];
      if (typeof value === "string") hidden[name] = value;
      delete env[name];
    }
  }
  try {
    return make();
  } finally {
    if (env) for (const name of Object.keys(hidden)) env[name] = hidden[name];
  }
};

const createOpenAiClient = (apiKey: string, maxRetries?: number): OpenAI =>
  withProviderEnvHidden(
    "OPENAI_",
    () =>
      new OpenAI({
        apiKey,
        baseURL: OPENAI_API_BASE_URL,
        organization: null,
        project: null,
        dangerouslyAllowBrowser: true,
        maxRetries,
      }),
  );

const createAnthropicClient = (apiKey: string, maxRetries?: number): Anthropic =>
  withProviderEnvHidden(
    "ANTHROPIC_",
    () => new Anthropic({ apiKey, baseURL: ANTHROPIC_API_BASE_URL, dangerouslyAllowBrowser: true, maxRetries }),
  );

// Output styles, matched to which ElevenLabs model the user has selected
// (see main.tsx's ELEVEN_TTS_MODEL_IDS) — sending bracket tags to the v2
// model (or vice versa) silently degrades the read, since neither model
// understands the other's markup and just speaks it aloud as literal text.
// v4 gets its own style rather than reusing v3's: its documented tag set is
// wider (plain-language delivery directions, tags followed in sequence) and
// v3's first/last-syllable guard is a v3 quirk nobody has reported for v4.
export type ScriptStyle = "plain" | "v3-tags" | "v4-tags";

// Three intensity levels: how much the rewrite may do beyond bare pacing. Some
// users want only pacing and pauses handled (no unexpected tags or rewording),
// others the fuller expressive treatment. "expressive" differs from "natural"
// only for the tag-aware models (more tags, used more freely); v2 has no tag
// mechanism, so its "expressive" is identical to "natural" (see promptFor) and
// the UI hides the option there.
export type ScriptIntensity = "pacing" | "natural" | "expressive";

// "plain" — for eleven_multilingual_v2 (and Kokoro, which shares this same
// Improve step). No tags/markup of any kind, since v2 doesn't understand
// them. Pacing works entirely through punctuation.
const PLAIN_BASE =
  "You improve narration scripts that will be read aloud by a text-to-speech voice engine. " +
  "Preserve the original meaning, language, and roughly the original length. Do not add stage " +
  "directions, emotion labels, brackets, or SSML/markup tags of any kind — the target voice " +
  "engine reads them aloud as literal text instead of interpreting them. Reply with only the " +
  "rewritten script text, no preamble, no quotation marks, no commentary.";

const PLAIN_PACING =
  PLAIN_BASE +
  " Only adjust punctuation for pacing: commas, periods, ellipses for a pause, paragraph " +
  "breaks. Do not rewrite phrasing or wording beyond the minimum needed to fix a run-on " +
  "sentence — keep the user's own word choices as close to untouched as possible.";

const PLAIN_NATURAL =
  PLAIN_BASE +
  " Rewrite the text for clearer, more natural spoken delivery: fix awkward phrasing, split " +
  "run-on sentences, and use real punctuation (commas, periods, ellipses, paragraph breaks) " +
  "to guide pacing.";

// "v3-tags" — for eleven_v3, based on ElevenLabs' published v3 guidance
// (elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices and
// elevenlabs.io/blog/eleven-v3-audio-tags-expressing-emotional-context-in-speech).
// v3 has no `[pause:Xms]` millisecond tag and no SSML phoneme tags, though both
// are sometimes claimed; the prompt warns against them. Single-voice generation
// only: ElevenLabs' multi-speaker "Text to Dialogue" API isn't used, so no
// [speaker_N] convention.
const V3_BASE =
  'You improve narration scripts for ElevenLabs\' expressive "v3" text-to-speech model. ' +
  "Rewrite the user's text to sound like a real vocal performance rather than a flat read, " +
  "while preserving the original meaning, language, and roughly the original length.\n\n" +
  'Punctuation is v3\'s primary timing mechanism, not a tag: ellipses ("...") add a pause ' +
  "and weight; CAPS adds emphasis; normal comma/period rhythm still applies. v3 does not " +
  "support SSML <break> tags — never use them, and never invent a bracket syntax with a " +
  "numeric duration like [pause:200ms] — that isn't real v3 syntax and would just be read " +
  "aloud as literal text. The only real pause tags are the plain [pause], [short pause], and " +
  "[long pause] — no duration argument.\n\n" +
  "Guard against v3 clipping the very first or last syllable of the whole performance (an " +
  "observed real-world quirk, not officially documented by ElevenLabs, but cheap to guard " +
  "against): open the very first line with a [short pause] and close the very last line with " +
  "a [short pause], once each, not on every internal line.\n\n" +
  "Native inline IPA for words the model will likely mispronounce (invented names, foreign " +
  "words, uncommon brand names): wrap the IPA transcription directly in forward slashes " +
  'right where the word appears, e.g. "Nice to meet you, /ʃaʊˈdeɪ/." Include stress marks ' +
  "(ˈ primary, ˌ secondary). Only for words that actually need it, never as a blanket pass. " +
  "This is v3's own native pronunciation syntax, not an SSML phoneme tag.\n\n" +
  "Do not add multi-speaker labels (this tool generates one voice at a time). Reply with " +
  "only the rewritten script text — no preamble, no headers, no quotation marks, no " +
  "commentary.";

const V3_PACING =
  V3_BASE +
  "\n\nFor this pass, use only punctuation and the plain pause tags ([pause], [short pause], " +
  "[long pause]) placed where a natural breath or beat belongs. Do not add any emotional, " +
  "reaction, or tone tag of any kind — no [excited], [whispers], [sighs], [laughs], or " +
  "similar. The goal here is natural pacing and breathing, nothing more expressive than that.";

const V3_NATURAL =
  V3_BASE +
  "\n\nBracketed audio tags, placed inline right before the words they affect, at genuine " +
  "emotional shifts (not every sentence): emotional state ([excited], [nervous], " +
  "[frustrated], [sorrowful], [calm]), reactions ([sigh], [laughs], [gulps], [gasps], " +
  "[whispers]), delivery/cognitive beats ([pauses], [hesitates], [stammers], [resigned " +
  "tone]), and tone ([cheerfully], [flatly], [deadpan], [playfully]). Tags may be combined " +
  "or sequenced across an emotional arc (e.g. \"[hesitant] I... I didn't mean to say that. " +
  '[regretful] It just came out."), but never stack more than 2 on one line, and never ' +
  "combine contradictory tags (e.g. [whispers][excited]). Match tags to what the selected " +
  "voice could plausibly deliver — per ElevenLabs' own guidance, don't expect a calm/quiet " +
  "voice to suddenly shout convincingly just because a [shout] tag is present; keep tags " +
  "within the voice's own natural range.";

const V3_EXPRESSIVE =
  V3_BASE +
  "\n\nUse the full range of bracketed audio tags liberally wherever the performance calls " +
  "for it: emotional state ([excited], [nervous], [frustrated], [sorrowful], [calm]), " +
  "reactions ([sigh], [laughs], [gulps], [gasps], [whispers]), delivery/cognitive beats " +
  "([pauses], [hesitates], [stammers], [resigned tone]), and tone ([cheerfully], [flatly], " +
  "[deadpan], [playfully]). Lean into non-verbal reactions whenever the text plausibly " +
  "implies them, not just at the strongest moments — this pass should read as a full " +
  "dramatic performance. Up to 3 tags may layer together at a genuine emotional peak, but " +
  "never combine contradictory tags (e.g. [whispers][excited]). Match tags to what the " +
  "selected voice could plausibly deliver — per ElevenLabs' own guidance, don't expect a " +
  "calm/quiet voice to suddenly shout convincingly just because a [shout] tag is present; " +
  "keep tags within the voice's own natural range.";

// "v4-tags" — for eleven_v4, based on ElevenLabs' v4 material:
// elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices
// ("Eleven v4 and Eleven v3 do not support SSML break tags"; pauses via
// ellipses, punctuation and text structure; IPA "wrapped in forward slashes"),
// elevenlabs.io/v4 (inline [pause]/[long pause]/[whispers]/[excited]; tag
// sequences followed "more reliably than v3") and the v4 launch post
// (plain-language directions such as [said angrily in French accent],
// [excited, happy]; stacked tags followed in order; sound-effect tags).
const V4_BASE =
  'You improve narration scripts for ElevenLabs\' expressive "v4" text-to-speech model. ' +
  "Rewrite the user's text to sound like a real vocal performance rather than a flat read, " +
  "while preserving the original meaning, language, and roughly the original length.\n\n" +
  'Punctuation and text structure are v4\'s main timing tools: ellipses ("...") add a pause ' +
  "and weight, CAPS adds emphasis, paragraph breaks separate thoughts. v4 does not support " +
  "SSML — never use <break> or any other XML-style tag. The only pause tags are the plain " +
  "[pause] and [long pause], with no duration argument; never invent a syntax like " +
  "[pause:200ms], which would be read aloud as literal text.\n\n" +
  "Native inline IPA for words the model will likely mispronounce (invented names, foreign " +
  "words, uncommon brand names): wrap the IPA transcription directly in forward slashes " +
  'right where the word appears, e.g. "Nice to meet you, /ʃaʊˈdeɪ/." Include stress marks ' +
  "(ˈ primary, ˌ secondary). Only for words that actually need it, never as a blanket pass.\n\n" +
  "Do not add multi-speaker labels (this tool generates one voice at a time). Reply with " +
  "only the rewritten script text — no preamble, no headers, no quotation marks, no " +
  "commentary.";

const V4_PACING =
  V4_BASE +
  "\n\nFor this pass, use only punctuation and the plain [pause] / [long pause] tags, placed " +
  "where a natural breath or beat belongs. Do not add any emotional, reaction, delivery or " +
  "sound-effect tag of any kind. The goal here is natural pacing and breathing, nothing more " +
  "expressive than that.";

const V4_NATURAL =
  V4_BASE +
  "\n\nBracketed audio tags, placed inline right before the words they affect, at genuine " +
  "emotional shifts (not every sentence). Besides single-word tags — emotional state " +
  "([excited], [nervous], [sarcastic], [calm]) and reactions ([laughs], [sighs], " +
  "[whispers]) — v4 understands short delivery directions written in plain words, e.g. " +
  "[said warmly], [excited, happy], [quietly, almost to herself]. At most 2 tags together; " +
  "v4 follows them in the order written. Never combine contradictory directions (e.g. " +
  "[whispers][shouting]). Keep every direction within what the selected voice could " +
  "plausibly deliver. No sound-effect tags.";

const V4_EXPRESSIVE =
  V4_BASE +
  "\n\nUse bracketed audio tags liberally wherever the performance calls for it: emotional " +
  "state ([excited], [nervous], [sarcastic], [calm]), reactions ([laughs], [sighs], " +
  "[whispers], [gasps]) and short plain-language delivery directions ([said warmly], " +
  "[excited, happy], [quietly, almost to herself]). Lean into non-verbal reactions whenever " +
  "the text plausibly implies them — this pass should read as a full dramatic performance. " +
  "Up to 3 tags may follow one another at a genuine emotional peak; v4 performs them in the " +
  "order written. Never combine contradictory directions. A sound-effect tag (e.g. " +
  "[applause], [phone buzzing]) only where the script itself describes that sound. Keep " +
  "every direction within what the selected voice could plausibly deliver.";

const promptFor = (style: ScriptStyle, intensity: ScriptIntensity): string => {
  if (style === "v4-tags") {
    if (intensity === "pacing") return V4_PACING;
    if (intensity === "expressive") return V4_EXPRESSIVE;
    return V4_NATURAL;
  }
  if (style === "v3-tags") {
    if (intensity === "pacing") return V3_PACING;
    if (intensity === "expressive") return V3_EXPRESSIVE;
    return V3_NATURAL;
  }
  // v2 and Kokoro have no tag mechanism, so "expressive" has no extra lever
  // beyond "natural" and deliberately aliases to the same prompt. The UI
  // shows the Expressive option only for ElevenLabs v3 and v4.
  return intensity === "pacing" ? PLAIN_PACING : PLAIN_NATURAL;
};

export type AssistantProvider = "openai" | "claude";

export interface ModelOption {
  id: string;
  /** Display label — usually just `id`, but Anthropic's own API returns a
   *  separate human-readable display_name that reads better in a picker. */
  label: string;
}

// Small, fast, inexpensive models: this is a one-shot text-editing pass, not
// a task that benefits from a larger flagship model. Used only as the
// last-resort fallback if the live model-list fetch fails (network error,
// stale key); normally the panel lists the providers' current models, since
// a hardcoded ID goes stale within months.
const OPENAI_FALLBACK_MODEL_ID = "gpt-6-luna";
const ANTHROPIC_FALLBACK_MODEL_ID = "claude-haiku-5-5";

/** True for an OpenAI model id that's actually a text-generation-capable
 *  text model — GET /v1/models returns *everything* the account can see
 *  (embeddings, whisper, dall-e, tts, moderation, realtime, image models,
 *  fine-tune base snapshots), none of which can do the text-in/text-out
 *  call improveWithOpenAi makes below. Allowlist by known chat-family
 *  prefixes rather than a denylist — a denylist silently lets through
 *  whatever new non-chat family OpenAI ships next. */
const isOpenAiChatModel = (id: string): boolean => {
  const lower = id.toLowerCase();
  const chatPrefixes = ["gpt-", "chatgpt-", "o1", "o3", "o4"];
  for (let i = 0; i < chatPrefixes.length; i++) {
    if (lower.indexOf(chatPrefixes[i]) === 0) {
      // Exclude non-chat siblings that share the "gpt-" prefix (audio, realtime,
      // image, transcribe, tts). "search" is not excluded:
      // gpt-4o-search-preview/gpt-4o-mini-search-preview are chat-completions
      // models. "tts" must be excluded, or gpt-4o-mini-tts (it contains "mini")
      // would be picked as the default by pickDefaultModel below.
      if (lower.indexOf("audio") !== -1) return false;
      if (lower.indexOf("realtime") !== -1) return false;
      // gpt-live-* are voice-conversation models (OpenAI lists them with the
      // Realtime models); the Responses API that improveWithOpenAi calls
      // doesn't serve them.
      if (lower.indexOf("gpt-live") === 0) return false;
      if (lower.indexOf("image") !== -1) return false;
      if (lower.indexOf("transcribe") !== -1) return false;
      if (lower.indexOf("tts") !== -1) return false;
      // Deep-research models (o3-deep-research etc.) refuse a request that doesn't
      // enable a web-search tool, which this one-shot rewrite never does. Codex and
      // -pro models stay listed: they serve the Responses API that
      // improveWithOpenAi uses.
      if (lower.indexOf("deep-research") !== -1) return false;
      return true;
    }
  }
  return false;
};

/**
 * Cheaper/smaller tier indicator, used only to pick a sensible default from
 * the live list, never to filter it. Naming for small models differs
 * (mini/nano for OpenAI, haiku/compact for Anthropic); check both.
 */
const looksLikeCheapTier = (id: string, extraTerms: string[]): boolean => {
  const lower = id.toLowerCase();
  for (let i = 0; i < extraTerms.length; i++) {
    if (lower.indexOf(extraTerms[i]) !== -1) return true;
  }
  return false;
};

/** Live model list via the official `openai` SDK's `models.list()`, filtered
 *  to chat-capable text models and sorted newest-first (OpenAI's own
 *  `created` unix-timestamp field) so a picker shows current models before
 *  older/deprecated ones. `for await` matches the SDK's own documented
 *  auto-pagination idiom — the endpoint returns everything in one page today
 *  ("no pagination actually occurs yet" per the SDK's own Page type comment)
 *  but this stays correct if that ever changes. Never throws on a parse/
 *  shape surprise — an empty list just means the UI falls back to
 *  OPENAI_FALLBACK_MODEL_ID, same as if this call had never been made. */
export const listOpenAiModels = async (apiKey: string): Promise<ModelOption[]> => {
  const client = createOpenAiClient(apiKey);
  const chatModels: { id: string; created: number }[] = [];
  for await (const item of client.models.list()) {
    if (item && typeof item.id === "string" && isOpenAiChatModel(item.id)) {
      chatModels.push({ id: item.id, created: typeof item.created === "number" ? item.created : 0 });
    }
  }
  chatModels.sort((a, b) => b.created - a.created);
  const options: ModelOption[] = [];
  for (let i = 0; i < chatModels.length; i++) options.push({ id: chatModels[i].id, label: chatModels[i].id });
  return options;
};

/**
 * Live model list via the official `@anthropic-ai/sdk`'s `models.list()`. The
 * API already returns newest-first (per Anthropic's docs), so no client-side
 * date sort is needed, unlike OpenAI's response. `limit: 1000` gets
 * Anthropic's whole, deliberately small model catalog in one page, so this
 * doesn't need the page loop listVoices needs in elevenlabs.ts.
 */
export const listAnthropicModels = async (apiKey: string): Promise<ModelOption[]> => {
  const client = createAnthropicClient(apiKey);
  const page = await client.models.list({ limit: 1000 });
  const options: ModelOption[] = [];
  for (let i = 0; i < page.data.length; i++) {
    const item = page.data[i];
    if (item && typeof item.id === "string") {
      options.push({ id: item.id, label: typeof item.display_name === "string" ? item.display_name : item.id });
    }
  }
  return options;
};

/**
 * Picks a sensible default from a live-fetched list: the smallest,
 * cheapest-looking model, since a one-shot text edit never needs a flagship or
 * reasoning-tier model. Falls back to the first item (already newest first) if
 * nothing matches a known cheap-tier name, and to the hardcoded fallback ID if
 * the list is empty.
 *
 * The auto-pick is limited to the plain `gpt-` family: the o-series is a
 * reasoning tier, slower than this edit needs (o1/o3/o4 stay in the picker).
 * OpenAI's GPT-5.6 family names its cheapest tier `gpt-5.6-luna`
 * (Sol/Terra/Luna), with no "mini"/"nano" in the id. Codex, -pro and search
 * variants are never auto-picked: codex is tuned for code, -pro is the slowest
 * and most expensive tier, and a search model answers questions instead of
 * editing text. They stay in the picker.
 */
export const pickDefaultModel = (options: ModelOption[], provider: AssistantProvider): string => {
  const cheapTerms = provider === "openai" ? ["mini", "nano", "luna"] : ["haiku", "compact"];
  for (let i = 0; i < options.length; i++) {
    const id = options[i].id;
    const lower = id.toLowerCase();
    if (provider === "openai") {
      if (lower.indexOf("gpt-") !== 0) continue;
      if (lower.indexOf("codex") !== -1 || lower.indexOf("-pro") !== -1 || lower.indexOf("search") !== -1) continue;
    }
    if (looksLikeCheapTier(id, cheapTerms)) return id;
  }
  if (options.length > 0) return options[0].id;
  return provider === "openai" ? OPENAI_FALLBACK_MODEL_ID : ANTHROPIC_FALLBACK_MODEL_ID;
};

/** Thrown when a provider stops before the end of its rewrite (its output
 *  limit was reached). The panel then keeps the user's text as it was —
 *  a shortened rewrite must never replace it. */
export const SCRIPT_REWRITE_INCOMPLETE =
  "The rewrite stopped before the end, most likely because the text is too long for one pass. Your text was left unchanged — split it into shorter parts and improve each one.";
export const SCRIPT_REWRITE_NOT_FINISHED = "OpenAI did not finish the rewrite. Your text was left unchanged.";
export const SCRIPT_REWRITE_NOT_FINISHED_CLAUDE = "Claude did not finish the rewrite. Your text was left unchanged.";

/** A rewrite is sent once per click. Both SDKs otherwise repeat a request
 *  twice on a server error, timeout or lost connection, and a rewrite the
 *  provider already ran and billed could run again. Model listing keeps the
 *  default retries: it is free. */
const PAID_REQUEST_MAX_RETRIES = 0;

/** True for the older, non-reasoning families that still accept a custom
 *  `temperature`. Every GPT-5-and-later and o-series model rejects anything
 *  but the default ("Only the default (1) value is supported"), or accepts
 *  it only with reasoning switched off, which not every one of them allows.
 *  An allowlist of the old families rather than a denylist of the new ones,
 *  so whatever OpenAI ships next gets the safe default. */
const acceptsCustomTemperature = (modelId: string): boolean => {
  const lower = modelId.toLowerCase();
  return lower.indexOf("gpt-4") === 0 || lower.indexOf("gpt-3.5") === 0 || lower.indexOf("chatgpt-4o") === 0;
};

/**
 * Uses the Responses API, the one API every current OpenAI model serves
 * (codex and -pro models don't serve Chat Completions). `instructions` carries
 * the system prompt. No `temperature` for GPT-5-family models, which reject
 * anything but the default. `store: false` keeps the user's script out of
 * OpenAI's 30-day response storage, which Responses enables by default.
 */
const improveWithOpenAi = async (
  apiKey: string,
  text: string,
  style: ScriptStyle,
  intensity: ScriptIntensity,
  modelId: string,
): Promise<string> => {
  const client = createOpenAiClient(apiKey, PAID_REQUEST_MAX_RETRIES);
  const response = await client.responses.create({
    model: modelId,
    instructions: promptFor(style, intensity),
    input: text,
    store: false,
    ...(acceptsCustomTemperature(modelId) ? { temperature: 0.4 } : {}),
  });
  if (response.status === "incomplete") throw new Error(SCRIPT_REWRITE_INCOMPLETE);
  if (response.status && response.status !== "completed") throw new Error(SCRIPT_REWRITE_NOT_FINISHED);
  const content = response.output_text;
  if (!content) throw new Error("OpenAI API returned no text.");
  return content.trim();
};

/** Output budget for one Claude rewrite. Claude 5 models think by default, and
 *  their thinking counts toward `max_tokens` too, so the budget leaves room
 *  for both. */
const CLAUDE_MAX_TOKENS = 16000;

/**
 * Uses the Messages API. On models that think by default the reply starts with
 * a `thinking` block, so the text is read from the `text` blocks only. Only a
 * reply that ended normally replaces the script: a refusal or a reply cut
 * short (at max_tokens or the context window) can still carry partial text.
 */
const improveWithClaude = async (
  apiKey: string,
  text: string,
  style: ScriptStyle,
  intensity: ScriptIntensity,
  modelId: string,
): Promise<string> => {
  const client = createAnthropicClient(apiKey, PAID_REQUEST_MAX_RETRIES);
  const message = await client.messages.create({
    model: modelId,
    max_tokens: CLAUDE_MAX_TOKENS,
    system: promptFor(style, intensity),
    messages: [{ role: "user", content: text }],
  });
  const stopReason = message.stop_reason;
  if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") {
    throw new Error(SCRIPT_REWRITE_INCOMPLETE);
  }
  if (stopReason !== "end_turn" && stopReason !== "stop_sequence") throw new Error(SCRIPT_REWRITE_NOT_FINISHED_CLAUDE);
  let content = "";
  for (const block of message.content) {
    if (block.type === "text") content += block.text;
  }
  if (!content.trim()) throw new Error("Claude API returned no text.");
  return content.trim();
};

export const improveScript = async (
  provider: AssistantProvider,
  apiKey: string,
  text: string,
  style: ScriptStyle = "plain",
  intensity: ScriptIntensity = "natural",
  modelId?: string,
): Promise<string> => {
  const resolvedModel = modelId || (provider === "openai" ? OPENAI_FALLBACK_MODEL_ID : ANTHROPIC_FALLBACK_MODEL_ID);
  return provider === "openai"
    ? improveWithOpenAi(apiKey, text, style, intensity, resolvedModel)
    : improveWithClaude(apiKey, text, style, intensity, resolvedModel);
};
