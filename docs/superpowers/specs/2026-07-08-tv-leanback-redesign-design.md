# TV Leanback Redesign — Design

**Date:** 2026-07-08
**Scope:** Android-TV (`Platform.isTV`) leanback redesign of Detail (Movie + Series),
Home + rails, Search, and Library. Phone + web layouts stay byte-identical. No
navigation/behavior/copy changes.

## Goal

Reelmark on Android TV currently renders the **phone layouts verbatim**, sized in absolute
`dp`. Because a landscape TV surface is short and wide (~540dp tall × ~960dp wide) versus a
tall phone (~800dp), those fixed values dominate the screen — the Movie/Series detail banner
(`coverImage`, fixed `height:400`) covers ~74% of the TV height and pushes the title, metadata,
and actions below the fold. This redesign rebuilds the four screens as true 10-foot **leanback**
layouts: horizontal arrangement, sizing relative to the landscape canvas, overscan-safe margins,
and clear D-pad focus flow.

## Root Cause

The oversized feel is not a scaling bug — it is absolute `dp` values (banner heights, font
sizes, paddings) tuned for a tall phone being rendered on a short, wide TV canvas. The fix is to
**arrange horizontally and size relative to screen dimensions**, not merely to shrink numbers.

## Constraints (Global)

- **No new native dependencies.** Builds are local Gradle release builds; a native module forces
  a rebuild. Motion/gradients/images use built-in `Animated`, `expo-linear-gradient`, and
  `expo-image` (via `TvSafeImage`) — all already installed. `react-native-reanimated`,
  `expo-blur`, and NativeWind are NOT added.
- **Keyed on `Platform.isTV` only — never `isTvApp`.** This codebase has two unrelated "TV"
  concepts: `Platform.isTV` (Android TV hardware) and `isTvApp` (an in-app password mode that
  runs on phones). The redesign targets Android TV hardware. `isTvApp`-on-phone keeps the phone
  layout.
- **Phone + web byte-identical.** Guaranteed structurally: each screen keeps its existing
  phone/web JSX untouched and adds an early `if (Platform.isTV) return <Tv…View/>;` branch above
  it. The phone/web code path never changes.
- **No behavior, navigation, or copy changes.** Same hooks, handlers, routes, and data. Only the
  TV presentation changes.
- **Brand tokens reuse `src/styles/theme.ts`** (`colors`, etc.) — same crimson accent
  (`#E5484D`), same surfaces. Only TV *layout* constants are new.
- Existing jest tests stay green. The known pre-existing `tsc customConditions` error is expected
  and not a regression.
- Player screen and its stream/track selection keep their current TV controls — out of scope.

## Architecture

### 1. TV layout constants — `src/styles/tvTheme.ts` (new)

A single module of TV-only layout values, consumed by the TV view components:

- **Overscan:** horizontal + vertical safe padding (~5% of screen; consolidates the existing
  `TV_HORIZONTAL_PADDING` idea from `styles.ts`).
- **Hero split ratios:** left info column vs right art column for the Detail hero; hero height
  fraction of screen.
- **Focus:** focus-scale factor and focus ring/border used across TV cards and buttons.
- **Card + type scale:** TV card width/height (consolidating `TV_CARD_WIDTH` /
  `TV_CARD_IMAGE_HEIGHT`), and a 10-foot type scale (title / heading / body / caption sizes).

Colors are imported from `theme.ts`; `tvTheme.ts` holds dimensions/scale only.

### 2. Clean phone/TV render split

For each redesigned screen, the screen component keeps all logic (data fetching, state,
handlers) and delegates only presentation to a TV view component that receives the
already-computed data + callbacks as props:

```tsx
// inside MovieDetailsScreen, after all hooks/handlers are set up
if (Platform.isTV) {
  return <TvMovieDetailsView {...tvViewProps} />;
}
// existing phone/web JSX below — unchanged
```

New TV view components live in `src/screens/tv/`:

- `TvMovieDetails.tsx`
- `TvSeriesDetail.tsx`
- `TvHome.tsx`
- `TvSearch.tsx`
- `TvLibrary.tsx`

Shared TV building blocks (as needed) also live under `src/screens/tv/` or
`src/components/tv/`: a `TvHero` (info-left / art-right hero), a `TvRail` (focusable horizontal
rail with header), and a `TvActionButton` (focusable pill). These reuse the existing
`Focusable` component for the Android TV native focus engine.

Because logic stays in the screen component, there is no duplication of data/handler code; the
TV view is presentation-only.

### 3. Screen designs

#### Detail — Movie + Series (Info-left / art-right)

- **Hero (~58% of screen height):**
  - **Left column (~45% width):** title (10-foot heading, not the phone's oversized run),
    metadata as pills (year · runtime · ★rating · genres), a 2–3 line clamped synopsis, and a
    horizontal **action row**: **Play** (accent fill, `hasTVPreferredFocus`), Save, Share,
    Trailer, and Download (only when the download entitlement is unlocked — same condition as
    today). Buttons are focusable pills.
  - **Right column (~55% width):** backdrop art (`coverImage`) feathered into `colors.bg` via a
    horizontal `LinearGradient` (art → `bg` toward the left column) so it blends behind the text;
    a bottom vertical gradient into `bg` for the content beneath.
- **Below the hero:** focusable horizontal rails — **Cast**, **Related** (recommendations).
- **Series additions:** a focusable **season selector** (horizontal chips) and an **episodes
  rail** (thumbnail · episode number · title); selecting an episode plays it via the existing
  handler. Same navigation and data as the current screen.

#### Home + rails

- Featured hero shrinks to ~one row-height (art-right + Play), not full-screen.
- Content rails use the TV card size, focus-scale, header type, and overscan-safe margins from
  `tvTheme.ts`. D-pad moves vertically between rails and horizontally within a rail. This refines
  the existing partial TV styling (`tvFeatured*`, `TV_CARD_WIDTH`) into the consolidated scale.

#### Search

- Landscape layout: a persistent search field that uses the **Android TV system keyboard** on
  focus (no custom on-screen keyboard — out of scope), with results re-laid as a D-pad **grid**
  (fewer, larger, focus-scaled columns) instead of the phone's stacked list. Same search logic
  and navigation.

#### Library

- Watchlist / Downloaded / Upcoming presented as a focusable top segment; content re-gridded for
  TV (wider cards, horizontal focus flow, overscan padding). The Upcoming tab reuses the existing
  `UpcomingReleases` body, re-gridded for TV.

## Verification

- Screenshot-driven per screen via argent on the `Television_4K` (or `TV2`) Android TV AVD:
  Detail (movie + series), Home, Search, Library.
- `describe` + `tv-remote` to confirm D-pad focus flow and that a sensible element receives
  initial focus on each screen.
- One phone smoke-check (the phone branch is unchanged, so this only confirms no accidental
  shared-style regression).
- `npx jest` stays green.

## Out of Scope

- Player screen + stream/track selection redesign (keeps current TV controls).
- Deep redesign of Settings, Preferences, Onboarding, Live, Planner, Calendar (they inherit the
  existing rendering; touched only if a shared-style change breaks them).
- Phone and web styling.
- New native dependencies (reanimated, blur) or a custom TV on-screen keyboard.
- Any navigation, flow, copy, or behavior change.
