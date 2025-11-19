# BMovieBox App Architecture & Navigation Guide

## App Navigation Structure

```
┌─────────────────────────────────────────────────────────────┐
│                      Navigation Stack                        │
└─────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────┐
    │          HomeScreen                      │
    │  • Featured Movie (1st movie)            │
    │  • Movies Grid (all other movies)        │
    │  • Pull-to-Refresh                       │
    │  • Loading States                        │
    └──────────────────┬───────────────────────┘
                       │
                       │ Tap Any Movie
                       ▼
    ┌──────────────────────────────────────────┐
    │       MovieDetailsScreen                 │
    │  • Cover Image                           │
    │  • Play Button (prominent)               │
    │  • Movie Title & Metadata                │
    │  • Genres, Release Year, Duration       │
    │  • Multi-Source Ratings (IMDB/TMDb/RT)  │
    │  • Directors & Cast                      │
    │  • Description/Synopsis                  │
    │  • Production Companies                  │
    │  • Awards & Countries                    │
    │  • View Count                            │
    └──────────────────┬───────────────────────┘
                       │
                       │ Click Play Button
                       ▼
    ┌──────────────────────────────────────────┐
    │   ServerSelectionScreen (if multiple)    │
    │  • List of available servers             │
    │  • Server name, quality, number          │
    │  • Tap to select                         │
    │                                          │
    │  (Skipped if only 1 server available)   │
    └──────────────────┬───────────────────────┘
                       │
                       │ Select Server
                       ▼
    ┌──────────────────────────────────────────┐
    │       VideoPlayerScreen                  │
    │  • Native Video Player                   │
    │  • Full Screen Controls                  │
    │  • Current Server Info                   │
    │  • Back Button                           │
    └──────────────────────────────────────────┘
```

---

## Component Hierarchy

```
App.tsx (Root Navigator)
│
├── NavigationContainer
│   └── Stack.Navigator
│       │
│       ├── HomeScreen
│       │   ├── Header
│       │   ├── FeaturedMovie (Component)
│       │   │   └── ImageBackground
│       │   │       └── Play Button
│       │   │
│       │   └── MoviesList
│       │       └── MovieCard (Component) x N
│       │           ├── Image
│       │           ├── Play Button Small
│       │           └── Info
│       │
│       ├── MovieDetailsScreen
│       │   ├── Cover Image
│       │   ├── Play Button
│       │   ├── Info Container
│       │   │   ├── Title
│       │   │   ├── Metadata
│       │   │   ├── Genres
│       │   │   ├── Ratings Grid
│       │   │   ├── Description
│       │   │   ├── Directors
│       │   │   ├── Cast
│       │   │   ├── Companies
│       │   │   └── Awards
│       │   │
│       │   └── ScrollView
│       │
│       ├── ServerSelectionScreen
│       │   └── ServerCard x N
│       │       ├── Server Name
│       │       ├── Quality
│       │       └── Server Number
│       │
│       └── VideoPlayerScreen
│           ├── Header
│           │   ├── Back Button
│           │   └── Title
│           │
│           ├── Video Player
│           │   └── Video Component (expo-video)
│           │
│           └── Footer
│               └── Server Info
```

---

## Data Flow Architecture

```
┌──────────────────┐
│   HomeScreen     │
│  (Initial Load)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────────┐
│      MovieAPI.getAllMovies()         │
│  (Fetch from http://localhost:3000)  │
└────────┬─────────────────────────────┘
         │
         ▼ (API Response)
┌──────────────────────────────────────┐
│   State: movies: Movie[]             │
│   State: loading: boolean            │
│   State: error: string | null        │
└────────┬─────────────────────────────┘
         │
         ├─────────────────────────────────┐
         │                                 │
         ▼ (First Movie)                   ▼ (Rest)
    ┌─────────────┐              ┌──────────────────┐
    │FeaturedMovie│              │  MovieCard x N   │
    └─────────────┘              └──────────────────┘
         │                                 │
         │ onPress                         │ onPress
         └────────────────┬────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │  MovieDetailsScreen (with slug)    │
         └────────────────┬───────────────────┘
                          │
                          ▼
         ┌────────────────────────────────────┐
         │ MovieAPI.getMovieDetailsBySlug()   │
         └────────────────┬───────────────────┘
                          │
                          ▼ (API Response)
         ┌────────────────────────────────────┐
         │  State: movieDetails: MovieDetail  │
         │  Display all movie information     │
         └────────────────┬───────────────────┘
                          │
                  Click Play Button
                          │
              ┌───────────┴────────────┐
              │                        │
         (Multiple)             (Single)
         Servers?                Server?
              │                        │
              ▼                        ▼
    ┌──────────────────────────────────────┐
    │ ServerSelectionScreen  │ VideoPlayer │
    │ Select Server          │ Auto-play   │
    └────────┬────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │     VideoPlayerScreen                │
    │  • Play video from server.url        │
    │  • Show native controls              │
    │  • Display server info               │
    └──────────────────────────────────────┘
```

---

## Type System Overview

### Core Types (From API)

