import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { fs, path } from "./cep/node";
import { buildGeneratedFileName, getGeneratedAudioDir } from "./genAudioDir";
import { writeGenerationMetadata } from "./generationMetadata";

// Thin client for ElevenLabs' Text-to-Speech API, built on ElevenLabs' own
// official @elevenlabs/elevenlabs-js SDK — calls go straight from this
// machine to api.elevenlabs.io using the user's own key (BYO-key), read from
// settings.ts. The extension has no server of its own and embeds no key of
// its own. Runs entirely in the JS/CEP side, not ExtendScript —
// ExtendScript has no fetch/XHR/network stack at all, so generation can't
// happen there even in principle; only the resulting file path crosses over
// to ppro.ts's importAudioAndPlaceOnTimeline via evalTS.
//
// A fresh ElevenLabsClient is constructed per call rather than cached/shared,
// since the API key is BYO and can change between calls (user editing the
// key field) — the SDK's own client construction is cheap (no network I/O).

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  /** Short "gender, accent, age" label for the picker, when ElevenLabs
   *  provides one — purely cosmetic, never used for matching. */
  labels?: string;
  /**
   * ElevenLabs' voice category: "premade" for their stock voices, or
   * "cloned"/"professional"/"generated" for voices the user added or created
   * (Instant/Professional Voice Cloning, Voice Design, or the community Voice
   * Library). The picker groups on it: "premade" -> Stock voices, everything
   * else -> My Voices; ElevenLabs offers no cleaner "did I create this" flag.
   */
  category: string;
}

export interface VoiceSettings {
  /** 0-1. Lower = more emotional/dynamic but less consistent; higher =
   *  clearer/more consistent but can sound flat. */
  stability: number;
  /** 0-1. Similarity/clarity boost — kept close to stability's range;
   *  pushing to 1.0 tends to over-enunciate into an unnatural read. Omitted
   *  for eleven_v3, which has no Similarity setting (ElevenLabs' text-to-
   *  speech guide); a field left undefined is not sent. */
  similarityBoost?: number;
  /** 0-1. Leave near 0 unless deliberately pushing for a stronger
   *  character/emotional read. Omitted for eleven_v3 and eleven_v4
   *  text-to-speech (see useSpeakerBoost below). */
  style?: number;
  /** 0.7-1.2. 1.0 is ElevenLabs' own default speed for the generation
   *  itself — a property of the model's delivery, independent of the Pacing
   *  tab's Speed % (which retimes audio already on the timeline). Omitted for
   *  eleven_v3 and eleven_v4 text-to-speech. */
  speed?: number;
  /**
   * Boosts similarity to the original speaker at a small extra computational and
   * latency cost (per ElevenLabs' docs); worth leaving on unless latency
   * matters. Omitted for eleven_v3 text-to-speech (stability only) and for
   * eleven_v4, which "uses two voice settings: Stability and Similarity"
   * (ElevenLabs help centre). Whether the API ignores or rejects the other
   * fields on v4 isn't documented, so they are left out; a field left
   * undefined is not sent.
   */
  useSpeakerBoost?: boolean;
}

/** The voice_settings object actually sent: only the fields that are set,
 *  so a v4 request carries stability and similarity alone, a v3 request
 *  stability alone. */
const voiceSettingsForRequest = (settings: VoiceSettings) => {
  const out: { stability: number; similarityBoost?: number; style?: number; speed?: number; useSpeakerBoost?: boolean } = {
    stability: settings.stability,
  };
  if (settings.similarityBoost !== undefined) out.similarityBoost = settings.similarityBoost;
  if (settings.style !== undefined) out.style = settings.style;
  if (settings.speed !== undefined) out.speed = settings.speed;
  if (settings.useSpeakerBoost !== undefined) out.useSpeakerBoost = settings.useSpeakerBoost;
  return out;
};

export interface GenerateVoiceResult {
  filePath: string;
  bytesWritten: number;
  warnings: string[];
  /** What ElevenLabs reports this request cost, from its `character-cost`
   *  response header — text-to-speech only, absent if the header is. */
  characterCost?: number;
}

/** Neighbouring text for ElevenLabs request stitching (`previous_text` /
 *  `next_text`): the model hears what comes before and after, so a line
 *  generated on its own keeps the intonation of the surrounding script.
 *  Not supported on eleven_v3 (ElevenLabs' request-stitching guide), so
 *  callers send it for v2/v4 only. */
export interface StitchContext {
  previousText?: string;
  nextText?: string;
}

