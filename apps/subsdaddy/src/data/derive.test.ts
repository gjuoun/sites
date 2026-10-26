import { describe, expect, test } from "bun:test";
import {
  WEEKS_PER_MONTH,
  cacheShare,
  capacityFromDelta,
  capacityFromSnapshot,
  fitPriceVector,
  mixShares,
  presetsFor,
  totalTokens,
  usdB,
  windowCoverage,
} from "./derive";

const ZERO = { input: 0, cache_creation: 0, cache_read: 0, output: 0 };

describe("token accounting", () => {
  test("total tokens sum all four columns", () => {
    expect(totalTokens({ input: 10, cache_creation: 5, cache_read: 85, output: 20 })).toBe(120);
  });

  test("cache share is computed over the prompt side, not all tokens", () => {
    // 85% of the prompt was a cache read; over every token it would read 0.71
    expect(cacheShare({ input: 10, cache_creation: 5, cache_read: 85, output: 20 })).toBeCloseTo(0.85, 5);
  });

  test("cache share stays inside [0,1] or reports null", () => {
    expect(cacheShare(ZERO)).toBeNull();
    expect(cacheShare({ input: 10, cache_creation: 0, cache_read: 10, output: 0 })).toBeCloseTo(0.5, 5);
  });
});

describe("capacity", () => {
  test("a snapshot divides delivered tokens by the consumed fraction and normalizes to a week", () => {
    const result = capacityFromSnapshot({
      tokens_in_window: 100,
      used_pct: 50,
      window_ms: 7 * 24 * 60 * 60 * 1000,
      coverage: 0.99,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.tokens_per_week).toBeCloseTo(200, 5);
  });

  test("a missing used_pct is a reason, never a zero", () => {
    const result = capacityFromSnapshot({ tokens_in_window: 100, used_pct: null, window_ms: 1000, coverage: 1 });
    expect(result).toEqual({ ok: false, unavailable: "used_pct_missing" });
  });

  test("a saturated window refuses to extrapolate", () => {
    const result = capacityFromSnapshot({ tokens_in_window: 100, used_pct: 100, window_ms: 1000, coverage: 1 });
    expect(result).toEqual({ ok: false, unavailable: "window_saturated" });
  });

  test("insufficient log coverage disqualifies the snapshot", () => {
    const result = capacityFromSnapshot({ tokens_in_window: 100, used_pct: 50, window_ms: 1000, coverage: 0.4 });
    expect(result).toEqual({ ok: false, unavailable: "partial_window" });
  });

  test("a delta pair needs an advancing percentage and at least an hour", () => {
    expect(capacityFromDelta({ tokens_between: 10, used_pct_before: 10, used_pct_after: 10, elapsed_ms: 7_200_000 })).toEqual(
      { ok: false, unavailable: "used_pct_did_not_advance" },
    );
    expect(capacityFromDelta({ tokens_between: 10, used_pct_before: 10, used_pct_after: 20, elapsed_ms: 60_000 })).toEqual({
      ok: false,
      unavailable: "delta_window_too_short",
    });
    const ok = capacityFromDelta({ tokens_between: 10, used_pct_before: 10, used_pct_after: 20, elapsed_ms: 7_200_000 });
    expect(ok.ok).toBe(true);
  });

  test("coverage clamps to the documented range", () => {
    expect(windowCoverage({ coverage_start_ms: 0, now_ms: 0, window_ms: 604_800_000 })).toBe(0);
    expect(windowCoverage({ coverage_start_ms: 0, now_ms: 604_800_000 * 2, window_ms: 604_800_000 })).toBe(1);
  });
});

describe("dollars per billion tokens", () => {
  test("a month of capacity converts through weeks-per-month", () => {
    const value = usdB(10, 1e9);
    expect(value).toBeCloseTo((10 / WEEKS_PER_MONTH) * 1e9 / 1e9, 2);
  });

  test("no capacity means no number", () => {
    expect(usdB(10, 0)).toBeNull();
    expect(usdB(0, 1e9)).toBeNull();
  });
});

describe("price vector fit", () => {
  // the three token columns must vary independently, or the normal equations are singular:
  // each column gets its own pseudo-random sequence (linear ramps are collinear)
  const seq = (seed: number) => {
    let s = seed;
    return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  };
  const ra = seq(7);
  const rb = seq(11);
  const rc = seq(13);
  const rows = Array.from({ length: 10 }, () => {
    const tokens = {
      input: Math.round(500 + ra() * 5000),
      cache_creation: 0,
      cache_read: Math.round(2000 + rb() * 40000),
      output: Math.round(100 + rc() * 3000),
    };
    return {
      tokens,
      total_cost: 1.5e-7 * tokens.input + 3e-9 * tokens.cache_read + 6e-7 * tokens.output,
    };
  });

  test("recovers the price vector it was given", () => {
    const fit = fitPriceVector(rows);
    expect(fit.ok).toBe(true);
    if (fit.ok) {
      expect(fit.p_in).toBeCloseTo(1.5e-7, 9);
      expect(fit.p_cache).toBeCloseTo(3e-9, 12);
      expect(fit.p_out).toBeCloseTo(6e-7, 9);
      expect(fit.excluded).toBe(0);
    }
  });

  test("zero-cost rows are excluded and counted, not fitted as free", () => {
    const fit = fitPriceVector([...rows, { tokens: { ...ZERO, output: 100 }, total_cost: 0 }]);
    expect(fit.excluded).toBe(1);
    expect(fit.ok).toBe(true);
    if (fit.ok) expect(fit.p_out).toBeCloseTo(6e-7, 9);
  });

  test("too few priced rows is a reason, not a fit", () => {
    const fit = fitPriceVector(rows.slice(0, 3));
    expect(fit.ok).toBe(false);
    if (!fit.ok) expect(fit.unavailable).toBe("too_few_priced_rows");
  });
});

describe("presets", () => {
  const fit = { ok: true as const, p_in: 1.5e-7, p_cache: 3e-9, p_out: 6e-7, residual: 0.01, excluded: 0, priced_rows: 10 };

  test("a capacity that disagrees with the plan allowance withholds every preset", () => {
    const presets = presetsFor({
      fit,
      capacity_usd: 90,
      plan_price_month_usd: 10,
      agent_share: 0.5,
      capacity_tokens_per_week: 1e9,
    });
    expect(presets).toHaveLength(3);
    for (const p of presets) expect(p.unavailable).toBe("capacity_conflict");
  });

  test("a missing agent share only withholds that one preset", () => {
    const presets = presetsFor({
      fit,
      capacity_usd: 10,
      plan_price_month_usd: 10,
      agent_share: null,
      capacity_tokens_per_week: 1e9,
    });
    expect(presets.find((p) => p.shape === "agent")?.unavailable).toBe("share_unavailable");
    expect(presets.find((p) => p.shape === "interactive")?.usd_per_b).toBeGreaterThan(0);
  });

  test("a failed fit propagates its reason", () => {
    const presets = presetsFor({
      fit: { ok: false, unavailable: "too_few_priced_rows", excluded: 0, priced_rows: 2 },
      capacity_usd: 10,
      plan_price_month_usd: 10,
      agent_share: 0.5,
      capacity_tokens_per_week: 1e9,
    });
    for (const p of presets) expect(p.unavailable).toBe("too_few_priced_rows");
  });
});

describe("mix shares", () => {
  test("the pooled agent share is the measured cache share across lanes", () => {
    const shares = mixShares([
      { tokens: { input: 10, cache_creation: 0, cache_read: 90, output: 10 }, total_cost: 1 },
      { tokens: { input: 50, cache_creation: 0, cache_read: 50, output: 10 }, total_cost: 1 },
    ]);
    expect(shares.interactive).toBe(0);
    expect(shares.cache_heavy).toBe(0.94);
    expect(shares.agent).toBeCloseTo((90 + 50) / (100 + 100), 5);
  });
});
