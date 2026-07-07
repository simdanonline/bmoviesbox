# Cinematic Premium UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Reelmark's phone UI from flat utilitarian dark to a cinematic premium look using a shared design-token layer, with staged deep polish on Home, Details, Search/Library, and Player — no layout, navigation, or behavior changes.

**Architecture:** Add a `src/styles/theme.ts` token module (plain typed constants, dark-only, zero runtime cost). Migrate the shared `src/styles/styles.ts` and each screen's local `StyleSheet.create` from hardcoded hex/spacing to tokens. TV-specific styles stay byte-identical. Polish enhancements (gradient scrims, metadata pills, empty states, press feedback) use only already-installed libs (`expo-linear-gradient`, `expo-image`, built-in `Animated`).

**Tech Stack:** React Native + Expo SDK 54, TypeScript, `@expo/vector-icons` (Feather), `expo-linear-gradient`, `expo-image` (via `TvSafeImage`), React Navigation.

## Global Constraints

- **No new native dependencies.** Do NOT add `react-native-reanimated`, `expo-blur`, NativeWind, or any UI kit. Motion uses built-in `Animated` and `expo-image` `transition` only.
- **Phone-first; TV byte-identical.** Never modify any style key whose name starts with `tv` (e.g. `tvFeaturedContainer`, `tvPlayButton`, `tvNativeControlButton`) or ends with `Focused` (e.g. `cardFocused`, `featuredFocused`, `iconButtonFocused`, `tvPlayButtonFocused`). Never touch `Platform.isTV ? … : …` ternary branches, `isTvApp` logic, or `Platform.isTV` conditionals.
- **Dark-only.** No theme provider/context, no light mode. Tokens are plain exported constants.
- **Keep video surfaces black.** Do NOT change `#000` backgrounds on `playerContainer`, `videoWrapper`, `video` — pure black behind video is intentional.
- **Tests stay green.** `npx jest` must pass (2 suites: `playerGestureMath`, `episodePlayback`). The pre-existing `tsc` `customConditions` error is expected and is NOT a regression — a task passes typecheck if it introduces **no new** errors beyond that one.
- **No git stash/checkout/restore** in this repo (dangling-stash hazard). Commit forward only.
- **Brand color** migrates `#e74c3c` → `#E5484D` (deeper crimson). App background `#0A0A0E` matches the adaptive-icon background.

### Canonical token substitution map (used by every migration task)

Apply to phone-facing style keys only (respect the exclusion rule above):

| Old value | New token | Notes |
|---|---|---|
| `#000` / `#000000` as `backgroundColor` | `colors.bg` | EXCEPT `playerContainer`/`videoWrapper`/`video` (keep `#000`) |
| `#000` in `textShadowColor` / `rgba(0,0,0,x)` overlays | leave as-is | shadows/scrims stay black |
| `#1a1a1a` | `colors.surface` | |
| `#2d2d2d`, `#2a2a2a` | `colors.surfaceHigh` | |
| `#333` | `colors.border` | borders/dividers |
| `#fff` / `#ffffff` | `colors.text` | text & border colors |
| `#aaa`, `#ddd`, `#ccc` | `colors.textSecondary` | |
| `#888` | `colors.textMuted` | |
| `#e74c3c` | `colors.accent` | |
| `rgba(231,76,60,0.8)` / `(...,0.9)` (phone keys) | `colors.accent` | solid accent fill |
| `#ffc107` | `colors.gold` | ratings |

---

## File Structure

- **Create:** `src/styles/theme.ts` — design tokens (`colors`, `spacing`, `radii`, `typography`, `shadows`).
- **Create:** `src/styles/__tests__/theme.test.ts` — structural test for token module.
- **Modify:** `src/styles/styles.ts` — migrate phone-facing keys to tokens (shared stylesheet consumed app-wide).
- **Modify (Stage A):** `src/screens/HomeScreen.tsx`, `src/components/FeaturedMovie.tsx`, `src/components/MovieCard.tsx`, `src/components/ContinueWatchingCard.tsx`, `src/components/RecommendationRail.tsx`.
- **Modify (Stage B):** `src/screens/MovieDetailsScreen.tsx`, `src/screens/SeriesDetailScreen.tsx`, `src/screens/SeriesList.tsx`.
- **Modify (Stage C):** `src/screens/SearchScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/WatchlistScreen.tsx`, `src/screens/DownloadedTitlesScreen.tsx`.
- **Modify (Stage D):** `src/screens/StreamSelection.tsx`, `src/screens/ServerSelectionScreen.tsx`, `src/components/TrackSelectionMenu.tsx`, plus the player-controls keys in `styles.ts` (already covered by Task 2; Task 6 does the local files + control-overlay polish).

