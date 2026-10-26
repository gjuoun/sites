import { describe, expect, test } from "bun:test";
import { blendedUsdPerB, cacheFor, estimateOne, pooledMix } from "./estimate";

const MIX = { output_share: 0.5, agent_cache_share: 0.8 };

describe("blended list-price cost", () => {
  test("a 50/50 output and input mix with no cache is the average of the two prices, per billion", () => {
    // (1−0.5)(1−0)·1 + 0.5·0 ... -> 0.5·in + 0.5·out = 0.5·1 + 0.5·2 = 1.5 $/M = 1500 $/B
    expect(blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 0.5, cache_share: 0 })).toBeCloseTo(1500, 6);
  });

  test("cache reads replace fresh input at the cache price", () => {
    // o=0, c=1 -> cache price only: 0.1 $/M = 100 $/B
    expect(blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 0, cache_share: 1 })).toBeCloseTo(100, 6);
  });

  test("share outside [0,1] is refused, not clamped", () => {
    expect(() => blendedUsdPerB({ in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, { output_share: 1.2, cache_share: 0 })).toThrow();
  });
});

describe("estimate formula", () => {
  test("estimate = (fee / allowance) × blended", () => {
    // fee $10, allowance $80 -> 0.125; blended 1500 $/B -> 187.5
    const e = estimateOne({ fee_usd: 10, allowance_usd: 80, allowance_reason: null, price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: { output_share: 0.5, agent_cache_share: 0 }, shape: "interactive" });
    expect(e.fee_over_allowance).toBeCloseTo(0.125, 9);
    expect(e.usd_per_b).toBeCloseTo(187.5, 6);
    expect(e.reason).toBeNull();
  });

  test("no allowance means null with a reason, never a number and never zero", () => {
    const e = estimateOne({ fee_usd: 10, allowance_usd: null, allowance_reason: "token allowance only", price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: MIX, shape: "agent" });
    expect(e.usd_per_b).toBeNull();
    expect(e.reason).toBe("token allowance only");
  });

  test("a zero or negative allowance is refused as unavailable", () => {
    const e = estimateOne({ fee_usd: 10, allowance_usd: 0, allowance_reason: null, price: { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 }, mix: MIX, shape: "agent" });
    expect(e.usd_per_b).toBeNull();
    expect(e.reason).toBe("no published usage-dollar allowance");
  });
});

describe("measured mix", () => {
  test("pooled output share and agent cache share come from the summed lanes", () => {
    const mix = pooledMix([
      { tokens: { input: 100, cache_creation: 0, cache_read: 800, output: 100 } },
      { tokens: { input: 100, cache_creation: 0, cache_read: 0, output: 0 } },
    ]);
    expect(mix.output_share).toBeCloseTo(100 / 1100, 9);
    expect(mix.agent_cache_share).toBeCloseTo(800 / 1000, 9);
  });

  test("cache share for each shape: interactive 0, cache_heavy 0.94, agent measured", () => {
    expect(cacheFor("interactive", MIX)).toBe(0);
    expect(cacheFor("cache_heavy", MIX)).toBe(0.94);
    expect(cacheFor("agent", MIX)).toBe(0.8);
  });
});
