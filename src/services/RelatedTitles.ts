import MovieAPI, { Movie } from "./MovieAPI";

/**
 * Related titles for a detail page, derived from the title's primary genre using
 * existing catalog endpoints (no new backend). Movies use the by-genre endpoint;
 * series fall back to the full series list filtered by shared genre (there is no
 * series-by-genre endpoint). Always resolves — network failures yield [].
 */
export async function getRelatedTitles(
  kind: "movie" | "series",
  genres: string[],
  excludeUrl: string,
  limit: number = 12,
): Promise<Movie[]> {
  const primaryGenre = genres?.[0];
  if (!primaryGenre) return [];
  try {
    const resp =
      kind === "movie"
        ? await MovieAPI.getMoviesByGenre(primaryGenre)
        : await MovieAPI.getAllSeries();
    const items = resp?.movies ?? [];
    return items
      .filter((m) => m.url !== excludeUrl)
      .filter((m) =>
        kind === "series" ? (m.genres ?? []).includes(primaryGenre) : true,
      )
      .slice(0, limit)
      .map((m) => ({ ...m, isSeries: kind === "series" }));
  } catch {
    return [];
  }
}
