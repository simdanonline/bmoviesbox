import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class MovieAPI {
  private apiClient: AxiosInstance;
  private baseURL: string = "https://movie-scraper-vml3.onrender.com/api";
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
        console.log("📦 Loaded persisted movies cache");
      }

      if (seriesData) {
        const parsed = JSON.parse(seriesData);
        Object.entries(parsed).forEach(([key, value]: [string, any]) => {
          this.seriesCache.set(key, value);
        });
        console.log("📦 Loaded persisted series cache");
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
      console.log(`📦 Using fresh cached movies for page ${page}`);
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
        console.log(`⚠️ API failed, using persistent cached movies for page ${page}`);
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
      console.log(`📦 Using fresh cached series for page ${page}`);
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
        console.log(`⚠️ API failed, using persistent cached series for page ${page}`);
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
      console.log(`🗑️ Cleared movie cache for page ${page}`);
    } else {
      this.movieCache.clear();
      console.log(`🗑️ Cleared all movie cache`);
    }
  }

  clearSeriesCache(page?: number): void {
    if (page !== undefined) {
      this.seriesCache.delete(`page_${page}`);
      console.log(`🗑️ Cleared series cache for page ${page}`);
    } else {
      this.seriesCache.clear();
      console.log(`🗑️ Cleared all series cache`);
    }
  }

  clearAllCache(): void {
    this.movieCache.clear();
    this.seriesCache.clear();
    console.log(`🗑️ Cleared all cache`);
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
