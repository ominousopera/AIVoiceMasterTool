import { child_process } from "./cep/node";
import { getEspeakDataPath, getEspeakPath } from "./espeakPath";

/**
 * Runs the bundled espeak-ng binary asynchronously (child_process.spawn +
 * await 'close', never spawnSync: spawnSync blocks the panel's thread for
 * the whole subprocess run, and Premiere resets a panel that blocks too
 * long; see whisper.ts). Returns stdout.
 */
const runEspeak = (args: string[], stdin: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const bin = getEspeakPath();
    const proc = child_process.spawn(bin, args);
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d: Buffer) => {
      stdout += d.toString("utf-8");
    });
    proc.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString("utf-8");
    });
    proc.on("error", (e) => reject(e));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`espeak-ng exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.stdin?.write(stdin, "utf-8");
    proc.stdin?.end();
  });

/**
 * Phonemizes each of `segments` with its own espeak-ng subprocess call and
 * returns the results in the same order. Never batched into one multi-line
 * `--stdin` call: espeak-ng truncates the last line's final phonemes without a
 * trailing newline ("Hello world" -> "həlˈoʊ wˈɜːl") and merges several
 * lines into one output line with it — reproducible from a plain shell pipe,
 * and silent data corruption either way. One line plus a trailing newline
 * per call is reliable, and spawning this ~1 MB static binary costs a few
 * milliseconds, negligible next to model load and inference.
 */
const phonemizeBatch = async (segments: string[], voiceLocale: string, extraArgs: string[] = []): Promise<string[]> => {
  if (segments.length === 0) return [];
  const dataPath = getEspeakDataPath();
  const args = ["--ipa", ...extraArgs, "-q", "-v", voiceLocale, "--path", dataPath, "--stdin"];
  const results: string[] = [];
  for (const seg of segments) {
    const stdin = seg.replace(/\n/g, " ") + "\n";
    const out = await runEspeak(args, stdin);
    results.push(
      out
        .split("\n")
        .filter((l) => l.length > 0)
        .join(" ")
        .trim(),
    );
  }
  return results;
};

// ---------------------------------------------------------------
// English phonemization: a port of kokoro-js's `m()` function (Apache-2.0),
// calling the bundled espeak-ng subprocess instead of an in-process
// phonemizer (see espeakPath.ts). The text-normalization rules below
// (abbreviations, times, currency, decimals, etc.) and the phoneme-symbol
// remap after them follow that function.

const formatTimeOrYear = (token: string): string => {
  if (token.includes(".")) return token;
  if (token.includes(":")) {
    const [h, mRaw] = token.split(":");
    const m = Number(mRaw);
    if (m === 0) return `${h} o'clock`;
    if (m < 10) return `${h} oh ${m}`;
    return `${h} ${m}`;
  }
  const year = parseInt(token.slice(0, 4), 10);
  if (year < 1100 || year % 1000 < 10) return token;
  const century = token.slice(0, 2);
  const rest = parseInt(token.slice(2, 4), 10);
  const suffix = token.endsWith("s") ? "s" : "";
  if (year % 1000 >= 100 && year % 1000 <= 999) {
    if (rest === 0) return `${century} hundred${suffix}`;
    if (rest < 10) return `${century} oh ${rest}${suffix}`;
  }
  return `${century} ${rest}${suffix}`;
};

const formatCurrency = (token: string): string => {
  const unit = token[0] === "$" ? "dollar" : "pound";
  const amount = token.slice(1);
  if (isNaN(Number(amount))) return `${amount} ${unit}s`;
  if (!amount.includes(".")) {
    const plural = amount === "1" ? "" : "s";
    return `${amount} ${unit}${plural}`;
  }
  const [whole, fracRaw] = amount.split(".");
  const frac = parseInt(fracRaw.padEnd(2, "0"), 10);
  const subUnit = token[0] === "$" ? (frac === 1 ? "cent" : "cents") : frac === 1 ? "penny" : "pence";
  return `${whole} ${unit}${whole === "1" ? "" : "s"} and ${frac} ${subUnit}`;
};

const formatDecimal = (token: string): string => {
  const [whole, frac] = token.split(".");
  return `${whole} point ${frac.split("").join(" ")}`;
};

/** Same punctuation-cluster regex kokoro-js's own `m()` builds — matches
 *  runs of whitespace + punctuation (kept literal, never sent through
 *  phonemization) so segments between them (the actual word content) can
 *  be phonemized separately while punctuation/spacing is preserved as-is. */
