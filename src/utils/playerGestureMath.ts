export type GestureAxis = "brightness" | "volume";

/** Left half of the surface controls brightness, right half controls volume.
 *  Width 0 (not yet measured) defaults to brightness. */
export function gestureAxisForX(x: number, width: number): GestureAxis {
  if (width <= 0) return "brightness";
  return x < width / 2 ? "brightness" : "volume";
}

/** Map a vertical drag to a new 0..1 level. Dragging up (negative
 *  translationY) raises the level; a full-height drag spans the full range.
 *  Non-positive areaHeight (not yet measured) leaves the value unchanged. */
export function applyVerticalDelta(
  start: number,
  translationY: number,
  areaHeight: number,
): number {
  if (areaHeight <= 0) return start;
  const next = start - translationY / areaHeight;
  return Math.max(0, Math.min(1, next));
}
