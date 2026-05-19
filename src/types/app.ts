export type WatchStatus =
  | "want_to_watch"
  | "watching"
  | "completed"
  | "dropped";

export type Mood =
  | "exciting"
  | "cozy"
  | "dark"
  | "funny"
  | "mind_bending"
  | "feel_good";

export const MOOD_LABELS: Record<Mood, string> = {
  exciting: "Exciting",
  cozy: "Cozy",
  dark: "Dark",
  funny: "Funny",
  mind_bending: "Mind-Bending",
  feel_good: "Feel Good",
};

export type RuntimeBucket = "under_90" | "between_90_120" | "over_120";

export const RUNTIME_LABELS: Record<RuntimeBucket, string> = {
  under_90: "Under 90 min",
  between_90_120: "90–120 min",
  over_120: "Over 2 hours",
};

export const DECADES = [
  "2020s",
  "2010s",
  "2000s",
  "1990s",
  "1980s",
  "Classic (pre-1980)",
];

export const ALL_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Musical",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Sport",
  "Thriller",
  "War",
  "Western",
];

export const STATUS_LABELS: Record<WatchStatus, string> = {
  want_to_watch: "Want to Watch",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

export const STATUS_COLORS: Record<WatchStatus, string> = {
  want_to_watch: "#3498db",
  watching: "#e74c3c",
  completed: "#2ecc71",
  dropped: "#95a5a6",
};

export interface TasteProfile {
  favoriteGenres: string[];
  dislikedGenres: string[];
  moods: Mood[];
  runtimeBuckets: RuntimeBucket[];
  decades: string[];
  languages: string[];
  favoritePeople: string[];
  onboardingCompletedAt: number | null;
  updatedAt: number;
}

export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  favoriteGenres: [],
  dislikedGenres: [],
  moods: [],
  runtimeBuckets: [],
  decades: [],
  languages: [],
  favoritePeople: [],
  onboardingCompletedAt: null,
  updatedAt: Date.now(),
};

export interface LibraryItem {
  url: string;
  id: string;
  title: string;
  thumbnail: string;
  releaseYear: string | null;
  genres: string[];
  imdbRating: string | null;
  isSeries: boolean;
  status: WatchStatus;
  savedAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  lastEpisodeUrl: string | null;
  lastSeasonNumber: number | null;
  lastEpisodeNumber: number | null;
  completedEpisodes: number;
  totalEpisodes: number | null;
}

export interface EpisodeProgress {
  seriesUrl: string;
  episodeUrl: string;
  episodeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  watched: boolean;
  watchedAt: number | null;
  updatedAt: number;
}

export interface ReleaseEvent {
  id: string;
  titleUrl: string;
  title: string;
  isSeries: boolean;
  thumbnail?: string | null;
  releaseAt: string;
  label?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  source: "api" | "local_cache" | "reminder";
}

export interface TitleReminder {
  id: string;
  titleUrl: string;
  title: string;
  releaseAt: string;
  isSeries: boolean;
  leadTime: "at_time" | "1_hour_before" | "1_day_before";
  notificationId: string | null;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type WatchPlanStatus = "planned" | "done" | "skipped";

export interface WatchPlanItem {
  id: string;
  titleUrl: string;
  detailSlug?: string | null;
  title: string;
  isSeries: boolean;
  thumbnail?: string | null;
  plannedFor: string;
  note: string;
  status: WatchPlanStatus;
  createdAt: number;
  updatedAt: number;
}

export interface TitleNote {
  titleUrl: string;
  title: string;
  isSeries: boolean;
  thumbnail?: string | null;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export const LEAD_TIME_LABELS: Record<TitleReminder["leadTime"], string> = {
  at_time: "At release",
  "1_hour_before": "1 hour before",
  "1_day_before": "1 day before",
};

export interface KnownTitleMetadata {
  url: string;
  title: string;
  isSeries: boolean;
  thumbnail?: string | null;
  coverImage?: string | null;
  genres: string[];
  runtime?: string | null;
  releaseYear?: string | null;
  releaseDate?: string | null;
  imdbRating?: string | null;
  directors?: string[];
  actors?: string[];
  countries?: string[];
  updatedAt: number;
}