/**
 * Curated subset of ElevenLabs' output_format enum (27 values, incl.
 * PCM/WAV/Opus/mu-law). Two families, each written with a matching file
 * extension (see outputFormatExtension and the buildGeneratedFileName calls):
 *
 * - `mp3_*`: compressed, small files.
 * - `wav_*`: ElevenLabs' WAV output, a real RIFF/WAVE container with a header,
 *   unlike their headerless `pcm_*` formats (not exposed: raw samples need a
 *   WAV header written by hand to be playable). Lossless and much bigger.
 *   `wav_44100` needs ElevenLabs' Pro tier or above (per the SDK's request
 *   types and the API reference); `wav_48000` has no documented tier
 *   requirement, though it most likely needs at least Pro as well.
 *
 * Opus and mu-law/a-law are left out: mu-law/a-law are lossy telephony formats,
 * and Opus' raw-stream (non-Ogg) output has uncertain Premiere import support,
 * without being clearly better than mp3 at 192 kbps here.
 */
export type ElevenLabsOutputFormat =
  | "mp3_44100_32"
  | "mp3_44100_64"
  | "mp3_44100_96"
  | "mp3_44100_128"
  | "mp3_44100_192"
  | "wav_44100"
  | "wav_48000";

/**
 * File extension for an output format: `wav_*` is a real container and gets
 * `.wav`, everything else here is mp3 (see the type above).
 */
export const outputFormatExtension = (format: ElevenLabsOutputFormat): "mp3" | "wav" => (format.startsWith("wav_") ? "wav" : "mp3");

/** The folder generated audio is saved to, created before the request: a
 *  folder that can't be made must fail before ElevenLabs generates (and
 *  bills) the audio, not after. */
const prepareOutputDir = (projectFolderPath?: string | null): string => {
  try {
    return getGeneratedAudioDir(projectFolderPath);
  } catch (e: any) {
    throw new Error(`The folder for generated audio could not be created (${e?.message || e}). Nothing was sent to ElevenLabs.`);
  }
};

/** The SDK's text-to-speech/speech-to-speech `convert()` calls resolve to a
 *  web-standard ReadableStream<Uint8Array> (not a Node Readable), so a
 *  `.pipe()`/Node-stream approach doesn't apply — read it out via the
 *  portable getReader()/read() loop, which works the same whether the
 *  runtime's ReadableStream comes from Node or from CEP's Chromium. */
const readableStreamToBuffer = async (stream: ReadableStream<Uint8Array>): Promise<Buffer> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(AUDIO_DOWNLOAD_STALLED)), AUDIO_STREAM_IDLE_MS);
      });
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await Promise.race([reader.read(), stalled]);
      } finally {
        clearTimeout(timer);
      }
      if (result.done) break;
      if (result.value) chunks.push(result.value);
    }
  } catch (e) {
    reader.cancel().catch(() => undefined);
    throw e;
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
};

/** The SDK's own timeout ends when the response headers arrive, so a body
 *  that stops mid-download would keep Generate busy forever. No audio for
 *  this long ends the download with AUDIO_DOWNLOAD_STALLED, and nothing is
 *  saved or placed. */
const AUDIO_STREAM_IDLE_MS = 60_000;
export const AUDIO_DOWNLOAD_STALLED =
  "ElevenLabs stopped sending the audio partway through (nothing arrived for 60 seconds). Nothing was saved or placed. Check your connection, then try again.";

/** Generate and Voice Changer send one request per click. The SDK otherwise
 *  repeats a request twice on a server error or timeout, and a take the
 *  server already made and billed could be made again. Voice listing keeps
 *  the default retries: it is free. */
const PAID_REQUEST_MAX_RETRIES = 0;

/** Populates the voice picker via the SDK's `voices.search()` (the
 *  documented replacement for the deprecated `voices.getAll()`, which stops
 *  working past 500 voices in a workspace). `search()` is paginated (max
 *  100/page) where the old GET /v1/voices endpoint returned everything in
 *  one shot — looped here via nextPageToken/hasMore so an account with a
 *  large voice library doesn't silently lose voices past the first page. */
export const listVoices = async (apiKey: string): Promise<ElevenLabsVoice[]> => {
  const client = new ElevenLabsClient({ apiKey });
  const voices: { voiceId: string; name?: string; labels?: Record<string, string>; category?: string }[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await client.voices.search({ pageSize: 100, nextPageToken });
    voices.push(...page.voices);
    nextPageToken = page.hasMore ? page.nextPageToken : undefined;
  } while (nextPageToken);

  return voices.map((v) => ({
    voiceId: v.voiceId,
    name: v.name || "",
    labels: v.labels ? [v.labels.gender, v.labels.accent, v.labels.age].filter(Boolean).join(", ") : undefined,
    category: v.category || "premade",
  }));
};

