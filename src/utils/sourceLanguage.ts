import type { ResolvedStream } from "../services/MovieAPI";

export interface SourceLanguageInfo {
  label: string;
  audio?: string;
  /** True when filename markers (VO/VOST/OAR) indicate this is the original
   * audio cut. Lets the UI flag dubbed releases distinctly from native ones. */
  audioIsOriginal: boolean;
  subtitles: string[];
  confidence: "explicit" | "filename" | "unknown";
}

/**
 * Short, badge-friendly summary of a stream's audio + subtitle situation.
 * Always returns concrete strings (no nulls) so the picker can render two
 * fixed slots — absence of a value is itself useful information ("no subs
 * detected" is different from "we don't know yet").
 */
export interface SourceLanguageBadges {
  audio: string;
  audioIsOriginal: boolean;
  subs: string;
  hasSubs: boolean;
}

const LANGUAGE_ALIASES: Array<{
  label: string;
  tokens: string[];
}> = [
  { label: "English", tokens: ["ENGLISH", "ENG", "EN"] },
  {
    label: "French",
    tokens: ["TRUEFRENCH", "FRENCH", "FRA", "FR", "VFF", "VFQ", "VF"],
  },
  { label: "Spanish", tokens: ["SPANISH", "ESP", "SPA", "ES"] },
  { label: "German", tokens: ["GERMAN", "DEU", "GER", "DE"] },
  { label: "Italian", tokens: ["ITALIAN", "ITA", "IT"] },
  { label: "Portuguese", tokens: ["PORTUGUESE", "PORTUGUES", "POR", "PT"] },
  { label: "Hindi", tokens: ["HINDI", "HIN", "HI"] },
  { label: "Japanese", tokens: ["JAPANESE", "JPN", "JA"] },
  { label: "Korean", tokens: ["KOREAN", "KOR", "KO"] },
  { label: "Chinese", tokens: ["CHINESE", "CHI", "ZHO", "ZH"] },
  { label: "Russian", tokens: ["RUSSIAN", "RUS", "RU"] },
  { label: "Polish", tokens: ["POLISH", "POL", "PL"] },
  { label: "Turkish", tokens: ["TURKISH", "TUR", "TR"] },
  { label: "Arabic", tokens: ["ARABIC", "ARA", "AR"] },
  { label: "Tamil", tokens: ["TAMIL", "TAM", "TA"] },
  { label: "Telugu", tokens: ["TELUGU", "TEL", "TE"] },
];

export function getSourceLanguageInfo(
  stream: ResolvedStream,
): SourceLanguageInfo {
  const explicit = getExplicitLanguageInfo(stream);
  if (explicit) return explicit;

  const text = `${stream.name} ${stream.title} ${stream.source}`;
  const compact = text.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  const tokens = new Set(
    text
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );

  const subtitles = detectSubtitleLanguages(tokens, compact);
  const audio = detectAudioLanguage(tokens, compact);
  const audioIsOriginal = audio === "Original audio";

  if (!audio && subtitles.length === 0) {
    return {
      label: "Language unknown",
      audioIsOriginal: false,
      subtitles: [],
      confidence: "unknown",
    };
  }

  return {
    label: formatLanguageLabel(audio, subtitles),
    audio,
    audioIsOriginal,
    subtitles,
    confidence: "filename",
  };
}

export function getSourceLanguageLabel(stream: ResolvedStream): string {
  return getSourceLanguageInfo(stream).label;
}

/**
 * Compact two-slot summary for picker rows: one audio chip + one subs chip.
 * Both slots always populate so the user can tell "no subs" from "unknown".
 */
export function getSourceLanguageBadges(
  stream: ResolvedStream,
): SourceLanguageBadges {
  const info = getSourceLanguageInfo(stream);
  const audio = info.audio
    ? info.audioIsOriginal
      ? "Original"
      : info.audio
    : "Unknown";
  const subs = info.subtitles.length > 0 ? info.subtitles.join(", ") : "None";
  return {
    audio,
    audioIsOriginal: info.audioIsOriginal,
    subs,
    hasSubs: info.subtitles.length > 0,
  };
}

function getExplicitLanguageInfo(
  stream: ResolvedStream,
): SourceLanguageInfo | null {
  const audio = normalizeLanguageValue(stream.language);
  const audioLanguages = stream.audioLanguages
    ?.map(normalizeLanguageValue)
    .filter((value): value is string => !!value);
  const subtitleLanguages = stream.subtitleLanguages
    ?.map(normalizeLanguageValue)
    .filter((value): value is string => !!value);

  const resolvedAudio =
    audioLanguages && audioLanguages.length > 1
      ? "Multi audio"
      : audioLanguages?.[0] ?? audio;
  const resolvedSubs = subtitleLanguages ?? [];

  if (!resolvedAudio && resolvedSubs.length === 0) return null;

  return {
    label: formatLanguageLabel(resolvedAudio, resolvedSubs),
    audio: resolvedAudio,
    // Explicit addon metadata names a concrete language; we have no way to
    // know whether it's the original cut or a dub, so default to false.
    audioIsOriginal: false,
    subtitles: resolvedSubs,
    confidence: "explicit",
  };
}

function detectAudioLanguage(
  tokens: Set<string>,
  compact: string,
): string | undefined {
  if (
    hasAny(tokens, ["MULTI", "MULTIAUDIO", "MULTILINGUAL"]) ||
    compact.includes("MULTIAUDIO")
  ) {
    return "Multi audio";
  }
  if (hasPhrase(compact, ["DUALAUDIO", "DUAL"])) {
    return "Dual audio";
  }

  const strippedTokens = new Set(tokens);
  for (const vostToken of ["VOSTFR", "VOSTEN", "SUBFRENCH", "SUBENGLISH"]) {
    strippedTokens.delete(vostToken);
  }

  for (const language of LANGUAGE_ALIASES) {
    if (hasAny(strippedTokens, language.tokens)) return language.label;
  }

  if (hasAny(tokens, ["VO", "VOST", "VOSTFR", "VOSTEN"])) {
    return "Original audio";
  }

  return undefined;
}

function detectSubtitleLanguages(
  tokens: Set<string>,
  compact: string,
): string[] {
  const subtitles: string[] = [];
  if (tokens.has("VOSTFR") || compact.includes("SUBFRENCH")) {
    subtitles.push("French");
  }
  if (tokens.has("VOSTEN") || compact.includes("SUBENGLISH")) {
    subtitles.push("English");
  }

  return unique(subtitles);
}

function normalizeLanguageValue(value?: string | null): string | undefined {
  if (!value) return undefined;
  const upper = value.trim().toUpperCase();
  if (!upper) return undefined;
  if (["MULTI", "MULTIAUDIO", "MULTILINGUAL"].includes(upper)) {
    return "Multi audio";
  }
  if (["DUAL", "DUALAUDIO"].includes(upper)) return "Dual audio";

  const exact = LANGUAGE_ALIASES.find((language) =>
    language.tokens.includes(upper),
  );
  if (exact) return exact.label;

  return value.trim();
}

function formatLanguageLabel(
  audio?: string,
  subtitles: string[] = [],
): string {
  const audioLabel = audio ? `Audio: ${audio}` : "Audio: Unknown";
  if (subtitles.length === 0) return audioLabel;
  return `${audioLabel} + ${subtitles.join("/")} subs`;
}

function hasAny(tokens: Set<string>, values: string[]): boolean {
  return values.some((value) => tokens.has(value));
}

function hasPhrase(compact: string, values: string[]): boolean {
  return values.some((value) => compact.includes(value));
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}
