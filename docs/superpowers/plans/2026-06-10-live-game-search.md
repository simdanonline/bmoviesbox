# Live Game Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Typing in the Live tab search bar finds any game ESPN knows about (any league), not just the ~20 hardcoded leagues.

**Architecture:** New backend endpoint `GET /api/sports/search?q=` in movie-scraper uses ESPN's cross-sport search to find teams/leagues, resolves each to today's scoreboard game or the team's `nextEvent`, and returns standard `LiveGame[]`. Event tokens gain a league displayName so games from unlisted leagues survive the decode → stream-resolution flow. The RN app fires a debounced server search alongside the existing instant local filter and merges results into the existing league-grouped cards.

**Tech Stack:** NestJS + axios + jest (movie-scraper), React Native/Expo + axios (BMovieBox).

**Spec:** `docs/superpowers/specs/2026-06-10-live-game-search-design.md`

**Repos:**
- Backend: `/Users/similoluwa/Documents/codes/vibe-coding/movie-scraper` (Tasks 1–5)
- Frontend: `/Users/similoluwa/Documents/codes/vibe-coding/BMovieBox` (Tasks 6–7)

⚠️ **BMovieBox repo rule:** never run `git stash`, `git checkout`, or `git restore` in BMovieBox (repo has dangling stashes; see project memory). Branch with `git switch -c <branch>` only. The pre-existing `tsc` `customConditions` error in BMovieBox is expected — do not try to fix it.

**Verified ESPN API facts (2026-06-10)** — referenced by tasks below:
- Search: `https://site.web.api.espn.com/apis/common/v3/search?query=<q>&limit=10&mode=prefix` → `{ items: [...] }`. Team items: `{ type: 'team', id, displayName, sport, defaultLeagueSlug, ... }`. League items: `{ type: 'league', displayName, sport, league, defaultLeagueSlug, ... }` (slug like `eng.2`).
- Team detail: `GET {ESPN_BASE}/{sport}/{league}/teams/{id}` → `data.team.nextEvent[0]` (may be `[]` off-season). The event has **no top-level `status`** — it lives at `competitions[0].status`. Competitor `score` is an **object** `{ value, displayValue }` (scoreboard events use a plain string). Competitor team logos are under `team.logos[0].href` (already handled by `toGame`).
- Scoreboard works for any league slug: `GET {ESPN_BASE}/{sport}/{league}/scoreboard`.

---

### Task 1: Event-token compatibility for unknown leagues (movie-scraper)

`decodeEventLink` currently returns `null` for leagues not in `LEAGUES`, which 400s the stream lookup for any searched game from an unlisted league. Carry the displayName in the token and fall back to constructing the ref.

**Files:**
- Create: `src/scraper/sports/espn.service.spec.ts`
- Modify: `src/scraper/sports/espn.service.ts` (`encodeEventLink` ~line 186, `decodeEventLink` ~line 202)

- [ ] **Step 1: Write the failing tests**

Create `src/scraper/sports/espn.service.spec.ts`:

