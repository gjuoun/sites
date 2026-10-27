import { describe, expect, test } from "bun:test";
import { vendorAllowance, analyzeWindow, type WindowAnalysis } from "./allowance";
import { vendorPoolFromCodexbar } from "../lib/quota";

const monthly = (used: number): WindowAnalysis => analyzeWindow(
  { window: "monthly", window_minutes: 43200, used_pct: used, resets_at: "2026-11-21T00:00:00Z", measured_at: "2026-10-27T00:00:00Z" },
  [{ ms: Date.parse("2026-10-20T00:00:00Z"), model: "priced", input: 1_000_000, cache_creation: 0, cache_read: 0, output: 0 }],
  () => ({ in_per_m: 1, out_per_m: 1, cache_per_m: 0, cache_write_per_m: null, overrides: [] }),
  Date.parse("2026-10-01T00:00:00Z"),
  43200,
);
const pool = { used_usd: 35, total_usd: 70, source: "codexbar plan line", measured_at: "2026-10-27T00:00:00Z" };

describe("vendor-reported pool takes priority when it matches the monthly window", () => {
  test("a pool whose used share equals the monthly used percent is the allowance", () => {
    const v = vendorAllowance(pool, monthly(50));
    expect(v.usd).toBe(70);
  });

  test("a pool that does not match the monthly window is not used, and the reason says why", () => {
    const v = vendorAllowance(pool, monthly(20));
    expect(v.usd).toBeNull();
    expect(v.reason).toContain("does not match the monthly window");
  });

  test("no pool, no monthly window, or a non-positive total: no vendor allowance, with the reason", () => {
    expect(vendorAllowance(null, monthly(50)).usd).toBeNull();
    expect(vendorAllowance(pool, undefined).reason).toContain("no monthly window");
    expect(vendorAllowance({ ...pool, total_usd: 0 }, monthly(50)).usd).toBeNull();
  });
});

describe("codexbar pool parsing: numbers only", () => {
  test("the plan line '… · $35.00 of $70.00' gives used 35 and total 70", () => {
    const json = JSON.stringify([{ usage: { loginMethod: "GOAT · $35.00 of $70.00", identity: { accountEmail: "x@example.com" } } }]);
    expect(vendorPoolFromCodexbar(json)).toEqual({ used_usd: 35, total_usd: 70, source: "codexbar plan line" });
  });

  test("a provider cost with limit 0 is not a pool", () => {
    const json = JSON.stringify([{ usage: { providerCost: { limit: 0, used: 0.2, currencyCode: "USD" } } }]);
    expect(vendorPoolFromCodexbar(json)).toBeNull();
  });

  test("a provider cost with a positive USD limit is the pool", () => {
    const json = JSON.stringify([{ usage: { providerCost: { limit: 50, used: 10, currencyCode: "USD" } } }]);
    expect(vendorPoolFromCodexbar(json)).toEqual({ used_usd: 10, total_usd: 50, source: "codexbar providerCost" });
  });

  test("no pool stated: null, never a guessed number", () => {
    expect(vendorPoolFromCodexbar(JSON.stringify([{ usage: { loginMethod: "Max" } }]))).toBeNull();
  });
});
