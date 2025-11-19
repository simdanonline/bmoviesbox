import axios, { AxiosInstance } from "axios";

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

class MovieAPI {
  private apiClient: AxiosInstance;
  private baseURL: string = "https://movie-scraper-vml3.onrender.com/api";

  constructor(baseURL?: string) {
    if (baseURL) {
      this.baseURL = baseURL;
    }

    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
    });
  }

  // Get all movies with pagination
  async getAllMovies(page: number = 1): Promise<MoviesResponse> {
    try {
      const response = await this.apiClient.get<MoviesResponse>("/movies", {
        params: { page },
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getAllSeries(page: number = 1): Promise<MoviesResponse> {
    try {
      const response = await this.apiClient.get<MoviesResponse>("/movies/series", {
        params: { page },
      });
      return response.data;
    } catch (error) {
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