```ts
import { EspnService } from './espn.service';
import { CacheService } from '../../cache/cache.service';

const makeService = () => new EspnService(new CacheService());

describe('EspnService event tokens', () => {
  it('round-trips a token for a league not in the hardcoded list', () => {
    const service = makeService();
    const ref = {
      sport: 'soccer',
      league: 'eng.2',
      displayName: 'English League Championship',
    };
    const token = service.encodeEventLink('12345', ref, 'Hull City', 'Millwall');
    const decoded = service.decodeEventLink(token);

    expect(decoded).not.toBeNull();
    expect(decoded!.eventId).toBe('12345');
    expect(decoded!.ref).toEqual(ref);
    expect(decoded!.home).toBe('Hull City');
    expect(decoded!.away).toBe('Millwall');
  });

  it('decodes legacy tokens (no displayName field) for known leagues', () => {
    const service = makeService();
    // Legacy payload shape: { e, s, l, h, a } — no `d`
    const legacy = Buffer.from(
      JSON.stringify({ e: '99', s: 'basketball', l: 'nba', h: 'Lakers', a: 'Celtics' }),
      'utf8',
    ).toString('base64url');

    const decoded = service.decodeEventLink(legacy);
    expect(decoded).not.toBeNull();
    expect(decoded!.ref.displayName).toBe('NBA');
    expect(decoded!.eventId).toBe('99');
  });

  it('falls back to the league slug as displayName for legacy unknown-league tokens', () => {
    const service = makeService();
    const legacy = Buffer.from(
      JSON.stringify({ e: '7', s: 'soccer', l: 'ned.1', h: 'Ajax', a: 'PSV' }),
      'utf8',
    ).toString('base64url');

    const decoded = service.decodeEventLink(legacy);
    expect(decoded).not.toBeNull();
    expect(decoded!.ref).toEqual({ sport: 'soccer', league: 'ned.1', displayName: 'ned.1' });
  });

  it('returns null for malformed tokens', () => {
    const service = makeService();
    expect(service.decodeEventLink('not-base64-json')).toBeNull();
    const missingLeague = Buffer.from(JSON.stringify({ e: '1', h: 'A', a: 'B' }), 'utf8')
      .toString('base64url');
    expect(service.decodeEventLink(missingLeague)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (in `/Users/similoluwa/Documents/codes/vibe-coding/movie-scraper`): `npm test -- espn.service`
Expected: FAIL — unknown-league round-trip gets `null` (today's `decodeEventLink` requires `LEAGUES` membership); the legacy-unknown-league test also fails.

- [ ] **Step 3: Implement**

In `src/scraper/sports/espn.service.ts`, add `d` to the encode payload:

```ts
  encodeEventLink(
    eventId: string,
    ref: SportsLeagueRef,
    home: string,
    away: string,
  ): string {
    const payload = {
      e: eventId,
      s: ref.sport,
      l: ref.league,
      d: ref.displayName,
      h: home,
      a: away,
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }
```

Replace the body of `decodeEventLink` (keep the signature):

```ts
  decodeEventLink(token: string): {
    eventId: string;
    ref: SportsLeagueRef;
    home: string;
    away: string;
  } | null {
    try {
      const json = Buffer.from(token, 'base64url').toString('utf8');
      const payload = JSON.parse(json);
      if (!payload.s || !payload.l || !payload.e) return null;
      // Known leagues keep their canonical ref; anything else (a game found
      // via search) gets a ref built from the token so the streams flow,
      // which matches by team names, still works.
      const ref: SportsLeagueRef = LEAGUES.find(
        (l) => l.sport === payload.s && l.league === payload.l,
      ) ?? {
        sport: String(payload.s),
        league: String(payload.l),
        displayName: String(payload.d ?? payload.l),
      };
      return {
        eventId: String(payload.e),
        ref,
        home: String(payload.h ?? ''),
        away: String(payload.a ?? ''),
      };
    } catch {
      return null;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- espn.service`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full backend test suite (regression)**

Run: `npm test`
Expected: PASS — existing `live.*` specs unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/scraper/sports/espn.service.ts src/scraper/sports/espn.service.spec.ts
git commit -m "feat(sports): decode event tokens for leagues outside the hardcoded list"
```

---

### Task 2: `EspnService.searchGames` — team path (movie-scraper)

Core search: ESPN cross-sport search → team items → today's scoreboard game for that team, falling back to the team's `nextEvent`.

**Files:**
- Modify: `src/scraper/sports/espn.service.ts`
- Modify: `src/scraper/sports/espn.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/scraper/sports/espn.service.spec.ts`:

```ts
describe('EspnService.searchGames', () => {
  const teamItem = {
    type: 'team',
    id: '306',
    displayName: 'Hull City',
    sport: 'soccer',
    defaultLeagueSlug: 'eng.2',
  };

  // Shape verified against the live team endpoint (2026-06-10): status sits on
  // competitions[0], scores are { value, displayValue } objects.
  const nextEventFixture = {
    id: '401700001',
    name: 'Hull City at Millwall',
    date: '2026-06-11T19:45Z',
    competitions: [
      {
        status: {
          type: {
            state: 'pre',
            shortDetail: '6/11 - 8:45 PM',
            detail: 'Thu, June 11th at 8:45 PM',
            description: 'Scheduled',
          },
        },
        competitors: [
          {
            homeAway: 'home',
            team: { displayName: 'Millwall', logos: [{ href: 'https://a/mil.png' }] },
            score: { value: 0, displayValue: '0' },
          },
          {
            homeAway: 'away',
            team: { displayName: 'Hull City', logos: [{ href: 'https://a/hull.png' }] },
            score: { value: 0, displayValue: '0' },
          },
        ],
      },
    ],
  };

  const scoreboardGame = (overrides: Partial<import('./types').LiveGame> = {}) => ({
    id: 'g1',
    sport: 'soccer',
    league: 'English League Championship',
    leagueLogo: '',
    homeTeam: 'Hull City',
    awayTeam: 'Leicester City',
    homeLogo: '',
    awayLogo: '',
    homeScore: '1',
    awayScore: '0',
    status: "45'",
    statusDetail: 'First Half',
    state: 'in' as const,
    datetime: '2026-06-10T19:00Z',
    link: 'tok',
    ...overrides,
  });

  it('returns the scoreboard game when the team is playing today', async () => {
    const service = makeService();
    jest.spyOn(service as any, 'fetchSearchItems').mockResolvedValue([teamItem]);
    const scoreboardSpy = jest
      .spyOn(service, 'getScoreboard')
      .mockResolvedValue([scoreboardGame()]);
    const nextEventSpy = jest.spyOn(service as any, 'fetchTeamNextEvent');

    const games = await service.searchGames('hull');

    expect(games).toHaveLength(1);
    expect(games[0].homeTeam).toBe('Hull City');
    expect(scoreboardSpy).toHaveBeenCalledWith(
      expect.objectContaining({ sport: 'soccer', league: 'eng.2' }),
    );
    expect(nextEventSpy).not.toHaveBeenCalled();
  });

  it('falls back to nextEvent when the team is not on today’s scoreboard', async () => {
    const service = makeService();
    jest.spyOn(service as any, 'fetchSearchItems').mockResolvedValue([teamItem]);
    jest.spyOn(service, 'getScoreboard').mockResolvedValue([]);
    jest
      .spyOn(service as any, 'fetchTeamNextEvent')
      .mockResolvedValue(nextEventFixture);

    const games = await service.searchGames('hull');

    expect(games).toHaveLength(1);
    const g = games[0];
    expect(g.id).toBe('401700001');
    expect(g.homeTeam).toBe('Millwall');
    expect(g.awayTeam).toBe('Hull City');
    expect(g.state).toBe('pre');
    // Object scores must be normalized to displayValue strings
    expect(g.homeScore).toBe('0');
    expect(g.awayScore).toBe('0');
    // The link must round-trip through decodeEventLink (unlisted league)
    const decoded = service.decodeEventLink(g.link);
    expect(decoded).not.toBeNull();
    expect(decoded!.ref.league).toBe('eng.2');
  });

  it('skips teams with no nextEvent and survives upstream search failure', async () => {
    const service = makeService();
    jest.spyOn(service as any, 'fetchSearchItems').mockResolvedValue([teamItem]);
    jest.spyOn(service, 'getScoreboard').mockResolvedValue([]);
    jest.spyOn(service as any, 'fetchTeamNextEvent').mockResolvedValue(null);
    expect(await service.searchGames('hull')).toEqual([]);

    const failing = makeService();
    jest
      .spyOn(failing as any, 'fetchSearchItems')
      .mockRejectedValue(new Error('espn down'));
    expect(await failing.searchGames('hull')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- espn.service`
Expected: FAIL — `searchGames` / `fetchSearchItems` / `fetchTeamNextEvent` do not exist.

- [ ] **Step 3: Implement**

In `src/scraper/sports/espn.service.ts`:

3a. Normalize object scores inside `toGame` — replace the two score lines:

```ts
    const homeScore = isMatchup ? this.normalizeScore(home.score) : null;
    const awayScore = isMatchup ? this.normalizeScore(away.score) : null;
```

and add the helper method:

```ts
  // Scoreboard events carry scores as strings; team `nextEvent` payloads carry
  // { value, displayValue } objects. Normalize both to the string the UI shows.
  private normalizeScore(score: unknown): string | null {
    if (score == null) return null;
    if (typeof score === 'object') {
      return (score as { displayValue?: string }).displayValue ?? null;
    }
    return String(score);
  }
```

3b. Add the search methods to `EspnService`:

```ts
  private readonly SEARCH_URL =
    'https://site.web.api.espn.com/apis/common/v3/search';

  /**
   * Cross-league game search. Finds teams/leagues via ESPN's site search,
   * then resolves each team to today's scoreboard game in its league, or its
   * nearest event (`nextEvent`) when it isn't playing today. Never throws —
   * upstream failures degrade to "no extra results".
   */
  async searchGames(query: string): Promise<LiveGame[]> {
    const q = query.trim().toLowerCase();
    const cacheKey = `sports:espn:search:${q}`;
    const cached = this.cacheService.get<LiveGame[]>(cacheKey);
    if (cached) return cached;

    let items: any[];
    try {
      items = await this.fetchSearchItems(q);
    } catch (error) {
      this.logger.warn(
        `ESPN search failed for "${q}": ${(error as Error).message}`,
      );
      return [];
    }

    const teamItems = items
      .filter((i) => i?.type === 'team' && i.sport && i.defaultLeagueSlug && i.id)
      .slice(0, 5);

    const results = await Promise.allSettled(
      teamItems.map((item) => this.gamesForTeam(item)),
    );

    const games: LiveGame[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      for (const g of r.value) {
        if (seen.has(g.id)) continue;
        seen.add(g.id);
        games.push(g);
      }
    }

    this.sortGames(games);
    this.cacheService.set(cacheKey, games, this.TTL);
    return games;
  }

  private async fetchSearchItems(query: string): Promise<any[]> {
    const { data } = await axios.get(this.SEARCH_URL, {
      params: { query, limit: 10, mode: 'prefix' },
      timeout: 8000,
    });
    return data?.items ?? [];
  }

  /**
   * Today's scoreboard game for the team if it's playing, else its nearest
   * event. `getScoreboard` is cached, so repeat hits are free.
   */
  private async gamesForTeam(item: any): Promise<LiveGame[]> {
    const slug = String(item.defaultLeagueSlug);
    const ref: SportsLeagueRef = LEAGUES.find(
      (l) => l.sport === item.sport && l.league === slug,
    ) ?? { sport: String(item.sport), league: slug, displayName: slug };

    const board = await this.getScoreboard(ref);
    const name = String(item.displayName ?? '').toLowerCase();
    const todays = board.filter(
      (g) =>
        g.homeTeam.toLowerCase().includes(name) ||
        g.awayTeam.toLowerCase().includes(name),
    );
    if (todays.length > 0) return todays;

    const event = await this.fetchTeamNextEvent(ref, String(item.id));
    if (!event) return [];
    // nextEvent keeps status on the competition, not the event.
    const normalized = {
      ...event,
      status: event.status ?? event.competitions?.[0]?.status,
    };
    return [this.toGame(normalized, ref, ref.displayName, '')];
  }

  private async fetchTeamNextEvent(
    ref: SportsLeagueRef,
    teamId: string,
  ): Promise<any | null> {
    try {
      const { data } = await this.client.get(
        `/${ref.sport}/${ref.league}/teams/${teamId}`,
      );
      return data?.team?.nextEvent?.[0] ?? null;
    } catch (error) {
      this.logger.warn(
        `ESPN team fetch failed ${ref.sport}/${ref.league}/${teamId}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private sortGames(games: LiveGame[]): void {
    const stateOrder = { in: 0, pre: 1, post: 2, unknown: 3 };
    games.sort((a, b) => {
      const sa = stateOrder[a.state] ?? 3;
      const sb = stateOrder[b.state] ?? 3;
      if (sa !== sb) return sa - sb;
      return a.datetime.localeCompare(b.datetime);
    });
  }
```

3c. DRY: replace the inline sort in `getAllScoreboards` (the `games.sort((a, b) => {...})` block, ~lines 84–90) with `this.sortGames(games);`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- espn.service`
Expected: PASS (Task 1's 4 tests + these 3).

- [ ] **Step 5: Commit**

```bash
git add src/scraper/sports/espn.service.ts src/scraper/sports/espn.service.spec.ts
git commit -m "feat(sports): cross-league game search via ESPN site search (team path)"
```

---

### Task 3: `searchGames` — league items + cross-source dedup (movie-scraper)

Searching "championship" should surface league matches (e.g. `eng.2`) directly, deduped against team-derived games.

**Files:**
- Modify: `src/scraper/sports/espn.service.ts` (inside `searchGames`)
- Modify: `src/scraper/sports/espn.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append inside the `describe('EspnService.searchGames', ...)` block:

```ts
  it('includes scoreboard games for league-type search matches', async () => {
    const service = makeService();
    jest.spyOn(service as any, 'fetchSearchItems').mockResolvedValue([
      {
        type: 'league',
        displayName: 'English League Championship',
        sport: 'soccer',
        league: 'eng.2',
        defaultLeagueSlug: 'eng.2',
      },
    ]);
    const scoreboardSpy = jest
      .spyOn(service, 'getScoreboard')
      .mockResolvedValue([scoreboardGame()]);

    const games = await service.searchGames('championship');

    expect(games).toHaveLength(1);
    expect(scoreboardSpy).toHaveBeenCalledWith({
      sport: 'soccer',
      league: 'eng.2',
      displayName: 'English League Championship',
    });
  });

  it('dedups by event id when a league match and a team match overlap', async () => {
    const service = makeService();
    jest.spyOn(service as any, 'fetchSearchItems').mockResolvedValue([
      {
        type: 'league',
        displayName: 'English League Championship',
        sport: 'soccer',
        league: 'eng.2',
        defaultLeagueSlug: 'eng.2',
      },
      teamItem,
    ]);
    jest.spyOn(service, 'getScoreboard').mockResolvedValue([scoreboardGame()]);

    const games = await service.searchGames('hull');
    expect(games).toHaveLength(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- espn.service`
Expected: FAIL — league test returns `[]` (league items ignored); dedup test returns 1 already only if league items ignored, so it may pass — the league-inclusion test is the genuine red.

- [ ] **Step 3: Implement**

In `searchGames`, after `teamItems` is computed, add:

```ts
    const leagueItems = items
      .filter((i) => i?.type === 'league' && i.sport && (i.league ?? i.defaultLeagueSlug))
      .slice(0, 2);
```

and change the fan-out to include league scoreboards:

```ts
    const results = await Promise.allSettled([
      ...leagueItems.map((item) =>
        this.getScoreboard({
          sport: String(item.sport),
          league: String(item.league ?? item.defaultLeagueSlug),
          displayName: String(item.displayName ?? item.league),
        }),
      ),
      ...teamItems.map((item) => this.gamesForTeam(item)),
    ]);
```

(The existing dedup-by-`seen` loop already handles the overlap.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- espn.service`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/scraper/sports/espn.service.ts src/scraper/sports/espn.service.spec.ts
git commit -m "feat(sports): include league matches in game search with cross-source dedup"
```

---

### Task 4: `GET /api/sports/search` endpoint (movie-scraper)

**Files:**
- Modify: `src/scraper/sports/sports.controller.ts`
- Create: `src/scraper/sports/sports.controller.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/scraper/sports/sports.controller.spec.ts`:

```ts
import { HttpException } from '@nestjs/common';
import { SportsController } from './sports.controller';

describe('SportsController /search', () => {
  const makeController = (espn: Partial<Record<string, jest.Mock>>) =>
    new SportsController(espn as any, {} as any, {} as any);

  it('rejects missing or too-short queries with 400', async () => {
    const controller = makeController({ searchGames: jest.fn() });
    await expect(controller.searchGames(undefined)).rejects.toThrow(HttpException);
    await expect(controller.searchGames('ab')).rejects.toThrow(HttpException);
  });

  it('returns games from the service', async () => {
    const games = [{ id: '1' }];
    const controller = makeController({
      searchGames: jest.fn().mockResolvedValue(games),
    });
    await expect(controller.searchGames('hull')).resolves.toEqual(games);
  });

  it('returns [] when the service throws (never 5xx)', async () => {
    const controller = makeController({
      searchGames: jest.fn().mockRejectedValue(new Error('boom')),
    });
    await expect(controller.searchGames('hull')).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- sports.controller`
Expected: FAIL — `controller.searchGames` does not exist.

- [ ] **Step 3: Implement**

In `src/scraper/sports/sports.controller.ts`, add after the `getGames` route:

```ts
  /**
   * Cross-league game search. Mirrors /resolve's contract: upstream failures
   * return an empty list instead of 5xx so the client degrades gracefully.
   */
  @Get('search')
  async searchGames(@Query('q') q?: string): Promise<LiveGame[]> {
    if (!q || q.trim().length < 3) {
      throw new HttpException(
        'q query parameter must be at least 3 characters',
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await this.espn.searchGames(q);
    } catch (error) {
      this.logger.warn(
        `searchGames failed for "${q}": ${(error as Error).message}`,
      );
      return [];
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- sports.controller`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + lint**

Run: `npm test && npm run lint`
Expected: all tests pass; lint clean (lint auto-fixes — re-stage if it rewrites files).

- [ ] **Step 6: Commit**

```bash
git add src/scraper/sports/sports.controller.ts src/scraper/sports/sports.controller.spec.ts
git commit -m "feat(sports): GET /api/sports/search endpoint"
```

---

### Task 5: Backend live smoke test (movie-scraper)

Verify against real ESPN before touching the app.

- [ ] **Step 1: Start the backend**

Run: `npm run start:dev` (leave running in background)
Expected: Nest logs `SportsController {/api/sports}` routes including `/api/sports/search`.

- [ ] **Step 2: Smoke-test the endpoint**

```bash
curl -s 'http://localhost:3000/api/sports/search?q=yankees' | python3 -m json.tool | head -40
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/sports/search?q=ab'
```

Expected: first returns a JSON array containing a Yankees game (`homeTeam`/`awayTeam`, `state`, `link` populated); second prints `400`. Also try a team from an unlisted league (e.g. `q=hull+city`) and confirm a game or `[]` (off-season) — not an error.

- [ ] **Step 3: Verify the streams flow accepts a searched game's token**

Take the `link` value from a search result and:

```bash
curl -s "http://localhost:3000/api/sports/streams?link=<LINK>" | head -c 400
```

Expected: HTTP 200 with a JSON array (possibly empty) — NOT a 400 "Invalid event token".

- [ ] **Step 4: Stop the dev server.** No commit (no code changes).

---

### Task 6: `MovieAPI.searchLiveGames` (BMovieBox)

**Files:**
- Modify: `src/services/MovieAPI.ts` (after `getLiveGames`, ~line 447)

- [ ] **Step 1: Implement**

Add after `getLiveGames`:

```ts
  // Cross-league game search — backend returns [] on upstream failure, and we
  // also swallow transport errors: search extras are best-effort.
  async searchLiveGames(query: string): Promise<LiveGame[]> {
    try {
      const response = await this.apiClient.get<LiveGame[]>("/sports/search", {
        params: { q: query },
      });
      return response.data ?? [];
    } catch {
      return [];
    }
  }
```

- [ ] **Step 2: Type-check the file compiles within the app's known constraints**

Run: `npx tsc --noEmit 2>&1 | grep -v customConditions | grep MovieAPI || echo "MovieAPI clean"`
Expected: `MovieAPI clean` (the `customConditions` error is pre-existing and expected).

- [ ] **Step 3: Commit**

```bash
git add src/services/MovieAPI.ts
git commit -m "feat: MovieAPI.searchLiveGames for cross-league game search"
```

---

### Task 7: LiveTab server-search integration (BMovieBox)

Debounced server search merged into the existing league-grouped list. Local instant filter stays untouched.

**Files:**
- Modify: `src/screens/LiveTab.tsx`

- [ ] **Step 1: Add state and the debounced search effect**

Next to the existing state (after `searchFocused`, ~line 94):

```ts
  const [serverResults, setServerResults] = useState<LiveGame[]>([]);
  const [serverLoading, setServerLoading] = useState(false);
```

After the `fetchGames` mount effect (~line 99), add (same debounce/cancel pattern as `SearchScreen.tsx:34-75`):

```ts
  // Server search: the local filter only sees today's fetched games from the
  // hardcoded leagues; this finds anything ESPN knows about.
  useEffect(() => {
    let cancelled = false;
    const q = searchQuery.trim();
    if (q.length < 3) {
      setServerResults([]);
      setServerLoading(false);
      return;
    }
    setServerLoading(true);
    const timer = setTimeout(async () => {
      const results = await MovieAPI.searchLiveGames(q);
      if (cancelled) return;
      setServerResults(results);
      setServerLoading(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);
```

- [ ] **Step 2: Merge server results into the rendered list**

Directly after the existing `filteredGames` computation (~line 271), add:

```ts
  // Merge server-search extras (cross-league results not already shown).
  const localIds = new Set(filteredGames.map((g) => g.id));
  const serverExtras = serverResults.filter(
    (g) => !localIds.has(g.id) && (!selectedSport || g.sport === selectedSport),
  );
  const combinedGames = [...filteredGames, ...serverExtras];
```

Then switch the downstream consumers from `filteredGames` to `combinedGames`:
- `groupedGames` reduce source (~line 335): `combinedGames.reduce(...)`
- header game count (~lines 447-448): `combinedGames.length`
- `noSearchResults` (~line 415): `searchQuery && combinedGames.length === 0 && !serverLoading`
- the `filteredGames.length === 0` render branch (~line 545): `combinedGames.length === 0`

- [ ] **Step 3: Search-bar spinner and searching state**

In the search container, between the `TextInput` and the clear button (~line 490):

```tsx
        {serverLoading ? (
          <ActivityIndicator
            size="small"
            color="#e74c3c"
            style={{ marginRight: 4 }}
          />
        ) : null}
```

Replace the `noSearchResults` render branch condition so an in-flight search shows progress instead of a premature "No games found": change `) : noSearchResults ? (` (~line 525) to:

```tsx
      ) : searchQuery && combinedGames.length === 0 && serverLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#e74c3c" />
          <Text style={styles.loadingText}>Searching all leagues...</Text>
        </View>
      ) : noSearchResults ? (
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v customConditions | grep LiveTab || echo "LiveTab clean"`
Expected: `LiveTab clean`.

- [ ] **Step 5: Commit**

```bash
git add src/screens/LiveTab.tsx
git commit -m "feat: cross-league server search in Live tab"
```

---

### Task 8: End-to-end manual QA (BMovieBox + simulator)

Visible-UI change → verify in the running app. Use the Argent workflow (read `argent-react-native-app-workflow` + `argent-device-interact` skills first; `list-devices` → prefer a booted device). Point the app at the local backend if it isn't deployed yet (`MovieAPI` base URL), or deploy movie-scraper first.

- [ ] **Step 1:** Launch the app, open the Live tab (note: on phone the tab only shows when `isTvApp` is enabled in-app).
- [ ] **Step 2:** Type a team name known to be on the default list (e.g. an NBA team). Expected: instant local results, then unchanged after the debounce (dedup — no duplicate cards).
- [ ] **Step 3:** Type a team/league NOT in the hardcoded leagues (e.g. "Hull City" or "Sunderland"). Expected: spinner in the search bar, then the game appears as a normal card (league badge, UPCOMING/LIVE/FINAL chip). Off-season teams may legitimately return nothing — pick something in season (check what's live on espn.com first).
- [ ] **Step 4:** Tap the found game. Expected: StreamSelection opens and loads (streams may be empty for obscure games — the screen must not error).
- [ ] **Step 5:** Type gibberish ("zzzzqqq"). Expected: spinner, then "No games found" — only after the search completes.
- [ ] **Step 6:** Select a sport first, then search for a team of a different sport. Expected: that team's game does NOT appear (sport filter applies to server results).
- [ ] **Step 7:** Report results; fix anything broken before declaring done (superpowers:verification-before-completion).

---

## Deployment note

The app talks to the deployed backend (`bmoviebox-b.simdan.dev`). Frontend search returns `[]` (silently, by design) until the movie-scraper changes are deployed there. Deploy backend before shipping an app build with Task 7.
