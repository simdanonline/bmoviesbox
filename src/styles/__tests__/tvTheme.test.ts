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
