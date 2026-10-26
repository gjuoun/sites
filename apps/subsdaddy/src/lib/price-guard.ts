// The sanity rule for an OpenRouter listing: refused listings never replace the last verified snapshot.

/** The sanity rule. Returns the reason the listing is refused, or null when every price is usable. */
export function sanity(p: { in_per_m: number | null; out_per_m: number | null; cache_per_m: number | null }): string | null {
  const { in_per_m: i, out_per_m: o, cache_per_m: c } = p;
  if (i === null || o === null || c === null) return "a price is missing";
  if (![i, o, c].every((v) => Number.isFinite(v) && v > 0)) return "a price is zero or negative";
  if (o < i) return "listing shows completion < prompt (" + o + " < " + i + " per M)";
  if (c > i) return "listing shows cache read > prompt (" + c + " > " + i + " per M)";
  return null;
}
