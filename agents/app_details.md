# BMovieBox - Application Specification for Technology Replication

## Executive Summary

BMovieBox is a full-featured movie and TV series streaming application that allows users to browse, search, view detailed information, and stream movies/series with integrated ad blocking. The application is currently built with React Native + Expo but is designed to be technology-agnostic.

**Current Tech Stack:** React Native 0.81.5, Expo 54.0.25, TypeScript, react-native-webview  
**Target Use Case:** Cross-platform streaming (mobile, web, desktop)  
**Key Innovation:** Aggressive ad blocking with multiple interception layers

---

## 1. Feature Overview

### 1.1 Core Features

#### Home Screen
- **Featured Movie Display**
  - First movie from API displayed full-width at top
  - Shows movie poster/cover image as background
  - Semi-transparent dark gradient overlay
  - Displays title, rating, and play button over image
  - Tap to view full movie details

- **Movie Grid**
  - All remaining movies displayed below featured section
  - Two-column responsive grid layout
  - Each item shows: thumbnail, title, rating (if available), release year
  - Small play button overlay on each card
  - Tap to view full movie details

- **Pull-to-Refresh**
  - User can pull down to refresh movie list
  - Shows loading indicator during fetch
  - Displays error state with retry button if fetch fails

#### Movie Details Screen
- **Visual Elements**
  - Large cover/backdrop image at top (1920x1080 if available, else poster)
  - Movie title, release year, runtime (if available)
  - Genre tags with colored background

- **Metadata Display**
  - Synopsis/description in expandable section
  - Four-part ratings grid:
    - IMDb rating (0-10)
    - TMDb rating (0-10)
    - Rotten Tomatoes score (percentage)
    - Metacritic score (0-100)
  - Average rating calculated across all sources

- **Detailed Information Sections**
  - Directors list
  - Cast/actors list
  - Production companies
  - Countries of origin
  - Awards and nominations
  - View count (if available)

- **Image Gallery**
  - Scrollable horizontal gallery of movie images
  - First image usually same as backdrop

- **Call-to-Action**
  - Large \"Play\" button at top of screen
  - Clicking navigates to server selection

#### Series Details Screen
- **Series Information**
  - Cover image, title, year, number of seasons
  - Same metadata as movies (ratings, description, cast, etc.)
  - Genres and production info

