# Movie Scraper API Documentation

## Overview

This NestJS backend provides two distinct movie scraping APIs:

1. **SOAP2Day API** - Robust, feature-rich movie scraping with detailed metadata (Recommended)
2. **EgyDead Scraper API** - Direct video link scraping from EgyDead.skin (Legacy)

The SOAP API is recommended for production use due to superior data quality, pagination support, and comprehensive metadata extraction.

---

## Quick Start

### Installation & Setup

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev

# Build for production
npm run build

# Start production server
npm run start
```

The server runs on **http://localhost:3000** by default.

---

## SOAP2Day API (Recommended)

**Base URL:** `http://localhost:3000/api/movies`

**Source:** `https://ww25.soap2day.day` (Embedded in service)

**Features:**

- Paginated movie listings
- Genre filtering
- Full-text search
- Detailed movie metadata
- Multiple streaming servers per movie
- Rating aggregation (IMDB, TMDB, Rotten Tomatoes, Metacritic)
- Director/Actor information
- Production company details

### Response Models

#### Movie Object

```typescript
interface Movie {
  id: string; // Movie unique identifier
  title: string; // Movie title
  url: string; // Full movie URL
  thumbnail: string; // Thumbnail image URL
  imdbRating: string | null; // IMDB rating (e.g., "8.5")
  runtime: string | null; // Duration (e.g., "148 min")
  releaseYear: string | null; // Release year
  genres: string[]; // Array of genre names
  country: string[]; // Array of country names
}
```

#### MovieDetail Object

```typescript
interface MovieDetail {
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

  // Streaming links
  streamingServers: StreamingServer[];

  // Ratings
  ratings: {
    imdb: string | null;
    tmdb: string | null;
    rottenTomatoes: string | null;
    metacritic: string | null;
    averageRating: string | null;
  };

  // People
  directors: string[];
  actors: string[];

  // Additional info
  genres: string[];
  countries: string[];
  companies: string[];
  awards: string | null;

  // Images
  images: string[];
}
```

#### StreamingServer Object

```typescript
interface StreamingServer {
  serverName: string; // Server name (e.g., "HQQServer")
  serverNumber: number; // 1-based server index
  quality: string; // Quality (e.g., "HD", "1080p")
  url: string; // Streaming URL
}
```

#### MoviesResponse Object

```typescript
interface MoviesResponse {
  movies: Movie[];
  pagination: {
    currentPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
```

### Endpoints

#### 1. Get All Movies (Paginated)

```
GET /api/movies?page=1
```

**Query Parameters:**

- `page` (optional, default: 1) - Page number for pagination

**Response:** `MoviesResponse`

**Example Request:**

```bash
curl "http://localhost:3000/api/movies?page=1"
```

**Example Response:**

