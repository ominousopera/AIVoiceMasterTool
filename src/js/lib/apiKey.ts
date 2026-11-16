/**
 * Shared check for every API key field (ElevenLabs, OpenAI, Anthropic). Real
 * keys from all three providers are single printable-ASCII tokens. Text
 * pasted or typed into the field by mistake (a sentence, or a key with a
 * look-alike Cyrillic letter) would otherwise be saved, and every request
 * would fail with the browser's raw "String contains non ISO-8859-1 code
 * point" (a header can't carry it), which says nothing about what to do.
 * So anything with whitespace or a non-ASCII character is refused at save
 * time with an explanation, and a key already saved that way is caught before
 * any network call. Returns English message keys; callers run them through
 * tr().
 */

// Zero-width and BOM characters are invisible and commonly come along when a
// key is copied out of a web page or a messenger; they are never part of a
// key, so they are dropped silently rather than refused.
const INVISIBLE = /[​-‍⁠﻿]/g;

export const cleanApiKey = (raw: string): string => raw.replace(INVISIBLE, "").trim();

export const API_KEY_HAS_SPACES =
  "This isn't a key: it contains spaces, so other text was probably pasted or typed into this field. Copy the key again from your account's API keys page.";
export const API_KEY_HAS_NON_LATIN =
  "The key contains non-Latin characters, for example a Cyrillic letter that looks like a Latin one. Copy the key again from your account's API keys page, or retype it with an English keyboard layout.";

export const apiKeyProblem = (key: string): string | null => {
  if (/\s/.test(key)) return API_KEY_HAS_SPACES;
  if (/[^\x21-\x7E]/.test(key)) return API_KEY_HAS_NON_LATIN;
  return null;
};
