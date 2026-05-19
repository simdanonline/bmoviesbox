# Google TV (Android TV) Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a BMovieBox build that installs from the Google TV launcher, navigates with the remote D-pad, and plays video on a real Google TV device.

**Architecture:** Use the official `@react-native-tvos/config-tv` Expo config plugin to rewrite the Android manifest for Leanback at build time (TV banner, `LEANBACK_LAUNCHER` intent, `uses-feature` flags) when `EXPO_TV=1` is set. Keep the existing phone/tablet build untouched — TV is a separate EAS profile. UI changes are additive: a reusable `Focusable` wrapper around touch targets that scales/glows on `onFocus`, an initial-focus hint on each screen, a TV-aware top-tab navigator that replaces the bottom tabs at runtime when `Platform.isTV`, and `useTVEventHandler` for the remote back button.

**Tech Stack:** Expo SDK 54, React Native 0.81, `@react-native-tvos/config-tv`, EAS Build, ADB for sideload. No `react-native-tvos` fork needed — vanilla RN 0.81 ships with Android TV focus APIs.

**Naming note:** The existing `TvAppContext` / `isTvApp` flag in this codebase is a **password-unlocked "TV mode" feature** (shows the `LiveTab`). It is **unrelated** to running on Android TV hardware. Throughout this plan, "TV platform" / `Platform.isTV` refers to Google TV / Android TV. Do not rename or repurpose `isTvApp` — they coexist.

---

## File Structure

**Create:**
- `assets/images/tv-banner.png` — 320×180 PNG required by Android TV launcher
- `src/components/Focusable.tsx` — D-pad-aware wrapper that styles focus state
- `src/hooks/useTVBackHandler.ts` — wraps `useTVEventHandler` for the menu/back button
- `src/navigation/TvTabs.tsx` — top-tab navigator used when `Platform.isTV`
- `docs/google-tv-build.md` — short README on building and sideloading

**Modify:**
- `app.json` — add the config plugin and TV banner reference
- `eas.json` — add a `tv` build profile with `EXPO_TV=1`
- `src/navigation/AppStack.tsx` — pick `MyTabs` vs `TvTabs` from `Platform.isTV`
- `src/components/MovieCard.tsx` — wrap in `Focusable`
- `src/components/FeaturedMovie.tsx` — wrap CTAs in `Focusable`, mark hero as initial focus
- `src/components/RecommendationRail.tsx` — set `hasTVPreferredFocus` on first card of first rail
- `src/screens/HomeScreen.tsx` — verify focus flow, landscape spacing tweaks
- `src/screens/SearchScreen.tsx` — focus the input on mount
- `src/screens/MovieDetailsScreen.tsx` — focus the primary action on mount
- `src/screens/VideoPlayerScreen.tsx` — D-pad controls (play/pause on select, seek on L/R)
- `src/styles/styles.ts` — add `cardFocused` style (scale, border, glow)
- `package.json` — new dev script `tv:build`

**No tests for native focus behavior** — D-pad focus is a native-only feature that can't be exercised by `jest`/`react-native-testing-library`. Verification is "install APK on Google TV, navigate with the remote." Each task lists explicit on-device acceptance checks.

---

## Task 1: Add TV config plugin and banner asset

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Create: `assets/images/tv-banner.png`

- [ ] **Step 1: Install the TV config plugin**

Run:
```bash
npx expo install @react-native-tvos/config-tv
```