---

## Task 1: Design token module

**Files:**
- Create: `src/styles/theme.ts`
- Test: `src/styles/__tests__/theme.test.ts`

**Interfaces:**
- Produces: `export const colors`, `spacing`, `radii`, `typography`, `shadows` from `src/styles/theme.ts`. Exact members below — every later task imports from here.

- [ ] **Step 1: Write the failing test**

Create `src/styles/__tests__/theme.test.ts`:

```ts
import { colors, spacing, radii, typography, shadows } from "../theme";

describe("theme tokens", () => {
  it("exposes the core color palette", () => {
    expect(colors.bg).toBe("#0A0A0E");
    expect(colors.surface).toBe("#131318");
    expect(colors.surfaceHigh).toBe("#1C1C24");
    expect(colors.accent).toBe("#E5484D");
    expect(colors.gold).toBe("#F5C518");
    expect(colors.text).toBe("#FFFFFF");
    expect(colors.textSecondary).toBe("#B8B8C0");
    expect(colors.textMuted).toBe("#71717A");
  });

  it("exposes spacing, radii, typography, shadows", () => {
    expect(spacing.md).toBe(12);
    expect(radii.card).toBe(14);
    expect(typography.heading.fontSize).toBe(18);
    expect(typography.body.lineHeight).toBe(20);
    expect(shadows.card.elevation).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/styles/__tests__/theme.test.ts`
Expected: FAIL — "Cannot find module '../theme'".

- [ ] **Step 3: Create the token module**

Create `src/styles/theme.ts`:

