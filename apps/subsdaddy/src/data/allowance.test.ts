import { describe, expect, test } from "bun:test";
import { analyzeWindow, bindingWindow, cycleOf, modelPerB, type PriceLookup, type UsageRow, type WindowReading } from "./allowance";

const MEASURED = "2026-10-27T01:00:00.000Z";
const flat = { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1, cache_write_per_m: null, overrides: [] };
const lookup: PriceLookup = (m) => (m === "priced" ? flat : null);
const H = 3_600_000;
const at = (hoursBeforeMeasured: number, model: string, tokens: number): UsageRow => ({ ms: Date.parse(MEASURED) - hoursBeforeMeasured * H, model, input: tokens, cache_creation: 0, cache_read: 0, output: 0 });

describe("window cost and allowance", () => {
  test("a window's cost is its priced rows at list price, and unpriced rows are counted, never zeroed", () => {
    const reading: WindowReading = { window: "monthly", window_minutes: 43200, used_pct: 50, resets_at: new Date(Date.parse(MEASURED) + 10 * 24 * H).toISOString(), measured_at: MEASURED };
    const rows = [at(1, "priced", 1_000_000), at(2, "mystery", 500_000)];
    const w = analyzeWindow(reading, rows, lookup, Date.parse(MEASURED) - 60 * 24 * H, 43200);
    expect(w.cost_usd).toBeCloseTo(1, 9);
    expect(w.unpriced_tokens).toBe(500_000);
    expect(w.unpriced_share).toBeCloseTo(500_000 / 1_500_000, 9);
    expect(w.unpriced_models).toEqual(["mystery"]);
  });

  test("allowance per cycle = cost ÷ used × (cycle ÷ window), with the cycle read from the data", () => {
    // resets 10 days after the reading: a monthly window that has run 20 days (its start is 30 days before reset)
    const reset = new Date(Date.parse(MEASURED) + 10 * 24 * H).toISOString();
    const reading: WindowReading = { window: "monthly", window_minutes: 43200, used_pct: 50, resets_at: reset, measured_at: MEASURED };
    const rows = [at(1, "priced", 2_000_000)];
    const w = analyzeWindow(reading, rows, lookup, Date.parse(MEASURED) - 60 * 24 * H, 43200);
    expect(w.allowance_usd_cycle).toBeCloseTo((2 / 0.5) * 1, 9);
  });

  test("the cycle length comes from the data: the same window with a 25-day cycle scales by 25/30, not by a constant", () => {
    const reset = new Date(Date.parse(MEASURED) + 3 * 24 * H).toISOString();
    const reading: WindowReading = { window: "weekly", window_minutes: 10080, used_pct: 100, resets_at: reset, measured_at: MEASURED };
    const rows = [at(1, "priced", 3_000_000)];
    const cov = Date.parse(MEASURED) - 60 * 24 * H;
    const a30 = analyzeWindow(reading, rows, lookup, cov, 43200).allowance_usd_cycle!;
    const a25 = analyzeWindow(reading, rows, lookup, cov, 25 * 1440).allowance_usd_cycle!;
    expect(a25 / a30).toBeCloseTo(25 / 30, 9);
  });

  test("the plan's allowance is the minimum over usable windows: the tightest window binds", () => {
    const reset = (d: number) => new Date(Date.parse(MEASURED) + d * 24 * H).toISOString();
    const cov = Date.parse(MEASURED) - 60 * 24 * H;
    const weekly = analyzeWindow({ window: "weekly", window_minutes: 10080, used_pct: 100, resets_at: reset(3), measured_at: MEASURED }, [at(1, "priced", 4_000_000)], lookup, cov, 43200);
    const monthly = analyzeWindow({ window: "monthly", window_minutes: 43200, used_pct: 50, resets_at: reset(10), measured_at: MEASURED }, [at(1, "priced", 2_000_000)], lookup, cov, 43200);
    const b = bindingWindow([weekly, monthly])!;
    expect(b.window).toBe("monthly");
    expect(b.allowance_usd_cycle).toBeCloseTo(4, 9);
  });

  test("a saturated window (used 100%) is usable; a window at 2% or less is low_signal: still usable, at low confidence", () => {
    const reset = new Date(Date.parse(MEASURED) + 3 * 24 * H).toISOString();
    const cov = Date.parse(MEASURED) - 60 * 24 * H;
    const sat = analyzeWindow({ window: "weekly", window_minutes: 10080, used_pct: 100, resets_at: reset, measured_at: MEASURED }, [at(1, "priced", 1_000_000)], lookup, cov, 43200);
    expect(sat.status).toBe("usable");
    const low = analyzeWindow({ window: "5h", window_minutes: 300, used_pct: 1, resets_at: new Date(Date.parse(MEASURED) + 1 * H).toISOString(), measured_at: MEASURED }, [at(1, "priced", 1_000)], lookup, cov, 43200);
    expect(low.status).toBe("low_signal");
    expect(low.allowance_usd_cycle).not.toBeNull();
    expect(low.confidence).toBe("low");
    expect(sat.confidence).toBe("normal");
    expect(bindingWindow([low, sat])!.window).toBe("weekly");
  });

  test("a window whose log does not cover its span is partial and does not bind", () => {
    const reading: WindowReading = { window: "monthly", window_minutes: 43200, used_pct: 50, resets_at: new Date(Date.parse(MEASURED) + 10 * 24 * H).toISOString(), measured_at: MEASURED };
    const w = analyzeWindow(reading, [at(1, "priced", 1_000_000)], lookup, Date.parse(MEASURED) - 5 * 24 * H, 43200);
    expect(w.status).toBe("partial");
    expect(w.allowance_usd_cycle).toBeNull();
    expect(bindingWindow([w])).toBeNull();
  });

  test("the billing cycle is the monthly window's own length, else the longest window's", () => {
    expect(cycleOf([{ window: "weekly", window_minutes: 10080, used_pct: 1, resets_at: MEASURED, measured_at: MEASURED }, { window: "monthly", window_minutes: 43200, used_pct: 1, resets_at: MEASURED, measured_at: MEASURED }])).toEqual({ minutes: 43200, billed: true });
    expect(cycleOf([{ window: "weekly", window_minutes: 10080, used_pct: 1, resets_at: MEASURED, measured_at: MEASURED }])).toEqual({ minutes: 10080, billed: false });
  });
});

describe("per-model $/B from the allowance", () => {
  test("fee over the tokens the allowance buys at the model's blended list price", () => {
    const mix = { output_share: 0.01, agent_cache_share: 0.9, cache_write_share: 0 };
    const r = modelPerB({ allowance_usd: 40, fee_usd: 10, ref: flat, mix, context_tokens: 100_000 });
    expect(r.usd_per_b).toBeCloseTo((10 / 40) * r.blended_usd_per_b, 9);
    expect(r.tokens_cycle).toBeCloseTo((40 / r.blended_usd_per_b) * 1e9, 3);
  });
});