Expected: package added to `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Add a TV banner asset**

Android TV requires a 320×180 banner. For now, drop a placeholder PNG at `assets/images/tv-banner.png`. Either:
- Export a 320×180 crop of `assets/images/icon.png` from any image editor, OR
- Generate one with ImageMagick: `magick assets/images/icon.png -resize 320x180^ -gravity center -extent 320x180 assets/images/tv-banner.png`

Verify the file exists and is exactly 320×180:
```bash
file assets/images/tv-banner.png
```
Expected: `PNG image data, 320 x 180, ...`

- [ ] **Step 3: Wire the plugin into `app.json`**

Replace the `plugins` array in `app.json` with:

```json
"plugins": [
  [
    "@react-native-tvos/config-tv",
    {
      "androidTVBanner": "./assets/images/tv-banner.png",
      "isTV": true
    }
  ],
  ["expo-video"],
  "expo-web-browser",
  [
    "expo-notifications",
    {
      "icon": "./assets/images/icon.png",
      "color": "#e74c3c"
    }
  ]
]
```

- [ ] **Step 4: Verify prebuild output**

Run:
```bash
EXPO_TV=1 npx expo prebuild --platform android --clean
```

Then check the generated manifest includes Leanback:
```bash
grep -E "leanback|LEANBACK_LAUNCHER|android.hardware.touchscreen" android/app/src/main/AndroidManifest.xml
```

Expected output contains:
- `<uses-feature android:name="android.software.leanback" android:required="false"`
- `<uses-feature android:name="android.hardware.touchscreen" android:required="false"`
- `<category android:name="android.intent.category.LEANBACK_LAUNCHER"`
- A `<meta-data android:name="com.google.android.tv.banner"` line (or `android:banner` on the activity)

Clean up the prebuild artifacts afterwards (we use EAS for actual builds):
```bash
rm -rf android
```

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json assets/images/tv-banner.png
git commit -m "feat(tv): add @react-native-tvos/config-tv plugin and TV banner"
```

---

## Task 2: Add EAS `tv` build profile and dev script

**Files:**
- Modify: `eas.json`
- Modify: `package.json`

- [ ] **Step 1: Add `tv` profile to `eas.json`**

Replace the `build` block in `eas.json` with:

```json
"build": {
  "development": {
    "developmentClient": true,
    "distribution": "internal",
    "channel": "development"
  },
  "preview": {
    "distribution": "internal",
    "channel": "preview"
  },
  "production": {
    "autoIncrement": true,
    "channel": "production"
  },
  "tv": {
    "extends": "preview",
    "platform": "android",
    "env": { "EXPO_TV": "1" },
    "channel": "tv",
    "android": {
      "buildType": "apk"
    }
  }
}
```

(`buildType: apk` matters — Google TV sideloading from ADB takes an APK, not an AAB.)

- [ ] **Step 2: Add a convenience npm script**

In `package.json`, add to `scripts`:

```json
"tv:build": "eas build --profile tv --platform android"
```

- [ ] **Step 3: Trigger a build**

```bash
npm run tv:build
```

Expected: EAS queues a build. Wait for the link in the terminal — the resulting `.apk` is the artifact for Task 3.

- [ ] **Step 4: Commit**

```bash
git add eas.json package.json
git commit -m "build(tv): add EAS tv profile and tv:build script"
```

---

## Task 3: Install on Google TV and verify launcher entry

**Files:** None (verification only)

- [ ] **Step 1: Enable Developer Options + ADB on the Google TV**

On the Google TV: Settings → System → About → tap "Android TV OS build" 7 times → Developer Options appears under Settings → System. In Developer Options, enable "USB debugging" and "Network debugging" (sometimes called "ADB debugging").

Note the TV's IP from Settings → Network → (your network) → IP address.

- [ ] **Step 2: Connect ADB over the network**

```bash
adb connect <TV_IP>:5555
```

The TV will show an authorization prompt — accept it (check "Always allow").

Verify:
```bash
adb devices
```
Expected: the TV's `<IP>:5555` appears with status `device` (not `unauthorized`).

- [ ] **Step 3: Install the APK from Task 2**

Download the `.apk` produced by EAS (the build page has a download link).

```bash
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv.apk
```

Expected: `Success`. If you see `INSTALL_FAILED_OLDER_SDK`, the EAS build's `minSdkVersion` is fine — the failure is more often `INSTALL_FAILED_INSUFFICIENT_STORAGE` (clear space on the TV) or a signature conflict from a prior non-TV install (`adb uninstall com.simdanonline.bmoviebox` first, then retry).

- [ ] **Step 4: Verify the app appears in the Google TV launcher**

Acceptance criteria:
- BMovieBox tile shows up in the Apps row on the Google TV home screen (not just in "All apps")
- The tile displays the banner image, not a generic Android icon
- Launching the tile opens the app and renders `HomeScreen`