```json
{
  "movies": [
    {
      "id": "12345",
      "title": "The Shawshank Redemption",
      "url": "https://ww25.soap2day.day/the-shawshank-redemption-1234/",
      "thumbnail": "https://image.tmdb.org/t/p/w342/...",
      "imdbRating": "9.3",
      "runtime": "142 min",
      "releaseYear": "1994",
      "genres": ["Drama"],
      "country": ["United States"]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 156,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `502 Bad Gateway` - Failed to fetch from source
- `500 Internal Server Error` - Server error

---

#### 2. Search Movies

```
GET /api/movies/search?q=query
```

**Query Parameters:**

- `q` (required) - Search query (e.g., "Avatar", "Inception")

**Response:** `{ results: Movie[] }`

**Example Request:**

```bash
curl "http://localhost:3000/api/movies/search?q=Avatar"
```

**Example Response:**

```json
{
  "results": [
    {
      "id": "67890",
      "title": "Avatar",
      "url": "https://ww25.soap2day.day/avatar-2009/",
      "thumbnail": "https://image.tmdb.org/t/p/w342/...",
      "imdbRating": "7.8",
      "runtime": "162 min",
      "releaseYear": "2009",
      "genres": ["Action", "Adventure", "Sci-Fi"],
      "country": ["United States"]
    }
  ]
}
```

**HTTP Status Codes:**

- `200 OK` - Search results found
- `502 Bad Gateway` - Failed to search
- `500 Internal Server Error` - Server error

---

#### 3. Get Movie Details by Slug

```
GET /api/movies/details/:slug
```

**Path Parameters:**

- `slug` (required) - Movie slug (from movie URL, e.g., "the-shawshank-redemption-1234")

**Response:** `MovieDetail`

**Example Request:**

```bash
curl "http://localhost:3000/api/movies/details/the-shawshank-redemption-1234"
```

**Example Response:**

```json
{
  "id": "12345",
  "title": "The Shawshank Redemption",
  "url": "https://ww25.soap2day.day/the-shawshank-redemption-1234/",
  "thumbnail": "https://image.tmdb.org/t/p/w342/...",
  "coverImage": "https://image.tmdb.org/t/p/w1280/...",
  "description": "Two imprisoned men bond over...",
  "views": 1250000,
  "duration": "142 min",
  "releaseDate": "1994-09-23",
  "releaseYear": "1994",
  "trailerUrl": "https://www.youtube.com/embed/...",
  "streamingServers": [
    {
      "serverName": "HQQServer",
      "serverNumber": 1,
      "quality": "HD",
      "url": "https://hqq.tv/watch/..."
    },
    {
      "serverName": "VidCloud",
      "serverNumber": 2,
      "quality": "1080p",
      "url": "https://vidcloud.co/..."
    }
  ],
  "ratings": {
    "imdb": "9.3",
    "tmdb": "8.7",
    "rottenTomatoes": "92",
    "metacritic": "82",
    "averageRating": "9.2"
  },
  "directors": ["Frank Darabont"],
  "actors": ["Tim Robbins", "Morgan Freeman", "Bob Gunton"],
  "genres": ["Drama"],
  "countries": ["United States"],
  "companies": ["Castle Rock Entertainment"],
  "awards": "Academy Award for Best Picture (1995)",
  "images": [
    "https://image.tmdb.org/t/p/w1280/...",
    "https://image.tmdb.org/t/p/w1280/..."
  ]
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `502 Bad Gateway` - Failed to fetch movie details
- `500 Internal Server Error` - Server error

---

#### 4. Get Movie Details by URL

```
GET /api/movies/details?url=/the-shawshank-redemption-1234/
```

**Query Parameters:**

- `url` (required) - Full or partial movie URL

**Response:** `MovieDetail`

**Example Request:**

```bash
curl "http://localhost:3000/api/movies/details?url=/the-shawshank-redemption-1234/"
```

**HTTP Status Codes:**

- `200 OK` - Success
- `502 Bad Gateway` - Failed to fetch movie details
- `500 Internal Server Error` - Server error

---

#### 5. Get Movies by Genre (Paginated)

```
GET /api/movies/genre/:genre?page=1
```

**Path Parameters:**

- `genre` (required) - Genre name (e.g., "Action", "Drama", "Comedy")

**Query Parameters:**

- `page` (optional, default: 1) - Page number for pagination

**Response:** `MoviesResponse`

**Example Request:**

```bash
curl "http://localhost:3000/api/movies/genre/Action?page=1"
```

**Example Response:**

```json
{
  "movies": [
    {
      "id": "67890",
      "title": "Avatar",
      "url": "https://ww25.soap2day.day/avatar-2009/",
      "thumbnail": "https://image.tmdb.org/t/p/w342/...",
      "imdbRating": "7.8",
      "runtime": "162 min",
      "releaseYear": "2009",
      "genres": ["Action", "Adventure", "Sci-Fi"],
      "country": ["United States"]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 45,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Supported Genres:**

- Action, Adventure, Animation, Biography, Comedy, Crime, Documentary, Drama, Family, Fantasy, Film-Noir, History, Horror, Music, Musical, Mystery, Romance, Sci-Fi, Sport, Thriller, War, Western

**HTTP Status Codes:**

- `200 OK` - Success
- `502 Bad Gateway` - Failed to fetch genre data
- `500 Internal Server Error` - Server error

---

## EgyDead Scraper API (Legacy)

**Base URL:** `http://localhost:3000/api/scraper`

**Source:** `https://egydead.skin`

**Features:**

- Direct video link extraction
- Movie search by title
- Direct link retrieval from URLs
- 4-level fallback selector strategy
- Enhanced error handling

### Response Model

#### MovieLink Object

```typescript
interface MovieLink {
  title: string; // Server name or link title
  url: string; // Direct streaming URL
  quality?: string; // Video quality (optional)
}
```

### Endpoints

#### 1. Search Movies

```
GET /api/scraper/search?q=query
```

**Query Parameters:**

- `q` (required) - Search query

**Response:**

```json
{
  "success": boolean,
  "data": MovieLink[],
  "message": string
}
```

**Example Request:**

```bash
curl "http://localhost:3000/api/scraper/search?q=Avatar"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "title": "Avatar - Server 1",
      "url": "https://vidcloud.co/embed/..."
    },
    {
      "title": "Avatar - Server 2",
      "url": "https://hqq.tv/watch/..."
    }
  ],
  "message": "Found 2 result(s) for \"Avatar\""
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `400 Bad Request` - Missing or invalid query
- `502 Bad Gateway` - Failed to scrape
- `500 Internal Server Error` - Server error

---

#### 2. Get Movie Links from URL

```
GET /api/scraper/movie?url=movie_url
```

**Query Parameters:**

- `url` (required) - Full URL to movie page

**Response:**

```json
{
  "success": boolean,
  "data": MovieLink[],
  "message": string
}
```

**Example Request:**

```bash
curl "http://localhost:3000/api/scraper/movie?url=https://egydead.skin/avatar"
```

**Example Response:**

```json
{
  "success": true,
  "data": [
    {
      "title": "Default Server",
      "url": "https://vidcloud.co/embed/xyz123"
    }
  ],
  "message": "Found 1 video link(s)"
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `400 Bad Request` - Missing or invalid URL
- `404 Not Found` - Movie not found
- `502 Bad Gateway` - Failed to scrape
- `500 Internal Server Error` - Server error

---

#### 3. Scrape Movie by Title

```
GET /api/scraper/scrape?title=movie_title
```

**Query Parameters:**

- `title` (required) - Movie title

**Response:**

```json
{
  "success": boolean,
  "movie": string,
  "links": MovieLink[],
  "message": string
}
```

**Example Request:**

```bash
curl "http://localhost:3000/api/scraper/scrape?title=The%20Shawshank%20Redemption"
```

**Example Response:**

```json
{
  "success": true,
  "movie": "The Shawshank Redemption",
  "links": [
    {
      "title": "Default Server",
      "url": "https://vidcloud.co/embed/..."
    }
  ],
  "message": "Successfully scraped 1 video link(s) for \"The Shawshank Redemption\""
}
```

**HTTP Status Codes:**

- `200 OK` - Success
- `400 Bad Request` - Missing or invalid title
- `404 Not Found` - Movie not found
- `502 Bad Gateway` - Failed to scrape
- `500 Internal Server Error` - Server error

---

## API Comparison

| Feature               | SOAP API            | EgyDead API         |
| --------------------- | ------------------- | ------------------- |
| **Pagination**        | ✅ Yes              | ❌ No               |
| **Search**            | ✅ Yes (Full-text)  | ✅ Yes (Basic)      |
| **Genre Filtering**   | ✅ Yes              | ❌ No               |
| **Movie Metadata**    | ✅ Extensive        | ❌ Minimal          |
| **Ratings**           | ✅ Multiple sources | ❌ No               |
| **Director/Actors**   | ✅ Yes              | ❌ No               |
| **Multiple Servers**  | ✅ Yes              | ✅ Yes              |
| **Fallback Strategy** | ✅ Implicit         | ✅ 4-level explicit |
| **Reliability**       | ⭐⭐⭐⭐⭐          | ⭐⭐⭐              |
| **Data Quality**      | ⭐⭐⭐⭐⭐          | ⭐⭐⭐              |
| **Speed**             | Medium              | Fast                |
| **Recommended Use**   | Production          | Development/Testing |

---

## Error Handling

### Common Error Responses

#### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Query parameter \"q\" is required",
  "error": "Bad Request"
}
```

#### 502 Bad Gateway

```json
{
  "statusCode": 502,
  "message": "Failed to fetch data: ECONNREFUSED",
  "error": "Bad Gateway"
}
```

#### 500 Internal Server Error

```json
{
  "statusCode": 500,
  "message": "An error occurred while scraping movies",
  "error": "Internal Server Error"
}
```

### Handling Errors in Your Client

**JavaScript/Node.js:**

```javascript
try {
  const response = await fetch("http://localhost:3000/api/movies?page=1");

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error: ${error.message}`);
    return;
  }

  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error("Network error:", error);
}
```

**Python:**

```python
import requests

try:
    response = requests.get('http://localhost:3000/api/movies?page=1')
    response.raise_for_status()
    data = response.json()
    print(data)
except requests.exceptions.RequestException as e:
    print(f"Error: {e}")
```

---

## Usage Examples

### JavaScript/Node.js

#### Using Fetch API

```javascript
// Get all movies from page 1
async function getAllMovies() {
  const response = await fetch("http://localhost:3000/api/movies?page=1");
  const data = await response.json();
  console.log(data.movies);
}

// Search for a movie
async function searchMovie(query) {
  const response = await fetch(
    `http://localhost:3000/api/movies/search?q=${encodeURIComponent(query)}`
  );
  const data = await response.json();
  console.log(data.results);
}

