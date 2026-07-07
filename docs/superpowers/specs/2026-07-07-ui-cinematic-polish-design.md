# UI Cinematic Premium Polish — Design

**Date:** 2026-07-07
**Scope:** App-wide visual polish, phone-first. No layout/navigation/behavior changes.

## Goal

Modernize Reelmark's look from flat utilitarian dark (`#000`/`#1a1a1a` + `#e74c3c`) to a
cinematic premium feel: deep near-black layered surfaces, gradient scrims over poster art,
refined typography and spacing, softer cards with depth. Structure and flows stay as-is.

## Constraints

- **No new native dependencies.** Builds are local Gradle release builds; adding native
  modules forces a rebuild. Motion uses built-in `Animated`, `expo-image` transitions, and
  `expo-linear-gradient` (already installed). `react-native-reanimated` is NOT added.
- **Phone-first.** TV-specific styles (card sizing, overscan padding, focus borders,
  `iconButtonFocused`, `featuredFocused`, etc.) remain byte-identical. `isTvApp` and
  `Platform.isTV` logic untouched. One TV smoke-check at the end.
- **Dark-only.** No theme provider/context — tokens are plain typed constants (zero runtime
  cost).
- Existing jest tests stay green. The known pre-existing `tsc customConditions` error is
  expected and not a regression.

## Architecture

### 1. Design tokens — `src/styles/theme.ts` (new)

Plain exported constants consumed by both the shared stylesheet and per-screen stylesheets:

- **Colors**
  - `bg: #0A0A0E` (matches adaptive-icon background)
  - Surfaces: `surface: #131318`, `surfaceHigh: #1C1C24` (blue-tinted grays replacing
    `#1a1a1a` / `#2d2d2d` / `#2a2a2a`)
  - Borders: `rgba(255,255,255,0.08)` hairlines replacing `#333`
  - Text: `text: #FFFFFF`, `textSecondary: #B8B8C0`, `textMuted: #71717A`
    (replacing `#fff` / `#aaa` / `#888` / `#ddd`)
  - Accent: `accent: #E5484D` (deeper cinematic crimson replacing `#e74c3c`), plus
    pressed/focused variants
  - Rating gold: `#F5C518` (replacing `#ffc107`)
  - Scrim gradient stops for hero/backdrop overlays
- **Spacing scale:** 4 / 8 / 12 / 16 / 20 / 24 / 32
- **Radii:** cards 14, buttons 12, pills 999
- **Type scale:** title / heading / body / caption presets with `fontSize`, `fontWeight`,
  `lineHeight`, `letterSpacing` (current styles set neither lineHeight nor letterSpacing)
- **Shadow presets:** subtle elevation for cards/posters

### 2. Shared stylesheet migration — `src/styles/styles.ts`

Replace every hardcoded color/spacing/radius value with token references. **Same style keys,
no structural or layout changes** — this restyles all screens at once. TV-specific values are
excluded from the sweep.

### 3. Staged screen polish

Each stage also replaces that screen's *local* `StyleSheet.create` hardcoded hex values with
tokens (nearly every screen has its own inline stylesheet).

- **Stage A — Home + rails:** `HomeScreen`, `FeaturedMovie`, `MovieCard`,
  `ContinueWatchingCard`, `RecommendationRail`, `UpcomingReleases`.
  Hero gets a bottom `expo-linear-gradient` scrim so title text sits on poster art; rail
  headers get consistent type; cards get token radii, `expo-image` ~200ms crossfade, subtle
  press-scale feedback via built-in `Animated`; progress bars restyled.
- **Stage B — Details:** `MovieDetailsScreen`, `SeriesDetailScreen`, `SeriesList`.
  Full-bleed backdrop with gradient scrim into `bg`; poster elevation shadow; metadata pills
  (year / runtime / rating) instead of plain text runs; primary Play button in accent with
  proper height/weight; secondary actions as quiet pills.
- **Stage C — Search + Library:** `SearchScreen`, `LibraryScreen`, `WatchlistScreen`,
  `DownloadedTitlesScreen`.
  Rounded search field on `surface` with proper placeholder color; consistent grid gutters
  from the spacing scale; designed empty states (icon + message + hint) replacing bare text.
- **Stage D — Player + stream selection:** player controls overlays, `StreamSelection`,
  `ServerSelectionScreen`, `TrackSelectionMenu`.
  Controls sit on gradient scrims instead of flat black boxes; consistent slider/track
  colors; selection screens become token-styled list rows with clear selected states.

Remaining screens (Settings, Preferences, Onboarding, Calendar, Planner, Live) inherit the
shared-stylesheet migration in this pass; deep polish for them is out of scope.

## Verification

Screenshot-driven per stage via argent on the Android emulator: Home, Details, Search,
Library, Player, StreamSelection. After all stages, one Android TV smoke-check confirming
focus states and card sizing are unchanged. `npx jest` stays green.

## Out of scope

- TV/big-screen redesign (separate later pass)
- Web build styling
- Navigation, flows, copy, or behavior changes
- New animation libraries (reanimated) or blur effects (expo-blur)
- Light theme / theme switching
