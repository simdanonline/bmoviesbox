// Pure helper: builds the metadata-pill strings for a TV detail hero.
export function buildMetaPills(input: {
  releaseYear?: string | null;
  duration?: string | null;
  rating?: string | null;
  genres?: string[];
}): string[] {
  const pills: string[] = [];
  const clean = (v?: string | null) =>
    v && v.trim() && v.trim().toLowerCase() !== "n/a" ? v.trim() : null;

  const year = clean(input.releaseYear);
  const duration = clean(input.duration);
  const rating = clean(input.rating);
  if (year) pills.push(year);
  if (duration) pills.push(duration);
  if (rating) pills.push(`★ ${rating}`);
  // Filter invalid genres first, then take up to 3 — so a leading "N/A" can't
  // crowd out a valid genre. Push the cleaned (trimmed) value.
  let genreCount = 0;
  for (const g of input.genres ?? []) {
    const c = clean(g);
    if (c) {
      pills.push(c);
      if (++genreCount === 3) break;
    }
  }
  return pills;
}
