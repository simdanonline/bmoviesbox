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