```typescript
// Movie - List Display
interface Movie {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  imdbRating: string | null;
  runtime: string | null;
  releaseYear: string | null;
  genres: string[];
  country: string[];
}

// MovieDetail - Full Information
interface MovieDetail {
  id: string;
  title: string;
  // ... all Movie fields
  coverImage: string;
  description: string;
  views: number;
  duration: string;
  releaseDate: string;
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
  companies: string[];
  awards: string | null;
  images: string[];
}

// Streaming Server
interface StreamingServer {
  serverName: string;
  serverNumber: number;
  quality: string;
  url: string;
}

// Paginated Response
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

---

## Screen-by-Screen Breakdown

### 1. HomeScreen

**Purpose**: Display all movies with featured movie at top

**State**:
```typescript
- movies: Movie[]                    // All movies from API
- loading: boolean                   // Initial load state
- refreshing: boolean                // Pull-to-refresh state
- error: string | null               // Error messages
```

**Key Functions**:
- `fetchMovies()` - Get movies from API
- `onRefresh()` - Pull-to-refresh handler
- `handleMoviePress()` - Navigate to details

**UI Elements**:
- Header with "BMovieBox" title
- FeaturedMovie (first movie)
- "More Movies" section with MovieCard grid
- Error display if API fails
- Loading spinner during fetch

---

### 2. MovieDetailsScreen

**Purpose**: Show comprehensive movie information

**Route Params**:
```typescript
{
  slug: string;                      // Movie URL slug
  movie?: Movie;                     // Optional cached movie data
}
```

**State**:
```typescript
- movieDetails: MovieDetail | null   // Full movie details
- loading: boolean                   // Loading state
- error: string | null               // Error messages
```

**Key Functions**:
- `fetchMovieDetails()` - Get full details by slug
- `handlePlayPress()` - Navigate to player/server selection

**UI Sections**:
- Cover image (fullscreen)
- Prominent play button
- Title & metadata row
- Genre tags
- Ratings grid (IMDb, TMDb, RT, Metacritic)
- Description/synopsis
- Directors list
- Cast list
- Production companies
- Countries
- Awards
- View count

---

### 3. ServerSelectionScreen

**Purpose**: Let user choose streaming server

**Route Params**:
```typescript
{
  servers: StreamingServer[];        // Available servers
  movieTitle: string;                // Movie title for display
}
```

**Key Functions**:
- `handleServerSelect()` - Navigate to player with selected server

**UI Elements**:
- Title: "Available Servers"
- Subtitle: "Select a server to play [movie]"
- Grid of server cards
- Each card shows: name, quality, server number

**Logic**:
- If only 1 server: automatically skip to player
- If multiple: show selection screen

---

### 4. VideoPlayerScreen

**Purpose**: Play video with native controls

**Route Params**:
```typescript
{
  server: StreamingServer;           // Server URL
  movieTitle: string;                // Movie title
}
```

**State**:
```typescript
- isPlaying: boolean                 // Play state
- isLoading: boolean                 // Video loading
```

**Key Components**:
- Header with back button and title
- expo-video Video component
- Loading overlay during buffering
- Footer with server information

**Features**:
- Native video controls
- Full screen support
- Error handling for broken links

---

## Styling Architecture

All styles are in `src/styles/styles.ts` using React Native StyleSheet:

### Color Scheme
```
Primary Brand: #e74c3c (Red)
Background:   #000 (Black)
Cards:        #1a1a1a (Dark Gray)
Text Primary: #fff (White)
Text Secondary: #aaa (Light Gray)
Accent:       #ffc107 (Gold - ratings)
```

### Layout System
- Consistent padding: 16px horizontal
- Card radius: 8-12px
- Spacing: 8px, 12px, 16px, 20px, 24px

### Typography
- Headers: 24-28px, bold
- Section titles: 18px, bold
- Body: 14px, regular
- Small: 11-12px, gray

---

## Error Handling Flow

```
API Call
    │
    ├─ Success → Display Data
    │
    └─ Error
        │
        ├─ Connection Refused
        │   └─ "No response from server. Check if API is running..."
        │
        ├─ Server Error (5xx)
        │   └─ "Failed to fetch from API"
        │
        ├─ Not Found (404)
        │   └─ "Movie not found"
        │
        └─ Network Error
            └─ Generic error message from API

All errors:
  ├─ Show Toast/Alert to user
  ├─ Log to console for debugging
  └─ Provide recovery action (retry/go back)
```

---

## Redux/State Management Notes

This app uses **React Hooks** for state management (no Redux needed):

- **useState()** - Local component state
- **useEffect()** - Side effects (API calls)
- **useRef()** - Video player reference

For future scaling, consider Redux if state becomes complex.

---

## Performance Considerations

1. **Image Loading**: React Native caches images automatically
2. **Pagination**: Only load 1 page of movies initially
3. **List Optimization**: Use FlatList for large lists (future improvement)
4. **API Caching**: MovieAPI service could be extended with caching
5. **Video Buffering**: expo-video handles buffering natively

---

## API Integration Pattern

```typescript
// Service Layer (MovieAPI.ts)
├─ getAllMovies(page)
├─ searchMovies(query)
├─ getMovieDetailsBySlug(slug)
├─ getMovieDetailsByUrl(url)
└─ getMoviesByGenre(genre, page)

// Error Handling
└─ Private handleError() method
   ├─ Detects error type
   ├─ Formats user-friendly message
   └─ Returns Error object
```

---

## Testing Checklist

- [ ] Home screen loads and displays movies
- [ ] Featured movie shows at top
- [ ] Other movies display in grid
- [ ] Pull-to-refresh works
- [ ] Tap movie navigates to details
- [ ] Details screen shows all information
- [ ] Play button on details works
- [ ] Server selection shows (if multiple)
- [ ] Video player loads and plays
- [ ] Back navigation works throughout
- [ ] Error states display properly
- [ ] Loading states show spinners

---

**Last Updated**: November 19, 2025
