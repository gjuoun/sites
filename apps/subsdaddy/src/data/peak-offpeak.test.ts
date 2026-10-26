import { describe, expect, test } from "bun:test";
import { PEAK_HOURS, OFFPEAK_HOURS, averagePrice, tierBasis, type PeakOffPeak } from "./peak-offpeak";

const DS: PeakOffPeak = {
  peak: { in_per_m: 0.3, out_per_m: 1.2, cache_per_m: 0.03 },
  offpeak: { in_per_m: 0.15, out_per_m: 0.6, cache_per_m: 0.015 },
};
const QWEN_MAX: PeakOffPeak = {
  peak: { in_per_m: 2, out_per_m: 6, cache_per_m: 0.25 },
  offpeak: { in_per_m: 1.2, out_per_m: 3.6, cache_per_m: 0.15 },
};

describe("hour-weighted average", () => {
  test("weights are 14h peak and 10h off-peak of a 24h day", () => {
    expect(PEAK_HOURS).toBe(14);
    expect(OFFPEAK_HOURS).toBe(10);
  });

  test("DeepSeek V4.1 Flash: 14/24 of peak plus 10/24 of off-peak, not a flat half", () => {
    const a = averagePrice(DS);
    expect(a.in_per_m).toBeCloseTo((0.3 * 14 + 0.15 * 10) / 24, 12);
    expect(a.in_per_m).toBeCloseTo(0.2375, 12);
    expect(a.out_per_m).toBeCloseTo(0.95, 12);
    expect(a.cache_per_m).toBeCloseTo(0.02375, 12);
    expect(a.in_per_m).not.toBeCloseTo(0.3 * 0.75, 6);
  });

  test("qwen3.8-max: the same weights, from its own peak and 0.6 x off-peak", () => {
    const a = averagePrice(QWEN_MAX);
    expect(a.in_per_m).toBeCloseTo(5 / 3, 12);
    expect(a.out_per_m).toBeCloseTo(5, 12);
    expect(a.cache_per_m).toBeCloseTo(0.2083333333, 9);
  });

  test("with equal bands the average equals the band", () => {
    const flat: PeakOffPeak = { peak: DS.peak, offpeak: DS.peak };
    expect(averagePrice(flat)).toEqual(DS.peak);
  });
});

describe("basis text", () => {
  test("carries the peak, off-peak, hours and average in one sentence", () => {
    const s = tierBasis("deepseek-v4.1-flash", DS);
    expect(s).toContain("peak $0.3 / $1.2 / $0.03 × 14h");
    expect(s).toContain("off-peak $0.15 / $0.6 / $0.015 × 10h");
    expect(s).toContain("avg $0.2375 / $0.95 / $0.02375 per M");
  });
});
