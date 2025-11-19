# BMovieBox Setup Guide

## Quick Start (5 minutes)

### Step 1: Prerequisites Check
```bash
# Check Node.js version (need v18+)
node --version

# Check npm
npm --version

# Install Expo CLI globally
npm install -g expo-cli
```

### Step 2: Backend Setup (if not already running)
```bash
# Navigate to your BMovieBox backend directory
cd ../your-backend-path

# Install dependencies
npm install

# Start backend
npm run start:dev

# Verify it's running (in another terminal)
curl http://localhost:3000/api/movies?page=1
```

You should see a JSON response with movies.

### Step 3: Frontend Setup
```bash
# Navigate to this app directory
cd BMovieBox

# Install dependencies
npm install

# Start the app
npm start
```

### Step 4: Run on Device/Emulator

**iOS:**
- Press `i` in the Expo CLI terminal
- Or scan the QR code with Camera app (iOS 13+)

**Android:**
- Press `a` in the Expo CLI terminal
- Or install Expo Go app from Play Store and scan QR code

---

## Detailed Setup Instructions

### macOS Setup

#### 1. Install Xcode (for iOS development)
```bash
# Install from App Store or
xcode-select --install
```

#### 2. Install Node.js
```bash
# Using Homebrew (recommended)
brew install node

# Or download from https://nodejs.org/
```

#### 3. Install Expo CLI
```bash
npm install -g expo-cli
```

#### 4. Backend Setup
```bash
# Clone or navigate to backend
cd path/to/backend

npm install
npm run start:dev

# Keep this running in a separate terminal
```

#### 5. Frontend Setup
```bash
# Clone or navigate to this app
cd BMovieBox

npm install
npm start

# You'll see a QR code in the terminal
```

#### 6. Test on Simulator/Device
```bash
# Press 'i' for iOS Simulator
# Press 'a' for Android Emulator
# Or scan QR code with your device
```

---

### Windows Setup

#### 1. Install Node.js
Download from https://nodejs.org/ and install the LTS version.

#### 2. Install Expo CLI
```bash
npm install -g expo-cli
```

#### 3. Install Android Studio (for Android development)
- Download from https://developer.android.com/studio
- Install and set up Android Emulator
- Add Android SDK to PATH

#### 4. Backend Setup
```bash
# Navigate to backend directory
cd path\to\backend

npm install
npm run start:dev
```

#### 5. Frontend Setup
```bash
# Navigate to app directory
cd BMovieBox

npm install
npm start
```

#### 6. Run on Emulator
```bash
# Press 'a' for Android Emulator
# Make sure Android Emulator is running first
```

---

### Linux Setup

#### 1. Install Node.js
```bash
# Using apt (Ubuntu/Debian)
sudo apt update
sudo apt install nodejs npm

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
```

#### 2. Install Expo CLI
```bash
npm install -g expo-cli
```

#### 3. Backend Setup
```bash
cd path/to/backend
npm install
npm run start:dev
```

#### 4. Frontend Setup
```bash
cd BMovieBox
npm install
npm start
```

#### 5. Run on Device
```bash
# Install Expo Go on your phone
# Scan the QR code from terminal
```

---

## Verifying Backend is Running

Before starting the app, always verify the backend API is accessible:

```bash
# On macOS/Linux
curl http://localhost:3000/api/movies?page=1

# On Windows (PowerShell)
Invoke-WebRequest http://localhost:3000/api/movies?page=1

# You should get a response like:
# {
#   "movies": [...],
#   "pagination": {...}
# }
```

If you get an error like "Connection refused", the backend is not running.

---

## Common Issues During Setup

### "npm: command not found"
- **Solution**: Node.js is not installed. Download from https://nodejs.org/

### "expo: command not found"
- **Solution**: Expo CLI not installed globally
```bash
npm install -g expo-cli
```

### "Cannot connect to localhost:3000"
- **Solution**: Backend is not running
```bash
# Start backend in a separate terminal
cd path/to/backend
npm run start:dev
```

### "EACCES: permission denied"
- **Solution**: Use `sudo` or fix npm permissions
```bash
sudo npm install -g expo-cli
# Or configure npm to not require sudo
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
```

### "Module not found" errors
- **Solution**: Dependencies not installed
```bash
cd BMovieBox
npm install
```

### App crashes on startup
- **Solution**: Clear cache and reinstall
```bash
rm -rf node_modules
npm install
npm start
```

---

## Project Structure Overview

```
BMovieBox/
├── src/
│   ├── screens/              # All app screens
│   │   ├── HomeScreen.tsx
│   │   ├── MovieDetailsScreen.tsx
│   │   ├── ServerSelectionScreen.tsx
│   │   └── VideoPlayerScreen.tsx
│   ├── components/           # Reusable components
│   │   ├── FeaturedMovie.tsx
│   │   └── MovieCard.tsx
│   ├── services/             # API client
│   │   └── MovieAPI.ts
│   └── styles/               # Styling
│       └── styles.ts
├── App.tsx                   # Main app entry & navigation
├── app.json                  # Expo configuration
├── package.json              # Dependencies
├── babel.config.js           # Babel config
└── tsconfig.json             # TypeScript config
```

---

## First Run Checklist

- [ ] Node.js installed (v18+)
- [ ] Expo CLI installed globally
- [ ] Backend running on http://localhost:3000
- [ ] Verified backend with curl request
- [ ] Ran `npm install` in BMovieBox directory
- [ ] Ran `npm start`
- [ ] Opened app on device/emulator

---

## Development Workflow

### Making Changes

1. **Edit a file** in `src/`
2. **Save the file** - hot reload will refresh the app automatically
3. **Check the app** for your changes

### Debugging

```bash
# Add console logs to your code
console.log('Debug info:', variable);

# View logs in terminal:
# On Android: Expo CLI shows logs
# On iOS: Expo CLI shows logs
```

### Testing Different Screens

Edit `App.tsx` to change the initial screen for faster testing:

```typescript
<Stack.Screen
  name="Home"
  component={HomeScreen}
  options={{ headerShown: false }}
/>
```

---

## Next Steps

After successful setup:

1. **Explore the app** - Navigate through all screens
2. **Test playback** - Try playing a movie
3. **Test error handling** - Stop the backend and see error messages
4. **Customize styling** - Edit `src/styles/styles.ts`
5. **Modify components** - Explore each component's purpose

---

## Additional Resources

- **Expo Documentation**: https://docs.expo.dev/
- **React Native Docs**: https://reactnative.dev/
- **React Navigation**: https://reactnavigation.org/
- **Axios Documentation**: https://axios-http.com/

---

## Getting Help

If you encounter issues:

1. Check the **Troubleshooting** section above
2. Review **error messages** carefully
3. Verify **backend is running**: `curl http://localhost:3000/api/movies?page=1`
4. Check **network connectivity**
5. Try **clearing cache**: `rm -rf node_modules && npm install`

---

**Enjoy your BMovieBox app!** 🎬
