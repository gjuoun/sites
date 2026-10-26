import { describe, expect, test } from "bun:test";
import { creditUsageValue, formatSmall, type CreditRow } from "./credits";

const DAY = 86_400_000;
const START = Date.parse("2026-10-25T16:00:00Z");
const END = Date.parse("2026-10-26T17:23:00Z");
const PRICE = { in_per_m: 1, out_per_m: 2, cache_per_m: 0.1 };
const base = (rows: CreditRow[], extra: Partial<Parameters<typeof creditUsageValue>[0]> = {}) =>
  creditUsageValue({ credits_used: 10, window_start_ms: START, window_end_ms: END, coverage_start_ms: START - DAY, rows, prices: { m: PRICE }, ...extra });

const row = (over: Partial<CreditRow> = {}): CreditRow => ({ created_ms: START + 1000, model: "m", input: 1_000_000, cache_creation: 0, cache_read: 0, output: 0, ...over });

describe("measured usage value of a credit", () => {
  test("usage value is each row priced at its own model's list price, divided by the credits used", () => {
    // 1,000,000 input tokens at $1/M = $1.00 usage; 500,000 output at $2/M = $1.00; total $2.00 over 10 credits
    const r = base([row(), row({ input: 0, output: 500_000 })]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.usage_usd).toBeCloseTo(2, 9);
    expect(r.usd_per_credit).toBeCloseTo(0.2, 9);
    expect(r.tokens_per_credit).toBeCloseTo(150_000, 6);
    expect(r.rows).toBe(2);
    expect(r.basis).toContain("÷ 10 credits used");
  });

  test("cache reads are priced at the cache price, not the input price", () => {
    const r = base([row({ input: 0, cache_read: 1_000_000 })]);
    if (!r.ok) throw new Error("expected a value");
    expect(r.usage_usd).toBeCloseTo(0.1, 9);
  });

  test("a row whose model has no list price makes the value unavailable, naming the model; it is not zeroed or dropped", () => {
    const r = creditUsageValue({ credits_used: 10, window_start_ms: START, window_end_ms: END, coverage_start_ms: START - DAY, rows: [row(), row({ model: "qwen3.8-max" })], prices: { m: PRICE, "qwen3.8-max": null } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.unavailable).toContain("qwen3.8-max (1 rows)");
  });

  test("when a model is unpriced, the reason states the measured lower bound from the priced rows, and still gives no value", () => {
    const r = creditUsageValue({ credits_used: 10, window_start_ms: START, window_end_ms: END, coverage_start_ms: START - DAY, rows: [row(), row({ model: "qwen3.8-max", input: 1_000_000 })], prices: { m: PRICE, "qwen3.8-max": null } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // priced rows: $1.00 of input usage over 10 credits = at least $0.1 per credit; 50% of tokens unpriced
    expect(r.unavailable).toContain("50.0% of window tokens");
    expect(r.unavailable).toContain("at least $0.1 usage value per credit (lower bound)");
  });

  test("a model that is not in the price table at all is refused too, never treated as free", () => {
    const r = base([row({ model: "unknown-model" })]);
    expect(r.ok).toBe(false);
  });

  test("cache writes have no list price, so rows that write cache are refused rather than priced at the input rate", () => {
    const r = base([row({ cache_creation: 10 })]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.unavailable).toContain("cache writes");
  });

  test("rows before the window start are outside the window; the row at the start is inside it", () => {
    const r = base([row({ created_ms: START - 1 }), row({ created_ms: START, input: 2_000_000 })]);
    if (!r.ok) throw new Error("expected a value");
    expect(r.rows).toBe(1);
    expect(r.usage_usd).toBeCloseTo(2, 9);
  });

  test("a usage log that starts after the window start cannot value the window", () => {
    const r = base([row()], { coverage_start_ms: START + DAY });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.unavailable).toMatch(/partial_window/);
  });

  test("missing or zero credits used gives no value", () => {
    expect(base([row()], { credits_used: null }).ok).toBe(false);
    expect(base([row()], { credits_used: 0 }).ok).toBe(false);
  });

  test("no usage at all in the window gives no value; credits alone never produce one", () => {
    const r = base([row({ created_ms: START - DAY })]);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.unavailable).toBe("no_usage_in_window");
  });
});

describe("small numbers stay readable", () => {
  test("0.000392 is printed as 0.000392, not as 0.000", () => {
    expect(formatSmall(10 / 25500)).toBe("0.000392");
    expect(formatSmall(0.125)).toBe("0.125");
  });
});
