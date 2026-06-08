# Next Episode / Autoplay — Design

Date: 2026-06-08
Status: Approved (pending spec review)

## Goal

Let users continue watching a series without returning to the detail screen.
When a next episode exists (within the current season, or the first episode of the
next season at a finale), the player offers a manual **Next** button during
playback and an **autoplay countdown** when the current episode ends. The finished
episode is marked watched once playback passes ~90%.

## Decisions (locked)

- **Season rollover:** After the last episode of a season, "next" = episode 1 of
  the next season. "Next" only disappears on the last episode of the last season.
- **Autoplay:** Countdown overlay on end **and** a manual Next button during playback.
- **Mark watched:** At ~90% playback progress (not only on full `onEnd`).
- **Resolve failure:** Toast "Couldn't load next episode", cancel countdown, stay on
  the end screen. No automatic skip-to-following-episode chaining.
- **Advance mechanism:** `navigation.replace("NativeVideoPlayer", nextParams)` — no
  back-stack buildup, full reuse of existing mount/reconnect logic.
- **Countdown UX:** "Next in 5s" overlay with **Cancel** (stops countdown, stays) and
  **Play now** (advance immediately). Auto-advances if untouched.

## Non-goals (YAGNI)

- No "previous episode" control.
- No skip-to-following-episode chaining on repeated failures.
- No user setting to disable autoplay (can be added later).

## Architecture

### 1. Shared resolve helper (refactor)

Today the resolve dance lives inline in
[SeriesDetailScreen.handlePlayEpisode](../../../src/screens/SeriesDetailScreen.tsx)
(lines ~489–558): `getOriginalLanguage` → `MovieAPI.getResolvedStreams` →
`pickBest` (filtering out magnets) → `preparePlayableStreams` → build
`sourceContext`, `streamProgressKey`, and the display title.

Extract this into a reusable function (new file `src/utils/episodePlayback.ts`):

```ts
resolveEpisodePlayback(
  series: { id: string; url: string; title: string },
  seasonNumber: number,
  episode: Episode,
): Promise<NextEpisodeParams | null>
```

Returns the exact param bundle the player route expects, or `null` when no playable
stream resolves. `SeriesDetailScreen` is refactored to call this helper (behavior
unchanged — the Tier-2 WebView fallback stays in the screen). The player calls the
same helper for the next episode. Single source of truth for the resolve/rank/title
logic.

`NextEpisodeParams` (the resolved bundle):
`{ streams, title, sourceContext, streamProgressKey, originalLanguage }` — matching
the existing `navigation.navigate("NativeVideoPlayer", {...})` call shape.

### 2. Next-episode computation

A pure helper (also in `episodePlayback.ts`):

```ts
getNextEpisode(
  seasons: Season[],
  currentSeason: number,
  currentEpisode: number,
): { season: number; episode: Episode } | null
```

Logic: find the current season; if a higher `episodeNumber` exists in it, return that
episode. Otherwise find the next season (next-higher `seasonNumber`) and return its
first episode. Return `null` if neither exists. Episodes/seasons are matched by
number, not array index, to tolerate gaps/ordering.

### 3. Player route params (extended)

`NativeVideoPlayer` reads `route.params` via a cast (there is no central typed
`ParamList`). Extend the cast with optional series context so the change is
backward-compatible (movies and downloads pass none):

```ts
seriesContext?: {
  seriesId: string;
  seriesUrl: string;
  seriesTitle: string;
  seasons: Season[];        // serializable — fine for route params
  season: number;
  episode: number;
};
```

`SeriesDetailScreen.handlePlayEpisode` populates `seriesContext` when launching an
episode. When absent (movies), all next-episode UI is hidden and behavior is
unchanged.

### 4. Player behavior changes

In [NativeVideoPlayer.tsx](../../../src/screens/NativeVideoPlayer.tsx):

- **Compute next on mount:** `const next = seriesContext ? getNextEpisode(...) : null`.
  Drives whether the Next button and end-of-episode autoplay are shown.
- **Mark watched at ~90%:** In the progress handlers (`handleVlcProgress` /
  `handleRnvProgress`, which already update `positionMs`/`durationMs`), once
  `positionMs / durationMs >= 0.9`, call `markEpisodeWatched(...)` once (guard with a
  ref so it fires a single time per mount). Pulls `markEpisodeWatched` from
  `useUserData()`. Episode identity comes from `seriesContext` +
  the matching `Episode` (need `episodeUrl`, `episodeTitle` — available from the
  `seasons` list).
- **Manual Next button:** Rendered in the transport controls only when `next != null`.
  Tapping it runs the advance flow immediately.
- **End-of-episode countdown:** Replace `onEnd={() => navigation.goBack()}` (both VLC
  line ~850 and rnv line ~877) with a handler: if `next != null`, show the countdown
  overlay (5s, Cancel + Play now); on expiry/Play-now run the advance flow. If
  `next == null`, keep `navigation.goBack()`.
- **Advance flow:**
  1. Show a spinner (reuse existing "getting links" style indicator if present).
  2. `const params = await resolveEpisodePlayback(series, next.season, next.episode)`.
  3. Success → `navigation.replace("NativeVideoPlayer", { ...params, seriesContext: <next> })`.
  4. Failure (`null` or throw) → toast "Couldn't load next episode", cancel countdown,
     remain on end screen.

### Data flow

```
SeriesDetailScreen.handlePlayEpisode
  └─ resolveEpisodePlayback(series, season, episode)  ──► navigate(player, {...params, seriesContext})
                                                              │
NativeVideoPlayer (mount)                                     ▼
  ├─ getNextEpisode(seasons, season, episode) → next
  ├─ onProgress ≥90% → markEpisodeWatched() (once)
  └─ Next button / onEnd countdown
        └─ resolveEpisodePlayback(series, next.season, next.episode)
              ├─ ok   → navigation.replace(player, {...params, seriesContext: next})
              └─ null → toast + stay
```

## Error handling

- `resolveEpisodePlayback` returns `null` on no playable stream and is wrapped in
  try/catch by callers; network/resolve errors → toast, no crash.
- `getNextEpisode` returns `null` defensively for malformed/empty `seasons`.
- 90% mark-watched is ref-guarded so it never double-writes; skipped entirely when
  `durationMs <= 0`.

## Testing

- **Unit (`getNextEpisode`):** mid-season → next episode; season finale → next season
  E1; series finale → `null`; gaps in episode/season numbering; empty seasons.
- **Unit (`resolveEpisodePlayback`):** returns bundle on success; `null` when
  `pickBest`/`preparePlayableStreams` yield nothing; propagates title/streamProgressKey
  format `${seriesUrl}::s${season}e${episode}`.
- **Manual QA (argent):** play a mid-season episode → Next button visible → tap →
  advances and resumes from 0; let an episode reach end → countdown → auto-advance;
  Cancel during countdown → stays; series finale → no Next button, end → back;
  ~90% scrub → episode shows watched on detail screen; force a resolve failure →
  toast, stays. Movie playback → no next-episode UI, unchanged.

## Files touched

| File | Change |
|------|--------|
| `src/utils/episodePlayback.ts` (new) | `getNextEpisode`, `resolveEpisodePlayback`, `NextEpisodeParams` |
| `src/screens/SeriesDetailScreen.tsx` | Use `resolveEpisodePlayback`; pass `seriesContext` |
| `src/screens/NativeVideoPlayer.tsx` | Extend params; next-button + countdown UI; 90% mark-watched; advance flow |
