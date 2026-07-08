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