/**
 * Text to speech via the SDK's `textToSpeech.convert()`: audio bytes as a
 * stream, encoded per `outputFormat` (ElevenLabs' 128 kbps mp3 when omitted),
 * written to a new, timestamp-unique file under
 * Documents/AI Voice Master Tool/Generated/ (see genAudioDir.ts), so
 * importAudioAndPlaceOnTimeline can pick it up by path.
 *
 * `languageCode` (ISO 639-1, e.g. "es") forces a language on models that
 * support it; ElevenLabs ignores it on `eleven_multilingual_v2`, which detects
 * the language from the text, so it only matters on v3/v4. Undefined =
 * ElevenLabs' default.
 *
 * `context`: see StitchContext. Whether ElevenLabs bills the neighbouring text
 * isn't documented; the `character-cost` header read here answers it per
 * request, and Batch logs it.
 */
export const generateSpeech = async (
  apiKey: string,
  voiceId: string,
  voiceName: string,
  text: string,
  modelId: string,
  settings: VoiceSettings,
  projectFolderPath?: string | null,
  outputFormat?: ElevenLabsOutputFormat,
  languageCode?: string,
  context?: StitchContext,
): Promise<GenerateVoiceResult> => {
  const dir = prepareOutputDir(projectFolderPath);
  const client = new ElevenLabsClient({ apiKey, maxRetries: PAID_REQUEST_MAX_RETRIES });
  const { data: stream, rawResponse } = await client.textToSpeech
    .convert(voiceId, {
      text,
      modelId,
      voiceSettings: voiceSettingsForRequest(settings),
      outputFormat: outputFormat || "mp3_44100_128",
      languageCode: languageCode || undefined,
      previousText: context?.previousText || undefined,
      nextText: context?.nextText || undefined,
    })
    .withRawResponse();
  const bytes = await readableStreamToBuffer(stream);
  const costHeader = Number(rawResponse.headers.get("character-cost"));
  const characterCost = Number.isFinite(costHeader) && rawResponse.headers.has("character-cost") ? costHeader : undefined;

  const filePath = path.join(
    dir,
    buildGeneratedFileName("elevenlabs", voiceName, text, outputFormatExtension(outputFormat || "mp3_44100_128")),
  );
  try {
    fs.writeFileSync(filePath, bytes);
  } catch (e: any) {
    // ElevenLabs has already generated (and billed) this audio, so a write
    // failure here (disk full, permissions, locked path) is reported with its
    // cause instead of losing the output silently.
    throw new Error(`Generated audio could not be saved to ${filePath}: ${e?.message || e}`);
  }
  writeGenerationMetadata(filePath, { engine: "elevenlabs", text, voiceId, voiceName });

  return { filePath, bytesWritten: bytes.length, warnings: [], characterCost };
};

/**
 * The audio is handed to the SDK as raw bytes (`Buffer` is one of
 * Uploadable.FileLike's accepted shapes) with filename/contentType metadata;
 * the SDK builds the multipart request itself.
 */
export const convertSpeechToSpeech = async (
  apiKey: string,
  voiceId: string,
  voiceName: string,
  inputFilePath: string,
  modelId: string,
  settings: VoiceSettings,
  projectFolderPath?: string | null,
  outputFormat?: ElevenLabsOutputFormat,
): Promise<GenerateVoiceResult> => {
  const dir = prepareOutputDir(projectFolderPath);
  const client = new ElevenLabsClient({ apiKey, maxRetries: PAID_REQUEST_MAX_RETRIES });
  const inputBytes = fs.readFileSync(inputFilePath);
  const stream = await client.speechToSpeech.convert(voiceId, {
    audio: { data: inputBytes, filename: path.basename(inputFilePath), contentType: "audio/wav" },
    modelId,
    voiceSettings: JSON.stringify({
      stability: settings.stability,
      similarity_boost: settings.similarityBoost,
      style: settings.style,
      speed: settings.speed,
      use_speaker_boost: settings.useSpeakerBoost,
    }),
    outputFormat: outputFormat || "mp3_44100_128",
  });
  const bytes = await readableStreamToBuffer(stream);

  const filePath = path.join(
    dir,
    buildGeneratedFileName("elevenlabs-vc", voiceName, "", outputFormatExtension(outputFormat || "mp3_44100_128")),
  );
  try {
    fs.writeFileSync(filePath, bytes);
  } catch (e: any) {
    // Same reasoning as generateSpeech above: the (billed) conversion has
    // already happened by this point, so a save failure here must not be
    // silently swallowed.
    throw new Error(`Converted audio could not be saved to ${filePath}: ${e?.message || e}`);
  }

  return { filePath, bytesWritten: bytes.length, warnings: [] };
};
