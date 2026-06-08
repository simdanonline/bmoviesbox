import { getNextEpisode } from "../episodePlayback";
import type { Season } from "../../services/MovieAPI";
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
