# Live Game Search — Design

**Date:** 2026-06-10
**Repos involved:** `BMovieBox` (React Native app), `movie-scraper` (NestJS backend, deployed at `bmoviebox-b.simdan.dev`)

## Problem

The Live tab lists games from `GET /api/sports/games`, which aggregates ESPN scoreboards
for a **hardcoded list of ~20 leagues** (`espn.service.ts` `LEAGUES`). Games outside those
leagues (lower-division soccer, cup competitions, boxing, rugby, anything obscure) never
reach the app. The Live tab's search bar only filters the already-fetched list, so those
games are unfindable even when they are live right now.

## Goal

Typing in the Live tab search bar should find **any game ESPN knows about**, regardless
of league, and let the user open it through the existing stream-selection flow.

Expanding the hardcoded league list was considered and rejected as the primary fix: it is
always incomplete and slows the default scoreboard aggregation. (It can still be done
later for leagues the user cares about; it is out of scope here.)

## Verified upstream APIs (checked 2026-06-10)

- **Cross-sport search:** `https://site.web.api.espn.com/apis/common/v3/search?query=<q>&limit=<n>&mode=prefix`
  Returns `items[]` with `type` (`team` | `league` | `player` | …), and for teams:
  `id`, `sport`, `defaultLeagueSlug`, `displayName`, `logos`.
- **Team nearest event:** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams/{id}`
  Returns `team.nextEvent[]` — the nearest event (today's live/finished game or the next
  upcoming one) with full competition data: competitors, scores, `status.type.state`
  (`pre`/`in`/`post`), date. Verified live with MLB (in-season); returns `[]` when a team
  has no scheduled event (e.g. off-season), which is correct "no result" behavior.
- **League scoreboard (existing):** `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/scoreboard`
  Works for any league slug, not just the hardcoded ones.

## Backend changes (movie-scraper)

### 1. `EspnService.searchGames(query: string): Promise<LiveGame[]>`

1. Call ESPN cross-sport search with the query (`mode=prefix`, limit ~10).
2. Partition results:
   - **Teams** (cap at 5): for each, fetch the team endpoint and map `nextEvent[0]`
     (if present) to the existing `LiveGame` shape. Reuse/extract the existing `toGame`
     mapping logic so cards render identically (state, scores, logos, kickoff).
   - **Leagues** (cap at 2): fetch that league's scoreboard via the existing
     `getScoreboard` with a constructed `SportsLeagueRef` and include its games.
3. Team fetches run with `Promise.allSettled`; failures are dropped, never thrown.
4. Dedup the combined list by event `id`.
5. Cache per normalized query (`sports:espn:search:<q>`) with the same 120 s TTL as
   scoreboards.

### 2. Event-token compatibility for unknown leagues

`encodeEventLink` payload gains `d` (league displayName). `decodeEventLink` currently
returns `null` when the league is not in `LEAGUES` — instead, fall back to constructing
`{ sport: payload.s, league: payload.l, displayName: payload.d ?? payload.l }`.
Old tokens (no `d`, league in `LEAGUES`) keep decoding exactly as before.

This unblocks the downstream flow for searched games: `GET /sports/streams` and
`GET /sports/event/:token` decode the token, and stream matching is by **team names**
against sportsurge/gamestrend (league-agnostic), so no changes are needed there.

### 3. `GET /api/sports/search?q=` (sports.controller.ts)

- 400 if `q` missing or shorter than 3 chars.
- Otherwise returns `LiveGame[]`. Like `/sports/resolve`, upstream/scrape failures are
  caught and logged and return `[]` — never a 5xx the UI would have to special-case.

### 4. Tests

Unit tests alongside the existing specs:
- `searchGames` maps a team `nextEvent` payload to `LiveGame` correctly (matchup,
  scores, state) and skips teams with empty `nextEvent`.
- Dedup by event id when a team result and a league scoreboard overlap.
- `decodeEventLink` round-trips a token for a league **not** in `LEAGUES` and still
  decodes legacy tokens for known leagues.

## Frontend changes (BMovieBox)

### 1. `MovieAPI.searchLiveGames(query: string): Promise<LiveGame[]>`

GET `/sports/search?q=<query>`; returns `[]` on error (matching the API class's
existing error style).

### 2. `LiveTab.tsx`

- Keep the instant client-side filter exactly as is — it remains the fast path for
  games already in the list.
- When `searchQuery.trim().length >= 3`, fire a **debounced (500 ms)** server search
  (same debounce/min-chars pattern as `SearchScreen.tsx`). Guard against stale
  responses with a cancelled flag, as `SearchScreen` does.
- Merge: server results whose `id` is not already in the locally filtered set are
  appended into the same league-grouped rendering (`groupedGames`), so they get the
  normal game cards, state chips, and `handleGamePress` flow with zero new UI
  components. Games whose kickoff is days away still appear, labeled UPCOMING with
  the kickoff date (existing card behavior).
- Loading: small `ActivityIndicator` inside the search container while the server
  search is in flight.
- Empty state: "No games found for…" only shows after the server search has
  completed with no results (not while it is still loading).
- The sport filter (`selectedSport`) applies to server results the same way it does
  to local ones.

## Out of scope

- Adding live games to the global `SearchScreen` (movies/TV search). Can be a
  follow-up; this design keeps search where live content lives.
- Expanding the hardcoded `LEAGUES` list.
- Stream availability for obscure games: search will find games that
  sportsurge/gamestrend do not carry; those degrade through the existing
  resolve → embed → WebView fallback and may end with no streams. Unchanged behavior.

## Risks

- ESPN's search and team endpoints are undocumented/unofficial; shapes were verified
  today but can change. All parsing is defensive (optional chaining, allSettled,
  return `[]` on failure) so breakage degrades to "search finds nothing extra," never
  a crash.
- One search keystroke fans out to up to ~8 ESPN requests (1 search + ≤5 teams +
  ≤2 scoreboards); debounce + min 3 chars + per-query caching keep this bounded.
