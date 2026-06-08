import MovieAPI, { Episode, ResolvedStream, Season } from "../services/MovieAPI";
import { pickBest } from "./streamRanking";
import { getOriginalLanguage } from "../services/tmdb";
import { preparePlayableStreams } from "./playbackValidation";
import type { PlaybackSourceContext } from "./playbackSourceHealth";

export interface NextEpisode {
  season: number;
  episode: Episode;
}

/**
 * Compute the episode that follows (season, episode) within `seasons`.
 * Stays within the current season when a higher episode number exists; at a
 * season finale rolls into the lowest-numbered episode of the next season.
 * Matches by season/episode NUMBER (not array index) to tolerate gaps and
 * unordered lists. Returns null at the series finale or for unknown input.
 */
export function getNextEpisode(
  seasons: Season[],
  currentSeason: number,
  currentEpisode: number,
): NextEpisode | null {
  const season = seasons.find((s) => s.seasonNumber === currentSeason);
  if (!season) return null;

  const later = season.episodes
    .filter((e) => e.episodeNumber > currentEpisode)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  if (later.length > 0) {
    return { season: currentSeason, episode: later[0] };
  }

  const nextSeason = seasons
    .filter((s) => s.seasonNumber > currentSeason)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  if (!nextSeason) return null;

  const firstEp = [...nextSeason.episodes].sort(
    (a, b) => a.episodeNumber - b.episodeNumber,
  )[0];
  if (!firstEp) return null;

  return { season: nextSeason.seasonNumber, episode: firstEp };
}

export interface SeriesRef {
  id: string;
  url: string;
  title: string;
}

export interface NextEpisodeParams {
  streams: ResolvedStream[];
  title: string;
  sourceContext: PlaybackSourceContext;
  streamProgressKey: string;
  originalLanguage?: string;
}

/**
 * Resolve, rank, and validate playable streams for a single episode, returning
 * the exact route-param bundle NativeVideoPlayer expects, or null when nothing
 * playable resolves (or any step throws). Mirrors the Tier-1 path in
 * SeriesDetailScreen.handlePlayEpisode so both call sites stay in sync.
 */
export async function resolveEpisodePlayback(
  series: SeriesRef,
  seasonNumber: number,
  episode: Episode,
): Promise<NextEpisodeParams | null> {
  try {
    const title = `${series.title} - S${seasonNumber}E${episode.episodeNumber} ${episode.episodeTitle}`;
    const languagePromise = getOriginalLanguage(series.id, "series");
    const resolved = await MovieAPI.getResolvedStreams(
      "series",
      { tmdbId: series.id },
      seasonNumber,
      episode.episodeNumber,
    );
    const originalLanguage = await languagePromise;
    const compatible = pickBest(
      resolved.filter((s) => s.type !== "magnet"),
      originalLanguage,
    );
    const sourceContext: PlaybackSourceContext = {
      tmdbId: String(series.id),
      kind: "episode",
      season: seasonNumber,
      episode: episode.episodeNumber,
    };
    const playable = await preparePlayableStreams(compatible, sourceContext);
    if (playable.length === 0) return null;
    return {
      streams: playable,
      title,
      sourceContext,
      streamProgressKey: `${series.url}::s${seasonNumber}e${episode.episodeNumber}`,
      originalLanguage: originalLanguage ?? undefined,
    };
  } catch (e) {
    console.warn("resolveEpisodePlayback failed:", e);
    return null;
  }
}
