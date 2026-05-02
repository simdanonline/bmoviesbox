import { Movie } from "./MovieAPI";
import {
  TasteProfile,
  LibraryItem,
  KnownTitleMetadata,
  Mood,
} from "../types/app";

// Mood → genre affinity mapping
const MOOD_GENRE_MAP: Record<Mood, string[]> = {
  exciting: ["Action", "Adventure", "Thriller", "Sci-Fi"],
  cozy: ["Romance", "Family", "Animation", "Comedy"],
  dark: ["Horror", "Crime", "Thriller", "Mystery"],
  funny: ["Comedy", "Animation", "Family"],
  mind_bending: ["Sci-Fi", "Mystery", "Thriller", "Fantasy"],
  feel_good: ["Comedy", "Romance", "Family", "Drama", "Music"],
};

function parseRuntime(runtime: string | null | undefined): number | null {
  if (!runtime) return null;
  const match = runtime.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function getDecade(year: string | null | undefined): string | null {
  if (!year) return null;
  const y = parseInt(year, 10);
  if (isNaN(y)) return null;
  if (y < 1980) return "Classic (pre-1980)";
  const decade = Math.floor(y / 10) * 10;
  return `${decade}s`;
}

interface ScoredMovie extends Movie {
  score: number;
}

export function scoreTitle(
  movie: Movie,
  profile: TasteProfile,
  metadata: KnownTitleMetadata | undefined,
  completedUrls: Set<string>,
  droppedUrls: Set<string>,
  ratings: Record<string, { rating: number }>,
  historyUrls: Set<string>
): number {
  let score = 50; // base score

  const genres = movie.genres || [];
  const runtime = parseRuntime(metadata?.runtime || movie.runtime);
  const year = movie.releaseYear || metadata?.releaseYear;
  const decade = getDecade(year);
  const imdb = parseFloat(movie.imdbRating || metadata?.imdbRating || "0");

  // Genre matching
  for (const g of genres) {
    if (profile.favoriteGenres.includes(g)) score += 15;
    if (profile.dislikedGenres.includes(g)) score -= 20;
  }

  // Mood affinity
  for (const mood of profile.moods) {
    const affinityGenres = MOOD_GENRE_MAP[mood] || [];
    for (const g of genres) {
      if (affinityGenres.includes(g)) score += 5;
    }
  }

  // Runtime match
  if (runtime && profile.runtimeBuckets.length > 0) {
    const bucket =
      runtime < 90
        ? "under_90"
        : runtime <= 120
        ? "between_90_120"
        : "over_120";
    if (profile.runtimeBuckets.includes(bucket)) score += 8;
  }

  // Decade match
  if (decade && profile.decades.includes(decade)) score += 8;

  // High IMDb boost
  if (imdb >= 8) score += 12;
  else if (imdb >= 7) score += 6;
  else if (imdb >= 6) score += 2;
  else if (imdb > 0 && imdb < 5) score -= 5;

  // User rating affinity: boost genres of highly-rated titles
  const userRating = ratings[movie.url]?.rating;
  if (userRating && userRating >= 4) score += 10;
  if (userRating && userRating <= 2) score -= 15;

  // Penalize completed/dropped
  if (completedUrls.has(movie.url)) score -= 40;
  if (droppedUrls.has(movie.url)) score -= 60;

  // Slight boost for unseen
  if (!historyUrls.has(movie.url)) score += 5;

  // Favorite people boost
  if (profile.favoritePeople.length > 0 && metadata) {
    const people = [
      ...(metadata.directors || []),
      ...(metadata.actors || []),
    ];
    for (const person of people) {
      if (
        profile.favoritePeople.some(
          (fp) => person.toLowerCase().includes(fp.toLowerCase())
        )
      ) {
        score += 10;
      }
    }
  }

  return score;
}

export function buildRecommendationPool(
  movies: Movie[],
  series: Movie[],
  profile: TasteProfile,
  library: LibraryItem[],
  knownMetadata: Record<string, KnownTitleMetadata>,
  ratings: Record<string, { rating: number }>,
  historyUrls: Set<string>
): ScoredMovie[] {
  const completedUrls = new Set(
    library.filter((l) => l.status === "completed").map((l) => l.url)
  );
  const droppedUrls = new Set(
    library.filter((l) => l.status === "dropped").map((l) => l.url)
  );

  const allTitles = [...movies, ...series];
  const seen = new Set<string>();

  return allTitles
    .filter((m) => {
      if (seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    })
    .map((m) => ({
      ...m,
      score: scoreTitle(
        m,
        profile,
        knownMetadata[m.url],
        completedUrls,
        droppedUrls,
        ratings,
        historyUrls
      ),
    }))
    .sort((a, b) => b.score - a.score);
}

export interface RecommendationRail {
  id: string;
  title: string;
  items: Movie[];
}

export function getPersonalizedRails(
  pool: ScoredMovie[],
  profile: TasteProfile,
  ratings: Record<string, { rating: number }>
): RecommendationRail[] {
  const rails: RecommendationRail[] = [];

  // For You — top scored items
  const forYou = pool.filter((m) => m.score > 50).slice(0, 15);
  if (forYou.length > 0) {
    rails.push({ id: "for_you", title: "For You", items: forYou });
  }

  // Quick Picks Tonight — shorter runtime, high score
  const quickPicks = pool
    .filter((m) => {
      const rt = parseRuntime(m.runtime);
      return rt !== null && rt <= 120 && m.score > 40;
    })
    .slice(0, 12);
  if (quickPicks.length > 0) {
    rails.push({
      id: "quick_picks",
      title: "Quick Picks Tonight",
      items: quickPicks,
    });
  }

  // Because You Like [top genre] — find the user's top genre and show matches
  if (profile.favoriteGenres.length > 0) {
    const topGenre = profile.favoriteGenres[0];
    const genreMatches = pool
      .filter((m) => m.genres?.includes(topGenre))
      .slice(0, 12);
    if (genreMatches.length > 0) {
      rails.push({
        id: "because_genre",
        title: `Because You Like ${topGenre}`,
        items: genreMatches,
      });
    }
  }

  // Highly Rated picks
  const highlyRated = pool
    .filter((m) => {
      const imdb = parseFloat(m.imdbRating || "0");
      return imdb >= 7.5;
    })
    .slice(0, 12);
  if (highlyRated.length > 0) {
    rails.push({
      id: "highly_rated",
      title: "Highly Rated",
      items: highlyRated,
    });
  }

  return rails;
}