If the tile doesn't appear in the Apps row but the install was "Success," the Leanback manifest changes didn't take effect — re-run Task 1 Step 4 to inspect the EAS-built APK by extracting `AndroidManifest.xml`:
```bash
# requires apktool: brew install apktool
apktool d -s -f ~/Downloads/bmoviebox-tv.apk -o /tmp/bmoviebox-tv
grep LEANBACK_LAUNCHER /tmp/bmoviebox-tv/AndroidManifest.xml
```
Expected: at least one match.

- [ ] **Step 5: Note current pain points (do NOT fix yet)**

Open the app on the TV and try to navigate with the remote. Expected state: most UI is unreachable, no visible focus indicator, bottom tabs are bottom-clipped. This is the baseline we'll fix in Tasks 4-9.

- [ ] **Step 6: Document the install flow**

Create `docs/google-tv-build.md`:

```markdown
# Building BMovieBox for Google TV

## Build
\`\`\`
npm run tv:build
\`\`\`
Download the resulting APK from the EAS build page.

## Install (one-time setup)
1. Google TV → Settings → System → About → tap "Android TV OS build" 7×.
2. Developer Options → enable "Network debugging".
3. Note the TV's IP from Settings → Network.
4. On your laptop: `adb connect <TV_IP>:5555` and accept the prompt on the TV.

## Install the APK
\`\`\`
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv.apk
\`\`\`

For re-installs over a non-TV build: `adb uninstall com.simdanonline.bmoviebox` first.

## Logs while running
\`\`\`
adb -s <TV_IP>:5555 logcat *:S ReactNative:V ReactNativeJS:V
\`\`\`
```

- [ ] **Step 7: Commit**

```bash
git add docs/google-tv-build.md
git commit -m "docs(tv): add Google TV build & sideload instructions"
```

---

## Task 4: Build the `Focusable` wrapper component

**Files:**
- Create: `src/components/Focusable.tsx`
- Modify: `src/styles/styles.ts`

- [ ] **Step 1: Add the focused-card style**

In `src/styles/styles.ts`, add a new entry to the styles object (near the existing `movieCardContainer` block at line 135):

```ts
cardFocused: {
  transform: [{ scale: 1.08 }],
  borderWidth: 3,
  borderColor: "#e74c3c",
  shadowColor: "#e74c3c",
  shadowOpacity: 0.6,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 0 },
  elevation: 12,
},
```

- [ ] **Step 2: Create the Focusable component**

Create `src/components/Focusable.tsx`:

```tsx
import React, { useState } from "react";
import {
  Pressable,
  PressableProps,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { styles } from "../styles/styles";

interface FocusableProps extends PressableProps {
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
  children: React.ReactNode;
}

export default function Focusable({
  style,
  focusedStyle,
  hasTVPreferredFocus,
  children,
  ...rest
}: FocusableProps) {
  const [focused, setFocused] = useState(false);
  const isTV = Platform.isTV;

  return (
    <Pressable
      {...rest}
      // @ts-expect-error — RN types miss this prop but it works on Android TV
      hasTVPreferredFocus={isTV ? hasTVPreferredFocus : undefined}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      style={[
        style,
        isTV && focused && (focusedStyle ?? styles.cardFocused),
      ]}
    >
      {children}
    </Pressable>
  );
}
```

Why `Pressable` and not `TouchableOpacity`: `Pressable` fires `onFocus`/`onBlur` on Android TV when the D-pad lands on it. `TouchableOpacity` does not surface those events on all RN versions. `hasTVPreferredFocus` is a real Android TV prop — it is just absent from React Native's TypeScript definitions.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors from `Focusable.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/Focusable.tsx src/styles/styles.ts
git commit -m "feat(tv): add Focusable wrapper with onFocus styling"
```

---

## Task 5: Make `MovieCard` D-pad focusable

**Files:**
- Modify: `src/components/MovieCard.tsx`

- [ ] **Step 1: Replace `TouchableOpacity` with `Focusable`**

In `src/components/MovieCard.tsx`, replace lines 1-61 with:

```tsx
import React from "react";
import { View, Text, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Movie } from "../services/MovieAPI";
import { styles } from "../styles/styles";
import { Feather } from "@expo/vector-icons";
import Focusable from "./Focusable";

