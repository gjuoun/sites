/**
 * QwenCloud peak and off-peak prices. The official pricing page gives a peak band (08:00-22:00 Beijing)
 * and an off-peak band (22:00-08:00 Beijing). The average price is hour-weighted over the day:
 *
 *   avg = (peak × 14h + off-peak × 10h) / 24h
 *
 * It is never a flat half of the peak price: an off-peak band that is 50% of peak averages to 79.2% of
 * peak, because it covers only 10 of the 24 hours. A model with no published tier has no average here;
 * the caller keeps its list price.
 */

export type TierPrice = { in_per_m: number; out_per_m: number; cache_per_m: number };

export const PEAK_HOURS = 14;
export const OFFPEAK_HOURS = 10;

export type PeakOffPeak = { peak: TierPrice; offpeak: TierPrice };

/** Hour-weighted average of the two bands, per token class. */
export function averagePrice(t: PeakOffPeak): TierPrice {
  const w = (p: number, o: number) => (p * PEAK_HOURS + o * OFFPEAK_HOURS) / (PEAK_HOURS + OFFPEAK_HOURS);
  return {
    in_per_m: w(t.peak.in_per_m, t.offpeak.in_per_m),
    out_per_m: w(t.peak.out_per_m, t.offpeak.out_per_m),
    cache_per_m: w(t.peak.cache_per_m, t.offpeak.cache_per_m),
  };
}

/** Compact decimal for a price per million tokens: 0.2375 stays 0.2375, never rounded to 0.24. */
export function fmtPrice(v: number): string {
  return String(Number(v.toPrecision(4)));
}

/** The three-price sentence used in every basis that relies on a tier average. */
export function tierBasis(model: string, t: PeakOffPeak): string {
  const a = averagePrice(t);
  const trio = (p: TierPrice) => "$" + fmtPrice(p.in_per_m) + " / $" + fmtPrice(p.out_per_m) + " / $" + fmtPrice(p.cache_per_m);
  return model + ": peak " + trio(t.peak) + " × " + PEAK_HOURS + "h, off-peak " + trio(t.offpeak) + " × " + OFFPEAK_HOURS + "h → avg " + trio(a) + " per M (in / out / cache)";
}
