import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ReleaseEvent } from "../types/app";

export interface Movie {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  imdbRating: string | null;
  runtime: string | null;
  releaseYear: string | null;
  genres: string[];
  country: string[];
  isSeries?: boolean;
}

export interface StreamingServer {
  serverName: string;
  name?: string;
  serverNumber: number;
  quality: string;
  url: string;
}

/** Direct playable stream returned by the backend's /api/streams endpoint. */
export interface ResolvedStream {
  url: string;
  headers?: Record<string, string>;
  name: string;
  title: string;
  quality: "CAM" | "480p" | "720p" | "1080p" | "4K" | "unknown";
  sizeBytes?: number;
  seeders?: number;
  source: string;
  language?: string;
  audioLanguages?: string[];
  subtitleLanguages?: string[];
  rdCached?: boolean;
  type: "hls" | "mp4" | "mkv" | "magnet";
}

export interface MovieDetail {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  coverImage: string;
  description: string;
  views: number;
  duration: string;
  releaseDate: string;
  releaseYear: string;
  trailerUrl: string | null;
  streamingServers: StreamingServer[];
  ratings: {
    imdb: string | null;
    tmdb: string | null;
    rottenTomatoes: string | null;
    metacritic: string | null;
    averageRating: string | null;
  };
  directors: string[];
  actors: string[];
  genres: string[];
  countries: string[];
  companies: string[];
  awards: string | null;
  images: string[];
}

export interface MoviesResponse {
  movies: Movie[];
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
export interface Episode {
  episodeNumber: number;
  episodeTitle: string;
  episodeUrl: string;
}

export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}
export interface SeriesDetail {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  coverImage: string;
  description: string;
  views: number;
  duration: string;
  releaseDate: string;
  releaseYear: string;
  trailerUrl: string;
  streamingServers: Array<{
    name: string;
    embedUrl: string;
  }>;
  ratings: {
    imdb: string;
    tmdb: string;
    rottenTomatoes: string;
    metacritic: string;
    averageRating: string;
  };
  directors: string[];
  actors: string[];
  genres: string[];
  countries: string[];
  companies: string[];
  awards: string;
  images: string[];
  seasons: Season[];
}

export interface LiveGame {
  id: string;
  sport: string;
  league: string;
  leagueLogo: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: string | null;
  awayScore: string | null;
  status: string;
  statusDetail: string;
  state: "pre" | "in" | "post" | "unknown";
  datetime: string;
  link: string;
}

export interface LiveStream {
  link: string;
  source: string;
  quality: string;
  language: string;
  channel: string;
}

export interface LiveGameEmbed {
  embedLink: string;
}

export interface SportsLeague {
  sport: string;
  league: string;
  displayName: string;
}

