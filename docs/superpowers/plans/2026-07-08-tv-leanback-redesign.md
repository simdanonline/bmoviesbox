# TV Leanback Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Android-TV (`Platform.isTV`) rendering of Detail (Movie + Series), Home, Search, and Library as true 10-foot leanback layouts, leaving phone/web byte-identical.

**Architecture:** Each target screen keeps ALL its existing hooks/state/handlers and gains an early `if (Platform.isTV) return <TvXxxView {...props} />;` branch above the untouched phone/web JSX. TV presentation lives in new `src/screens/tv/` components that consume already-computed data + callbacks as props. A new `src/styles/tvTheme.ts` holds TV-only layout constants; brand colors come from the existing `src/styles/theme.ts`.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, Hermes. Built-in `Animated`, `expo-linear-gradient`, `expo-image` (via `TvSafeImage`), `@expo/vector-icons` (FontAwesome/Feather). Existing `Focusable` component drives the Android TV native focus engine. Tests: `jest` (`jest-expo` preset), pure-logic/value style.

## Global Constraints

- **No new dependencies** (runtime or dev). Motion/gradients/images use built-in `Animated`, `expo-linear-gradient`, `expo-image` — all already installed. No `react-native-reanimated`, `expo-blur`, NativeWind, or `react-test-renderer`.
- **Keyed on `Platform.isTV` only — never `isTvApp`.** `Platform.isTV` = Android TV hardware; `isTvApp` = an in-app phone password mode that must keep the phone layout.
- **Phone + web byte-identical.** The existing phone/web JSX branch of every screen is not edited; only an early `if (Platform.isTV) return …` is inserted above it, plus TV-only state/effects guarded by `if (Platform.isTV)`.
- **No behavior, navigation, or copy changes** beyond the one approved addition: a TV-only "Related titles" fetch on the two Detail screens. Same hooks, handlers, routes, and data everywhere else.
- **Brand tokens reuse `src/styles/theme.ts`** (`colors`, accent `#E5484D`). Only TV *layout* constants are new (`src/styles/tvTheme.ts`).
- **Downloads are absent on real TV.** `canDownload = isTvApp || Platform.OS === "web"` is structurally `false` when `Platform.isTV`, so TV views render no download buttons / `DownloadSourcePicker`.
- Existing jest tests stay green. The known pre-existing `tsc customConditions` error is expected and not a regression; new/changed files must add no new tsc errors.
- **Never run `git stash` / `git checkout` / `git restore` in this repo** (dangling-stash hazard). Use `git switch` / `git branch`. Commit with `git add <paths>` + `git commit`.
- **Verification device:** Android TV emulator AVD `TV2` (running) or `Television_4K`, driven via argent (`launch-app`, `describe`, `tv-remote`, `screenshot`). Follow the `argent-tv-interact` skill: TV is focus-driven — use `describe` to read focus and `tv-remote` for D-pad, not `gesture-tap`.

**Testing approach for component tasks:** There is no component render-test harness in this repo (no `react-test-renderer`). Pure logic/values are unit-tested with jest (Tasks 1–3). Visual TV components (Tasks 4–8) are verified by: (a) unit tests for any extracted pure helper, (b) `npx jest` stays green, (c) `npx tsc --noEmit` adds no new errors beyond the known `customConditions` one, and (d) an explicit argent screenshot + `describe` focus check on the TV emulator. This mirrors how the merged phone-polish pass was verified.

---

## File Structure

**New files**
- `src/styles/tvTheme.ts` — TV-only layout/size/type constants (overscan, hero split, focus scale, rail/grid sizing, TV type scale).
- `src/styles/__tests__/tvTheme.test.ts` — asserts the constants.
- `src/services/RelatedTitles.ts` — `getRelatedTitles(kind, genres, excludeUrl, limit?)` → `Movie[]`.
- `src/services/__tests__/RelatedTitles.test.ts` — mocks `MovieAPI`, asserts filtering/exclusion/limit/empty/error.
- `src/components/tv/TvActionButton.tsx` — focusable pill (icon + label, `primary` accent variant) for TV detail action rows.
- `src/screens/tv/detailMeta.ts` — pure `buildMetaPills(...)` helper.
- `src/screens/tv/__tests__/detailMeta.test.ts` — asserts pill building.
- `src/screens/tv/TvMovieDetails.tsx` — TV movie detail view.
- `src/screens/tv/TvSeriesDetail.tsx` — TV series detail view (incl. season selector + episodes rail).
- `src/screens/tv/TvHome.tsx` — TV home view.
- `src/screens/tv/TvSearch.tsx` — TV search view.
- `src/screens/tv/TvLibrary.tsx` — TV library view.

**Modified files (add TV branch + TV-only state; phone JSX untouched)**
- `src/screens/MovieDetailsScreen.tsx`
- `src/screens/SeriesDetailScreen.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/SearchScreen.tsx`
- `src/screens/LibraryScreen.tsx`
- `src/components/FeaturedMovie.tsx` (Task 6 only — shrink TV featured hero styles) and `src/styles/styles.ts` (`tvFeatured*` keys) if needed.

---

### Task 1: TV layout tokens (`src/styles/tvTheme.ts`)

**Files:**
- Create: `src/styles/tvTheme.ts`
- Test: `src/styles/__tests__/tvTheme.test.ts`

**Interfaces:**
- Consumes: `colors` from `./theme`.
- Produces:
  - `tvLayout` — `{ screenWidth, screenHeight, overscanH, overscanV, heroHeight, heroInfoWidth, heroArtWidth, focusScale, railCardWidth, railCardHeight, gridColumns, gridGutter }` (all `number`).
  - `tvType` — `{ heroTitle, sectionTitle, body, meta, caption }` each a text-style object `{ fontSize, fontWeight, lineHeight, letterSpacing? }`.
  - `tvFocus` — `{ borderWidth: number, borderColor: string, radius: number }`.

- [ ] **Step 1: Write the failing test**

Create `src/styles/__tests__/tvTheme.test.ts`:

```ts
import { tvLayout, tvType, tvFocus } from "../tvTheme";

describe("tvTheme", () => {
  it("derives overscan from screen size (~5%)", () => {
    expect(tvLayout.overscanH).toBe(Math.round(tvLayout.screenWidth * 0.05));
    expect(tvLayout.overscanV).toBe(Math.round(tvLayout.screenHeight * 0.05));
  });

  it("splits the detail hero into info-left / art-right", () => {
    expect(tvLayout.heroInfoWidth).toBeLessThan(tvLayout.heroArtWidth);
    expect(tvLayout.heroInfoWidth + tvLayout.heroArtWidth).toBeLessThanOrEqual(
      tvLayout.screenWidth + 1,
    );
    expect(tvLayout.heroHeight).toBe(Math.round(tvLayout.screenHeight * 0.58));
  });

  it("caps rail card width and uses a 2:3 poster ratio", () => {
    expect(tvLayout.railCardWidth).toBeLessThanOrEqual(240);
    expect(tvLayout.railCardHeight).toBe(Math.round(tvLayout.railCardWidth * 1.5));
  });

  it("exposes focus + grid constants", () => {
    expect(tvLayout.focusScale).toBe(1.08);
    expect(tvLayout.gridColumns).toBe(5);
    expect(tvLayout.gridGutter).toBe(16);
    expect(tvFocus.borderColor).toBe("#FFFFFF");
    expect(tvFocus.borderWidth).toBe(3);
  });

  it("exposes a 10-foot type scale larger than phone", () => {
    expect(tvType.heroTitle.fontSize).toBeGreaterThanOrEqual(36);
    expect(tvType.body.fontSize).toBeGreaterThanOrEqual(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/styles/__tests__/tvTheme.test.ts`
Expected: FAIL — `Cannot find module '../tvTheme'`.

- [ ] **Step 3: Write the implementation**

Create `src/styles/tvTheme.ts`:

