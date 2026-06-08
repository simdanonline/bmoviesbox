# Next Episode / Autoplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual "Next Episode" button and an end-of-episode autoplay countdown to the series video player, advancing across seasons, and mark episodes watched at ~90% progress.

**Architecture:** Extract the existing episode resolve pipeline into a shared `src/utils/episodePlayback.ts` (a pure `getNextEpisode` + an async `resolveEpisodePlayback`). The player receives a new optional `seriesContext` route param, computes the next episode, shows a Next button + countdown, and advances via `navigation.replace`. Movies/downloads pass no `seriesContext` and behave exactly as today.

**Tech Stack:** React Native 0.81 / Expo SDK 54, TypeScript, react-native-vlc-media-player + react-native-video, jest-expo (added in Task 0).

Spec: `docs/superpowers/specs/2026-06-08-next-episode-autoplay-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/utils/episodePlayback.ts` (new) | `getNextEpisode` (pure), `resolveEpisodePlayback` (async), `SeriesRef` + `NextEpisodeParams` types |
| `src/utils/__tests__/episodePlayback.test.ts` (new) | Unit tests for both helpers |
| `jest.config.js`, `jest.setup.js` (new) | jest-expo test harness |
| `src/screens/SeriesDetailScreen.tsx` | Use `resolveEpisodePlayback`; pass `seriesContext` to player |
| `src/screens/NativeVideoPlayer.tsx` | `seriesContext` param, next computation, 90% mark-watched, Next button overlay, countdown overlay, advance flow |

---

## Task 0: Add jest-expo test harness

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `jest.setup.js`

- [ ] **Step 1: Install jest-expo + testing deps**

Run:
```bash
npx expo install -- --save-dev jest-expo jest @types/jest
```
Expected: devDependencies updated, no peer-dep errors.

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "jest"
```

- [ ] **Step 3: Create `jest.config.js`**

```js
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|react-native-.*))",
  ],
};
```

- [ ] **Step 4: Create `jest.setup.js`**

```js
// Silence the native AsyncStorage warning in unit tests.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
```

- [ ] **Step 5: Smoke-test the harness**

Create a throwaway test `src/utils/__tests__/harness.test.ts`:
```ts
test("jest runs", () => {
  expect(1 + 1).toBe(2);
});
```
Run: `npm test -- harness`
Expected: 1 passing test. Then delete `src/utils/__tests__/harness.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.js jest.setup.js
git commit -m "test: add jest-expo harness"
```

---

## Task 1: `getNextEpisode` pure helper (TDD)

**Files:**
- Create: `src/utils/episodePlayback.ts`
- Test: `src/utils/__tests__/episodePlayback.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/utils/__tests__/episodePlayback.test.ts`:
```ts
import { getNextEpisode } from "../episodePlayback";
import type { Season } from "../../services/MovieAPI";

const ep = (n: number) => ({
  episodeNumber: n,
  episodeTitle: `Ep ${n}`,
  episodeUrl: `https://x/e${n}`,
});

const seasons: Season[] = [
  { seasonNumber: 1, episodes: [ep(1), ep(2), ep(3)] },
  { seasonNumber: 2, episodes: [ep(1), ep(2)] },
];