// Get movie details
async function getMovieDetails(slug) {
  const response = await fetch(
    `http://localhost:3000/api/movies/details/${slug}`
  );
  const data = await response.json();
  console.log(data);
}

// Get movies by genre
async function getMoviesByGenre(genre, page = 1) {
  const response = await fetch(
    `http://localhost:3000/api/movies/genre/${encodeURIComponent(
      genre
    )}?page=${page}`
  );
  const data = await response.json();
  console.log(data.movies);
}
```

#### Using Axios

```javascript
const axios = require("axios");

const apiClient = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 10000,
});

// Get all movies
async function getAllMovies() {
  try {
    const { data } = await apiClient.get("/api/movies", {
      params: { page: 1 },
    });
    console.log(data.movies);
  } catch (error) {
    console.error("Error fetching movies:", error.message);
  }
}

// Search movies
async function searchMovies(query) {
  try {
    const { data } = await apiClient.get("/api/movies/search", {
      params: { q: query },
    });
    console.log(data.results);
  } catch (error) {
    console.error("Error searching movies:", error.message);
  }
}
```

### cURL Examples

```bash
# Get all movies from page 1
curl "http://localhost:3000/api/movies?page=1"

# Search for a movie
curl "http://localhost:3000/api/movies/search?q=Inception"