```ts
// TV-only layout constants (Android TV, Platform.isTV). Colors come from theme.ts;
// this module holds dimensions / sizing / TV type scale only. Plain constants,
// zero runtime cost.
import { Dimensions } from "react-native";
import { colors } from "./theme";

const { width, height } = Dimensions.get("window");
const railCardWidth = Math.min(width / 7, 240);

export const tvLayout = {
  screenWidth: width,
  screenHeight: height,
  // Overscan-safe margins (~5%): many TVs clip the physical edges.
  overscanH: Math.round(width * 0.05),
  overscanV: Math.round(height * 0.05),
  // Detail hero: info-left / art-right split; hero ~58% of screen height.
  heroHeight: Math.round(height * 0.58),
  heroInfoWidth: Math.round(width * 0.45),
  heroArtWidth: Math.round(width * 0.55),
  // Focus scale for cards/buttons.
  focusScale: 1.08,
  // Poster rail card sizing (2:3 poster ratio).
  railCardWidth,
  railCardHeight: Math.round(railCardWidth * 1.5),
  // Grid (Search results, Library).
  gridColumns: 5,
  gridGutter: 16,
} as const;

export const tvType = {
  heroTitle: { fontSize: 40, fontWeight: "800", lineHeight: 46, letterSpacing: -0.5 },
  sectionTitle: { fontSize: 22, fontWeight: "700", lineHeight: 28, letterSpacing: -0.2 },
  body: { fontSize: 18, fontWeight: "400", lineHeight: 26, letterSpacing: 0 },
  meta: { fontSize: 16, fontWeight: "600", lineHeight: 20, letterSpacing: 0 },
  caption: { fontSize: 14, fontWeight: "500", lineHeight: 18, letterSpacing: 0.2 },
} as const;

export const tvFocus = {
  borderWidth: 3,
  borderColor: colors.text, // "#FFFFFF"
  radius: 12,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/styles/__tests__/tvTheme.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/styles/tvTheme.ts src/styles/__tests__/tvTheme.test.ts
git commit -m "feat(tv): add TV layout tokens (tvTheme)"
```

---

### Task 2: Related-titles service (`src/services/RelatedTitles.ts`)

**Files:**
- Create: `src/services/RelatedTitles.ts`
- Test: `src/services/__tests__/RelatedTitles.test.ts`

**Interfaces:**
- Consumes: default-exported `MovieAPI` singleton from `./MovieAPI` — methods `getMoviesByGenre(genre: string, page?: number): Promise<MoviesResponse>` and `getAllSeries(page?: number): Promise<MoviesResponse>`, where `MoviesResponse = { movies: Movie[]; pagination: {...} }`. `Movie` has `{ id, title, url, thumbnail, imdbRating, runtime, releaseYear, genres: string[], country, isSeries? }`.
- Produces: `getRelatedTitles(kind: "movie" | "series", genres: string[], excludeUrl: string, limit?: number): Promise<Movie[]>`.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/RelatedTitles.test.ts`:

```ts
import { getRelatedTitles } from "../RelatedTitles";
import MovieAPI from "../MovieAPI";

jest.mock("../MovieAPI", () => ({
  __esModule: true,
  default: { getMoviesByGenre: jest.fn(), getAllSeries: jest.fn() },
}));

const mockApi = MovieAPI as unknown as {
  getMoviesByGenre: jest.Mock;
  getAllSeries: jest.Mock;
};

