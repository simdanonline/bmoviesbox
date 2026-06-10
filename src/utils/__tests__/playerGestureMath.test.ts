import { gestureAxisForX, applyVerticalDelta } from "../playerGestureMath";

describe("gestureAxisForX", () => {
  it("returns brightness on the left half", () => {
    expect(gestureAxisForX(10, 100)).toBe("brightness");
  });
  it("returns volume on the right half", () => {
    expect(gestureAxisForX(60, 100)).toBe("volume");
  });
  it("treats exact midpoint as volume", () => {
    expect(gestureAxisForX(50, 100)).toBe("volume");
  });
  it("falls back to brightness when width is unknown", () => {
    expect(gestureAxisForX(10, 0)).toBe("brightness");
  });
});

describe("applyVerticalDelta", () => {
  it("increases value on upward drag (negative translationY)", () => {
    expect(applyVerticalDelta(0.5, -100, 200)).toBeCloseTo(1.0);
  });
  it("decreases value on downward drag", () => {
    expect(applyVerticalDelta(0.5, 100, 200)).toBeCloseTo(0.0);
  });
  it("clamps to [0,1]", () => {
    expect(applyVerticalDelta(0.5, -1000, 200)).toBe(1);
    expect(applyVerticalDelta(0.5, 1000, 200)).toBe(0);
  });
  it("returns the start value when area height is non-positive", () => {
    expect(applyVerticalDelta(0.3, -50, 0)).toBe(0.3);
  });
});
