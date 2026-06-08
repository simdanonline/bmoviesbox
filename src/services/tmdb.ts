import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Minimal TMDB client for the one thing the main backend doesn't surface: a
 * title's ORIGINAL language. We use it to enforce original (non-dubbed) audio
 * during playback — both when ranking sources and when auto-selecting the audio
 * track inside the player.
 *
 * Auth: a v3 API key supplied via the EXPO_PUBLIC_TMDB_API_KEY env var (Expo
 * inlines EXPO_PUBLIC_* into the bundle at build time). When the key is absent
 * every call resolves to null, so the whole original-audio feature degrades
 * gracefully to the previous behaviour.
 */
const TMDB_BASE = "https://api.themoviedb.org/3";
const API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
const CACHE_PREFIX = "@bmoviebox_tmdb_origlang::";
// Original language is immutable for a title, so cache aggressively.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Session memo so repeated plays of the same title don't re-hit AsyncStorage.
const memo = new Map<string, string | null>();

/**
 * Resolve a title's original language as an ISO-639-1 code (e.g. "en", "ja",
 * "ko"). Returns null when unknown, the key is unset, or the lookup fails —
 * callers must treat null as "no reference available".
 */
export async function getOriginalLanguage(
  tmdbId: string | number | null | undefined,
  type: "movie" | "series",
): Promise<string | null> {
  if (!API_KEY) return null;
  if (tmdbId == null || tmdbId === "") return null;

  const endpoint = type === "series" ? "tv" : "movie";
  const key = `${endpoint}:${tmdbId}`;
  if (memo.has(key)) return memo.get(key) ?? null;

  const cached = await readCache(key);
  if (cached !== undefined) {
    memo.set(key, cached);
    return cached;
  }

  try {
    const res = await fetch(
      `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${API_KEY}`,
    );
    if (!res.ok) {
      memo.set(key, null);
      return null;
    }
    const data = (await res.json()) as { original_language?: unknown };
    const lang =
      typeof data.original_language === "string" && data.original_language
        ? data.original_language.toLowerCase()
        : null;
    memo.set(key, lang);
    void writeCache(key, lang);
    return lang;
  } catch {
    memo.set(key, null);
    return null;
  }
}

/** Returns the cached value, or `undefined` when there's no valid cache entry. */
async function readCache(key: string): Promise<string | null | undefined> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { lang: string | null; ts: number };
    if (Date.now() - parsed.ts >= CACHE_TTL_MS) return undefined;
    return parsed.lang;
  } catch {
    return undefined;
  }
}

async function writeCache(key: string, lang: string | null): Promise<void> {
  try {
    await AsyncStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({ lang, ts: Date.now() }),
    );
  } catch {
    // best-effort cache; ignore write failures
  }
}