```ts
// Dark-only design tokens. Plain constants — no provider, zero runtime cost.
export const colors = {
  bg: "#0A0A0E",
  surface: "#131318",
  surfaceHigh: "#1C1C24",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.14)",
  text: "#FFFFFF",
  textSecondary: "#B8B8C0",
  textMuted: "#71717A",
  accent: "#E5484D",
  accentPressed: "#C93B40",
  accentSoft: "rgba(229,72,77,0.15)",
  gold: "#F5C518",
  // Gradient scrim stops (transparent → near-bg) for hero/backdrop overlays.
  scrimTop: "rgba(10,10,14,0)",
  scrimMid: "rgba(10,10,14,0.55)",
  scrimBottom: "rgba(10,10,14,0.95)",
  overlay: "rgba(0,0,0,0.4)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  card: 14,
  button: 12,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: "800", lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: "700", lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 14, fontWeight: "400", lineHeight: 20, letterSpacing: 0 },
  caption: { fontSize: 12, fontWeight: "500", lineHeight: 16, letterSpacing: 0.2 },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  poster: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/styles/__tests__/theme.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify no new typecheck errors**

Run: `npx tsc --noEmit 2>&1 | grep -v customConditions | grep -i "theme.ts" || echo "no new theme errors"`
Expected: `no new theme errors`.

- [ ] **Step 6: Commit**

```bash
git add src/styles/theme.ts src/styles/__tests__/theme.test.ts
git commit -m "feat(ui): add cinematic design token module"
```

---

## Task 2: Migrate shared stylesheet to tokens

**Files:**
- Modify: `src/styles/styles.ts`

**Interfaces:**
- Consumes: all tokens from `src/styles/theme.ts` (Task 1).
- Produces: same exported `styles` object, same keys — only values change. No key added/removed/renamed (screens reference these by name).

- [ ] **Step 1: Import tokens**

At the top of `src/styles/styles.ts`, after the RN import, add:

```ts
import { colors, spacing, radii, typography, shadows } from "./theme";
```

- [ ] **Step 2: Apply the canonical substitution map**

Apply the **Canonical token substitution map** (see Global Constraints) to every style key EXCEPT keys starting with `tv` or ending with `Focused`, and EXCEPT the video-surface exceptions. Concretely, that means updating these phone-facing keys: `container`, `header`, `headerTitle`, `featuredContainer`, `featuredHeroTitle`, `featuredBadge`, `featuredInfo`, `featuredTitle`, `featuredMetaText`, `genresList`, `ratingBadge`, `ratingBadgeText`, `moviesSection`→`sectionTitle`, `movieCardContainer`, `cardImageWrapper`, `playButtonSmall`, `playIconSmall`, `cardTitle`, `cardRatingText`, `cardYear`, `playButton`, `playButtonText`, `movieTitle`, `metaText`, `metaDot`, `genreTag`, `genreText`, `ratingsContainer`, `ratingsTitle`, `ratingItem`, `ratingSource`, `ratingValue`, `description`, `personText`, `errorText`, `subtext`, `serverCard`, `serverName`, `serverQuality`, `serverNumber`, `playerHeader`, `backButtonText`, `playerTitle`, `serverInfo`, `trailerButton`, `trailerButtonText`, `retryButton`, `seriesBadge`, `ratingBadge`.

Additionally refine these specific keys (beyond a plain color swap):

- `header`: set `backgroundColor: colors.bg` (flat, no separate bar color), `borderBottomColor: colors.border`.
- `headerTitle`: spread `typography.title` then keep `color: colors.text` (adds letterSpacing/lineHeight).
- `sectionTitle`: spread `typography.heading`, `color: colors.text`, keep `marginBottom: spacing.lg`.
- `featuredContainer`: `borderRadius: radii.card`, and add `...shadows.card`.
- `movieCardContainer`: `borderRadius: radii.card`, `backgroundColor: colors.surface`.
- `cardImageWrapper`: `backgroundColor: colors.surfaceHigh`.
- `playButton` (details Play CTA): `backgroundColor: colors.accent`, `borderRadius: radii.button`.
- `genreTag`: `backgroundColor: colors.surfaceHigh`, `borderRadius: radii.pill`.
- `ratingsContainer`, `ratingItem`, `serverCard`: `backgroundColor: colors.surface`/`colors.surfaceHigh` as per map, `borderRadius: radii.md`, `serverCard.borderColor: colors.border`.

Leave untouched (TV/focus/video): every `tv*` key, `featuredFocused`, `cardFocused`, `iconButtonFocused`, `tvPlayButtonFocused`, `tvShowControlsButtonFocused`, `tvNativeControlButtonFocused`, and `playerContainer`/`videoWrapper`/`video` background `#000`.

- [ ] **Step 3: Verify no TV/focus keys changed**

Run: `git diff src/styles/styles.ts | grep -E '^\+' | grep -E 'tv[A-Z]|Focused' || echo "no TV/focus edits — good"`
Expected: `no TV/focus edits — good`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit 2>&1 | grep -v customConditions | grep "styles.ts" || echo "no new style errors"`
Expected: jest PASS; `no new style errors`.

- [ ] **Step 5: Screenshot check (emulator)**

Boot the Android emulator via argent, launch the app, screenshot Home. Confirm: darker blue-black background, crimson accents, gold ratings, no layout shift. (Reviewer verifies visually.)

- [ ] **Step 6: Commit**

```bash
git add src/styles/styles.ts
git commit -m "refactor(ui): migrate shared stylesheet to design tokens"
```

---

## Task 3: Stage A — Home + browse rails polish

**Files:**
- Modify: `src/components/FeaturedMovie.tsx`, `src/components/MovieCard.tsx`, `src/components/ContinueWatchingCard.tsx`, `src/components/RecommendationRail.tsx`, `src/screens/HomeScreen.tsx`

**Interfaces:**
- Consumes: `colors`, `spacing`, `radii`, `typography`, `shadows` from `src/styles/theme.ts`; shared `styles` from `src/styles/styles.ts`.
- Produces: no new exports; visual-only changes. Component prop signatures unchanged.

- [ ] **Step 1: Migrate local stylesheets to tokens**

In `ContinueWatchingCard.tsx` (`cwStyles`) and `RecommendationRail.tsx` (`railStyles`), import tokens and apply the canonical map to phone-facing keys only (skip `Platform.isTV ? …` branches — leave those expressions intact, only swap the non-TV literal values and standalone colors). Specifically:
- `title` → spread `typography.heading`, `color: colors.text`.
- `cardTitle` → `color: colors.textSecondary`.
- `image` `backgroundColor: "#1a1a1a"` → `colors.surface`; keep `borderRadius: radii.sm`.
- `rating` `#ffc107` → `colors.gold`.
- `progressBadge` `rgba(231,76,60,0.9)` → `colors.accent`; `epCountBadge` keep `rgba(0,0,0,0.75)`; `epCountText` `#aaa` → `colors.textSecondary`.