interface MovieCardProps {
  movie: Movie;
  onPress: () => void;
  style?: ViewStyle;
  hasTVPreferredFocus?: boolean;
}

export default function MovieCard({
  movie,
  onPress,
  style,
  hasTVPreferredFocus,
}: MovieCardProps) {
  if (!movie.thumbnail) {
    return null;
  }

  return (
    <Focusable
      style={[styles.movieCardContainer, style]}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
    >
      <View style={styles.cardImageWrapper}>
        <Image
          source={{ uri: movie.thumbnail.trim() }}
          style={styles.cardImage}
          contentFit="scale-down"
        />
        <View style={styles.cardOverlay}>
          <View style={styles.playButtonSmall}>
            <Text style={styles.playIconSmall}>▶</Text>
          </View>
        </View>
        {movie.isSeries && (
          <View style={styles.seriesBadge}>
            <Feather name="tv" size={24} color="black" />
          </View>
        )}
      </View>

      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {movie.title}
        </Text>

        {movie.imdbRating && (
          <View style={styles.cardRating}>
            <Text style={styles.cardRatingText}>
              ⭐ {parseFloat(movie?.imdbRating || "0").toFixed(1)}
            </Text>
          </View>
        )}

        <Text style={styles.cardYear}>{movie.releaseYear}</Text>
      </View>
    </Focusable>
  );
}
```

Note: also dropped the `onProgress={(e) => console.log(e)}` debug line from line 32 — it was spamming logcat.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 3: Manual smoke-test on phone**

```bash
npm run android
```
Expected: cards still tap on a touch device exactly as before — no visual regression. (No focus styling on phone because `Platform.isTV === false`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/MovieCard.tsx
git commit -m "feat(tv): make MovieCard D-pad focusable via Focusable wrapper"
```

---

## Task 6: TV-aware top-tab navigator

**Files:**
- Create: `src/navigation/TvTabs.tsx`
- Modify: `src/navigation/AppStack.tsx`

Bottom tabs are unusable with a D-pad — the user has to traverse the entire screen content downward to reach them. We swap to a top tab bar on TV.

- [ ] **Step 1: Create `TvTabs.tsx`**

Create `src/navigation/TvTabs.tsx`:

```tsx
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Text, View, StyleSheet } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import SeriesList from "../screens/SeriesList";
import LibraryScreen from "../screens/LibraryScreen";
import PlannerScreen from "../screens/PlannerScreen";
import CalendarScreen from "../screens/CalendarScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LiveTab from "../screens/LiveTab";
import { useTvApp } from "../context/TvAppContext";

const Tab = createMaterialTopTabNavigator();

export default function TvTabs() {
  const { isTvApp } = useTvApp();

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={{
          swipeEnabled: false,
          tabBarStyle: { backgroundColor: "#000" },
          tabBarIndicatorStyle: { backgroundColor: "#e74c3c", height: 3 },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#999",
          tabBarLabelStyle: { fontSize: 16, fontWeight: "600" },
        }}
      >
        <Tab.Screen name="Movies" component={HomeScreen} />
        <Tab.Screen name="Series" component={SeriesList} />
        <Tab.Screen name="Library" component={LibraryScreen} />
        <Tab.Screen name="Planner" component={PlannerScreen} />
        <Tab.Screen name="Calendar" component={CalendarScreen} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "Settings" }} />
        {isTvApp && <Tab.Screen name="LiveTab" component={LiveTab} options={{ title: "Live" }} />}
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
```

- [ ] **Step 2: Install the top-tabs dependency**

```bash
npx expo install @react-navigation/material-top-tabs react-native-tab-view react-native-pager-view
```

Expected: three new entries in `dependencies`.

- [ ] **Step 3: Pick the navigator based on `Platform.isTV`**

