# BMovieBox - Complete Project Structure

## 📁 Project Files Overview

```
BMovieBox/
│
├── 📄 App.tsx                          ⭐ Main app entry point
│   └─ Navigation setup and stack configuration
│
├── 📂 src/
│   │
│   ├── 📂 screens/                     ⭐ All app screens
│   │   ├── HomeScreen.tsx              • Main screen with movies list
│   │   ├── MovieDetailsScreen.tsx      • Detailed movie information
│   │   ├── ServerSelectionScreen.tsx   • Choose streaming server
│   │   └── VideoPlayerScreen.tsx       • Video player with controls
│   │
│   ├── 📂 components/                  ⭐ Reusable UI components
│   │   ├── FeaturedMovie.tsx           • Featured movie card
│   │   └── MovieCard.tsx               • Individual movie card
│   │
│   ├── 📂 services/                    ⭐ API integration
│   │   └── MovieAPI.ts                 • API client and type definitions
│   │
│   └── 📂 styles/
│       └── styles.ts                   • All global styles and theme
│
├── 📄 app.json                         ⭐ Expo configuration
├── 📄 package.json                     ⭐ Dependencies and scripts
├── 📄 tsconfig.json                    • TypeScript configuration
├── 📄 babel.config.js                  • Babel transpiler config
├── 📄 .gitignore                       • Git ignore rules
│
├── 📄 README.md                        ⭐ Main documentation
│   └─ Features, setup, troubleshooting
│
├── 📄 SETUP_GUIDE.md                   ⭐ Step-by-step installation
│   └─ OS-specific guides for macOS, Windows, Linux
│
├── 📄 ARCHITECTURE.md                  ⭐ Technical architecture
│   └─ Navigation flow, component hierarchy, data flow
│
├── 📄 .env.example                     • Environment variables template
│
└── 📄 INDEX.md                         • This file
```

---

## 🚀 Quick Start

### 1. Install & Setup (First Time Only)
```bash
cd BMovieBox
npm install
```

### 2. Start Backend (Keep Running)
```bash
# In backend directory
npm run start:dev

# Verify: curl http://localhost:3000/api/movies?page=1
```

### 3. Start App
```bash
npm start
# Press 'i' for iOS or 'a' for Android
```

---

## 📋 File Descriptions

### Core App Files

#### `App.tsx` (Entry Point)
- Initializes the app
- Sets up navigation stack
- Configures screen transitions
- Defines header styling

#### `app.json` (Expo Config)
- App metadata (name, version, icon)
- Platform-specific settings
- Plugin configuration
- Splash screen setup

#### `package.json` (Dependencies)
```
Dependencies:
- react-native: UI framework
- @react-navigation: Navigation
- expo-video: Video player
- axios: HTTP client

DevDependencies:
- @babel/core: JavaScript compiler
```

---

### Screens (4 Primary Screens)

#### `HomeScreen.tsx`
**What it does**: Main entry screen
**Features**:
- Fetches all movies on load
- Shows featured movie (1st movie) prominently
- Shows other movies in 2-column grid
- Pull-to-refresh functionality
- Loading and error states
- Navigates to MovieDetailsScreen on tap

**State Management**:
- `movies`: Array of movies
- `loading`: Initial load status
- `refreshing`: Pull-to-refresh status
- `error`: Error messages

---

#### `MovieDetailsScreen.tsx`
**What it does**: Shows detailed movie information
**Features**:
- Displays full movie cover image
- Prominent play button
- Movie title and metadata
- Genre tags
- Multiple ratings (IMDb, TMDb, RT, Metacritic)
- Director and actor information
- Production details
- Scrollable content

**Route Parameters**:
- `slug`: Movie URL slug for API call

**Navigation**:
- Navigates to ServerSelectionScreen (if multiple servers)
- Navigates to VideoPlayerScreen (if single server)

---

#### `ServerSelectionScreen.tsx`
**What it does**: Let user choose streaming server
**Features**:
- Displays available streaming servers
- Shows server name, quality, number
- Grid layout of server cards
- Tap to select and play