- [ ] **Step 2: Hero scrim + type on phone FeaturedMovie**

In `FeaturedMovie.tsx`, the phone branch (`return` after `// Phone layout`) already uses a `LinearGradient`. Update its `colors` prop to token scrim stops for a smoother fade:

```tsx
<LinearGradient
  colors={[colors.scrimTop, colors.scrimMid, colors.scrimBottom]}
  locations={[0, 0.55, 1]}
  style={styles.featuredGradient}
>
```

Add `import { colors } from "../styles/theme";` at top. Do NOT alter the `if (Platform.isTV)` branch.

- [ ] **Step 3: Card press-scale feedback on MovieCard**

In `MovieCard.tsx`, wrap the card body in an `Animated.View` driven by a press scale using built-in `Animated` (no reanimated). `Focusable` already handles press; add a lightweight scale on the inner content:

```tsx
import React, { useRef } from "react";
import { View, Text, ViewStyle, Animated, Pressable } from "react-native";
```

Keep `Focusable` as the outer element (preserves TV focus). Inside, wrap the image+info in `Animated.View` with `style={{ transform: [{ scale }] }}` where `scale` is a `useRef(new Animated.Value(1)).current`, and add `onPressIn`/`onPressOut` handlers via a `Pressable` **only on non-TV** (`!Platform.isTV`) that animate to `0.97`/`1` over 100ms. If wiring press events conflicts with `Focusable`, SKIP the scale and instead just apply `...shadows.card` to `styles.movieCardContainer` (already done in Task 2) — the reviewer will decide. Prefer the simplest version that keeps TV untouched.

- [ ] **Step 4: expo-image crossfade on cards**

Ensure `TvSafeImage` usages in `MovieCard`, `ContinueWatchingCard`, `RecommendationRail` pass `transition={200}` (FeaturedMovie already does). Add the prop where missing.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit 2>&1 | grep -v customConditions | grep -E "FeaturedMovie|MovieCard|ContinueWatching|RecommendationRail|HomeScreen" || echo "no new errors"`
Expected: jest PASS; `no new errors`.

- [ ] **Step 6: Screenshot check (emulator)**

Launch app → Home. Confirm hero scrim fade, consistent rail headers, card crossfade, gold ratings. No TV regression (phone layout only touched).

- [ ] **Step 7: Commit**

```bash
git add src/components/FeaturedMovie.tsx src/components/MovieCard.tsx src/components/ContinueWatchingCard.tsx src/components/RecommendationRail.tsx src/screens/HomeScreen.tsx
git commit -m "feat(ui): polish home hero, cards, and rails"
```

---

## Task 4: Stage B — Details screens polish

**Files:**
- Modify: `src/screens/MovieDetailsScreen.tsx`, `src/screens/SeriesDetailScreen.tsx`, `src/screens/SeriesList.tsx`

**Interfaces:**
- Consumes: tokens from `theme.ts`; shared `styles` (already token-migrated); `expo-linear-gradient`.
- Produces: visual-only changes.

- [ ] **Step 1: Backdrop gradient scrim**

In `MovieDetailsScreen.tsx` and `SeriesDetailScreen.tsx`, wrap/overlay the cover image (`styles.coverImage`) with a bottom `LinearGradient` fading into `colors.bg` so the poster blends into the page. Add:

```tsx
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../styles/theme";
```

Place, immediately after the cover `<Image>`/`<TvSafeImage>`, an absolutely-positioned gradient covering the bottom ~40% of the image:

```tsx
<LinearGradient
  colors={[colors.scrimTop, colors.bg]}
  style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 160 }}
  pointerEvents="none"
