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