**Route Parameters**:
- `servers`: Array of StreamingServer objects
- `movieTitle`: Movie title for display

**Optimization**: 
- Automatically skipped if only 1 server available

---

#### `VideoPlayerScreen.tsx`
**What it does**: Native video playback
**Features**:
- Uses expo-video component
- Full native video controls
- Shows current server info
- Loading overlay during buffering
- Error handling for broken links
- Back button for navigation

**Route Parameters**:
- `server`: StreamingServer object with URL
- `movieTitle`: Movie title for header

---

### Components (Reusable UI)

#### `FeaturedMovie.tsx`
**Used in**: HomeScreen
**Props**:
- `movie: Movie` - Movie object
- `onPress: () => void` - Tap handler

**Features**:
- Full-width featured card
- Image background with overlay
- "FEATURED" badge
- Play button overlay
- Movie title and metadata
- Rating badge (IMDb)
- Click to view details

---

#### `MovieCard.tsx`
**Used in**: HomeScreen (grid)
**Props**:
- `movie: Movie` - Movie object
- `onPress: () => void` - Tap handler

**Features**:
- Thumbnail image
- Play button on hover
- Title (2 lines max)
- Rating badge
- Release year
- Click to view details

---

### Services (API Integration)

#### `MovieAPI.ts`
**Purpose**: Centralized API client

**Type Definitions**:
```typescript
interface Movie { ... }              // List display
interface MovieDetail { ... }        // Full details
interface StreamingServer { ... }    // Server info
interface MoviesResponse { ... }     // Paginated response
```

**Methods**:
- `getAllMovies(page)` - Get paginated movies
- `searchMovies(query)` - Search by title
- `getMovieDetailsBySlug(slug)` - Get details by URL slug
- `getMovieDetailsByUrl(url)` - Get details by full URL
- `getMoviesByGenre(genre, page)` - Filter by genre

**Features**:
- Centralized error handling
- Configurable base URL
- Axios-based HTTP client
- Type-safe responses
- Automatic error formatting

---

### Styles

#### `styles.ts`
**Purpose**: All styling definitions
**Features**:
- React Native StyleSheet
- Dark theme colors
- Consistent spacing
- Typography scales
- Component-specific styles

**Color Scheme**:
- Primary: #e74c3c (Red)
- Background: #000 (Black)
- Cards: #1a1a1a (Dark Gray)
- Text: #fff (White)
- Accent: #ffc107 (Gold)

---

### Configuration Files

#### `tsconfig.json`
- TypeScript compiler settings
- Enables React JSX
- Strict type checking

#### `babel.config.js`
- Babel transpiler configuration
- Expo preset

#### `.gitignore`
- Ignores node_modules
- Ignores .expo folders
- Ignores env files
- Ignores build artifacts

---

### Documentation Files

#### `README.md`
**Contains**:
- Feature overview
- Prerequisites
- Installation steps
- API integration details
- Screen descriptions
- Troubleshooting
- Customization guide

#### `SETUP_GUIDE.md`
**Contains**:
- Step-by-step installation
- OS-specific instructions (macOS, Windows, Linux)
- Verification steps
- Common issues and solutions
- Development workflow

#### `ARCHITECTURE.md`
**Contains**:
- Navigation structure diagram
- Component hierarchy
- Data flow diagrams
- Type system overview
- Screen breakdowns
- Styling architecture
- Error handling flow

---

## 🔄 Data Flow Summary

```
1. App starts → HomeScreen
2. HomeScreen fetches movies via MovieAPI
3. Display featured movie + grid
4. User taps movie → MovieDetailsScreen
5. MovieDetailsScreen fetches full details
6. Display all information
7. User clicks Play → ServerSelectionScreen (if multiple)
8. User selects server → VideoPlayerScreen
9. Video plays with native controls
```

---

## 📱 Navigation Stack

```
Stack Navigator
├─ HomeScreen (headerShown: false)
├─ MovieDetailsScreen (headerShown: true)
├─ ServerSelectionScreen (headerShown: true)
└─ VideoPlayerScreen (headerShown: false)
```