/>
```

Wrap the image + gradient in a `View` with `position: "relative"` if not already. Do NOT change TV branches.

- [ ] **Step 2: Metadata pills**

Where the details screen renders year / runtime / rating as plain `Text` in `metaRow`, add a shared poster shadow to the cover and ensure meta uses `styles.metaText` (already tokenized). If the screen has a local `StyleSheet`, migrate its hex values via the canonical map. Add `...shadows.poster` to the poster/cover style if a discrete poster element exists (some detail layouts use a small poster over the backdrop).

- [ ] **Step 3: Migrate any local stylesheet**

Apply the canonical substitution map to any local `StyleSheet.create` in these three files (phone keys only; leave `Platform.isTV`/`tv*`/`*Focused`).

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit 2>&1 | grep -v customConditions | grep -E "MovieDetails|SeriesDetail|SeriesList" || echo "no new errors"`
Expected: jest PASS; `no new errors`.

- [ ] **Step 5: Screenshot check (emulator)**

Open a movie → Details. Confirm backdrop fades into background, Play button is crimson with proper weight, genre pills rounded, ratings gold. Repeat for a series.

- [ ] **Step 6: Commit**

```bash
git add src/screens/MovieDetailsScreen.tsx src/screens/SeriesDetailScreen.tsx src/screens/SeriesList.tsx
git commit -m "feat(ui): polish movie and series details screens"
```

---

## Task 5: Stage C — Search + Library polish

**Files:**
- Modify: `src/screens/SearchScreen.tsx`, `src/screens/LibraryScreen.tsx`, `src/screens/WatchlistScreen.tsx`, `src/screens/DownloadedTitlesScreen.tsx`

**Interfaces:**
- Consumes: tokens from `theme.ts`; shared `styles`.
- Produces: visual-only changes; a reusable empty-state block per screen (inline, not a new shared component unless a screen already has one).

- [ ] **Step 1: Migrate local stylesheets to tokens**

Apply the canonical substitution map to each screen's local `StyleSheet.create` (phone keys only).

- [ ] **Step 2: Search field styling**

In `SearchScreen.tsx`, style the search `TextInput` container: `backgroundColor: colors.surface`, `borderRadius: radii.pill`, `paddingHorizontal: spacing.lg`, `borderWidth: 1`, `borderColor: colors.border`; set the input `color: colors.text` and `placeholderTextColor={colors.textMuted}`. Keep an inline Feather search icon if present.

- [ ] **Step 3: Designed empty states**

For each screen's "no results / empty" branch, replace bare `Text` with a centered block: a Feather icon (`search` for Search, `bookmark` for Watchlist, `download` for Downloaded, `film` for Library) at `size={48} color={colors.textMuted}`, a headline `Text` (`typography.heading`, `colors.text`), and a hint `Text` (`typography.body`, `colors.textSecondary`). Use `spacing` for gaps. Preserve existing copy strings; only restyle. If a screen has no empty branch, add one guarded by the existing empty condition.

- [ ] **Step 4: Grid gutters**

Ensure grid `contentContainerStyle` / row wrappers use `spacing` scale values (`spacing.lg` horizontal padding, `spacing.md`/`spacing.lg` gaps) consistent with the shared `moviesGrid`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit 2>&1 | grep -v customConditions | grep -E "SearchScreen|LibraryScreen|WatchlistScreen|DownloadedTitles" || echo "no new errors"`
Expected: jest PASS; `no new errors`.

- [ ] **Step 6: Screenshot check (emulator)**

Open Search (empty + with results), Library, Watchlist, Downloaded. Confirm rounded search field, consistent grids, designed empty states.

- [ ] **Step 7: Commit**

```bash
git add src/screens/SearchScreen.tsx src/screens/LibraryScreen.tsx src/screens/WatchlistScreen.tsx src/screens/DownloadedTitlesScreen.tsx
git commit -m "feat(ui): polish search and library screens with designed empty states"
```

---

## Task 6: Stage D — Player + stream selection polish

**Files:**
- Modify: `src/screens/StreamSelection.tsx`, `src/screens/ServerSelectionScreen.tsx`, `src/components/TrackSelectionMenu.tsx`

**Interfaces:**
- Consumes: tokens from `theme.ts`; shared `styles` (player-header/footer keys already tokenized in Task 2).
- Produces: visual-only changes. Keep `#000` video surfaces.