describe("getNextEpisode", () => {
  it("returns the next episode within the same season", () => {
    expect(getNextEpisode(seasons, 1, 1)).toEqual({ season: 1, episode: ep(2) });
  });

  it("rolls into the next season at a season finale", () => {
    expect(getNextEpisode(seasons, 1, 3)).toEqual({ season: 2, episode: ep(1) });
  });

  it("returns null at the series finale", () => {
    expect(getNextEpisode(seasons, 2, 2)).toBeNull();
  });

  it("matches by number, tolerating unordered/gapped lists", () => {
    const gapped: Season[] = [
      { seasonNumber: 2, episodes: [ep(5), ep(1)] },
      { seasonNumber: 1, episodes: [ep(2), ep(1)] },
    ];
    expect(getNextEpisode(gapped, 1, 1)).toEqual({ season: 1, episode: ep(2) });
    expect(getNextEpisode(gapped, 1, 2)).toEqual({ season: 2, episode: ep(1) });
    expect(getNextEpisode(gapped, 2, 5)).toBeNull();
  });

  it("returns null for empty or unknown input", () => {
    expect(getNextEpisode([], 1, 1)).toBeNull();
    expect(getNextEpisode(seasons, 9, 9)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- episodePlayback`
Expected: FAIL — "Cannot find module '../episodePlayback'".

- [ ] **Step 3: Implement `getNextEpisode`**

Create `src/utils/episodePlayback.ts`:
```ts
import type { Episode, Season } from "../services/MovieAPI";

export interface NextEpisode {
  season: number;
  episode: Episode;
}

/**
 * Compute the episode that follows (season, episode) within `seasons`.
 * Stays within the current season when a higher episode number exists; at a
 * season finale rolls into the lowest-numbered episode of the next season.
 * Matches by season/episode NUMBER (not array index) to tolerate gaps and
 * unordered lists. Returns null at the series finale or for unknown input.
 */
export function getNextEpisode(
  seasons: Season[],
  currentSeason: number,
  currentEpisode: number,
): NextEpisode | null {
  const season = seasons.find((s) => s.seasonNumber === currentSeason);
  if (!season) return null;

  const later = season.episodes
    .filter((e) => e.episodeNumber > currentEpisode)
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  if (later.length > 0) {
    return { season: currentSeason, episode: later[0] };
  }

  const nextSeason = seasons
    .filter((s) => s.seasonNumber > currentSeason)
    .sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
  if (!nextSeason) return null;

  const firstEp = [...nextSeason.episodes].sort(
    (a, b) => a.episodeNumber - b.episodeNumber,
  )[0];
  if (!firstEp) return null;

  return { season: nextSeason.seasonNumber, episode: firstEp };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- episodePlayback`
Expected: PASS — 5 tests in the `getNextEpisode` suite.

- [ ] **Step 5: Commit**

```bash
git add src/utils/episodePlayback.ts src/utils/__tests__/episodePlayback.test.ts
git commit -m "feat: add getNextEpisode helper"
```

---

## Task 2: `resolveEpisodePlayback` helper (TDD)

**Files:**
- Modify: `src/utils/episodePlayback.ts`
- Test: `src/utils/__tests__/episodePlayback.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/__tests__/episodePlayback.test.ts`:
```ts
import { resolveEpisodePlayback } from "../episodePlayback";
import MovieAPI from "../../services/MovieAPI";
import { getOriginalLanguage } from "../../services/tmdb";
import { pickBest } from "../streamRanking";
import { preparePlayableStreams } from "../playbackValidation";

jest.mock("../../services/MovieAPI", () => ({
  __esModule: true,
  default: { getResolvedStreams: jest.fn() },
}));
jest.mock("../../services/tmdb", () => ({ getOriginalLanguage: jest.fn() }));
jest.mock("../streamRanking", () => ({ pickBest: jest.fn() }));
jest.mock("../playbackValidation", () => ({ preparePlayableStreams: jest.fn() }));

const series = { id: "42", url: "https://x/series", title: "My Show" };
const episode = { episodeNumber: 2, episodeTitle: "Pilot", episodeUrl: "https://x/e2" };

describe("resolveEpisodePlayback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a param bundle on success", async () => {
    (getOriginalLanguage as jest.Mock).mockResolvedValue("en");
    const raw = [{ url: "u1", type: "mp4" }, { url: "magnet", type: "magnet" }];
    (MovieAPI.getResolvedStreams as jest.Mock).mockResolvedValue(raw);
    (pickBest as jest.Mock).mockImplementation((s) => s);
    (preparePlayableStreams as jest.Mock).mockResolvedValue([{ url: "u1", type: "mp4" }]);

    const result = await resolveEpisodePlayback(series, 1, episode);

    expect(result).toEqual({
      streams: [{ url: "u1", type: "mp4" }],
      title: "My Show - S1E2 Pilot",
      sourceContext: { tmdbId: "42", kind: "episode", season: 1, episode: 2 },
      streamProgressKey: "https://x/series::s1e2",
      originalLanguage: "en",
    });
    // magnets are filtered out before ranking
    expect((pickBest as jest.Mock).mock.calls[0][0]).toEqual([{ url: "u1", type: "mp4" }]);
  });

  it("returns null when no playable streams resolve", async () => {
    (getOriginalLanguage as jest.Mock).mockResolvedValue(null);
    (MovieAPI.getResolvedStreams as jest.Mock).mockResolvedValue([]);
    (pickBest as jest.Mock).mockReturnValue([]);
    (preparePlayableStreams as jest.Mock).mockResolvedValue([]);

    expect(await resolveEpisodePlayback(series, 1, episode)).toBeNull();
  });

  it("returns null and swallows errors", async () => {
    (getOriginalLanguage as jest.Mock).mockResolvedValue(null);
    (MovieAPI.getResolvedStreams as jest.Mock).mockRejectedValue(new Error("boom"));

    expect(await resolveEpisodePlayback(series, 1, episode)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- episodePlayback`
Expected: FAIL — "resolveEpisodePlayback is not a function".

- [ ] **Step 3: Implement `resolveEpisodePlayback`**

Add to `src/utils/episodePlayback.ts` (imports at top, exports below `getNextEpisode`):
```ts
import MovieAPI, { Episode, ResolvedStream, Season } from "../services/MovieAPI";
import { pickBest } from "./streamRanking";
import { getOriginalLanguage } from "../services/tmdb";
import { preparePlayableStreams } from "./playbackValidation";
import type { PlaybackSourceContext } from "./playbackSourceHealth";

export interface SeriesRef {
  id: string;
  url: string;
  title: string;
}

export interface NextEpisodeParams {
  streams: ResolvedStream[];
  title: string;
  sourceContext: PlaybackSourceContext;
  streamProgressKey: string;
  originalLanguage?: string;
}

/**
 * Resolve, rank, and validate playable streams for a single episode, returning
 * the exact route-param bundle NativeVideoPlayer expects, or null when nothing
 * playable resolves (or any step throws). Mirrors the Tier-1 path in
 * SeriesDetailScreen.handlePlayEpisode so both call sites stay in sync.
 */
export async function resolveEpisodePlayback(
  series: SeriesRef,
  seasonNumber: number,
  episode: Episode,
): Promise<NextEpisodeParams | null> {
  try {
    const title = `${series.title} - S${seasonNumber}E${episode.episodeNumber} ${episode.episodeTitle}`;
    const languagePromise = getOriginalLanguage(series.id, "series");
    const resolved = await MovieAPI.getResolvedStreams(
      "series",
      { tmdbId: series.id },
      seasonNumber,
      episode.episodeNumber,
    );
    const originalLanguage = await languagePromise;
    const compatible = pickBest(
      resolved.filter((s) => s.type !== "magnet"),
      originalLanguage,
    );
    const sourceContext: PlaybackSourceContext = {
      tmdbId: String(series.id),
      kind: "episode",
      season: seasonNumber,
      episode: episode.episodeNumber,
    };
    const playable = await preparePlayableStreams(compatible, sourceContext);
    if (playable.length === 0) return null;
    return {
      streams: playable,
      title,
      sourceContext,
      streamProgressKey: `${series.url}::s${seasonNumber}e${episode.episodeNumber}`,
      originalLanguage: originalLanguage ?? undefined,
    };
  } catch (e) {
    console.warn("resolveEpisodePlayback failed:", e);
    return null;
  }
}
```

Note: keep the `Season` import — it is used by `getNextEpisode`. Remove any now-duplicate `Episode`/`Season` import lines so the file has a single import from `../services/MovieAPI`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- episodePlayback`
Expected: PASS — all `getNextEpisode` and `resolveEpisodePlayback` tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors in `episodePlayback.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/episodePlayback.ts src/utils/__tests__/episodePlayback.test.ts
git commit -m "feat: add resolveEpisodePlayback helper"
```

---

## Task 3: Refactor SeriesDetailScreen to use the helper + pass seriesContext

**Files:**
- Modify: `src/screens/SeriesDetailScreen.tsx:489-533` (the Tier-1 block in `handlePlayEpisode`)

- [ ] **Step 1: Add the import**

Near the other util imports (after line 41 `preparePlayableStreams` import), add:
```ts
import {
  resolveEpisodePlayback,
  type SeriesRef,
} from "../utils/episodePlayback";
```
The existing imports of `pickBest` (line 30) and `preparePlayableStreams` (line 41) stay — they are still used by the download path. `getOriginalLanguage` (line 31) also stays (used elsewhere).

- [ ] **Step 2: Replace the Tier-1 body of `handlePlayEpisode`**

Replace lines 495-533 (the `// Tier 1:` comment through the end of its `catch`) with:
```ts
    // Tier 1: backend's resolved-stream pipeline (Stremio + Real-Debrid).
    // MKV streams stay in the list — NativeVideoPlayer falls back to libVLC
    // on iOS automatically. Resolve logic lives in resolveEpisodePlayback so
    // the player can reuse it for the "next episode" flow.
    const seriesRef: SeriesRef = {
      id: String(seriesData.id),
      url: seriesData.url,
      title: seriesData.title,
    };
    const params = await resolveEpisodePlayback(
      seriesRef,
      selectedSeason,
      episode,
    );
    if (params) {
      setGettingLinks(false);
      navigation.navigate("NativeVideoPlayer", {
        ...params,
        seriesContext: {
          seriesId: seriesRef.id,
          seriesUrl: seriesRef.url,
          seriesTitle: seriesRef.title,
          seasons: seriesData.seasons,
          season: selectedSeason,
          episode: episode.episodeNumber,
        },
      });
      return;
    }
```

Leave the Tier-2 WebView fallback block (lines 535-557) unchanged — it runs when `params` is null.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (`navigation` is `NativeStackScreenProps<any>`-style, so the extra `seriesContext` param is accepted.)

- [ ] **Step 4: Build sanity check**

Run: `npx tsc --noEmit && npm test -- episodePlayback`
Expected: typecheck clean, helper tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/SeriesDetailScreen.tsx
git commit -m "refactor: use resolveEpisodePlayback in SeriesDetailScreen"
```

---

## Task 4: Player — receive seriesContext, compute next, mark watched at 90%

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx` (param cast ~line 145, state/refs near 189, progress handlers 594-599 and the rnv handler, imports near top)

- [ ] **Step 1: Add imports**

After line 35 (`import { ResolvedStream } from "../services/MovieAPI";`) add:
```ts
import type { Season } from "../services/MovieAPI";
import {
  getNextEpisode,
  resolveEpisodePlayback,
  type SeriesRef,
} from "../utils/episodePlayback";
import { useUserData } from "../context/UserDataContext";
```

- [ ] **Step 2: Extend the route-params cast**

In the `route.params as { ... }` block (starts line 145), add the optional field before the closing `}`:
```ts
    seriesContext?: {
      seriesId: string;
      seriesUrl: string;
      seriesTitle: string;
      seasons: Season[];
      season: number;
      episode: number;
    };
```
Then add `seriesContext` to the destructured names at the top of that block.

- [ ] **Step 3: Compute the next episode + grab markEpisodeWatched**

Immediately after the `route.params` destructure (after the cast block), add:
```ts
  const { markEpisodeWatched } = useUserData();

  const nextEpisode = seriesContext
    ? getNextEpisode(
        seriesContext.seasons,
        seriesContext.season,
        seriesContext.episode,
      )
    : null;

  const markedWatchedRef = useRef(false);
```

- [ ] **Step 4: Add the 90% mark-watched effect**

After the existing throttled-save logic (after `saveProgressIfDue`, around line 473), add:
```ts
  // Mark the current episode watched once playback passes 90%. Fires at most
  // once per mount (ref-guarded) and only for series playback.
  const maybeMarkWatched = (currentMs: number) => {
    if (markedWatchedRef.current) return;
    if (!seriesContext || durationMs <= 0) return;
    if (currentMs / durationMs < 0.9) return;
    const season = seriesContext.seasons.find(
      (s) => s.seasonNumber === seriesContext.season,
    );
    const ep = season?.episodes.find(
      (e) => e.episodeNumber === seriesContext.episode,
    );
    if (!ep) return;
    markedWatchedRef.current = true;
    markEpisodeWatched({
      seriesUrl: seriesContext.seriesUrl,
      episodeUrl: ep.episodeUrl,
      episodeTitle: ep.episodeTitle,
      seasonNumber: seriesContext.season,
      episodeNumber: seriesContext.episode,
    });
  };
```

- [ ] **Step 5: Call it from both progress handlers**

In `handleVlcProgress` (line 594-599), after `saveProgressIfDue(e.currentTime);` add:
```ts
    maybeMarkWatched(e.currentTime);
```
In the rnv progress handler `handleRnvProgress` (find it near line 662, where it calls `setPositionMs(ms)`), after the position save add the same call with that handler's millisecond variable, e.g.:
```ts
    maybeMarkWatched(ms);
```
(Confirm the rnv handler's local ms variable name; it converts seconds→ms before saving.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: mark series episodes watched at 90% in player"
```

---

## Task 5: Player — manual Next button + advance flow

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx` (state near 189, render overlay near 916, styles)

- [ ] **Step 1: Add advance state**

Near the other `useState` declarations (around line 189) add:
```ts
  const [advancing, setAdvancing] = useState(false);
```

- [ ] **Step 2: Add the advance handler**

After `maybeMarkWatched` (from Task 4), add:
```ts
  // Resolve and switch to the next episode. Uses navigation.replace so episodes
  // don't pile up on the back stack and the player fully remounts.
  const advanceToNextEpisode = async () => {
    if (!seriesContext || !nextEpisode || advancing) return;
    setAdvancing(true);
    const series: SeriesRef = {
      id: seriesContext.seriesId,
      url: seriesContext.seriesUrl,
      title: seriesContext.seriesTitle,
    };
    const params = await resolveEpisodePlayback(
      series,
      nextEpisode.season,
      nextEpisode.episode,
    );
    setAdvancing(false);
    if (!params) {
      ToastAndroid && Platform.OS === "android"
        ? ToastAndroid.show("Couldn't load next episode", ToastAndroid.SHORT)
        : Alert.alert("Couldn't load next episode");
      return;
    }
    navigation.replace("NativeVideoPlayer", {
      ...params,
      seriesContext: {
        seriesId: seriesContext.seriesId,
        seriesUrl: seriesContext.seriesUrl,
        seriesTitle: seriesContext.seriesTitle,
        seasons: seriesContext.seasons,
        season: nextEpisode.season,
        episode: nextEpisode.episode.episodeNumber,
      },
    });
  };
```
Ensure `Alert`, `Platform`, and `ToastAndroid` are imported from `react-native` (add any missing to the existing `react-native` import block near line 8). Cross-platform toast: Android uses `ToastAndroid`, iOS falls back to a lightweight `Alert`.

- [ ] **Step 3: Render the Next button overlay**

After the custom-controls block (after the VLC controls `</>` near line 947's section, but OUTSIDE the `useVlc &&` guard so it shows for both players), add — gated on controls visibility and a next existing:
```tsx
      {nextEpisode && controlsVisible && !errored && (
        <Focusable
          style={[styles.nextButton, { bottom: 70 + insets.bottom, right: 16 + insets.right }]}
          focusedStyle={styles.buttonFocused}
          onPress={advanceToNextEpisode}
        >
          <Text style={styles.buttonText}>
            {advancing ? "Loading…" : "Next ▶"}
          </Text>
        </Focusable>
      )}
```

- [ ] **Step 4: Add the style**

In the `StyleSheet.create({...})` block add:
```ts
  nextButton: {
    position: "absolute",
    backgroundColor: "rgba(231,76,60,0.9)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: add manual Next Episode button to player"
```

---

## Task 6: Player — end-of-episode autoplay countdown

**Files:**
- Modify: `src/screens/NativeVideoPlayer.tsx` (state, onEnd handlers lines 850 & 877, render overlay, styles)

- [ ] **Step 1: Add countdown state**

Near the other `useState` (line 189 area):
```ts
  const [countdown, setCountdown] = useState<number | null>(null);
```

- [ ] **Step 2: Add the onEnd handler**

After `advanceToNextEpisode`, add:
```ts
  // At end of playback: if a next episode exists, start a 5s autoplay countdown;
  // otherwise preserve the original behaviour of leaving the player.
  const handlePlaybackEnded = () => {
    if (nextEpisode) {
      setPaused(true);
      setCountdown(5);
    } else {
      navigation.goBack();
    }
  };

  const cancelCountdown = () => setCountdown(null);
```
(`setPaused` already exists in this component — it drives the `paused` prop.)

- [ ] **Step 3: Drive the countdown with an effect**

Add near the other effects:
```ts
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      void advanceToNextEpisode();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);
```

- [ ] **Step 4: Wire both players' onEnd**

Line 850: change `onEnd={() => navigation.goBack()}` → `onEnd={handlePlaybackEnded}`.
Line 877: change `onEnd={() => navigation.goBack()}` → `onEnd={handlePlaybackEnded}`.

- [ ] **Step 5: Render the countdown overlay**

After the Next button overlay (Task 5 Step 3), add:
```tsx
      {countdown !== null && nextEpisode && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>
            Next episode in {countdown}s
          </Text>
          <View style={styles.countdownRow}>
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              hasTVPreferredFocus
              onPress={() => {
                setCountdown(null);
                void advanceToNextEpisode();
              }}
            >
              <Text style={styles.buttonText}>
                {advancing ? "Loading…" : "Play now"}
              </Text>
            </Focusable>
            <Focusable
              style={styles.button}
              focusedStyle={styles.buttonFocused}
              onPress={cancelCountdown}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Focusable>
          </View>
        </View>
      )}
```

- [ ] **Step 6: Add the style**

In `StyleSheet.create`:
```ts
  countdownRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
  },
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/NativeVideoPlayer.tsx
git commit -m "feat: add autoplay countdown at end of episode"
```

---

## Task 7: Manual QA via argent

**Files:** none (verification only). Follow the argent rules: boot a device, `launch-app`, use discovery tools before every tap.

- [ ] **Step 1: Boot a device and launch the app**

Use `list-devices` → prefer a booted one → `boot-device` if needed → `launch-app`. Start Metro per `argent-react-native-app-workflow` if not running.

- [ ] **Step 2: Verify mid-season Next button**

Open a series, play a non-final episode. While controls are visible, confirm a "Next ▶" button appears (bottom-right). Tap it (discover coords via `debugger-component-tree`/`describe` first). Expected: player remounts on the next episode, resumes from start.

- [ ] **Step 3: Verify season rollover**

Play the last episode of a season that has a following season. Use the Next button. Expected: advances to S(n+1)E1.

- [ ] **Step 4: Verify autoplay countdown**

Scrub near the end of an episode and let it finish (or use a short stream). Expected: "Next episode in 5s" overlay with Play now + Cancel; auto-advances at 0. Tap Cancel on a fresh end → overlay dismisses, stays on the finished episode.

- [ ] **Step 5: Verify series finale**

Play the last episode of the last season. Expected: no Next button; on end, returns to the previous screen (original behaviour).

- [ ] **Step 6: Verify 90% mark-watched**

Scrub past ~90% of an episode, back out to the series detail screen. Expected: that episode shows as watched.

- [ ] **Step 7: Verify movie path unaffected**

Play a movie. Expected: no Next button, no countdown; on end, returns back as before.

- [ ] **Step 8: Clean up**

`stop-all-simulator-servers` (and offer `stop-metro` if Metro was started separately).

- [ ] **Step 9: Final commit (if any QA-driven fixes were made)**

```bash
git add -A
git commit -m "fix: address next-episode QA findings"
```

---

## Self-Review Notes

- **Spec coverage:** season rollover (Task 1), countdown + manual button (Tasks 5, 6), 90% mark-watched (Task 4), toast-on-failure (Task 5 Step 2), navigation.replace (Task 5 Step 2), Cancel + Play now (Task 6 Step 5), shared resolve helper (Task 2), seriesContext param (Tasks 3, 4). All covered.
- **rnv handler ms variable (Task 4 Step 5):** the react-native-video progress handler converts `currentTime` (seconds) to ms before `setPositionMs`; confirm the exact local name at implementation time and pass it to `maybeMarkWatched`.
- **Toast:** `ToastAndroid` is Android-only; iOS falls back to `Alert`. Both imported from `react-native`.