In `src/navigation/AppStack.tsx`, modify line 13 (the `MyTabs` import) and the `Stack.Screen name="Home"` block.

Replace line 13:
```tsx
import MyTabs from "./Tabs";
```
with:
```tsx
import MyTabs from "./Tabs";
import TvTabs from "./TvTabs";
import { Platform } from "react-native";
```

Replace lines 54-58 (the `<Stack.Screen name="Home" component={MyTabs} ...>` block) with:
```tsx
<Stack.Screen
  name="Home"
  component={Platform.isTV ? TvTabs : MyTabs}
  options={{ headerShown: false }}
/>
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/TvTabs.tsx src/navigation/AppStack.tsx package.json package-lock.json
git commit -m "feat(tv): top-tab navigator on Platform.isTV"
```

---

## Task 7: Initial focus + remote back button

**Files:**
- Modify: `src/components/RecommendationRail.tsx`
- Modify: `src/components/FeaturedMovie.tsx`
- Create: `src/hooks/useTVBackHandler.ts`
- Modify: `src/screens/MovieDetailsScreen.tsx`

- [ ] **Step 1: Set initial focus on the first rail's first card**

Read `src/components/RecommendationRail.tsx` to confirm it renders `MovieCard` in a `FlatList`. Pass `hasTVPreferredFocus` to the first item.

Patch its `renderItem` to accept an index check, e.g.:
```tsx
renderItem={({ item, index }) => (
  <MovieCard
    movie={item}
    onPress={() => onMoviePress(item)}
    hasTVPreferredFocus={isFirstRail && index === 0}
  />
)}
```
Add an `isFirstRail?: boolean` prop to `RecommendationRail` and thread it through. In `HomeScreen.tsx`, pass `isFirstRail={true}` to the first `<RecommendationRail>` instance only.

- [ ] **Step 2: Wrap `FeaturedMovie` CTAs**

In `src/components/FeaturedMovie.tsx`, replace each `TouchableOpacity` (Play / More info / etc.) with `Focusable`. The Play button should be the screen's initial focus if `FeaturedMovie` is above the rails — in that case, set `hasTVPreferredFocus` on the Play button instead of on the rail (only one initial-focus target per screen).

- [ ] **Step 3: Create the TV back-button hook**

Create `src/hooks/useTVBackHandler.ts`:

```ts
import { useEffect } from "react";
import { Platform, TVEventHandler } from "react-native";

export function useTVBackHandler(onBack: () => void) {
  useEffect(() => {
    if (!Platform.isTV) return;
    const handler = new TVEventHandler();
    handler.enable(null, (_cmp, evt: { eventType?: string }) => {
      if (evt?.eventType === "menu") onBack();
    });
    return () => handler.disable();
  }, [onBack]);
}
```

The Google TV remote's "Back" arrow fires `eventType: "menu"` through `TVEventHandler`. React Navigation's stack already handles back natively, but custom modal screens (e.g. `StreamSelection`) need this hook to dismiss.

- [ ] **Step 4: Use the hook in `MovieDetailsScreen`**

In `src/screens/MovieDetailsScreen.tsx`, near the top of the component:

```tsx
import { useTVBackHandler } from "../hooks/useTVBackHandler";
// ...
useTVBackHandler(() => navigation.goBack());
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/RecommendationRail.tsx src/components/FeaturedMovie.tsx src/hooks/useTVBackHandler.ts src/screens/MovieDetailsScreen.tsx src/screens/HomeScreen.tsx
git commit -m "feat(tv): initial focus + TV remote back handling"
```

---

## Task 8: Rebuild and verify on Google TV

**Files:** None (verification only)

- [ ] **Step 1: Rebuild the TV APK**

```bash
npm run tv:build
```

- [ ] **Step 2: Reinstall on the TV**

```bash
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv-2.apk
```

- [ ] **Step 3: Acceptance walkthrough**

Open the app from the Google TV launcher and verify with the remote alone (no touch / no mouse):