const buildPunctuationRunRegex = (): RegExp => {
  const chars = ';:,.!?¡¿—…"«»“”(){}[]';
  const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(\\s*[${escaped}]+\\s*)+`, "g");
};
const PUNCTUATION_RUN_RE = buildPunctuationRunRegex();

const splitOnPunctuationRuns = (text: string): { match: boolean; text: string }[] => {
  const parts: { match: boolean; text: string }[] = [];
  let cursor = 0;
  for (const m of text.matchAll(PUNCTUATION_RUN_RE)) {
    const matched = m[0];
    const index = m.index ?? 0;
    if (cursor < index) parts.push({ match: false, text: text.slice(cursor, index) });
    if (matched.length > 0) parts.push({ match: true, text: matched });
    cursor = index + matched.length;
  }
  if (cursor < text.length) parts.push({ match: false, text: text.slice(cursor) });
  return parts;
};

/** Same text-normalization chain kokoro-js's own `m()` applies before
 *  phonemizing — smart-quote/CJK-punctuation normalization, honorific
 *  expansion, colloquial "yeah", times/years, currency, decimals, digit
 *  ranges, and acronym-dot handling. Order matters (later rules assume
 *  earlier ones already ran) — kept in the same sequence as the original. */
const normalizeEnglishText = (text: string): string =>
  text
    .replace(/['‘’]/g, "'")
    .replace(/«/g, "“")
    .replace(/»/g, "”")
    .replace(/[“”]/g, '"')
    .replace(/\(/g, "«")
    .replace(/\)/g, "»")
    .replace(/、/g, ", ")
    .replace(/。/g, ". ")
    .replace(/！/g, "! ")
    .replace(/，/g, ", ")
    .replace(/：/g, ": ")
    .replace(/；/g, "; ")
    .replace(/？/g, "? ")
    .replace(/[^\S \n]/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/(?<=\n) +(?=\n)/g, "")
    .replace(/\bD[Rr]\.(?= [A-Z])/g, "Doctor")
    .replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, "Mister")
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, "Miss")
    .replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, "Mrs")
    .replace(/\betc\.(?! [A-Z])/gi, "etc")
    .replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/\d*\.\d+|\b\d{4}s?\b|(?<!:)\b(?:[1-9]|1[0-2]):[0-5]\d\b(?!:)/g, formatTimeOrYear)
    .replace(/(?<=\d),(?=\d)/g, "")
    .replace(/[$£]\d+(?:\.\d+)?(?: hundred| thousand| (?:[bm]|tr)illion)*\b|[$£]\d+\.\d\d?\b/gi, formatCurrency)
    .replace(/\d*\.\d+/g, formatDecimal)
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=\d)S/g, " S")
    .replace(/(?<=[BCDFGHJ-NP-TV-Z])'?s\b/g, "'S")
    .replace(/(?<=X')S\b/g, "s")
    .replace(/(?:[A-Za-z]\.){2,} [a-z]/g, (m) => m.replace(/\./g, "-"))
    .replace(/(?<=[A-Z])\.(?=[A-Z])/gi, "-")
    .trim();

/** Same phoneme-symbol post-processing kokoro-js's own `m()` applies after
 *  phonemizing — American-specific vs. both-variants rules, unchanged. */
const postProcessEnglishPhonemes = (phonemes: string, american: boolean): string => {
  let out = phonemes
    .replace(/kəkˈoːɹoʊ/g, "kˈoʊkəɹoʊ")
    .replace(/kəkˈɔːɹəʊ/g, "kˈəʊkəɹəʊ")
    .replace(/ʲ/g, "j")
    .replace(/r/g, "ɹ")
    .replace(/x/g, "k")
    .replace(/ɬ/g, "l")
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, " ")
    .replace(/ z(?=[;:,.!?¡¿—…"«»“”(){}[\] ]|$)/g, "z");
  if (american) out = out.replace(/(?<=nˈaɪn)ti(?!ː)/g, "di");
  return out.trim();
};

/** Phonemizes English text for Kokoro: `american` true for the "a" voices
 *  (espeak "en-us"), false for the British "b" voices ("en"), matching
 *  kokoro-js's own `m()` exactly except for the underlying espeak call (a
 *  subprocess instead of in-process WASM — see the section comment above
 *  formatTimeOrYear). */
export const phonemizeEnglish = async (text: string, american: boolean): Promise<string> => {
  const normalized = normalizeEnglishText(text);
  const parts = splitOnPunctuationRuns(normalized);
  const locale = american ? "en-us" : "en";
  const textSegments = parts.filter((p) => !p.match).map((p) => p.text);
  const phonemized = await phonemizeBatch(textSegments, locale);
  let i = 0;
  const joined = parts.map((p) => (p.match ? p.text : phonemized[i++])).join("");
  return postProcessEnglishPhonemes(joined, american);
};

// ---------------------------------------------------------------
// Spanish/French/Italian/Portuguese/Hindi phonemization — replicates misaki's
// `EspeakG2P` class (misaki/espeak.py), the reference for Kokoro's
// multilingual voices, rather than kokoro-js's English-only path.
// ---------------------------------------------------------------

/** misaki's own espeak-to-misaki phoneme substitution table (EspeakG2P.E2M)
 *  — collapses eSpeak's tied compound IPA symbols (diphthongs/affricates)
 *  into Kokoro's own single-character phoneme vocabulary. Order doesn't
 *  matter (no substring overlaps between keys). */
const TIER_A_E2M: [string, string][] = [
  ["a^ɪ", "I"],
  ["a^ʊ", "W"],
  ["d^z", "ʣ"],
  ["d^ʒ", "ʤ"],
  ["e^ɪ", "A"],
  ["o^ʊ", "O"],
  ["ə^ʊ", "Q"],
  ["s^s", "S"],
  ["t^s", "ʦ"],
  ["t^ʃ", "ʧ"],
  ["ɔ^ɪ", "Y"],
];

/**
 * Kokoro voice-id language prefix -> espeak-ng locale for the multilingual
 * voices (English is handled separately by phonemizeEnglish above).
 */
export const TIER_A_LOCALES: Record<string, string> = {
  e: "es", // Spanish
  f: "fr", // French
  h: "hi", // Hindi
  i: "it", // Italian
  p: "pt-br", // Brazilian Portuguese (eSpeak's plain "pt" is European Portuguese)
};

/** Removes eSpeak's language-switch markers, such as "(en)" and "(it)" around
 *  a word its dictionary reads as English. misaki removes them too
 *  (language_switch='remove-flags'); left in, the voice reads them out. */
const stripLanguageSwitches = (phonemes: string): string =>
  phonemes
    .replace(/\([^()]*\)/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

/** Joins a ".", "," or ":" between two digits back into the text around it,
 *  so eSpeak reads "3,5", "1.000" or "10:30" as one number instead of as
 *  numbers separated by punctuation. */
const keepNumberSeparators = (parts: { match: boolean; text: string }[]): { match: boolean; text: string }[] => {
  const out: { match: boolean; text: string }[] = [];
  for (let k = 0; k < parts.length; k++) {
    const part = parts[k];
    const prev = out[out.length - 1];
    const next = parts[k + 1];
    if (
      part.match &&
      /^[.,:]$/.test(part.text) &&
      prev &&
      !prev.match &&
      /\d$/.test(prev.text) &&
      next &&
      !next.match &&
      /^\d/.test(next.text)
    ) {
      prev.text += part.text + next.text;
      k++;
      continue;
    }
    out.push({ match: part.match, text: part.text });
  }
  return out;
};

/**
 * Phonemizes multilingual (Spanish, French, Hindi, Italian, Brazilian
 * Portuguese) text for Kokoro, matching misaki's EspeakG2P pipeline, which
 * these voices were trained on:
 * - parentheses become angle quotes first (misaki's convention, so they
 *   survive phonemization), and back at the end;
 * - punctuation is kept: the text between punctuation runs is phonemized and
 *   the runs are put back as they were (misaki's preserve_punctuation), as
 *   phonemizeEnglish does; a separator inside a number stays with the number;
 * - eSpeak is asked for tie marks (`--tie=^`), so its two-letter diphthongs
 *   and affricates collapse into Kokoro's single symbols (E2M table above);
 * - language-switch markers are removed, then remaining ties and hyphens.
 */
export const phonemizeTierA = async (text: string, langCode: string): Promise<string> => {
  const locale = TIER_A_LOCALES[langCode];
  if (!locale) throw new Error(`No espeak-ng language is mapped for Kokoro language code "${langCode}".`);
  const pre = text.replace(/«/g, "“").replace(/»/g, "”").replace(/\(/g, "«").replace(/\)/g, "»");
  const parts = keepNumberSeparators(splitOnPunctuationRuns(pre));
  const textSegments = parts.filter((p) => !p.match).map((p) => p.text);
  const phonemized = await phonemizeBatch(textSegments, locale, ["--tie=^"]);
  let i = 0;
  let out = parts.map((p) => (p.match ? p.text : stripLanguageSwitches(phonemized[i++] ?? ""))).join("");
  for (const [tied, single] of TIER_A_E2M) out = out.split(tied).join(single);
  out = out.replace(/\^/g, "").replace(/-/g, "");
  out = out.replace(/«/g, "(").replace(/»/g, ")");
  return out.trim();
};
