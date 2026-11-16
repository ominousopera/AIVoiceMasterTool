import { useEffect, useState } from "react";
import { loadUiLanguage, saveUiLanguage, UiLanguage } from "../settings";
import { ru } from "./ru";
import { es } from "./es";

/** Gettext-style i18n: the English source string itself is the dictionary
 *  key (see `ru.ts`/`es.ts`), not an invented identifier — this keeps the
 *  hundreds of `tr("...")` call sites in `main.tsx`/`Waveform.tsx` self-
 *  documenting and lets a still-missing key fall back to readable English
 *  instead of a blank string or a raw key name. No new dependency (no
 *  i18next etc.) — same "hand-roll it, it's simple enough" choice this
 *  codebase already made for Waveform.tsx's canvas rendering.
 *
 *  Not used for `licenseText.ts` (the license notice stays English-only —
 *  the GPL's English text is the one that governs) or for raw diagnostics-dump/debug text (developer-facing,
 *  not part of the translated interface). Every other user-facing string
 *  in the panel — including `guideText.ts` — goes through `tr()`. */

const DICTIONARIES: Partial<Record<UiLanguage, Record<string, string>>> = { ru, es };

let currentLanguage: UiLanguage = loadUiLanguage();
const listeners = new Set<() => void>();

export const getLanguage = (): UiLanguage => currentLanguage;

export const setLanguage = (language: UiLanguage): void => {
  // Saved even when the language is already active: the first-run prompt
  // relies on the saved value to know the choice was made, and English is the
  // default before any choice, so picking English must still write it.
  const changed = language !== currentLanguage;
  currentLanguage = language;
  saveUiLanguage(language);
  if (changed) listeners.forEach((listener) => listener());
};

/** Looks up `source` in the active language's dictionary; falls back to
 *  `source` itself (English) if the language is English, the dictionary is
 *  missing, or this particular string hasn't been translated yet. `vars`
 *  fills `{name}` placeholders for the handful of strings that interpolate
 *  a number/filename, e.g. `tr("Found {count} regions", { count })` — do
 *  the same substitution in `ru.ts`/`es.ts`'s translated value. */
export const tr = (source: string, vars?: Record<string, string | number>): string => {
  const dict = DICTIONARIES[currentLanguage];
  const template = (dict && dict[source]) || source;
  if (!vars) return template;
  // Single regex pass, not one split/join per key: sequential passes re-scan the
  // already-substituted text, so a value that itself contains another key's
  // `{name}` placeholder (a user's sequence or clip name can contain anything)
  // would be substituted twice. Not exploitable (React text nodes are always
  // escaped), just a correctness issue.
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
};

/** Subscribes the calling component to language changes — call this once
 *  near the top of a component tree (the panel's top-level `App` in
 *  `main.tsx` is enough; React re-renders its whole subtree by default,
 *  nothing else here is memoized) so switching language in Settings or the
 *  first-run prompt re-renders every `tr(...)` call with the new language
 *  immediately, no reload needed. The returned value itself is rarely used
 *  directly — it exists to make this a real `useState`, so React knows to
 *  re-render on change. */
export const useLanguage = (): UiLanguage => {
  const [language, setLanguageState] = useState(currentLanguage);
  useEffect(() => {
    const listener = () => setLanguageState(currentLanguage);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return language;
};
