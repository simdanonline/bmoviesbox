# BMovieBox - React Native Movie Player App (Vibe Codedish)

A modern, feature-rich movie streaming application built with Expo and React Native, powered by the BMovieBox API (SOAP2Day integration).

## Features

✅ **Home Screen with Featured Movie** - Browse movies with the first movie featured prominently at the top  
✅ **Movie Listings** - Browse all movies in a beautiful grid layout  
✅ **Movie Details Screen** - Comprehensive movie information including:
  - Thumbnail and cover images
  - Title, description, and year of release
  - Directors, actors, and production companies
  - Multiple rating sources (IMDb, TMDb, Rotten Tomatoes, Metacritic)
  - Runtime, genres, and countries
  - Awards information
  - View count

✅ **Server Selection** - Choose from multiple streaming servers before playback  
✅ **Video Player** - Native video playback with standard controls  
✅ **Error Handling** - Comprehensive error messages and recovery  
✅ **Pull-to-Refresh** - Refresh movie list from home screen  
✅ **Dark Theme UI** - Modern dark theme optimized for media consumption  

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** or **yarn** package manager
- **Expo CLI**: `npm install -g expo-cli`
- **BMovieBox Backend API** running on `http://localhost:3000`

### Backend Setup

The app requires the BMovieBox NestJS backend to be running. Follow these steps:

1. Navigate to your BMovieBox backend directory
2. Install dependencies: `npm install`
3. Start the development server: `npm run start:dev`
4. Verify it's running: `http://localhost:3000/api/movies?page=1`

---

## Installation

### 1. Clone or Navigate to Project

```bash
cd BMovieBox
```

### 2. Install Dependencies

```bash
npm install
```

Or if using yarn:

```bash
yarn install
```

### 3. Configure API Endpoint (Optional)

If your API is running on a different URL (not `http://localhost:3000`), edit `src/services/MovieAPI.ts`:

```typescript
private baseURL: string = 'http://your-api-url:port/api';
```

Or set it at runtime in `src/screens/HomeScreen.tsx`:

```typescript
import MovieAPI from '../services/MovieAPI';

// Set custom URL
MovieAPI.setBaseURL('http://your-api-url:3000/api');
```

---

## Running the App

### Development Mode

```bash
npm start
```

This will start the Expo development server and display a QR code.

### iOS (Simulator)

After running `npm start`:

```bash
i
```

Or press `i` in the Expo CLI terminal.

### Android (Emulator/Device)

After running `npm start`:

```bash
a
```

Or press `a` in the Expo CLI terminal.

### Web (Browser)

```bash
npm run web
```

---

## Project Structure

```
BMovieBox/
├── src/
│   ├── screens/
│   │   ├── HomeScreen.tsx              # Main home/movies list screen
│   │   ├── MovieDetailsScreen.tsx      # Detailed movie information
│   │   ├── ServerSelectionScreen.tsx   # Server selection for playback
│   │   └── VideoPlayerScreen.tsx       # Video player component
│   ├── components/
│   │   ├── FeaturedMovie.tsx           # Featured movie card component
│   │   └── MovieCard.tsx               # Reusable movie card component
│   ├── services/
│   │   └── MovieAPI.ts                 # API client and type definitions
│   └── styles/
│       └── styles.ts                   # Global styles and themes
├── App.tsx                              # Root navigation setup
├── app.json                             # Expo configuration
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript configuration
├── babel.config.js                      # Babel configuration
└── README.md                            # This file
```

---

## API Integration

The app uses the SOAP2Day API through the BMovieBox backend. The API client is located in `src/services/MovieAPI.ts`.

### Key API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/movies?page=1` | Fetch paginated movie list |
| `GET /api/movies/details/:slug` | Get detailed movie information |
| `GET /api/movies/search?q=query` | Search for movies |
| `GET /api/movies/genre/:genre?page=1` | Get movies by genre |

### Error Handling

The API client includes comprehensive error handling:

```typescript
try {
  const movies = await MovieAPI.getAllMovies(1);
} catch (error) {
  // Error automatically formatted with meaningful message
  console.error(error.message);
}
```

Common errors:
- **Connection refused**: API server not running
- **Failed to fetch data**: Source website temporarily unavailable
- **404 Not Found**: Movie/details not available

---

## Screen Navigation

### Flow Diagram