# Get movie details by slug
curl "http://localhost:3000/api/movies/details/inception-2010"

# Get movie details by URL
curl "http://localhost:3000/api/movies/details?url=/inception-2010/"

# Get movies by genre
curl "http://localhost:3000/api/movies/genre/Sci-Fi?page=1"

# Search using EgyDead API
curl "http://localhost:3000/api/scraper/search?q=Avatar"

# Get links for a movie (EgyDead)
curl "http://localhost:3000/api/scraper/scrape?title=Avatar"
```

### Python Examples

```python
import requests

BASE_URL = 'http://localhost:3000'

def get_all_movies(page=1):
    response = requests.get(f'{BASE_URL}/api/movies', params={'page': page})
    return response.json()

def search_movies(query):
    response = requests.get(f'{BASE_URL}/api/movies/search', params={'q': query})
    return response.json()

def get_movie_details(slug):
    response = requests.get(f'{BASE_URL}/api/movies/details/{slug}')
    return response.json()

def get_movies_by_genre(genre, page=1):
    response = requests.get(
        f'{BASE_URL}/api/movies/genre/{genre}',
        params={'page': page}
    )
    return response.json()

# Usage
if __name__ == '__main__':
    # Get all movies
    movies = get_all_movies()
    print(f"Found {len(movies['movies'])} movies")

    # Search for a specific movie
    results = search_movies('Avatar')
    print(f"Search results: {results['results']}")

    # Get movie details
    if results['results']:
        movie_slug = results['results'][0]['url'].split('/')[-2]
        details = get_movie_details(movie_slug)
        print(f"Movie: {details['title']}")
        print(f"Rating: {details['ratings']['imdb']}/10")