- The first card / Play CTA is visibly focused on launch (red border + scale).
- D-pad **right** moves focus along the first rail.
- D-pad **down** moves focus to the next rail's first card.
- D-pad **up** from a rail lands on the top tab bar; **left/right** moves between tabs.
- Pressing **select / OK** on a card opens `MovieDetailsScreen`.
- Pressing **back** on the remote returns from `MovieDetailsScreen` to `HomeScreen`.
- Tab change between Movies → Series → Library works.

If any of these fail, the focus traversal is the root cause — `Pressable` inside a non-focusable parent can swallow focus. Add `focusable={true}` and `accessible={true}` on container `View`s along the focus path.

- [ ] **Step 4: Capture logcat for any red errors**

In a separate terminal while you're walking through:
```bash
adb -s <TV_IP>:5555 logcat *:E ReactNativeJS:V
```
Note any red-flagged warnings — those are work items but not blockers for this plan.

---

## Task 9: VideoPlayerScreen D-pad controls

**Files:**
- Modify: `src/screens/VideoPlayerScreen.tsx`

- [ ] **Step 1: Read the current player implementation**

```bash
wc -l src/screens/VideoPlayerScreen.tsx
```
Note the line count — if it's >300 lines, plan the edits in small chunks.

Identify:
- The `expo-video` player ref / control surface
- Where touch controls (play/pause buttons) are rendered

- [ ] **Step 2: Wire D-pad events to player actions**

Add a `useTVEventHandler` block that maps:
- `eventType === "select"` (center button) → toggle play/pause
- `eventType === "right"` → seek +10s
- `eventType === "left"` → seek -10s
- `eventType === "up"` / `"down"` → show/hide control overlay

```tsx
import { useEffect } from "react";
import { Platform, TVEventHandler } from "react-native";

// ...inside the component, near other hooks:
useEffect(() => {
  if (!Platform.isTV) return;
  const handler = new TVEventHandler();
  handler.enable(null, (_cmp, evt: { eventType?: string }) => {
    switch (evt?.eventType) {
      case "select":
        player.playing ? player.pause() : player.play();
        break;
      case "right":
        player.currentTime = Math.min(player.currentTime + 10, player.duration);
        break;
      case "left":
        player.currentTime = Math.max(player.currentTime - 10, 0);
        break;
      case "up":
      case "down":
        setControlsVisible(true);
        break;
    }
  });
  return () => handler.disable();
}, [player]);
```

Note: the `expo-video` player ref's API (`player.playing`, `player.currentTime`, `player.duration`) is correct for SDK 54's `expo-video` ≥ 3.x. If the existing screen uses an older `Video` component from `expo-av`, adapt the calls to that API instead — do **not** introduce a new player library.

- [ ] **Step 3: Hide touch controls on TV**

The existing touch overlay (play/pause buttons, scrubber) is fine to leave rendered — touch UIs ignore D-pad. But the focus traversal will get stuck on them. Wrap the overlay in:

```tsx
{!Platform.isTV && (
  /* existing touch controls */
)}
```

…OR, if you want to keep visual feedback on TV, wrap each control button in `Focusable` and let the user navigate them with the D-pad. Pick one — don't ship both.

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no new errors.

- [ ] **Step 5: Rebuild and test on TV**

```bash
npm run tv:build
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv-3.apk
```

Acceptance:
- Open any movie → ServerSelection → VideoPlayer.
- Center button toggles play/pause.
- Left/right seeks by 10s with visible time change.
- Back button on remote exits to `MovieDetailsScreen`.

- [ ] **Step 6: Commit**

```bash
git add src/screens/VideoPlayerScreen.tsx
git commit -m "feat(tv): D-pad controls in VideoPlayerScreen"
```

---

## Task 10: SearchScreen focus

**Files:**
- Modify: `src/screens/SearchScreen.tsx`

- [ ] **Step 1: Focus the text input on mount**

In `SearchScreen.tsx`, add a `useRef<TextInput>` and call `.focus()` in a `useEffect` gated by `Platform.isTV`. On Google TV this surfaces the on-screen keyboard automatically.

```tsx
import { useEffect, useRef } from "react";
import { Platform, TextInput } from "react-native";

const inputRef = useRef<TextInput>(null);
useEffect(() => {
  if (Platform.isTV) inputRef.current?.focus();
}, []);

// ...on the input:
<TextInput ref={inputRef} ... />
```

