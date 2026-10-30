import { describe, expect, test } from "bun:test";
import { cacheShare, capacityConfidence, chooseAllowance, elapsedCoverage, presetsFor, resolveDollarPerB, usdPerBOfCycle } from "./derive";

describe("$/B from the tokens a cycle buys", () => {
  test("fee over tokens per cycle, per billion tokens", () => {
    expect(usdPerBOfCycle(10, 1e9)).toBeCloseTo(10, 9);
    expect(usdPerBOfCycle(20, 2e9)).toBeCloseTo(10, 9);
  });

  test("no tokens or no fee gives no figure, never zero", () => {
    expect(usdPerBOfCycle(10, 0)).toBeNull();
    expect(usdPerBOfCycle(0, 1e9)).toBeNull();
  });
});

describe("cache share", () => {
  test("cache read over the prompt side only", () => {
    expect(cacheShare({ input: 1, cache_creation: 0, cache_read: 9, output: 5 })).toBeCloseTo(0.9, 9);
  });

  test("no prompt gives no share", () => {
    expect(cacheShare({ input: 0, cache_creation: 0, cache_read: 0, output: 5 })).toBeNull();
  });
});

describe("capacity confidence", () => {
  test("a reading below 10% is low confidence; above is normal; none is none", () => {
    expect(capacityConfidence(5)?.confidence).toBe("low");
    expect(capacityConfidence(50)?.confidence).toBe("normal");
    expect(capacityConfidence(null)).toBeNull();
  });
});

describe("dollar figure with a same-rate peer", () => {
  test("an own measured figure wins; a missing one takes the peer's, marked derived", () => {
    expect(resolveDollarPerB({ own: 3, rate_peer: "x", peer_value: 9 })).toEqual({ usd_per_b: 3, basis: "measured", derived_from: null });
    expect(resolveDollarPerB({ own: null, rate_peer: "x", peer_value: 9 })).toEqual({ usd_per_b: 9, basis: "derived", derived_from: "x" });
    expect(resolveDollarPerB({ own: null, rate_peer: null, peer_value: null })).toEqual({ usd_per_b: null, basis: null, derived_from: null });
  });
});

describe("coverage of a window by its usage log", () => {
  test("the log covers the whole span: 1; it starts halfway: 0.5", () => {
    expect(elapsedCoverage({ coverage_start_ms: 0, window_start_ms: 100, now_ms: 200 })).toBe(1);
    expect(elapsedCoverage({ coverage_start_ms: 150, window_start_ms: 100, now_ms: 200 })).toBeCloseTo(0.5, 9);
  });
});

describe("presets need a capacity in dollars", () => {
  test("no capacity dollars: every shape is unavailable with that reason", () => {
    const out = presetsFor({ fit: { ok: false, unavailable: "no_fit" } as never, capacity_usd: null, plan_price_month_usd: 10, agent_share: 0.5, capacity_tokens_per_cycle: null });
    expect(out.every((p) => p.unavailable === "capacity_usd_unavailable")).toBe(true);
  });
});