```
Home Screen
    ↓
Select Movie
    ↓
Movie Details Screen
    ↓
Click Play
    ↓
Server Selection Screen (if multiple servers)
    ↓
Video Player Screen
```

### Screen Descriptions

#### 1. Home Screen
- Displays featured movie at the top
- Shows all other movies in a 2-column grid
- Pull-to-refresh functionality
- Tapping any movie navigates to details

#### 2. Movie Details Screen
- Comprehensive movie information
- Large cover image
- Play button to start playback
- All metadata, ratings, cast, crew information
- View counter

#### 3. Server Selection Screen
- Shows available streaming servers
- Displays server name and quality
- Select any server to start playback
- (Automatically skipped if only 1 server available)

#### 4. Video Player Screen
- Native video player with standard controls
- Shows current playing server info
- Back button to return to details

---

## Styling

The app uses a cohesive dark theme optimized for movie streaming:

- **Primary Color**: `#e74c3c` (Red for CTAs)
- **Background**: `#000` (Pure black)
- **Cards**: `#1a1a1a` (Dark gray)
- **Text**: `#fff` (White for primary text)
- **Accents**: `#ffc107` (Gold for ratings)

All styles are centralized in `src/styles/styles.ts` for easy customization.

---

## Troubleshooting

### Issue: "Failed to fetch data: ECONNREFUSED"

**Solution**: Ensure the BMovieBox backend is running on `http://localhost:3000`

```bash
# From the backend directory
npm run start:dev
```

### Issue: "No response from server"

**Solution**: Check if the API URL is correct in `src/services/MovieAPI.ts`

### Issue: Video Won't Play

**Possible causes:**
- The streaming link is expired
- Your ISP is blocking the host
- The video has been removed

**Solution**: Try a different server or movie

### Issue: App Crashes on Startup

**Solution**: Clear cache and reinstall dependencies

```bash
rm -rf node_modules
npm install
npm start
```

### Issue: Movies Don't Load

**Solution**: 
1. Verify backend is running: `curl http://localhost:3000/api/movies?page=1`
2. Check network connectivity
3. Verify app permissions (iOS/Android)

---

## Performance Optimization Tips

1. **Pagination**: The app automatically loads movies in pages
2. **Image Caching**: React Native automatically caches images
3. **List Virtualization**: Large lists are optimized with FlatList principles
4. **Lazy Loading**: Movie details loaded on demand

---

## Customization

### Change API Base URL

Edit `src/services/MovieAPI.ts`:

```typescript
class MovieAPI {
  private baseURL: string = 'http://your-custom-url:port/api';
}
```

### Change Theme Colors

Edit `src/styles/styles.ts`:

```typescript
// Example: Change primary red to blue
'-c' (Red): '#e74c3c' → '#3498db' (Blue)
```

### Add More Genres

Add genre names to the server selection or create a genre filter in `HomeScreen.tsx`

---

## Dependencies

- **expo**: Core Expo framework
- **react-native**: UI framework
- **@react-navigation**: Navigation library
- **expo-video**: Video player
- **axios**: HTTP client
- **react-native-gesture-handler**: Gesture support

---

## Building for Production

### iOS

```bash
eas build --platform ios
```

### Android

```bash
eas build --platform android
```

For detailed instructions, visit [Expo Build Documentation](https://docs.expo.dev/build/setup/)

---

## Known Limitations

1. **Streaming Availability**: Content availability depends on the source website
2. **Geographic Blocking**: Some streams may be geographically restricted
3. **Link Expiration**: Video links from some hosts may expire
4. **API Rate Limits**: Source websites may have rate limiting

---

## Legal Notice

This application is for educational purposes only. Users are responsible for ensuring their use complies with local laws and terms of service of streaming sources. The developers are not liable for any misuse or copyright violations.

---

## Support & Contribution

For issues or suggestions:

1. Check the Troubleshooting section
2. Verify backend API is running
3. Review error messages carefully
4. Check device/simulator network connectivity

---

## License

This project is provided as-is for educational purposes.

---

## Changelog

### Version 1.0.0
- ✅ Initial release
- ✅ Home screen with featured movie
- ✅ Movie details screen
- ✅ Server selection
- ✅ Video player integration
- ✅ Dark theme UI
- ✅ Error handling
- ✅ Pull-to-refresh

---

**Last Updated**: November 19, 2025  
**API Version**: 1.0.0  
**React Native Version**: 0.74.1  
**Expo Version**: 51.0.0
# bmoviesbox