---

## 🎯 Key Features Implemented

| Feature | File | Status |
|---------|------|--------|
| Home screen with featured movie | HomeScreen.tsx | ✅ |
| Movie list grid | HomeScreen.tsx, MovieCard.tsx | ✅ |
| Detailed movie info | MovieDetailsScreen.tsx | ✅ |
| Multiple ratings display | MovieDetailsScreen.tsx | ✅ |
| Server selection | ServerSelectionScreen.tsx | ✅ |
| Video playback | VideoPlayerScreen.tsx | ✅ |
| Error handling | All screens | ✅ |
| Loading states | All screens | ✅ |
| Pull-to-refresh | HomeScreen.tsx | ✅ |
| Dark theme | styles.ts | ✅ |

---

## 🔧 Customization Points

### Change API URL
File: `src/services/MovieAPI.ts`
```typescript
private baseURL: string = 'http://your-url:3000/api';
```

### Change Colors
File: `src/styles/styles.ts`
```typescript
// e.g., Change red to blue
'#e74c3c' → '#3498db'
```

### Modify Layout
Files: `src/styles/styles.ts`
- Grid columns: Adjust width percentages
- Spacing: Adjust padding/margin values
- Font sizes: Adjust fontSize values

### Add Features
Common additions:
- Search functionality
- Favorites/bookmarks
- Watch history
- Genre filtering
- User ratings

---

## 📦 Dependencies Explained

| Package | Purpose | Version |
|---------|---------|---------|
| react | React library | 18.2.0 |
| react-native | RN framework | 0.74.1 |
| expo | Expo toolkit | ~51.0.0 |
| @react-navigation/native | Navigation | ^6.1.9 |
| @react-navigation/stack | Stack navigator | ^6.3.20 |
| expo-video | Video player | ~1.0.0 |
| axios | HTTP client | ^1.6.2 |

---

## 📊 Project Statistics

- **Total Files**: 14+
- **Lines of Code**: ~2000+
- **Screens**: 4
- **Components**: 2
- **API Endpoints Used**: 4
- **Styling Objects**: 40+
- **Documentation Files**: 4

---

## 🎓 Learning Resources

### Used Technologies
- **React Hooks**: State and effects management
- **React Navigation**: Screen stack management
- **TypeScript**: Type-safe development
- **Expo**: React Native tooling
- **Axios**: HTTP requests
- **StyleSheet**: Native styling

### Official Documentation
- https://reactnative.dev/
- https://docs.expo.dev/
- https://reactnavigation.org/
- https://axios-http.com/

---

## ✅ Verification Checklist

- [ ] All files created successfully
- [ ] No TypeScript errors
- [ ] Backend running on localhost:3000
- [ ] Dependencies installed
- [ ] App starts without errors
- [ ] Home screen loads movies
- [ ] Can navigate to details
- [ ] Video player works
- [ ] Errors handled gracefully

---

## 🐛 Debugging Tips

### View Console Logs
```bash
# Terminal shows logs automatically
# Or check device logs:
npm start → View output
```

### Check API Connectivity
```bash
curl http://localhost:3000/api/movies?page=1
```

### Clear Cache & Reinstall
```bash
rm -rf node_modules
npm install
npm start
```

### Hot Reload
- Save any file in `src/` to auto-refresh app

---

## 🚀 Next Steps

1. **Install & Run**
   - Follow SETUP_GUIDE.md
   
2. **Explore App**
   - Test all screens
   - Try playback
   
3. **Customize**
   - Change colors in styles.ts
   - Modify layouts
   
4. **Extend Features**
   - Add search
   - Add favorites
   - Add watch history

---

## 📞 Support

For issues:
1. Check README.md troubleshooting
2. Review SETUP_GUIDE.md for OS-specific help
3. See ARCHITECTURE.md for technical details
4. Verify backend is running
5. Check network connectivity

---

**Project Created**: November 19, 2025  
**Framework**: React Native + Expo  
**API**: SOAP2Day via BMovieBox Backend  
**Status**: ✅ Ready for development

Enjoy building! 🎬🚀