```

---

## Rate Limiting & Best Practices

### Recommendations

1. **Pagination:** Always use pagination when fetching all movies

   ```javascript
   // Good: Fetch page by page
   for (let page = 1; page <= totalPages; page++) {
     const response = await fetch(`/api/movies?page=${page}`);
     // Process data
   }

   // Bad: Don't fetch all at once
   // const allMovies = await fetch('/api/movies'); // Could timeout
   ```

2. **Caching:** Implement caching to reduce API calls

   ```javascript
   const cache = new Map();

   async function getMovieWithCache(slug) {
     if (cache.has(slug)) {
       return cache.get(slug);
     }
     const details = await fetch(`/api/movies/details/${slug}`);
     cache.set(slug, details);
     return details;
   }
   ```

3. **Error Handling:** Always implement retry logic

   ```javascript
   async function retryFetch(url, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await fetch(url);
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
       }
     }
   }
   ```

4. **Search Optimization:** Be specific with search queries

   ```javascript
   // Good: Specific search
   searchMovies("Avatar 2022");

   // Less efficient: Generic search
   searchMovies("a");
   ```

---

## Troubleshooting

### "No movies found"

- **SOAP API:** The movie may not be available on soap2day.day
- **EgyDead API:** Check if the URL is correct and the website is accessible
- **Solution:** Try searching with different keywords

### "Failed to fetch data"

- The source website may be temporarily unavailable
- Your ISP may be blocking the request
- **Solution:** Wait a few minutes and retry; check your internet connection

### "Timeout"

- The scraping operation took too long (>10 seconds)
- The source website is responding slowly
- **Solution:** Retry the request; use the SOAP API for better reliability

### Streaming Links Not Working

- The video hosting service may have removed the content
- Your IP may be blocked by the hosting service
- **Solution:** Try different streaming servers; check if content is still available

---

## Advanced Configuration

### Custom Headers (for specific regions)

Edit `src/scraper/soap2day/soap.service.ts`:

```typescript
private getHeaders() {
  return {
    'User-Agent': 'Your custom user agent',
    'Accept-Language': 'your-region',
    // ... other headers
  };
}
```

### Proxy Setup

Add to `src/scraper/soap2day/soap.service.ts`:

```typescript
const response = await axios.get(url, {
  httpAgent: new HttpProxyAgent("http://proxy-server:port"),
  httpsAgent: new HttpsProxyAgent("https://proxy-server:port"),
  // ... other options
});
```

---

## License

This project is for educational purposes only. Respect copyright laws and website terms of service.

---

## Support

For issues and questions:

1. Check the troubleshooting section
2. Review error messages carefully
3. Test individual endpoints with cURL first
4. Check source website availability

**Last Updated:** $(date)
**API Version:** 1.0.0