- [ ] **Step 1: Migrate local stylesheets to tokens**

Apply the canonical map to each file's local `StyleSheet.create` (phone keys only; leave `tv*`/`Platform.isTV` player-control keys untouched — those are covered by the TV byte-identical rule).

- [ ] **Step 2: Selection list rows**

In `StreamSelection.tsx` and `ServerSelectionScreen.tsx`, style each option row/card: `backgroundColor: colors.surface`, `borderRadius: radii.md`, `borderWidth: 1`, `borderColor: colors.border`; selected state uses `borderColor: colors.accent` + `backgroundColor: colors.accentSoft`. Quality labels use `colors.gold`; secondary text `colors.textMuted`.

- [ ] **Step 3: TrackSelectionMenu**

Style menu container `backgroundColor: colors.surfaceHigh`, `borderRadius: radii.md`; selected track row uses `colors.accentSoft` background + `colors.accent` text; unselected `colors.textSecondary`. Do NOT change gesture/behavior logic.

- [ ] **Step 4: Player control overlay scrims (phone only)**

If phone player controls sit on flat boxes (`playerHeader`/`playerFooter`), leave the shared keys as tokenized in Task 2 (they now use `colors.surface`). Do not restructure the player. This step is a no-op unless a local flat-black control box exists on the phone path — if so, give it a subtle `colors.surface` background with `borderColor: colors.border`.

- [ ] **Step 5: Run tests + typecheck**

Run: `npx jest && npx tsc --noEmit 2>&1 | grep -v customConditions | grep -E "StreamSelection|ServerSelection|TrackSelectionMenu" || echo "no new errors"`
Expected: jest PASS; `no new errors`.

- [ ] **Step 6: Screenshot check (emulator)**

Trigger stream/server selection and the track menu. Confirm token-styled rows with clear selected states, gold quality labels.

- [ ] **Step 7: Commit**

```bash
git add src/screens/StreamSelection.tsx src/screens/ServerSelectionScreen.tsx src/components/TrackSelectionMenu.tsx
git commit -m "feat(ui): polish stream/server selection and track menu"
```

---

## Task 7: TV smoke-check + final verification

**Files:** none modified (verification only). If a regression is found, fix in the offending file and note it.

- [ ] **Step 1: Full test + typecheck sweep**

Run: `npx jest`
Expected: PASS (all suites incl. `theme.test.ts`).

Run: `npx tsc --noEmit 2>&1 | grep -v customConditions || echo "only the known customConditions error remains"`
Expected: `only the known customConditions error remains` (no new errors).

- [ ] **Step 2: Confirm no TV/focus/video regressions in the diff**

Run: `git diff master -- src/styles/styles.ts | grep -E '^\+' | grep -E 'tv[A-Z]|Focused|playerContainer|videoWrapper' || echo "TV/focus/video surfaces untouched"`
Expected: `TV/focus/video surfaces untouched`.

- [ ] **Step 3: Android TV smoke-check (best-effort)**

If an Android TV emulator/device is available via argent, launch the app and confirm: featured focus border, card focus scaling, and rail density are unchanged from before. If no TV target is available, note that in the completion report and rely on the Step 2 static guarantee.

- [ ] **Step 4: Phone visual pass**

Screenshot Home, Details, Search, Library, Player selection on the phone emulator one final time. Confirm consistent cinematic look across all polished screens.

- [ ] **Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(ui): resolve regressions from cinematic polish pass"
```

(Skip if Steps 1–4 were clean with nothing to commit.)

---

## Self-Review Notes

- **Spec coverage:** theme.ts (Task 1), styles.ts migration (Task 2), Stage A/B/C/D (Tasks 3–6), TV smoke-check + jest-green (Task 7). All spec sections mapped.
- **No new deps:** enforced in Global Constraints and every task; only `expo-linear-gradient`/`expo-image`/`Animated` used.
- **TV byte-identical:** exclusion rule (`tv*` / `*Focused` / `Platform.isTV` branches) repeated per task, with a static diff-grep guard in Tasks 2 and 7.
- **Type consistency:** token member names (`colors.*`, `spacing.*`, `radii.*`, `typography.*`, `shadows.*`) defined once in Task 1 and referenced identically everywhere.
