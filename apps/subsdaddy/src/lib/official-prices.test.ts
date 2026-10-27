import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hourWeighted, parseDeepSeekFlash, tiersAreSane, DEEPSEEK_PRICING_URL, PEAK_HOURS_PER_WEEK, HOURS_PER_WEEK, type OfficialTiers } from "./official-prices";
import { reconcile, sanity } from "./price-guard";
import { modelsFileSchema } from "../data/schema";

const APP_ROOT = join(import.meta.dir, "..", "..");
const fixture = readFileSync(join(APP_ROOT, "fixtures", "deepseek-pricing.txt"), "utf8");
const parsed = parseDeepSeekFlash(fixture)!;
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(APP_ROOT, "data", "models.json"), "utf8")));

describe("DeepSeek official table: the flash column", () => {
  test("the parser reads the flash column: cache hit, cache miss and output, both bands", () => {
    expect(parsed.off_peak).toEqual({ in_per_m: 0.15, out_per_m: 0.6, cache_per_m: 0.003 });
    expect(parsed.peak).toEqual({ in_per_m: 0.3, out_per_m: 1.2, cache_per_m: 0.006 });
  });

  test("the peak hours are the page's own words: UTC, Monday to Friday, excluding Chinese public holidays", () => {
    expect(parsed.peak_hours_utc).toContain("01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday");
    expect(parsed.peak_hours_utc).toContain("excluding Chinese public holidays");
  });

  test("a table whose off-peak is not half of peak is not read", () => {
    expect(tiersAreSane({ ...parsed, off_peak: { ...parsed.off_peak, in_per_m: 0.2 } })).toBe(false);
    expect(parseDeepSeekFlash(fixture.replace("$0.15 $0.66", "$0.10 $0.66"))).toBeNull();
  });

  test("a page without the price table gives no table, so no price", () => {
    expect(parseDeepSeekFlash("Model details only, no prices.")).toBeNull();
  });

  test("the source is the official pricing document", () => {
    expect(DEEPSEEK_PRICING_URL).toBe("https://api-docs.deepseek.com/quick_start/pricing/");
  });
});

describe("DeepSeek estimate price: the hour-weighted average of peak and off-peak (r42)", () => {
  test("35 of 168 hours at peak: in 0.18125, cache hit 0.003625, output 0.725 per million tokens", () => {
    const w = hourWeighted(parsed);
    expect(w.in_per_m).toBeCloseTo(0.18125, 9);
    expect(w.cache_per_m).toBeCloseTo(0.003625, 9);
    expect(w.out_per_m).toBeCloseTo(0.725, 9);
  });
  test("the weight is the page's schedule: 7 hours on 5 weekdays out of 168", () => {
    expect(PEAK_HOURS_PER_WEEK / HOURS_PER_WEEK).toBeCloseTo(35 / 168, 12);
  });
  test("a page with a different peak schedule is refused, not weighted", () => {
    const changed = fixture.replace("01:00 - 04:00 and 06:00 - 10:00 UTC, Monday through Friday", "00:00 - 06:00 UTC, every day");
    expect(parseDeepSeekFlash(changed)).toBeNull();
  });
  test("the stored reference uses the hour-weighted price of its own official tiers", () => {
    for (const d of models.reference.filter((x: { ref: string }) => x.ref === "deepseek-v4.1-flash")) {
      const w = hourWeighted({ peak: d.official!.peak, off_peak: d.official!.off_peak, peak_hours_utc: d.official!.peak_hours_utc });
      expect(d.in_per_m).toBeCloseTo(w.in_per_m, 9);
      expect(d.out_per_m).toBeCloseTo(w.out_per_m, 9);
    }
  });
});

describe("OpenRouter listing against an official table", () => {
  const listing = { in_per_m: 0.14, out_per_m: 0.42, cache_per_m: 0.0042 };

  test("the listing 0.14 / 0.42 / 0.0042 passes the sanity rule, so it is rejected by the official rule, not by the sanity rule", () => {
    expect(sanity(listing)).toBeNull();
  });

  test("with an official table, a disagreeing listing is rejected and the official price is used; the note says so", () => {
    const r = reconcile({ official: hourWeighted(parsed), listing, listingRefusal: null, snapshot: { in_per_m: 0.02, out_per_m: 1, cache_per_m: 0.015 }, snapshotDate: "2026-10-26" });
    expect(r.status).toBe("official");
    expect(r.values.in_per_m).toBeCloseTo(0.18125, 9);
    expect(r.note).toContain("Official documentation is authoritative for first-party models; the aggregator listing disagreed and was rejected");
    expect(r.note).toContain("listing 0.14 / 0.42 / 0.0042");
  });

  test("an agreeing listing is recorded as agreeing, and the official price stands", () => {
    const m = hourWeighted(parsed);
    const r = reconcile({ official: m, listing: m, listingRefusal: null, snapshot: m, snapshotDate: "2026-10-26" });
    expect(r.note).toBe("listing agrees with the official price table");
  });

  test("without an official table, a sane listing is verified", () => {
    const r = reconcile({ official: null, listing, listingRefusal: null, snapshot: { in_per_m: 0.02, out_per_m: 1, cache_per_m: 0.015 }, snapshotDate: "2026-10-26" });
    expect(r.status).toBe("verified");
    expect(r.values).toEqual(listing);
  });

  test("a refused listing with no official table keeps the last verified snapshot, with the date", () => {
    const snap = { in_per_m: 0.02, out_per_m: 1, cache_per_m: 0.015 };
    const r = reconcile({ official: null, listing: { in_per_m: 0.0432, out_per_m: 0.01, cache_per_m: 0.034 }, listingRefusal: "listing shows completion < prompt (0.01 < 0.0432 per M)", snapshot: snap, snapshotDate: "2026-10-26" });
    expect(r.status).toBe("anomaly");
    expect(r.values).toEqual(snap);
    expect(r.note).toContain("price_anomaly: listing shows completion < prompt");
    expect(r.note).toContain("using last verified snapshot 2026-10-26");
  });
});