- [ ] **Step 2: Wrap result rows in `Focusable`**

Search results that use `TouchableOpacity` need the same swap as `MovieCard` in Task 5. If `SearchScreen` already uses `MovieCard` for results, this is already done — verify and skip.

- [ ] **Step 3: Rebuild, sideload, verify**

```bash
npm run tv:build
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv-4.apk
```

Acceptance:
- Open the Search tab — keyboard appears, input is focused.
- Type a query with the remote — results render.
- D-pad down moves focus to the first result.
- Select opens the movie.

- [ ] **Step 4: Commit**

```bash
git add src/screens/SearchScreen.tsx
git commit -m "feat(tv): SearchScreen autofocus and result focus styling"
```

---

## Task 11: Landscape spacing pass

**Files:**
- Modify: `src/styles/styles.ts`
- Modify: `src/screens/HomeScreen.tsx` (as needed)

- [ ] **Step 1: Identify the breakpoints**

Google TV is always landscape, typically 1920×1080. Find every `Dimensions.get('window').width`-based sizing in `styles.ts` — phone portrait tunings (e.g. card widths of ~150) will look tiny.

- [ ] **Step 2: Branch on `Platform.isTV` in card sizes**

Where card widths/heights are set in `styles.ts`, replace literal numbers with conditional values. Example:

```ts
import { Dimensions, Platform } from "react-native";
const { width } = Dimensions.get("window");
const CARD_WIDTH = Platform.isTV ? Math.min(width / 7, 260) : width / 2.5;
```

Apply to `movieCardContainer`, `cardImageWrapper`, and any rail item containers.

- [ ] **Step 3: Rebuild, sideload, eyeball it**

```bash
npm run tv:build
adb -s <TV_IP>:5555 install -r ~/Downloads/bmoviebox-tv-5.apk
```

Acceptance:
- Cards on the TV are large enough to read titles from across the room.
- No content is clipped at the screen edges (TV overscan — leave ~5% safe margin on all sides if needed).

- [ ] **Step 4: Commit**

```bash
git add src/styles/styles.ts src/screens/HomeScreen.tsx
git commit -m "style(tv): scale card sizing for 1080p landscape"
```

---

## Out of scope for this plan

These are deliberate non-goals — listed so the engineer doesn't sprawl:

- **Apple TV / tvOS** — would need the `react-native-tvos` fork, separate build pipeline. Track separately if there's demand.
- **Play Store TV submission** — sideloading via ADB is fine for personal use; Play Console TV review needs a separate listing with TV screenshots, ratings, content guidelines.
- **Background images on the launcher** — Android TV supports a recommendation row and rich preview backgrounds; that's a separate "polish" plan.
- **Voice search** — would require integrating with the Google TV speech intent. Defer.
- **OnboardingScreen / PreferencesScreen / SettingsScreen TV polish** — they'll work passably with the global `Focusable` swap from Task 5; per-screen tuning can come in a follow-up.

---

## Self-Review Notes

- All steps reference exact file paths under `/Users/similoluwa/Documents/codes/vibe-coding/BMovieBox/`.
- Code blocks are complete — no `// TODO` or `// implement later` placeholders.
- The `Focusable` API (`focused`, `hasTVPreferredFocus`, `onPress`, `onFocus`, `onBlur`, `style`, `focusedStyle`) is used consistently across Tasks 4, 5, 7, 9, 10.
- The `useTVBackHandler` and `useTVEventHandler` patterns match — both go through `TVEventHandler` with `eventType` strings.
- No native test framework is invented — verification is on-device, which is the only meaningful test for TV focus behavior.
- Spec coverage: config plugin ✓ (Task 1), banner ✓ (Task 1), EAS profile ✓ (Task 2), launcher entry ✓ (Task 3), D-pad navigation ✓ (Tasks 4-7), back button ✓ (Task 7), video controls ✓ (Task 9), search input ✓ (Task 10), landscape sizing ✓ (Task 11).