export interface TeamMetadata {
  id: string;
  name: string;
  shortName: string | null;
  badge: string | null;
  logo: string | null;
  jersey: string | null;
  stadium: string | null;
  stadiumImage: string | null;
  country: string | null;
  formedYear: string | null;
  description: string | null;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MovieAPI {
  private apiClient: AxiosInstance;
  // QA ONLY — revert before commit: point at local backend for live-game-search testing
  // private baseURL: string = "http://localhost:4001/api";
  private baseURL: string = "https://bmoviebox-b.simdan.dev/api";
  private movieCache: Map<string, CacheEntry<MoviesResponse>> = new Map();
  private seriesCache: Map<string, CacheEntry<MoviesResponse>> = new Map();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes in milliseconds
  private readonly PERSISTENT_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private readonly MOVIES_CACHE_KEY = "bmoviebox_movies_cache";
  private readonly SERIES_CACHE_KEY = "bmoviebox_series_cache";

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }

    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
    });

    // Load persisted cache on initialization
    this.loadPersistedCache();
  }

  private async loadPersistedCache(): Promise<void> {
    try {
      const moviesData = await AsyncStorage.getItem(this.MOVIES_CACHE_KEY);
      const seriesData = await AsyncStorage.getItem(this.SERIES_CACHE_KEY);

      if (moviesData) {
        const parsed = JSON.parse(moviesData);
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          this.movieCache.set(key, value);
        });
      }

      if (seriesData) {
        const parsed = JSON.parse(seriesData);
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          this.seriesCache.set(key, value);
        });
      }
    } catch (error) {
      console.error("Failed to load persisted cache:", error);
    }
  }

  private async persistCache(
    cache: Map<string, CacheEntry<MoviesResponse>>,
    key: string
  ): Promise<void> {
    try {
      const cacheObject = Object.fromEntries(cache);
      await AsyncStorage.setItem(key, JSON.stringify(cacheObject));
    } catch (error) {
      console.error(`Failed to persist cache (${key}):`, error);
    }
  }

  private isCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  private isPersistentCacheValid<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < this.PERSISTENT_CACHE_DURATION;
  }

  // Get all movies with pagination and caching (with persistent fallback for poor network)
  async getAllMovies(page: number = 1): Promise<MoviesResponse> {
    const cacheKey = `page_${page}`;
    
    // Check if cache exists and is still valid (fresh cache)
    const cached = this.movieCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }

    try {
      const response = await this.apiClient.get<MoviesResponse>("/movies", {
        params: { page },
      });
      
      // Store in both memory and persistent cache
      const cacheEntry: CacheEntry<MoviesResponse> = {
        data: response.data,
        timestamp: Date.now(),
      };
      this.movieCache.set(cacheKey, cacheEntry);
      await this.persistCache(this.movieCache, this.MOVIES_CACHE_KEY);

      return response.data;
    } catch (error) {
      // If API fails, try to use persistent cache (even if stale)
      if (cached && this.isPersistentCacheValid(cached)) {
        return cached.data;
      }
      
      throw this.handleError(error);
    }
  }

  async getAllSeries(page: number = 1): Promise<MoviesResponse> {
    const cacheKey = `page_${page}`;

    // Check if cache exists and is still valid (fresh cache)
    const cached = this.seriesCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }

    try {
      const response = await this.apiClient.get<MoviesResponse>("/movies/series", {
        params: { page },
      });

      // Store in both memory and persistent cache
      const cacheEntry: CacheEntry<MoviesResponse> = {
        data: response.data,
        timestamp: Date.now(),
      };
      this.seriesCache.set(cacheKey, cacheEntry);
      await this.persistCache(this.seriesCache, this.SERIES_CACHE_KEY);

      return response.data;
    } catch (error) {
      // If API fails, try to use persistent cache (even if stale)
      if (cached && this.isPersistentCacheValid(cached)) {
        return cached.data;
      }

      throw this.handleError(error);
    }
  }

  async getSeriesByUrl(url: string): Promise<SeriesDetail> {
    try {
      const response = await this.apiClient.get<SeriesDetail>(
        "/movies/series-detail",
        {
          params: { url },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSeriesServer(url: string): Promise<{title: string, videoLinks: StreamingServer[]}> {
    try {
      const response = await this.apiClient.get<{title: string, videoLinks: StreamingServer[]}>(
        "/movies/video-links",
        {
          params: { url },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Search movies
  async searchMovies(query: string): Promise<{ results: Movie[], series: Movie[] }> {
    try {
      const response = await this.apiClient.get<{ results: Movie[], series: Movie[] }>(
        "/movies/search",
        {
          params: { q: query },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get movie details by slug
  async getMovieDetailsBySlug(slug: string): Promise<MovieDetail> {
    try {
      const response = await this.apiClient.get<MovieDetail>(
        `/movies/details/${slug}`
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get movie details by URL
  async getMovieDetailsByUrl(url: string): Promise<MovieDetail> {
    try {
      const response = await this.apiClient.get<MovieDetail>(
        "/movies/details",
        {
          params: { url },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get movies by genre
  async getMoviesByGenre(
    genre: string,
    page: number = 1
  ): Promise<MoviesResponse> {
    try {
      const response = await this.apiClient.get<MoviesResponse>(
        `/movies/genre/${genre}`,
        {
          params: { page },
        }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Set custom base URL
  setBaseURL(baseURL: string) {
    this.baseURL = baseURL;
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
    });
  }

  // Clear cache for specific page or all cache
  clearMovieCache(page?: number): void {
    if (page !== undefined) {
      this.movieCache.delete(`page_${page}`);
    } else {
      this.movieCache.clear();
    }
  }

  clearSeriesCache(page?: number): void {
    if (page !== undefined) {
      this.seriesCache.delete(`page_${page}`);
    } else {
      this.seriesCache.clear();
    }
  }

  clearAllCache(): void {
    this.movieCache.clear();
    this.seriesCache.clear();
  }

  async getLiveGames(filter?: {
    sport?: string;
    league?: string;
  }): Promise<LiveGame[]> {
    try {
      const response = await this.apiClient.get<LiveGame[]>("/sports/games", {
        params: filter,
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching live games:", error);
      throw this.handleError(error);
    }
  }

  // Cross-league game search — backend returns [] on upstream failure, and we
  // also swallow transport errors: search extras are best-effort.
  async searchLiveGames(query: string): Promise<LiveGame[]> {
    try {
      const response = await this.apiClient.get<LiveGame[]>("/sports/search", {
        params: { q: query },
      });
      return response.data ?? [];
    } catch {
      return [];
    }
  }

  async getSportsLeagues(): Promise<SportsLeague[]> {
    try {
      const response =
        await this.apiClient.get<SportsLeague[]>("/sports/leagues");
      return response.data;
    } catch (error) {
      console.error("Error fetching sports leagues:", error);
      throw this.handleError(error);
    }
  }

  async getTeamMetadata(name: string): Promise<TeamMetadata | null> {
    try {
      const response = await this.apiClient.get<TeamMetadata | null>(
        "/sports/team",
        { params: { name } }
      );
      return response.data;
    } catch {
      return null;
    }
  }

  async getStreams(link: string): Promise<LiveStream[]> {
    try {
      const response = await this.apiClient.get<LiveStream[]>(
        "/sports/streams",
        { params: { link } }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching streams:", error);
      throw this.handleError(error);
    }
  }

  /**
   * Resolve playable stream URLs for a movie or episode via the backend's
   * Stremio-addon + Real-Debrid pipeline. Returns ranked direct URLs that
   * can be handed to expo-video / react-native-video without a WebView.
   *
   * Either tmdbId or imdbId works. Use whichever the calling screen has.
   */
  async getResolvedStreams(
    type: "movie" | "series",
    ids: { tmdbId?: string | number; imdbId?: string },
    season?: number,
    episode?: number
  ): Promise<ResolvedStream[]> {
    try {
      const params: Record<string, string | number> = { type };
      if (ids.tmdbId != null) params.tmdb = String(ids.tmdbId);
      if (ids.imdbId) params.imdb = ids.imdbId;
      if (season != null) params.season = season;
      if (episode != null) params.episode = episode;
      const response = await this.apiClient.get<{ streams: ResolvedStream[] }>(
        "/streams",
        { params, timeout: 20_000 }
      );
      return response.data?.streams ?? [];
    } catch (error) {
      console.warn("getResolvedStreams failed:", error);
      return []; // graceful: caller falls back to WebView path
    }
  }

  /**
   * Tier-1 live resolver. Asks the backend to fetch the embed page for the
   * given stream link and pull out any direct HLS / MP4 URLs (plus the
   * `Referer`/`Origin` headers the origin host requires). Returns an empty
   * array when extraction fails — caller falls back to the WebView embed.
   *
   * Mirrors `getResolvedStreams` for VOD: same `ResolvedStream` shape so the
   * native player and source picker work without branching.
   */
  async getResolvedLiveStreams(link: string): Promise<ResolvedStream[]> {
    try {
      const response = await this.apiClient.get<{ streams: ResolvedStream[] }>(
        "/sports/resolve",
        { params: { link }, timeout: 15_000 },
      );
      return response.data?.streams ?? [];
    } catch (e) {
      console.warn("getResolvedLiveStreams failed:", e);
      return [];
    }
  }

  async getLiveGameEmbed(link: string): Promise<LiveGameEmbed> {
    try {
      const response = await this.apiClient.get<LiveGameEmbed>(
        "/sports/embed",
        { params: { link } }
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Calendar endpoints — gracefully fail if backend doesn't support them
  async getCalendar(from: string, to: string): Promise<ReleaseEvent[]> {
    try {
      const response = await this.apiClient.get<ReleaseEvent[]>("/calendar", {
        params: { from, to },
      });
      return response.data;
    } catch {
      // Endpoint may not exist — return empty
      return [];
    }
  }

  async getTitleReleaseSchedule(url: string): Promise<ReleaseEvent[]> {
    try {
      const response = await this.apiClient.get<ReleaseEvent[]>(
        "/movies/release-schedule",
        { params: { url } }
      );
      return response.data;
    } catch {
      return [];
    }
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return new Error(
          error.response.data?.message || "Failed to fetch from API"
        );
      } else if (error.request) {
        return new Error(
          "No response from server. Check if API is running and URL is correct."
        );
      }
    }
    return error instanceof Error ? error : new Error("Unknown error occurred");
  }
}

export default new MovieAPI();