const mv = (over: Partial<any> = {}) => ({
  id: "1", title: "T", url: "u1", thumbnail: "t", imdbRating: "7",
  runtime: null, releaseYear: "2020", genres: ["Action"], country: [], ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("getRelatedTitles", () => {
  it("returns [] when the title has no genres", async () => {
    const out = await getRelatedTitles("movie", [], "u1");
    expect(out).toEqual([]);
    expect(mockApi.getMoviesByGenre).not.toHaveBeenCalled();
  });

  it("fetches movies by primary genre and excludes the current url", async () => {
    mockApi.getMoviesByGenre.mockResolvedValue({
      movies: [mv({ url: "u1" }), mv({ url: "u2" }), mv({ url: "u3" })],
      pagination: {},
    });
    const out = await getRelatedTitles("movie", ["Action", "Sci-Fi"], "u1", 12);
    expect(mockApi.getMoviesByGenre).toHaveBeenCalledWith("Action");
    expect(out.map((m) => m.url)).toEqual(["u2", "u3"]);
  });

  it("filters series to those sharing the primary genre", async () => {
    mockApi.getAllSeries.mockResolvedValue({
      movies: [
        mv({ url: "s1", genres: ["Drama"] }),
        mv({ url: "s2", genres: ["Action", "Drama"] }),
        mv({ url: "self", genres: ["Action"] }),
      ],
      pagination: {},
    });
    const out = await getRelatedTitles("series", ["Action"], "self");
    expect(mockApi.getAllSeries).toHaveBeenCalled();
    expect(out.map((m) => m.url)).toEqual(["s2"]);
  });

  it("respects the limit", async () => {
    mockApi.getMoviesByGenre.mockResolvedValue({
      movies: Array.from({ length: 30 }, (_, i) => mv({ url: `u${i}` })),
      pagination: {},
    });
    const out = await getRelatedTitles("movie", ["Action"], "none", 5);
    expect(out).toHaveLength(5);
  });

  it("returns [] on API error", async () => {
    mockApi.getMoviesByGenre.mockRejectedValue(new Error("network"));
    const out = await getRelatedTitles("movie", ["Action"], "u1");
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/services/__tests__/RelatedTitles.test.ts`
Expected: FAIL — `Cannot find module '../RelatedTitles'`.

- [ ] **Step 3: Write the implementation**

Create `src/services/RelatedTitles.ts`:

```ts
import MovieAPI, { Movie } from "./MovieAPI";

/**
 * Related titles for a detail page, derived from the title's primary genre using
 * existing catalog endpoints (no new backend). Movies use the by-genre endpoint;
 * series fall back to the full series list filtered by shared genre (there is no
 * series-by-genre endpoint). Always resolves — network failures yield [].
 */
export async function getRelatedTitles(
  kind: "movie" | "series",
  genres: string[],
  excludeUrl: string,
  limit: number = 12,
): Promise<Movie[]> {
  const primaryGenre = genres?.[0];
  if (!primaryGenre) return [];
  try {
    const resp =
      kind === "movie"
        ? await MovieAPI.getMoviesByGenre(primaryGenre)
        : await MovieAPI.getAllSeries();
    const items = resp?.movies ?? [];
    return items
      .filter((m) => m.url !== excludeUrl)
      .filter((m) =>
        kind === "series" ? (m.genres ?? []).includes(primaryGenre) : true,
      )
      .slice(0, limit)
      .map((m) => ({ ...m, isSeries: kind === "series" }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/RelatedTitles.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/RelatedTitles.ts src/services/__tests__/RelatedTitles.test.ts
git commit -m "feat(tv): add getRelatedTitles service for detail related rail"
```

---

### Task 3: Shared TV detail primitives (`TvActionButton` + `buildMetaPills`)

**Files:**
- Create: `src/components/tv/TvActionButton.tsx`
- Create: `src/screens/tv/detailMeta.ts`
- Test: `src/screens/tv/__tests__/detailMeta.test.ts`

**Interfaces:**
- Consumes: `Focusable` (default export) from `../Focusable`; `colors`, `radii` from `../../styles/theme`; `tvType`, `tvLayout` from `../../styles/tvTheme`; `FontAwesome` from `@expo/vector-icons`.
- Produces:
  - `TvActionButton` (default export) — props `{ icon: keyof typeof FontAwesome.glyphMap; label: string; onPress: () => void; primary?: boolean; hasTVPreferredFocus?: boolean; loading?: boolean; active?: boolean }`.
  - `buildMetaPills(input: { releaseYear?: string | null; duration?: string | null; rating?: string | null; genres?: string[] }): string[]` from `detailMeta.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/tv/__tests__/detailMeta.test.ts`:

```ts
import { buildMetaPills } from "../detailMeta";

describe("buildMetaPills", () => {
  it("includes year, duration, rating (★ prefixed) and up to 3 genres", () => {
    expect(
      buildMetaPills({
        releaseYear: "2024",
        duration: "2h 11m",
        rating: "8.4",
        genres: ["Action", "Sci-Fi", "Thriller", "Drama"],
      }),
    ).toEqual(["2024", "2h 11m", "★ 8.4", "Action", "Sci-Fi", "Thriller"]);
  });

  it("skips empty / null / N/A fields", () => {
    expect(
      buildMetaPills({
        releaseYear: "2024",
        duration: null,
        rating: "N/A",
        genres: [],
      }),
    ).toEqual(["2024"]);
  });

  it("returns [] for an all-empty input", () => {
    expect(buildMetaPills({})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/screens/tv/__tests__/detailMeta.test.ts`
Expected: FAIL — `Cannot find module '../detailMeta'`.

- [ ] **Step 3: Write `detailMeta.ts`**

Create `src/screens/tv/detailMeta.ts`:

```ts
// Pure helper: builds the metadata-pill strings for a TV detail hero.
export function buildMetaPills(input: {
  releaseYear?: string | null;
  duration?: string | null;
  rating?: string | null;
  genres?: string[];
}): string[] {
  const pills: string[] = [];
  const clean = (v?: string | null) =>
    v && v.trim() && v.trim().toLowerCase() !== "n/a" ? v.trim() : null;

  const year = clean(input.releaseYear);
  const duration = clean(input.duration);
  const rating = clean(input.rating);
  if (year) pills.push(year);
  if (duration) pills.push(duration);
  if (rating) pills.push(`★ ${rating}`);
  for (const g of (input.genres ?? []).slice(0, 3)) {
    if (clean(g)) pills.push(g);
  }
  return pills;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/screens/tv/__tests__/detailMeta.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `TvActionButton.tsx`**

Create `src/components/tv/TvActionButton.tsx`:

```tsx
import React from "react";
import { Text, View, ActivityIndicator, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import Focusable from "../Focusable";
import { colors, radii } from "../../styles/theme";
import { tvType, tvLayout } from "../../styles/tvTheme";

interface TvActionButtonProps {
  icon: keyof typeof FontAwesome.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  hasTVPreferredFocus?: boolean;
  loading?: boolean;
  active?: boolean;
}

export default function TvActionButton({
  icon,
  label,
  onPress,
  primary,
  hasTVPreferredFocus,
  loading,
  active,
}: TvActionButtonProps) {
  const iconColor = primary || active ? colors.text : colors.textSecondary;
  return (
    <Focusable
      style={[styles.button, primary && styles.primary]}
      focusedStyle={styles.focused}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.inner}>
          <FontAwesome
            name={icon}
            size={20}
            color={active ? colors.accent : iconColor}
          />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 140,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 14,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  focused: {
    borderColor: colors.text,
    transform: [{ scale: tvLayout.focusScale }],
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...tvType.meta,
    color: colors.text,
    marginLeft: 10,
  },
});
```

- [ ] **Step 6: Verify jest + tsc**

Run: `npx jest src/screens/tv/__tests__/detailMeta.test.ts` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -v customConditions | grep "tv/TvActionButton\|tv/detailMeta"` → no output (no new errors in these files).

- [ ] **Step 7: Commit**

```bash
git add src/components/tv/TvActionButton.tsx src/screens/tv/detailMeta.ts src/screens/tv/__tests__/detailMeta.test.ts
git commit -m "feat(tv): add TvActionButton + buildMetaPills detail primitives"
```

---

### Task 4: TV Movie Detail view + wire-in

**Files:**
- Create: `src/screens/tv/TvMovieDetails.tsx`
- Modify: `src/screens/MovieDetailsScreen.tsx` (add TV-only `relatedTitles` state + fetch effect + `handleRelatedPress` + `if (Platform.isTV) return <TvMovieDetails …/>` above the existing `return (<ScrollView …`).

**Interfaces:**
- Consumes: `getRelatedTitles` (Task 2); `TvActionButton` (Task 3); `buildMetaPills` (Task 3); `tvLayout`, `tvType`, `tvFocus` (Task 1); `colors`, `radii` (`theme.ts`); `TvSafeImage`; `RecommendationRail` (default export, props `{ title: string; items: Movie[]; onPress: (m: Movie) => void }`); `StatusSelector`, `StarRating`, `TitlePlanningPanel` (reused as-is); `LinearGradient`.
- Produces: `TvMovieDetails` default export with props (all supplied by `MovieDetailsScreen`):
  ```ts
  interface TvMovieDetailsProps {
    movieDetails: MovieDetail;        // from services/MovieAPI
    relatedTitles: Movie[];
    resolvingStreams: boolean;
    isSaved: boolean;                 // isInWatchlist(movieDetails.url)
    currentStatus: WatchStatus | null;
    onPlay: () => void;               // handlePlayPress
    onToggleWatchlist: () => void;
    onShare: () => void;
    onTrailer: () => void;
    onStatusSelect: (s: WatchStatus) => void;
    onRemoveStatus: () => void;
    getRating: (url: string) => number;
    setRating: (url: string, r: number) => void;
    onRelatedPress: (m: Movie) => void;
  }
  ```

- [ ] **Step 1: Write `TvMovieDetails.tsx`**

Create `src/screens/tv/TvMovieDetails.tsx`:

```tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import TvSafeImage from "../../components/TvSafeImage";
import TvActionButton from "../../components/tv/TvActionButton";
import RecommendationRail from "../../components/RecommendationRail";
import StatusSelector from "../../components/StatusSelector";
import StarRating from "../../components/StarRating";
import TitlePlanningPanel from "../../components/TitlePlanningPanel";
import { buildMetaPills } from "./detailMeta";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { MovieDetail, Movie } from "../../services/MovieAPI";
import type { WatchStatus } from "../../types/app";

interface TvMovieDetailsProps {
  movieDetails: MovieDetail;
  relatedTitles: Movie[];
  resolvingStreams: boolean;
  isSaved: boolean;
  currentStatus: WatchStatus | null;
  onPlay: () => void;
  onToggleWatchlist: () => void;
  onShare: () => void;
  onTrailer: () => void;
  onStatusSelect: (s: WatchStatus) => void;
  onRemoveStatus: () => void;
  getRating: (url: string) => number;
  setRating: (url: string, r: number) => void;
  onRelatedPress: (m: Movie) => void;
}

export default function TvMovieDetails({
  movieDetails,
  relatedTitles,
  resolvingStreams,
  isSaved,
  currentStatus,
  onPlay,
  onToggleWatchlist,
  onShare,
  onTrailer,
  onStatusSelect,
  onRemoveStatus,
  getRating,
  setRating,
  onRelatedPress,
}: TvMovieDetailsProps) {
  const pills = buildMetaPills({
    releaseYear: movieDetails.releaseYear,
    duration: movieDetails.duration,
    rating: movieDetails.ratings?.imdb ?? null,
    genres: movieDetails.genres,
  });
  const cast = (movieDetails.actors ?? []).slice(0, 6).join(", ");
  const directors = (movieDetails.directors ?? []).join(", ");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Hero: info-left / art-right */}
      <View style={styles.hero}>
        <View style={styles.heroArt}>
          {!!movieDetails.coverImage && (
            <TvSafeImage
              source={{ uri: movieDetails.coverImage.trim() }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          {/* Feather art into bg toward the left info column and along the bottom. */}
          <LinearGradient
            colors={[colors.bg, "rgba(10,10,14,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(10,10,14,0)", colors.bg]}
            style={styles.heroArtBottom}
            pointerEvents="none"
          />
        </View>

        <View style={styles.heroInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {movieDetails.title}
          </Text>

          <View style={styles.pillRow}>
            {pills.map((p, i) => (
              <View key={`${p}-${i}`} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>

          {!!movieDetails.description && (
            <Text style={styles.synopsis} numberOfLines={3}>
              {movieDetails.description}
            </Text>
          )}

          <View style={styles.actionRow}>
            <TvActionButton
              icon="play"
              label="Play"
              primary
              hasTVPreferredFocus
              loading={resolvingStreams}
              onPress={onPlay}
            />
            <TvActionButton
              icon={isSaved ? "bookmark" : "bookmark-o"}
              label={isSaved ? "Saved" : "Save"}
              active={isSaved}
              onPress={onToggleWatchlist}
            />
            <TvActionButton icon="play-circle" label="Trailer" onPress={onTrailer} />
            <TvActionButton icon="share-alt" label="Share" onPress={onShare} />
          </View>
        </View>
      </View>

      {/* Secondary info + tracking */}
      <View style={styles.section}>
        <StatusSelector
          currentStatus={currentStatus}
          onSelect={onStatusSelect}
          onRemove={onRemoveStatus}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Rating</Text>
        <StarRating
          rating={getRating(movieDetails.url)}
          onRate={(r) => setRating(movieDetails.url, r)}
        />
      </View>

      <View style={styles.section}>
        <TitlePlanningPanel
          titleUrl={movieDetails.url}
          title={movieDetails.title}
          isSeries={false}
          thumbnail={movieDetails.thumbnail}
        />
      </View>

      {!!cast && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <Text style={styles.body}>{cast}</Text>
        </View>
      )}
      {!!directors && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Director</Text>
          <Text style={styles.body}>{directors}</Text>
        </View>
      )}

      {relatedTitles.length > 0 && (
        <View style={styles.railSection}>
          <RecommendationRail
            title="More Like This"
            items={relatedTitles}
            onPress={onRelatedPress}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: tvLayout.overscanV * 2 },
  hero: { height: tvLayout.heroHeight, flexDirection: "row" },
  heroArt: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: tvLayout.heroArtWidth,
    backgroundColor: colors.surface,
  },
  heroArtBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  heroInfo: {
    width: tvLayout.heroInfoWidth,
    paddingLeft: tvLayout.overscanH,
    paddingRight: tvLayout.overscanH,
    paddingTop: tvLayout.overscanV,
    justifyContent: "center",
  },
  title: { ...tvType.heroTitle, color: colors.text, marginBottom: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
    marginBottom: 8,
  },
  pillText: { ...tvType.caption, color: colors.textSecondary },
  synopsis: { ...tvType.body, color: colors.textSecondary, marginBottom: 24 },
  actionRow: { flexDirection: "row", flexWrap: "wrap" },
  section: {
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: 24,
  },
  railSection: { paddingTop: 28, paddingLeft: tvLayout.overscanH - 8 },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 12 },
  body: { ...tvType.body, color: colors.textSecondary },
});
```

> Note: `StatusSelector`, `StarRating`, `TitlePlanningPanel` are imported and reused as-is. If any of their prop names differ from those shown (`currentStatus`/`onSelect`/`onRemove`, `rating`/`onRate`, `titleUrl`/`title`/`isSeries`/`thumbnail`), match the exact props those components already receive in `MovieDetailsScreen.tsx` (lines ~635, ~731, ~736) — do not change those components.

- [ ] **Step 2: Wire the TV branch into `MovieDetailsScreen.tsx`**

Add the import near the other screen imports:

```tsx
import TvMovieDetails from "./tv/TvMovieDetails";
import { getRelatedTitles } from "../services/RelatedTitles";
import type { Movie } from "../services/MovieAPI";
```

Add TV-only state with the other `useState` calls (near line 134-143):

```tsx
const [relatedTitles, setRelatedTitles] = useState<Movie[]>([]);
```

Add a TV-only fetch effect after `movieDetails` is populated (place after the existing details-fetch effect). It must be guarded so it never runs on phone/web:

```tsx
useEffect(() => {
  if (!Platform.isTV || !movieDetails) return;
  let cancelled = false;
  (async () => {
    const related = await getRelatedTitles(
      "movie",
      movieDetails.genres ?? [],
      movieDetails.url,
    );
    if (!cancelled) setRelatedTitles(related);
  })();
  return () => {
    cancelled = true;
  };
}, [movieDetails]);
```

Add a related-press navigation handler near the other handlers (mirrors `HomeScreen.handleMoviePress`):

```tsx
const handleRelatedPress = (item: Movie) => {
  if (item.isSeries) {
    navigation.navigate("SeriesDetails", { url: item.url });
  } else {
    const parts = item.url.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie: item });
  }
};
```

Insert the TV branch immediately before the existing `return (<ScrollView style={styles.container}>` (line 490-491), AFTER the `loading`/`error` early returns and after `movieDetails` is guaranteed non-null (i.e. wherever the existing code already guarantees `movieDetails` for the main render):

```tsx
if (Platform.isTV) {
  return (
    <TvMovieDetails
      movieDetails={movieDetails}
      relatedTitles={relatedTitles}
      resolvingStreams={resolvingStreams}
      isSaved={isInWatchlist(movieDetails.url)}
      currentStatus={currentStatus}
      onPlay={handlePlayPress}
      onToggleWatchlist={() =>
        toggleWantToWatch({
          id: movieDetails.id,
          title: movieDetails.title,
          thumbnail: movieDetails.thumbnail,
          imdbRating: movieDetails.ratings?.imdb ?? null,
          releaseYear: movieDetails.releaseYear,
          genres: movieDetails.genres,
          url: movieDetails.url,
          isSeries: false,
          savedAt: Date.now(),
        })
      }
      onShare={() =>
        Share.share({
          message: `Check out "${movieDetails.title}" on Reelmark!`,
          title: movieDetails.title,
        })
      }
      onTrailer={handlePressTrailer}
      onStatusSelect={handleStatusSelect}
      onRemoveStatus={() => removeFromLibrary(movieDetails.url)}
      getRating={getRating}
      setRating={setRating}
      onRelatedPress={handleRelatedPress}
    />
  );
}
```

> `currentStatus` already exists at line 232. `handleStatusSelect` at line 236. Confirm `Platform` and `useEffect` are already imported in this file (they are). The phone JSX below this branch is left exactly as-is.

- [ ] **Step 3: Run jest + tsc gates**

Run: `npx jest` → all green (no test regressions; new logic tests from Tasks 1-3 pass).
Run: `npx tsc --noEmit 2>&1 | grep -v customConditions` → no NEW errors referencing `TvMovieDetails.tsx` or the edited `MovieDetailsScreen.tsx` lines. (Resolve any type mismatch on reused-component props by matching their existing usage.)

- [ ] **Step 4: Verify on the TV emulator (argent)**

Ensure Metro is running for the app, then on AVD `TV2`:
1. `launch-app` the Reelmark package, navigate to any Movie detail (use `tv-remote` D-pad + `select`).
2. `screenshot` — confirm: backdrop art occupies the right ~55% and feathers into the background; title + metadata pills + synopsis + action row are all visible in the left column WITHOUT scrolling; nothing is clipped at the screen edges (overscan).
3. `describe` — confirm the **Play** button holds initial focus; press `right`/`left` to confirm focus moves across the action row; press `down` to confirm focus descends into the sections / related rail.
4. If sizing is off (title too large, art too wide, content clipped), tune values in `src/styles/tvTheme.ts` (`heroHeight`, `heroInfoWidth`/`heroArtWidth`, `tvType.heroTitle`) and re-screenshot. Record the final judgment in the report.

- [ ] **Step 5: Commit**

```bash
git add src/screens/tv/TvMovieDetails.tsx src/screens/MovieDetailsScreen.tsx
git commit -m "feat(tv): leanback movie detail (info-left/art-right) + related rail"
```

---

### Task 5: TV Series Detail view + wire-in (season selector + episodes rail)

**Files:**
- Create: `src/screens/tv/TvSeriesDetail.tsx`
- Modify: `src/screens/SeriesDetailScreen.tsx` (TV-only `relatedTitles` state + fetch + `handleRelatedPress` + `if (Platform.isTV) return <TvSeriesDetail …/>` before the existing `return (<ScrollView …` at line 611).

**Interfaces:**
- Consumes: same primitives as Task 4, plus `Focusable`. `Season = { seasonNumber: number; episodes: Episode[] }`, `Episode = { episodeNumber: number; episodeTitle: string; episodeUrl: string }` (from `services/MovieAPI`).
- Produces: `TvSeriesDetail` default export:
  ```ts
  interface TvSeriesDetailProps {
    seriesData: SeriesDetail;
    relatedTitles: Movie[];
    seasons: Season[];
    selectedSeason: number;
    currentEpisodes: Episode[];
    gettingLinks: boolean;
    selectedEpisode: number | null;
    isSaved: boolean;
    currentStatus: WatchStatus | null;
    isEpisodeWatched: (episodeUrl: string) => boolean;
    onSelectSeason: (n: number) => void;
    onPlayEpisode: (ep: Episode) => void;
    onToggleWatchlist: () => void;
    onShare: () => void;
    onTrailer: () => void;
    onStatusSelect: (s: WatchStatus) => void;
    onRemoveStatus: () => void;
    getRating: (url: string) => number;
    setRating: (url: string, r: number) => void;
    onRelatedPress: (m: Movie) => void;
  }
  ```

- [ ] **Step 1: Write `TvSeriesDetail.tsx`**

Create `src/screens/tv/TvSeriesDetail.tsx`. The hero mirrors Task 4 (info-left / art-right, no hero Play — series play is per-episode). Below the hero: a horizontal **season selector** (focusable chips) then a horizontal **episodes rail** (focusable number+title tiles), then Status/Rating/Planning/Cast, then the related rail.

```tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import TvSafeImage from "../../components/TvSafeImage";
import Focusable from "../../components/Focusable";
import TvActionButton from "../../components/tv/TvActionButton";
import RecommendationRail from "../../components/RecommendationRail";
import StatusSelector from "../../components/StatusSelector";
import StarRating from "../../components/StarRating";
import TitlePlanningPanel from "../../components/TitlePlanningPanel";
import { buildMetaPills } from "./detailMeta";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type {
  SeriesDetail,
  Movie,
  Season,
  Episode,
} from "../../services/MovieAPI";
import type { WatchStatus } from "../../types/app";

interface TvSeriesDetailProps {
  seriesData: SeriesDetail;
  relatedTitles: Movie[];
  seasons: Season[];
  selectedSeason: number;
  currentEpisodes: Episode[];
  gettingLinks: boolean;
  selectedEpisode: number | null;
  isSaved: boolean;
  currentStatus: WatchStatus | null;
  isEpisodeWatched: (episodeUrl: string) => boolean;
  onSelectSeason: (n: number) => void;
  onPlayEpisode: (ep: Episode) => void;
  onToggleWatchlist: () => void;
  onShare: () => void;
  onTrailer: () => void;
  onStatusSelect: (s: WatchStatus) => void;
  onRemoveStatus: () => void;
  getRating: (url: string) => number;
  setRating: (url: string, r: number) => void;
  onRelatedPress: (m: Movie) => void;
}

export default function TvSeriesDetail(props: TvSeriesDetailProps) {
  const {
    seriesData,
    relatedTitles,
    seasons,
    selectedSeason,
    currentEpisodes,
    gettingLinks,
    selectedEpisode,
    isSaved,
    currentStatus,
    isEpisodeWatched,
    onSelectSeason,
    onPlayEpisode,
    onToggleWatchlist,
    onShare,
    onTrailer,
    onStatusSelect,
    onRemoveStatus,
    getRating,
    setRating,
    onRelatedPress,
  } = props;

  const pills = buildMetaPills({
    releaseYear: seriesData.releaseYear,
    duration: seriesData.duration,
    rating: seriesData.ratings?.imdb ?? null,
    genres: seriesData.genres,
  });
  const cast = (seriesData.actors ?? []).slice(0, 6).join(", ");

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroArt}>
          {!!seriesData.coverImage && (
            <TvSafeImage
              source={{ uri: seriesData.coverImage.trim() }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}
          <LinearGradient
            colors={[colors.bg, "rgba(10,10,14,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(10,10,14,0)", colors.bg]}
            style={styles.heroArtBottom}
            pointerEvents="none"
          />
        </View>

        <View style={styles.heroInfo}>
          <Text style={styles.title} numberOfLines={2}>
            {seriesData.title}
          </Text>
          <View style={styles.pillRow}>
            {pills.map((p, i) => (
              <View key={`${p}-${i}`} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>
          {!!seriesData.description && (
            <Text style={styles.synopsis} numberOfLines={3}>
              {seriesData.description}
            </Text>
          )}
          <View style={styles.actionRow}>
            <TvActionButton
              icon={isSaved ? "bookmark" : "bookmark-o"}
              label={isSaved ? "Saved" : "Save"}
              primary
              hasTVPreferredFocus
              active={isSaved}
              onPress={onToggleWatchlist}
            />
            {!!seriesData.trailerUrl && (
              <TvActionButton icon="play-circle" label="Trailer" onPress={onTrailer} />
            )}
            <TvActionButton icon="share-alt" label="Share" onPress={onShare} />
          </View>
        </View>
      </View>

      {/* Season selector */}
      <View style={styles.railSection}>
        <Text style={styles.sectionTitle}>Seasons</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {seasons.map((s) => {
            const active = s.seasonNumber === selectedSeason;
            return (
              <Focusable
                key={s.seasonNumber}
                style={[styles.seasonChip, active && styles.seasonChipActive]}
                focusedStyle={styles.chipFocused}
                onPress={() => onSelectSeason(s.seasonNumber)}
              >
                <Text
                  style={[styles.seasonText, active && styles.seasonTextActive]}
                >
                  Season {s.seasonNumber}
                </Text>
              </Focusable>
            );
          })}
        </ScrollView>
      </View>

      {/* Episodes rail */}
      <View style={styles.railSection}>
        <Text style={styles.sectionTitle}>Episodes</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {currentEpisodes.map((ep) => {
            const watched = isEpisodeWatched(ep.episodeUrl);
            const loading = gettingLinks && selectedEpisode === ep.episodeNumber;
            return (
              <Focusable
                key={ep.episodeNumber}
                style={styles.episodeCard}
                focusedStyle={styles.chipFocused}
                disabled={gettingLinks}
                onPress={() => onPlayEpisode(ep)}
              >
                <View style={styles.episodeTop}>
                  <Text style={styles.episodeNum}>E{ep.episodeNumber}</Text>
                  <FontAwesome
                    name={loading ? "spinner" : watched ? "check-circle" : "play"}
                    size={16}
                    color={watched ? colors.accent : colors.text}
                  />
                </View>
                <Text style={styles.episodeTitle} numberOfLines={2}>
                  {ep.episodeTitle}
                </Text>
              </Focusable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <StatusSelector
          currentStatus={currentStatus}
          onSelect={onStatusSelect}
          onRemove={onRemoveStatus}
        />
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Rating</Text>
        <StarRating
          rating={getRating(seriesData.url)}
          onRate={(r) => setRating(seriesData.url, r)}
        />
      </View>
      <View style={styles.section}>
        <TitlePlanningPanel
          titleUrl={seriesData.url}
          title={seriesData.title}
          isSeries={true}
          thumbnail={seriesData.thumbnail}
        />
      </View>
      {!!cast && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cast</Text>
          <Text style={styles.body}>{cast}</Text>
        </View>
      )}

      {relatedTitles.length > 0 && (
        <View style={styles.railSection}>
          <RecommendationRail
            title="More Like This"
            items={relatedTitles}
            onPress={onRelatedPress}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: tvLayout.overscanV * 2 },
  hero: { height: tvLayout.heroHeight, flexDirection: "row" },
  heroArt: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: tvLayout.heroArtWidth,
    backgroundColor: colors.surface,
  },
  heroArtBottom: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120 },
  heroInfo: {
    width: tvLayout.heroInfoWidth,
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: tvLayout.overscanV,
    justifyContent: "center",
  },
  title: { ...tvType.heroTitle, color: colors.text, marginBottom: 16 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 18 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
    marginBottom: 8,
  },
  pillText: { ...tvType.caption, color: colors.textSecondary },
  synopsis: { ...tvType.body, color: colors.textSecondary, marginBottom: 24 },
  actionRow: { flexDirection: "row", flexWrap: "wrap" },
  section: { paddingHorizontal: tvLayout.overscanH, paddingTop: 24 },
  railSection: { paddingTop: 28, paddingHorizontal: tvLayout.overscanH },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 12 },
  body: { ...tvType.body, color: colors.textSecondary },
  seasonChip: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  seasonChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  seasonText: { ...tvType.meta, color: colors.textSecondary },
  seasonTextActive: { color: colors.text },
  chipFocused: {
    borderColor: colors.text,
    transform: [{ scale: tvLayout.focusScale }],
  },
  episodeCard: {
    width: 260,
    padding: 16,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 14,
  },
  episodeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  episodeNum: { ...tvType.meta, color: colors.accent },
  episodeTitle: { ...tvType.body, color: colors.text },
});
```

- [ ] **Step 2: Wire the TV branch into `SeriesDetailScreen.tsx`**

Imports:

```tsx
import TvSeriesDetail from "./tv/TvSeriesDetail";
import { getRelatedTitles } from "../services/RelatedTitles";
```

(`Movie`, `Season`, `Episode`, `SeriesDetail` are already imported from `../services/MovieAPI`.)

TV-only state (with the other `useState` calls near line 78-92):

```tsx
const [relatedTitles, setRelatedTitles] = useState<Movie[]>([]);
```

TV-only fetch effect (after `seriesData` is populated):

```tsx
useEffect(() => {
  if (!Platform.isTV || !seriesData) return;
  let cancelled = false;
  (async () => {
    const related = await getRelatedTitles(
      "series",
      seriesData.genres ?? [],
      seriesData.url,
    );
    if (!cancelled) setRelatedTitles(related);
  })();
  return () => {
    cancelled = true;
  };
}, [seriesData]);
```

Related-press handler:

```tsx
const handleRelatedPress = (item: Movie) => {
  if (item.isSeries) {
    navigation.navigate("SeriesDetails", { url: item.url });
  } else {
    const parts = item.url.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    navigation.navigate("MovieDetails", { slug, movie: item });
  }
};
```

Insert before the existing `return (<ScrollView style={seriesStyles.container}` (line 611), after `seriesData` is guaranteed non-null:

```tsx
if (Platform.isTV) {
  return (
    <TvSeriesDetail
      seriesData={seriesData}
      relatedTitles={relatedTitles}
      seasons={seriesData.seasons ?? []}
      selectedSeason={selectedSeason}
      currentEpisodes={currentEpisodes}
      gettingLinks={gettingLinks}
      selectedEpisode={selectedEpisode}
      isSaved={isInWatchlist(seriesData.url)}
      currentStatus={currentStatus}
      isEpisodeWatched={isEpisodeWatched}
      onSelectSeason={setSelectedSeason}
      onPlayEpisode={handlePlayEpisode}
      onToggleWatchlist={() =>
        toggleWantToWatch({
          id: seriesData.id,
          title: seriesData.title,
          thumbnail: seriesData.thumbnail,
          imdbRating: seriesData.ratings?.imdb ?? null,
          releaseYear: seriesData.releaseYear,
          genres: seriesData.genres,
          url: seriesData.url,
          isSeries: true,
          savedAt: Date.now(),
        })
      }
      onShare={() =>
        Share.share({
          message: `Check out "${seriesData.title}" on Reelmark!`,
          title: seriesData.title,
        })
      }
      onTrailer={handlePressTrailer}
      onStatusSelect={handleStatusSelect}
      onRemoveStatus={() => removeFromLibrary(seriesData.url)}
      getRating={getRating}
      setRating={setRating}
      onRelatedPress={handleRelatedPress}
    />
  );
}
```

> Match the exact `toggleWantToWatch({...})` object shape used in the phone JSX (line 643-655) — copy its fields verbatim. `currentEpisodes` (line 154), `selectedSeason` (81), `selectedEpisode` (82), `gettingLinks` (84), `currentStatus` (196), `handlePlayEpisode` (498), `isEpisodeWatched`, `handleStatusSelect` (198) already exist.

- [ ] **Step 3: jest + tsc gates** — same as Task 4 Step 3.

- [ ] **Step 4: Verify on TV emulator (argent)** — navigate to a Series detail on `TV2`:
  - Hero reads like the movie one; **Save** holds initial focus (no hero Play on series).
  - `down` moves into the Seasons row; `left`/`right` switches season and the Episodes rail updates.
  - `down` into Episodes rail; focus scales the episode tile; `select` starts playback (or shows the loading spinner).
  - Related rail present at the bottom. Nothing clipped. Tune tokens if needed.

- [ ] **Step 5: Commit**

```bash
git add src/screens/tv/TvSeriesDetail.tsx src/screens/SeriesDetailScreen.tsx
git commit -m "feat(tv): leanback series detail with season selector + episodes rail"
```

---

### Task 6: TV Home view + wire-in

**Files:**
- Create: `src/screens/tv/TvHome.tsx`
- Modify: `src/screens/HomeScreen.tsx` (add `if (Platform.isTV) return <TvHome …/>` before the phone `return`).
- Modify (if needed for the shrunk hero): `src/components/FeaturedMovie.tsx` TV branch and/or `src/styles/styles.ts` `tvFeatured*` keys.

**Interfaces:**
- Consumes: `FeaturedMovie` (`{ movie: Movie; onPress: () => void }`), `RecommendationRail`, `ContinueWatchingSection` (`{ items: LibraryItem[]; onPress: (i: LibraryItem) => void }`), `MovieCard` (`{ movie: Movie; onPress: () => void; style?; hasTVPreferredFocus? }`), `Focusable`; `tvLayout`, `tvType`, `colors`.
- Produces: `TvHome` default export:
  ```ts
  interface TvHomeProps {
    featuredMovie: Movie | null;
    rails: { id: string; title: string; items: Movie[] }[];
    filteredMovies: Movie[];
    continueWatching: LibraryItem[];
    isTvApp: boolean;
    onMoviePress: (m: Movie) => void;
    onContinuePress: (i: LibraryItem) => void;
    onSearch: () => void;
    onSettings: () => void;
  }
  ```

- [ ] **Step 1: Write `TvHome.tsx`**

Create `src/screens/tv/TvHome.tsx`. Header row (logo + search + settings, overscan padding), shrunk featured hero, continue-watching (unless `isTvApp`), recommendation rails, then a bottom poster grid of `filteredMovies`. Reuses existing card/rail components (which already branch on `Platform.isTV`).

```tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import FeaturedMovie from "../../components/FeaturedMovie";
import RecommendationRail from "../../components/RecommendationRail";
import ContinueWatchingSection from "../../components/ContinueWatchingCard";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import { colors } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { Movie } from "../../services/MovieAPI";
import type { LibraryItem } from "../../types/app";

interface TvHomeProps {
  featuredMovie: Movie | null;
  rails: { id: string; title: string; items: Movie[] }[];
  filteredMovies: Movie[];
  continueWatching: LibraryItem[];
  isTvApp: boolean;
  onMoviePress: (m: Movie) => void;
  onContinuePress: (i: LibraryItem) => void;
  onSearch: () => void;
  onSettings: () => void;
}

export default function TvHome({
  featuredMovie,
  rails,
  filteredMovies,
  continueWatching,
  isTvApp,
  onMoviePress,
  onContinuePress,
  onSearch,
  onSettings,
}: TvHomeProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.logo}>Reelmark</Text>
        <View style={styles.headerActions}>
          <Focusable style={styles.iconBtn} focusedStyle={styles.iconFocused} onPress={onSearch}>
            <FontAwesome name="search" size={22} color={colors.text} />
          </Focusable>
          <Focusable style={styles.iconBtn} focusedStyle={styles.iconFocused} onPress={onSettings}>
            <FontAwesome name="gear" size={22} color={colors.text} />
          </Focusable>
        </View>
      </View>

      {!!featuredMovie && (
        <FeaturedMovie movie={featuredMovie} onPress={() => onMoviePress(featuredMovie)} />
      )}

      {!isTvApp && (
        <ContinueWatchingSection items={continueWatching} onPress={onContinuePress} />
      )}

      {rails.map((rail) => (
        <RecommendationRail
          key={rail.id}
          title={rail.title}
          items={rail.items}
          onPress={onMoviePress}
        />
      ))}

      {filteredMovies.length > 0 && (
        <View style={styles.gridSection}>
          <Text style={styles.sectionTitle}>More Movies</Text>
          <View style={styles.grid}>
            {filteredMovies.map((movie) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                onPress={() => onMoviePress(movie)}
                style={styles.gridCard}
              />
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const CARD_W = tvLayout.railCardWidth;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: tvLayout.overscanV * 2 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: tvLayout.overscanH,
    paddingTop: tvLayout.overscanV,
    paddingBottom: 12,
  },
  logo: { ...tvType.heroTitle, color: colors.accent },
  headerActions: { flexDirection: "row" },
  iconBtn: {
    padding: 12,
    borderRadius: 999,
    marginLeft: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  iconFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  gridSection: { paddingHorizontal: tvLayout.overscanH, paddingTop: 24 },
  sectionTitle: { ...tvType.sectionTitle, color: colors.text, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  gridCard: { width: CARD_W, marginRight: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
});
```

- [ ] **Step 2: Wire into `HomeScreen.tsx`**

Import: `import TvHome from "./tv/TvHome";`

Insert before the phone `return (` (after the `loading`/`error` early returns, ~line 209-219), so all derived values (`featuredMovie`, `rails`, `filteredMovies`, `continueWatching`, `isTvApp`) are in scope:

```tsx
if (Platform.isTV) {
  return (
    <TvHome
      featuredMovie={featuredMovie}
      rails={rails}
      filteredMovies={filteredMovies}
      continueWatching={continueWatching}
      isTvApp={isTvApp}
      onMoviePress={handleMoviePress}
      onContinuePress={handleContinuePress}
      onSearch={onclickSearch}
      onSettings={onclickSettings}
    />
  );
}
```

> This supersedes the current inline TV handling on Home (the `scrollTo` nudge effect at line 68 and the genre-chip TV paddings are now irrelevant on TV since the phone JSX no longer renders on TV — leave them; they are harmless no-ops on the phone path). Do NOT remove phone-path code.

- [ ] **Step 3: Shrink the featured hero (if the screenshot shows it dominating)**

If `FeaturedMovie`'s TV layout (`styles.tvFeaturedContainer` / `tvFeaturedImage`, `src/styles/styles.ts` line 192-236) still fills most of the screen, reduce its height so it reads as ~one hero band (target ≈ `tvLayout.heroHeight * 0.7`, i.e. ~40% of screen). Edit only the `tvFeatured*` keys in `styles.ts` — these render on Android TV only (guarded by the `Platform.isTV` branch inside `FeaturedMovie`), so phone is unaffected. Re-screenshot to confirm.

- [ ] **Step 4: jest + tsc gates** — `npx jest` green; `npx tsc --noEmit 2>&1 | grep -v customConditions` → no new errors for `TvHome.tsx` / `HomeScreen.tsx`.

- [ ] **Step 5: Verify on TV emulator (argent)** — launch to Home on `TV2`:
  - Header (logo + search + settings) sits inside the overscan margin; icons take focus.
  - Featured hero is a band, not the whole screen; below it Continue Watching + rails are visible; `down` walks rail→rail; `right`/`left` within a rail scales focused cards; bottom grid reachable. Tune `tvFeatured*` / `tvLayout` if needed.

- [ ] **Step 6: Commit**

```bash
git add src/screens/tv/TvHome.tsx src/screens/HomeScreen.tsx src/styles/styles.ts src/components/FeaturedMovie.tsx
git commit -m "feat(tv): leanback home (banded hero + D-pad rails + grid)"
```

---

### Task 7: TV Search view + wire-in

**Files:**
- Create: `src/screens/tv/TvSearch.tsx`
- Modify: `src/screens/SearchScreen.tsx` (add `if (Platform.isTV) return <TvSearch …/>`).

**Interfaces:**
- Consumes: `MovieCard`, `Focusable`, `TextInput`; `tvLayout`, `tvType`, `colors`.
- Produces: `TvSearch` default export:
  ```ts
  interface TvSearchProps {
    query: string;
    setQuery: (q: string) => void;
    inputRef: React.RefObject<TextInput>;
    activeTab: "movies" | "series";
    setActiveTab: (t: "movies" | "series") => void;
    movies: Movie[];
    series: Movie[];
    loading: boolean;
    searched: boolean;
    onMoviePress: (m: Movie) => void;
  }
  ```

- [ ] **Step 1: Write `TvSearch.tsx`**

Create `src/screens/tv/TvSearch.tsx`. Landscape: a top search field (auto-focus already handled by the screen's existing `Platform.isTV` effect at line 33 → uses the Android TV system keyboard), tab chips (Movies/TV) when results exist, and a D-pad grid of `MovieCard`s using `numColumns` = `tvLayout.gridColumns`.

```tsx
import React from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/build/FontAwesome";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import type { Movie } from "../../services/MovieAPI";

interface TvSearchProps {
  query: string;
  setQuery: (q: string) => void;
  inputRef: React.RefObject<TextInput>;
  activeTab: "movies" | "series";
  setActiveTab: (t: "movies" | "series") => void;
  movies: Movie[];
  series: Movie[];
  loading: boolean;
  searched: boolean;
  onMoviePress: (m: Movie) => void;
}

export default function TvSearch({
  query, setQuery, inputRef, activeTab, setActiveTab,
  movies, series, loading, searched, onMoviePress,
}: TvSearchProps) {
  const results = activeTab === "movies" ? movies : series;
  const showTabs = searched && !loading && (movies.length > 0 || series.length > 0);

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <FontAwesome name="search" size={22} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search movies & series"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>

      {showTabs && (
        <View style={styles.tabs}>
          {(["movies", "series"] as const).map((t) => {
            const active = activeTab === t;
            const count = t === "movies" ? movies.length : series.length;
            return (
              <Focusable
                key={t}
                style={[styles.tab, active && styles.tabActive]}
                focusedStyle={styles.tabFocused}
                onPress={() => setActiveTab(t)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === "movies" ? "Movies" : "TV"} ({count})
                </Text>
              </Focusable>
            );
          })}
        </View>
      )}

      {loading && (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color={colors.accent} />
      )}

      {!loading && searched && results.length === 0 && (
        <Text style={styles.empty}>No results found</Text>
      )}

      {!loading && results.length > 0 && (
        <FlatList
          key={activeTab}
          data={results}
          keyExtractor={(item) => item.id}
          numColumns={tvLayout.gridColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <MovieCard
              movie={item}
              onPress={() => onMoviePress(item)}
              style={styles.card}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: tvLayout.overscanH, paddingTop: tvLayout.overscanV },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: 24,
    height: 64,
  },
  input: { ...tvType.body, color: colors.text, flex: 1, marginLeft: 14 },
  tabs: { flexDirection: "row", marginTop: 20 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  tabText: { ...tvType.meta, color: colors.textSecondary },
  tabTextActive: { color: colors.text },
  empty: { ...tvType.body, color: colors.textMuted, textAlign: "center", marginTop: 48 },
  grid: { paddingTop: 20, paddingBottom: tvLayout.overscanV * 2 },
  gridRow: { gap: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
  card: { width: tvLayout.railCardWidth },
});
```

- [ ] **Step 2: Wire into `SearchScreen.tsx`**

Import: `import TvSearch from "./tv/TvSearch";` and ensure `Platform` is imported (it is — used at line 33).

Insert before the phone `return (<View style={localStyles.container}>` (after `activeResults`/`showTabs` derivations, ~line 89-90):

```tsx
if (Platform.isTV) {
  return (
    <TvSearch
      query={query}
      setQuery={setQuery}
      inputRef={inputRef}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      movies={movies}
      series={series}
      loading={loading}
      searched={searched}
      onMoviePress={handleMoviePress}
    />
  );
}
```

- [ ] **Step 3: jest + tsc gates** — green; no new errors for `TvSearch.tsx` / `SearchScreen.tsx`.

- [ ] **Step 4: Verify on TV emulator (argent)** — launch to Search on `TV2`:
  - Search field auto-focuses; typing via `keyboard` tool populates results.
  - Results appear as a wide grid (5 columns); focus scales the focused card; `up` returns to tabs/field. Tune columns/card width if cramped.

- [ ] **Step 5: Commit**

```bash
git add src/screens/tv/TvSearch.tsx src/screens/SearchScreen.tsx
git commit -m "feat(tv): leanback search (system keyboard + D-pad results grid)"
```

---

### Task 8: TV Library view + wire-in

**Files:**
- Create: `src/screens/tv/TvLibrary.tsx`
- Modify: `src/screens/LibraryScreen.tsx` (add `if (Platform.isTV) return <TvLibrary …/>`).

**Interfaces:**
- Consumes: `MovieCard`, `Focusable`, `UpcomingReleases` (no props); `tvLayout`, `tvType`, `colors`; `STATUS_LABELS`, `STATUS_COLORS`, `LibraryItem` from `../../types/app`.
- Produces: `TvLibrary` default export:
  ```ts
  interface TvLibraryProps {
    viewMode: "library" | "upcoming";
    setViewMode: (v: "library" | "upcoming") => void;
    filteredItems: LibraryItem[];
    onItemPress: (item: LibraryItem) => void;
  }
  ```
  (Download management is `isTvApp`-gated → absent on real TV. Filters/sort are omitted from the TV grid for simplicity; the grid shows the full watchlist. If you want the type filter, add it as focusable chips mirroring the Search tabs.)

- [ ] **Step 1: Write `TvLibrary.tsx`**

Create `src/screens/tv/TvLibrary.tsx`:

```tsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import MovieCard from "../../components/MovieCard";
import Focusable from "../../components/Focusable";
import UpcomingReleases from "../../components/UpcomingReleases";
import { colors, radii } from "../../styles/theme";
import { tvLayout, tvType } from "../../styles/tvTheme";
import { STATUS_LABELS, STATUS_COLORS } from "../../types/app";
import type { LibraryItem } from "../../types/app";

interface TvLibraryProps {
  viewMode: "library" | "upcoming";
  setViewMode: (v: "library" | "upcoming") => void;
  filteredItems: LibraryItem[];
  onItemPress: (item: LibraryItem) => void;
}

const SEGMENTS = [
  { key: "library", label: "Watchlist" },
  { key: "upcoming", label: "Upcoming" },
] as const;

export default function TvLibrary({
  viewMode, setViewMode, filteredItems, onItemPress,
}: TvLibraryProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Library</Text>
      </View>

      <View style={styles.segments}>
        {SEGMENTS.map((seg) => {
          const active = viewMode === seg.key;
          return (
            <Focusable
              key={seg.key}
              style={[styles.segment, active && styles.segmentActive]}
              focusedStyle={styles.segFocused}
              onPress={() => setViewMode(seg.key)}
            >
              <Text style={[styles.segText, active && styles.segTextActive]}>
                {seg.label}
              </Text>
            </Focusable>
          );
        })}
      </View>

      {viewMode === "upcoming" ? (
        <View style={styles.upcoming}>
          <UpcomingReleases />
        </View>
      ) : filteredItems.length === 0 ? (
        <Text style={styles.empty}>Your watchlist is empty</Text>
      ) : (
        <View style={styles.grid}>
          {filteredItems.map((item) => (
            <View key={item.url} style={styles.cell}>
              <MovieCard
                movie={item as any}
                onPress={() => onItemPress(item)}
                style={styles.card}
              />
              {!!item.status && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: STATUS_COLORS[item.status] },
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: tvLayout.overscanH, paddingTop: tvLayout.overscanV, paddingBottom: tvLayout.overscanV * 2 },
  header: { marginBottom: 16 },
  title: { ...tvType.heroTitle, color: colors.text },
  segments: { flexDirection: "row", marginBottom: 24 },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 12,
  },
  segmentActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  segFocused: { borderColor: colors.text, transform: [{ scale: tvLayout.focusScale }] },
  segText: { ...tvType.meta, color: colors.textSecondary },
  segTextActive: { color: colors.text },
  empty: { ...tvType.body, color: colors.textMuted, textAlign: "center", marginTop: 48 },
  upcoming: {},
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { marginRight: tvLayout.gridGutter, marginBottom: tvLayout.gridGutter },
  card: { width: tvLayout.railCardWidth },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
  },
  badgeText: { ...tvType.caption, color: colors.text },
});
```

- [ ] **Step 2: Wire into `LibraryScreen.tsx`**

Import: `import TvLibrary from "./tv/TvLibrary";` and ensure `Platform` is imported (add `Platform` to the `react-native` import if absent — verify first).

Insert before the phone `return (`:

```tsx
if (Platform.isTV) {
  return (
    <TvLibrary
      viewMode={viewMode}
      setViewMode={setViewMode}
      filteredItems={filteredItems}
      onItemPress={handlePress}
    />
  );
}
```

> `viewMode` (line 53), `setViewMode`, `filteredItems` (147), `handlePress` (171) already exist. `STATUS_COLORS`/`STATUS_LABELS` are already imported in `LibraryScreen`; confirm their key type matches `LibraryItem.status` (`WatchStatus`).

- [ ] **Step 3: jest + tsc gates** — green; no new errors for `TvLibrary.tsx` / `LibraryScreen.tsx`.

- [ ] **Step 4: Verify on TV emulator (argent)** — launch to Library on `TV2`:
  - Title + Watchlist/Upcoming segment inside overscan; segment focus switches content.
  - Watchlist grid focus-scales cards with status badges; Upcoming renders the calendar body. Tune if needed.

- [ ] **Step 5: Commit**

```bash
git add src/screens/tv/TvLibrary.tsx src/screens/LibraryScreen.tsx
git commit -m "feat(tv): leanback library (segment + focus grid + upcoming)"
```

---

### Task 9: Integration — cross-screen focus flow + phone regression + full gates

**Files:** none created; verification + any small fixes surfaced.

- [ ] **Step 1: Full test + type gates**

Run: `npx jest` → ALL green.
Run: `npx tsc --noEmit 2>&1 | grep -v customConditions` → only the known pre-existing error remains; no new errors.

- [ ] **Step 2: TV end-to-end focus/nav smoke (argent on `TV2`)**

With Metro running, from Home: `describe` to read initial focus, then `tv-remote` to walk Home → open a Movie detail → Play focus → back → open a Series detail → season/episode focus → back → Search (type, focus results) → Library (segment + grid). Confirm at each screen: initial focus lands on a sensible element, D-pad moves logically, nothing is clipped by overscan, and `back` returns correctly (via the existing `useTVBackHandler`). `screenshot` each screen for the report.

- [ ] **Step 3: Phone byte-identical smoke (argent on the booted iOS simulator)**

Launch the app on the iPhone simulator (`71605EB1-55E6-445B-B183-AC366C524DF9`); `screenshot` Home, a Movie detail, Search, Library. Confirm they look exactly as before this branch (the phone JSX was untouched; this catches any accidental shared-style regression from Task 6's `styles.ts` edit). If Task 6 changed only `tvFeatured*` keys, phone is unaffected.

- [ ] **Step 4: Record results**

Note in the ledger: jest count, tsc status (known error only), and a one-line pass/fail per TV screen and per phone screen. No commit unless a fix was needed; if a fix was made, commit it with a `fix(tv): …` message naming the screen.

---

## Notes for the executor

- **Reused components are not modified** (except `FeaturedMovie`/`styles.ts` `tvFeatured*` in Task 6, TV-only). If a reused component's prop names differ from this plan, match the component's actual signature — do not change the component.
- **The `isTvApp` phone mode still uses the phone layout** — never route it to a TV view.
- **Every screen edit is additive**: a new import, TV-only state/effect/handler, and one `if (Platform.isTV) return …` block above the untouched phone `return`.
- Argent is focus-driven on TV: use `describe` + `tv-remote`, never `gesture-tap`. Load the `argent-tv-interact` skill before interacting.