- **Season Selection**
  - Horizontal scrollable season selector
  - Shows \"S1\", \"S2\", \"S3\", etc. as buttons
  - Active season highlighted in red (#e74c3c)
  - Clicking season changes episode list

- **Episode Grid**
  - Two-column grid of episodes for selected season
  - Each episode shows:
    - Episode number (E1, E2, etc.) in red circle
    - Episode title
    - Small play button
  - Tap episode to start playback
  - Episode count varies by season

#### Search Screen
- **Search Input**
  - Text input at top of screen
  - Placeholder text: \"Search for movies...\"
  - Real-time search with 500ms debounce
  - Minimum 3 characters required to trigger search

- **Search Results**
  - Two-column grid layout (same as home screen movies)
  - Shows loading indicator during search
  - Empty state messages:
    - \"Search for movies\" (no search initiated yet)
    - \"No results found\" (search executed with no matches)
  - Tap result to view details

#### Video Player Screen
- **Header**
  - Back button (navigates to previous screen)
  - Movie/episode title in center
  - Reload button to refresh video

- **Video Playback**
  - Full-width video embedded via WebView
  - Native video player controls (play, pause, progress bar, fullscreen)
  - Loading indicator while video loads
  - Server info displayed in footer (server name, quality)

- **Ad Blocking**
  - Aggressive JavaScript injection prevents ad domains from loading
  - Blocks popups and redirect attempts
  - Counter shows \"🛡️ Blocked X ad redirects\"
  - Navigation locked to original streaming domain

#### Server Selection Screen
- **Server List**
  - Each server shown as individual card
  - Displays server name and quality (if available)
  - Large tap-to-play button on each card
  - Clicking server with URL launches video player

---

## 2. Data Models & API Integration

### 2.1 Movie Object
```typescript
{
  id: string;                    // Unique identifier
  title: string;                 // Movie title
  thumbnail: string;             // URL to poster/thumbnail image (200x300px)
  poster?: string;               // Alternative poster URL
  backdrop?: string;             // Large background image (1920x1080px)
  description: string;           // Full plot synopsis
  imdbRating?: number;           // 0-10 scale
  tmdbRating?: number;           // 0-10 scale
  rottenTomatoesRating?: number; // 0-100 percentage
  metacriticRating?: number;     // 0-100 scale
  releaseYear: number;           // YYYY format
  runtime?: string;              // \"120 mins\" format
  directors: string[];           // List of director names
  actors: string[];              // List of actor names
  genres: string[];              // List of genre strings
  countries: string[];           // Country of origin
  productionCompany: string[];   // Production studios
  awards?: string;               // Awards summary text
  images: string[];              // Array of promotional images
  url: string;                   // Slug/URL to fetch full details
  views?: number;                // View count if available
  streamingServers?: StreamingServer[];
}
```

### 2.2 Series Object
```typescript
{
  id: string;
  title: string;
  thumbnail: string;
  coverImage: string;            // Large cover image
  description: string;
  releaseYear: string;           // \"2017\" format
  releaseDate: string;           // ISO 8601 date
  ratings: {
    imdb: string;                // \"8.258678510\" format
    tmdb: string;                // \"8.2\" format
    rottenTomatoes: string;      // \"94%\" format
    metacritic: string;          // \"6.7\" format
    averageRating: string;       // Calculated average
  };
  directors: string[];
  actors: string[];
  genres: string[];
  countries: string[];
  companies: string[];           // Production companies
  awards: string;                // \"38 wins & 45 nominations total\"
  images: string[];              // Promotional images
  trailerUrl?: string;           // YouTube embed URL
  seasons: Season[];             // Array of seasons
  streamingServers?: StreamingServer[];
}
```

### 2.3 Season Object
```typescript
{
  seasonNumber: number;          // 1, 2, 3, etc.
  episodes: Episode[];
}
```

### 2.4 Episode Object
```typescript
{
  episodeNumber: number;         // 1, 2, 3, etc.
  episodeTitle: string;          // Episode name or \"HD\"
  episodeUrl: string;            // URL to stream episode
}
```

### 2.5 Streaming Server Object
```typescript
{
  name: string;                  // \"Server 1\", \"Server 2\", etc.
  url: string;                   // Direct stream URL or embed URL
  quality?: string;              // \"1080p\", \"720p\", etc.
  serverName?: string;           // Alternative name field
  serverNumber?: number;         // Server identifier
}
```

### 2.6 API Endpoints (Expected)

**GET /api/movies?page=1**
- Returns paginated list of movies
- Response: `{ movies: Movie[], page: 1, totalPages: 10 }`

**GET /api/movies/search?q=query**
- Search movies by title
- Response: `Movie[]`

**GET /api/movies/details/:slug**
- Get full movie details
- Response: Movie (with all metadata and streaming servers)

**GET /api/series?page=1**
- Get paginated series list
- Response: `{ series: Series[], page: 1, totalPages: 10 }`

**GET /api/series/details/:slug**
- Get full series with seasons and episodes
- Response: Series

**GET /api/series/search?q=query**
- Search series
- Response: Series[]

### 2.7 API Response Normalization

The application normalizes varying API response formats:

```
Thumbnail mapping priority:
  1. response.thumbnail (if provided)
  2. response.poster (if thumbnail not available)
  3. response.images[0] (first image in array)
  4. Placeholder image URL (fallback)

Rating field mapping:
  - \"imdbRating\" OR \"imdb_rating\" OR \"imdb\"
  - \"tmdbRating\" OR \"tmdb_rating\" OR \"tmdb\"
  - Similar patterns for other ratings

Array field handling:
  - Accepts array OR single string value
  - Single strings converted to [string]
```

---

## 3. User Interface & Design System

### 3.1 Color Scheme (Dark Theme)
- **Background**: #000000 (pure black)
- **Secondary Background**: #1a1a1a (very dark gray)
- **Accent Color**: #e74c3c (red)
- **Text Primary**: #ffffff (white)
- **Text Secondary**: #cccccc (light gray)
- **Text Tertiary**: #888888 (medium gray)
- **Borders**: #333333 (dark gray)
- **Success**: #4caf50 (green, for \"blocked ads\" indicator)

### 3.2 Typography
- **Large Titles**: 24px, bold (700), white
- **Section Titles**: 16px, semi-bold (600), white
- **Body Text**: 14px, regular (400), light gray
- **Small Text**: 12px, regular (400), medium gray
- **Button Text**: 16px, semi-bold (600), white

### 3.3 Layout Patterns

**Two-Column Grid**
- Used for movies, series, search results
- Formula: (screenWidth - 32px padding) / 2 = column width
- Gap between columns: 10px
- Column wrapper justifyContent: \"space-between\"
- Bottom margin between rows: 16px

**Featured Section**
- Full width with 16px horizontal padding
- Height: 250-300px
- ImageBackground with semi-transparent gradient overlay
- Text overlaid on image with shadow for readability

**Horizontal Scroll Sections**
- Used for season selector
- Content scrolls horizontally
- Padding maintained at 16px
- Item width varies (seasons are narrower buttons)

**Section Container**
- Horizontal padding: 16px
- Vertical margin between sections: 20px
- Content area max-width on large screens (optional)

### 3.4 Component Patterns

**Card Components**
- Border radius: 8px
- Border color: #333
- Border width: 1px
- Padding: 12-16px
- Background: #1a1a1a
- Shadow: subtle (optional, platform-dependent)

**Button Styles**
- Primary (red) buttons: background #e74c3c, padding 12x16px, radius 8px
- Secondary buttons: background #333, padding 8x12px, radius 6px
- Border: 1px solid #333
- Active states: opacity 0.8 on press

**Input Fields**
- Background: #2a2a2a
- Border: 1px #444
- Border radius: 8px
- Padding: 12px horizontal, 12px vertical
- Text color: #fff
- Placeholder: #666

**Loading States**
- Spinner color: #e74c3c
- Spinner size: \"large\" (40-50px)
- Show on: initial load, search, refresh
- Overlay opacity: semi-transparent #000 if needed

**Error States**
- Text color: #ff6b6b (light red)
- Background: #2a1a1a (dark red tint)
- Padding: 16px
- Border radius: 8px
- Retry button included

### 3.5 Responsive Behavior

**Mobile (< 600px)**
- Two-column grid unchanged
- Full width sections with minimal padding
- Bottom tab navigation

**Tablet (600-1200px)**
- Option to display 3-4 columns
- Larger cards and text
- Tab navigation or drawer navigation

**Desktop (> 1200px)**
- Can display side-by-side layouts
- Wider cards
- Top navigation bar option

---

## 4. Navigation Structure

### 4.1 Navigation Hierarchy

```
Root Navigator (Tab Navigator)
├── Home Tab
│   ├── HomeScreen
│   │   └── MovieDetailsScreen
│   │       └── ServerSelectionScreen (if play clicked)
│   │           └── VideoPlayerScreen
│   └── SeriesListScreen (optional)
│       └── SeriesDetailsScreen
│           └── VideoPlayerScreen
├── Search Tab
│   ├── SearchScreen
│   │   ├── MovieDetailsScreen
│   │   └── SeriesDetailsScreen
│       └── VideoPlayerScreen
└── Series Tab (optional)
    ├── SeriesListScreen
    └── SeriesDetailsScreen
        └── VideoPlayerScreen
```

### 4.2 Navigation Flow

**Movie Playback Flow**
1. User on HomeScreen or SearchScreen
2. Tap movie card
3. Navigate to MovieDetailsScreen
4. View full details
5. Tap \"Play\" button
6. Navigate to ServerSelectionScreen
7. Select server
8. Navigate to VideoPlayerScreen with server URL
9. Video plays in WebView
10. Tap back button → return to MovieDetailsScreen

**Series Playback Flow**
1. User on Home or SeriesListScreen
2. Tap series card
3. Navigate to SeriesDetailsScreen
4. Select season via horizontal scroll
5. Episode list updates
6. Tap episode
7. Navigate to VideoPlayerScreen with episode URL
8. Video plays in WebView
9. Tap back button → return to SeriesDetailsScreen

**Search Flow**
1. User on SearchScreen
2. Type query (min 3 chars)
3. Results appear in two-column grid
4. Tap result
5. Navigate to MovieDetailsScreen or SeriesDetailsScreen
6. Continue to video playback if desired

### 4.3 Parameter Passing

**Between Screens**
- MovieDetailsScreen receives: `{ slug: string, movie?: Movie }`
- SeriesDetailsScreen receives: `{ url: string }`
- VideoPlayerScreen receives: `{ server: StreamingServer, movieTitle: string }`
- ServerSelectionScreen receives: `{ servers: StreamingServer[], movieTitle: string }`
- All parameters passed via navigation props

---

## 5. Business Logic & Algorithms

### 5.1 Ad Blocking Implementation

**Layer 1: Domain Blocklist**
```
Blocked domains (30+):
  - doubleclick.net, googleadservices.com, googlesyndication.com
  - adnxs.com, advertising.com, criteo.com, outbrain.com
  - taboola.com, popads.net, popcash.net, propellerads.com
  - pagead.l.google.com, ads.google.com
  - pixel.facebook.com, connect.facebook.net
  - And 20+ more ad networks and tracking services
```

**Layer 2: Network Request Interception**
- Intercept fetch() API calls
- Intercept XMLHttpRequest calls
- Block any request URL containing blocklist domain
- Return Promise.reject() for blocked requests

**Layer 3: DOM Element Removal**
- Run every 1-2 seconds
- Query selectors:
  - `[id*=\"ad\"]`, `[id*=\"adv\"]`, `[id*=\"banner\"]`
  - `[class*=\"ad-\"]`, `[class*=\"advert\"]`, `[class*=\"ads\"]`
  - `[data-ad-slot]`, `[data-ad-client]`
  - `iframe[src*=\"ad\"]`, `script[src*=\"ad\"]`
- Remove matched elements from DOM
- Skip video/source/audio tags

**Layer 4: Navigation Locking**
- Compare target URL domain to original streaming domain
- Block navigation if target domain differs
- onShouldStartLoadWithRequest callback validates all navigations
- Override window.location.href to prevent programmatic redirects

**Layer 5: Popup & Redirect Prevention**
- Override window.open() to return null
- Override window.openWindow(), window.showModalDialog()
- Monitor click events on links
- Prevent default if link URL is ad domain

**Layer 6: Continuous Monitoring**
- setInterval() to check for new ads every 1-2 seconds
- Re-run DOM removal and fetch blocking
- Detect navigation attempts and revert if needed

### 5.2 Image Fallback Chain

**When displaying movie/series image:**
1. Check if `movie.thumbnail` exists and is non-empty string
2. If not, try `movie.poster`
3. If not, try `movie.images[0]`
4. If not, use placeholder: `https://via.placeholder.com/200x300?text=No+Image`

**Same logic for backdrop images:**
1. `movie.backdrop` (wide format)
2. `movie.images[1]` (if exists)
3. `movie.images[0]`
4. Placeholder: `https://via.placeholder.com/1920x1080?text=No+Image`

### 5.3 Search Debouncing
- User types in SearchScreen
- 500ms debounce timer started
- If user types again within 500ms, timer resets
- When 500ms passes without typing, API call triggered
- Minimum 3 characters required to trigger search

### 5.4 Data Transformation on API Response

```
For each movie received:
  1. Extract id (use _id as fallback)
  2. Extract title (use name as fallback)
  3. Extract thumbnail via fallback chain
  4. Parse all ratings to float
  5. Parse releaseYear to int
  6. Ensure arrays for directors, actors, genres, countries
  7. Convert single values to arrays
  8. Return normalized Movie object
```

### 5.5 Ratings Display Logic

- Show each rating in 2x2 grid on details screen
- Format each rating:
  - IMDb: Show as `8.1` (1 decimal place)
  - TMDb: Show as `8.2` (1 decimal place)
  - Rotten Tomatoes: Show as `94%` (with percent sign)
  - Metacritic: Show as `67` (no decimal if whole number)
- Each in separate card with source label
- Calculate average: (IMDb + TMDb + RT/100 + Metacritic/10) / 4

### 5.6 Season & Episode Management

**When user selects season:**
1. Find season object by seasonNumber
2. Extract episodes array
3. Update episode list in grid
4. Re-render with new episode data

**When user taps episode:**
1. Extract episodeUrl from episode object
2. Pass to VideoPlayerScreen with title: `${seriesTitle} - S${seasonNum}E${episodeNum}`
3. Launch video player

---

## 6. Technical Considerations

### 6.1 State Management

**Home Screen State:**
- `movies: Movie[]` - Current page of movies
- `loading: boolean` - Fetch in progress
- `error: string | null` - Error message if fetch failed
- `page: number` - Current pagination page

**MovieDetailsScreen State:**
- `movieDetails: MovieDetail` - Full movie data from route params or API
- `loading: boolean` - Fetch in progress
- `error: string | null` - Error message

**SearchScreen State:**
- `query: string` - Current search query
- `results: (Movie | Series)[]` - Search results
- `loading: boolean` - Search in progress
- `searched: boolean` - Has user initiated search

**VideoPlayerScreen State:**
- `isLoading: boolean` - Video loading
- `error: string | null` - Playback error
- `blockedAttempts: number` - Number of blocked ad redirects

### 6.2 Performance Optimization

**Image Caching**
- Use platform-specific image caching (e.g., react-native-fast-image, or browser cache)
- Cache policy: memory + disk
- Reuse image URLs across screens

**API Caching**
- Debounce search requests (500ms)
- Implement pagination to avoid loading all movies at once
- Cache movie details after first fetch

**Rendering Optimization**
- Use FlatList with keyExtractor for efficient grid rendering
- Use useMemo/useCallback for expensive computations
- Implement virtualization for long lists
- Remove inline object/function definitions

**Ad Blocking Optimization**
- Run DOM cleanup on 1-2s intervals (not too frequent)
- Use efficient CSS selectors
- Inject JavaScript once at page load, not repeatedly

### 6.3 Error Handling

**API Errors:**
- Catch network errors and timeout errors
- Display error message with retry button
- Log error for debugging

**Image Errors:**
- Handle image load failures gracefully
- Use fallback URL
- Don't block UI rendering

**Video Playback Errors:**
- Detect WebView errors via onError callback
- Display error message with retry option
- Allow user to go back and select different server

**Navigation Errors:**
- Handle undefined route parameters
- Prevent crashes from invalid data

### 6.4 Security Considerations

**WebView Security:**
- Disable JavaScript auto-open windows: `javaScriptCanOpenWindowsAutomatically={false}`
- Disable third-party cookies: `thirdPartyCookiesEnabled={false}`
- Don't require user interaction for media: `mediaPlaybackRequiresUserAction={false}`
- Use custom user agent to avoid detection

**API Security:**
- Use HTTPS only for API calls (enforce in axios interceptor)
- Handle API errors gracefully
- Validate all response data before use

**Data Privacy:**
- Don't store sensitive data in app
- Clear app cache regularly
- Don't log user data or full URLs

### 6.5 Accessibility

**Mobile Accessibility:**
- Use sufficient color contrast (white on black passes WCAG)
- Make touch targets at least 44x44px
- Provide meaningful button labels
- Support screen readers with semantic HTML/RN components

**Keyboard Navigation:**
- All interactive elements accessible via keyboard (web version)
- Tab order logical and visible
- Escape key to close dialogs

---

## 7. Implementation Details by Screen

### 7.1 HomeScreen Implementation

**Data Flow:**
1. useEffect() calls MovieAPI.getAllMovies(1) on component mount
2. Split response.movies into featured (first) and others
3. Render FeaturedMovie component with movies[0]
4. Render FlatList with movies.slice(1) in 2-column grid

**Key Components:**
- FlatList with numColumns={2}
- columnWrapperStyle for spacing
- Pull-to-refresh callback triggers new API call
- Empty/error states with messages and retry button

**Loading States:**
- Initial load: Show spinner centered
- Refresh: Show spinner at top
- Error: Show message with retry button

### 7.2 MovieDetailsScreen Implementation

**Data Flow:**
1. Receive slug from route.params
2. Call MovieAPI.getMovieDetailsBySlug(slug)
3. Display all metadata in scrollable sections

**Sections (in order):**
1. Backdrop image (full width, 250px height)
2. Movie title, year, runtime, genres
3. Play button (large, red)
4. Ratings grid (4 columns)
5. Synopsis section
6. Directors section
7. Cast section
8. Countries section
9. Production companies section
10. Awards section (if available)
11. Image gallery (horizontal scroll, optional)

**Tap Handlers:**
- Play button → navigate to ServerSelectionScreen (if multiple servers) or VideoPlayerScreen (if single)
- Movie card in gallery → show full screen image (optional)

### 7.3 VideoPlayerScreen Implementation

**Initialization:**
1. Receive server URL from ServerSelectionScreen params
2. Inject ad-blocking JavaScript into WebView
3. Set source URI to server.url

**Lifecycle:**
- onLoadStart: setLoading(true)
- onLoadEnd: setLoading(false)
- onError: Display error message
- onNavigationStateChange: Detect redirect attempts, block if needed

**Header Controls:**
- Back button: navigation.goBack()
- Title: Display in center
- Reload button: webViewRef.current?.reload()

**Footer Info:**
- Display server name and quality
- Show blocked ads counter

### 7.4 SearchScreen Implementation

**Input Handling:**
1. TextInput onChange → setQuery()
2. useEffect with 500ms debounce timer
3. When 500ms expires, call MovieAPI.searchMovies(query)
4. Update results state

**Display Logic:**
- No search initiated: Show empty state message
- Loading: Show spinner
- No results: Show \"no results\" message
- Results found: Show 2-column grid

**Tap Handlers:**
- Tap result → navigate to MovieDetailsScreen or SeriesDetailsScreen

### 7.5 SeriesDetailsScreen Implementation

**Initialization:**
1. Receive url from route params
2. Call MovieAPI.getSeriesByUrl(url)
3. Extract seasons array
4. Set selectedSeason to 1 (default)
5. Compute currentEpisodes = seasons[0].episodes

**Season Selection:**
1. Render horizontal scroll of season buttons
2. Highlight active season
3. On season button press: setSelectedSeason(), update episode list

**Episode Display:**
1. Map currentEpisodes to episode cards
2. Show episode number in circle
3. Show episode title
4. Show play overlay
5. Tap episode → handlePlayEpisode()

**Video Playback:**
1. Call MovieAPI.getSeriesServer(episode.episodeUrl) to get streaming servers
2. Show ServerSelectionScreen if multiple servers
3. Launch VideoPlayerScreen with selected server
4. Tap back in player → return to series details

---

## 8. API Service Implementation

### 8.1 MovieAPI Service Structure

The MovieAPI service handles all backend communication:

```typescript
class MovieAPI {
  // Static methods for API calls
  static getAllMovies(page: number): Promise<MoviesResponse>
  static getMovieDetailsBySlug(slug: string): Promise<MovieDetail>
  static searchMovies(query: string): Promise<Movie[]>
  static getSeriesByUrl(url: string): Promise<SeriesDetail>
  static getSeriesServer(episodeUrl: string): Promise<{ videoLinks: StreamingServer[] }>
  
  // Helper methods
  private static transformMovieData(data: any): Movie
  private static normalizeRatings(data: any): Ratings
}
```

### 8.2 API Base Configuration

- **Base URL**: From environment variable or config
- **Timeout**: 10 seconds
- **Retry**: Automatic retry on network errors
- **Headers**: User-Agent, Content-Type

---

## 9. Platform-Specific Considerations

### 9.1 Mobile (iOS/Android)
- Status bar styling (dark background, light text)
- Safe area insets for notch/home button
- Hardware back button handling (Android)
- Fullscreen video support
- Gesture-based navigation (swipe back)

### 9.2 Web (React/Vue/etc)
- Browser back button navigation
- Keyboard shortcuts (ESC to exit fullscreen, arrows to skip, etc.)
- Mouse wheel scroll for movie grid
- Hover effects on interactive elements
- Responsive breakpoints for desktop/tablet/mobile
- Progressive enhancement for network requests
- SEO metadata if applicable

### 9.3 Common Across Platforms
- Dark theme as default
- Touch/click targets 44px minimum
- Network error handling and retry logic
- Loading states for all async operations
- Error boundaries to catch crashes

---

## 10. Folder & File Structure Recommendation

```
src/
├── screens/
│   ├── HomeScreen.tsx
│   ├── MovieDetailsScreen.tsx
│   ├── SeriesDetailScreen.tsx
│   ├── SearchScreen.tsx
│   ├── VideoPlayerScreen.tsx
│   ├── ServerSelectionScreen.tsx
│   └── AdBlockingVideoPlayer.tsx
├── components/
│   ├── FeaturedMovie.tsx
│   ├── MovieCard.tsx
│   ├── SeriesCard.tsx
│   ├── EpisodeCard.tsx
│   └── RatingDisplay.tsx
├── services/
│   └── MovieAPI.ts
├── navigation/
│   ├── AppStack.tsx
│   └── Tabs.tsx
├── styles/
│   └── styles.ts
├── types/
│   ├── Movie.ts
│   ├── Series.ts
│   └── index.ts
└── utils/
    ├── apiClient.ts
    ├── constants.ts
    └── helpers.ts
```

---

## 11. Deployment & Environment Configuration

### 11.1 Environment Variables
```
REACT_APP_API_URL=http://localhost:3000/api
REACT_APP_ENVIRONMENT=development
REACT_APP_APP_VERSION=1.0.0
```

### 11.2 Build Configuration
- Minification enabled for production
- Source maps for debugging
- Code splitting if applicable (web version)
- Platform-specific builds (iOS, Android, Web)

### 11.3 CI/CD Considerations
- Unit tests for utility functions
- Integration tests for API calls
- E2E tests for critical user flows
- Automated builds on push
- App store submission automation (for mobile)

---

## 12. Glossary & Terms

- **Featured Movie**: First movie in list, displayed prominently at top of home screen
- **Two-Column Grid**: Layout with 2 items per row, evenly spaced
- **Backdrop/Cover Image**: Large (1920x1080) background image
- **Poster/Thumbnail**: Smaller (200x300) image for grid display
- **Streaming Server**: Specific host/URL for video playback
- **Ad Domain**: Domain serving advertisements to be blocked
- **WebView**: Embedded browser component for video playback
- **Episode URL**: Direct link to stream video content
- **Season Number**: Integer (1, 2, 3, etc.) identifying series season
- **Episode Number**: Integer (1, 2, 3, etc.) identifying episode within season
- **Ratings**: Scores from IMDb, TMDb, Rotten Tomatoes, Metacritic
- **Debounce**: Delay before executing action after user stops typing
- **Fallback**: Alternative value used if primary value unavailable
- **Navigation Stack**: History of screens user has visited
- **Navigation Locking**: Preventing navigation away from streaming domain

---

## 13. Common Pitfalls & Solutions

### Pitfall 1: Missing Image URLs
**Problem**: API sometimes returns null/empty thumbnail  
**Solution**: Implement fallback chain as described in section 5.2

### Pitfall 2: Ads Still Redirecting
**Problem**: Ad blocking layers not comprehensive enough  
**Solution**: Implement all 6 layers as described in section 5.1

### Pitfall 3: Video Not Playing
**Problem**: Incorrect URL format or unsupported codec  
**Solution**: Test URLs directly in browser before implementation; handle playback errors gracefully

### Pitfall 4: Search Too Slow
**Problem**: API called on every keystroke  
**Solution**: Implement 500ms debounce; minimum 3 character requirement

### Pitfall 5: Grid Items Not Aligned
**Problem**: columnWrapperStyle or gap not set correctly  
**Solution**: Use justifyContent: \"space-between\" and explicit gap value

### Pitfall 6: State Not Updating
**Problem**: Forgot to call state setter function  
**Solution**: Use proper state management pattern; ensure setState calls

### Pitfall 7: Navigation Props Missing
**Problem**: Forgot to pass route.params to next screen  
**Solution**: Always pass full object as navigation param

---

## 14. Testing Checklist

- [ ] Home screen displays featured movie at top
- [ ] Home screen displays remaining movies in 2-column grid
- [ ] Pull-to-refresh updates movie list
- [ ] Movie details screen shows all metadata
- [ ] Ratings display correctly formatted
- [ ] Play button navigates to server selection
- [ ] Server selection shows available servers
- [ ] Video player loads and plays video
- [ ] Ad blocking prevents ad domain loads
- [ ] Back button returns to previous screen
- [ ] Search works with 3+ characters
- [ ] Search results display in 2-column grid
- [ ] Series details show seasons
- [ ] Season selection updates episode list
- [ ] Episodes play from selected server
- [ ] Images load with fallback handling
- [ ] Error states display with retry option
- [ ] Loading states show during data fetch
- [ ] Responsive layout on various screen sizes

---

## 15. Future Enhancement Possibilities

- Favorites/watchlist functionality
- Watch history tracking
- User ratings and reviews
- Genre filtering and browsing
- Sorting options (by rating, year, views)
- Advanced search filters
- Download for offline viewing (where legal)
- Subtitles/closed captions support
- Audio track selection
- Parental controls
- Multi-device watch continuity
- Social sharing
- Recommendations based on viewing history

---

**Document Version**: 1.0  
**Last Updated**: November 2024  
**Application**: BMovieBox Movie & Series Streaming Platform  
**Purpose**: Technology-agnostic specification for rebuilding in alternative frameworks
