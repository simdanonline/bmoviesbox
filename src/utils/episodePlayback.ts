import type { Episode, Season } from "../services/MovieAPI";

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
