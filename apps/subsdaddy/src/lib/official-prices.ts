/**
 * Official price tables for first-party models, read from the provider's own pricing document.
 *
 * The DeepSeek table gives two bands per token class: off-peak and peak. Its footnote says off-peak rates are
 * half of peak. The parser checks that before it accepts a table, so a misread column cannot pass.
 * The flat price used for estimates is the arithmetic mean of the two bands (owner ruling, 2026-10-26).
 */

export type PriceTriple = { in_per_m: number; out_per_m: number; cache_per_m: number };
export type OfficialTiers = { peak: PriceTriple; off_peak: PriceTriple; peak_hours_utc: string };

export const DEEPSEEK_PRICING_URL = "https://api-docs.deepseek.com/quick_start/pricing/";

/** Peak is 01:00-04:00 and 06:00-10:00 UTC, Monday to Friday: 3 + 4 = 7 hours on 5 of 7 days. */
export const PEAK_HOURS_PER_WEEK = 7 * 5;
export const HOURS_PER_WEEK = 168;

const pair = (text: string, label: RegExp): { off: number; peak: number } | null => {
  const m = label.exec(text);
  return m ? { off: Number(m[1]), peak: Number(m[2]) } : null;
};

/** Positive prices, and off-peak exactly half of peak (within 1%), as the page's own footnote states. */
export function tiersAreSane(t: OfficialTiers): boolean {
  const pairs: Array<[number, number]> = [
    [t.peak.in_per_m, t.off_peak.in_per_m],
    [t.peak.out_per_m, t.off_peak.out_per_m],
    [t.peak.cache_per_m, t.off_peak.cache_per_m],
  ];
  return pairs.every(([p, o]) => Number.isFinite(p) && Number.isFinite(o) && o > 0 && Math.abs(p - 2 * o) <= 0.01 * p);
}

/** The flash column of the DeepSeek table (deepseek-flash, served by DeepSeek-V4.1-Flash-1017). The first price of each row is the flash price. */
export function parseDeepSeekFlash(text: string): OfficialTiers | null {
  const hit = pair(text, /1M INPUT TOKENS \(CACHE HIT\)\s+OFF-PEAK \$([\d.]+)\s+\$[\d.]+\s+PEAK \$([\d.]+)/);
  const miss = pair(text, /1M INPUT TOKENS \(CACHE MISS\)\s+OFF-PEAK \$([\d.]+)\s+\$[\d.]+\s+PEAK \$([\d.]+)/);
  const out = pair(text, /1M OUTPUT TOKENS\s+OFF-PEAK \$([\d.]+)\s+\$[\d.]+\s+PEAK \$([\d.]+)/);
  const hours = /Peak hours are ([^.]+)\./.exec(text);
  if (!hit || !miss || !out || !hours) return null;
  const tiers: OfficialTiers = {
    peak: { in_per_m: miss.peak, out_per_m: out.peak, cache_per_m: hit.peak },
    off_peak: { in_per_m: miss.off, out_per_m: out.off, cache_per_m: hit.off },
    peak_hours_utc: hours[1].trim(),
  };
  return tiersAreSane(tiers) ? tiers : null;
}

/** The flat price used for estimates: the arithmetic mean of peak and off-peak (the owner's ruling). */
export function arithmeticMean(t: OfficialTiers): PriceTriple {
  // rounded to 12 significant digits so that a mean of two stored prices is not stored with float noise
  const mean = (a: number, b: number) => Number(((a + b) / 2).toPrecision(12));
  return {
    in_per_m: mean(t.peak.in_per_m, t.off_peak.in_per_m),
    out_per_m: mean(t.peak.out_per_m, t.off_peak.out_per_m),
    cache_per_m: mean(t.peak.cache_per_m, t.off_peak.cache_per_m),
  };
}

/** The same two bands weighted by the hours each one covers. A sensitivity check only; not used for estimates. */
export function hourWeighted(t: OfficialTiers): PriceTriple {
  const w = PEAK_HOURS_PER_WEEK / HOURS_PER_WEEK;
  const f = (p: number, o: number) => p * w + o * (1 - w);
  return {
    in_per_m: f(t.peak.in_per_m, t.off_peak.in_per_m),
    out_per_m: f(t.peak.out_per_m, t.off_peak.out_per_m),
    cache_per_m: f(t.peak.cache_per_m, t.off_peak.cache_per_m),
  };
}
