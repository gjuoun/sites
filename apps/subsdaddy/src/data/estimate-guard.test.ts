import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogFileSchema, catalogRowSchema, estimateSchema } from "./catalog";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const stamp = "2026-10-26T17:00:00Z";

describe("estimate schema", () => {
  const value = { ref: "claude-haiku-5.5", shape: "agent", usd_per_b: 2.5, reason: null, fee_over_allowance: 0.125, blended_usd_per_b: 20, measured_at: stamp, source: "test" };

  test("an unavailable estimate carries a reason and no number", () => {
    expect(estimateSchema.parse({ status: "unavailable", reason: "no allowance", basis: null, values: [], range_agent: null, measured_at: stamp, source: "t" }).status).toBe("unavailable");
    expect(() => estimateSchema.parse({ status: "unavailable", reason: null, basis: null, values: [], range_agent: null, measured_at: stamp, source: "t" })).toThrow(/reason/);
    expect(() => estimateSchema.parse({ status: "unavailable", reason: "x", basis: null, values: [value], range_agent: null, measured_at: stamp, source: "t" })).toThrow(/no values/);
  });

  test("an estimated row needs a basis, a value and its agent range", () => {
    const ok = { status: "estimated", reason: null, basis: "fee/allowance", values: [value], range_agent: [2.5, 2.5], measured_at: stamp, source: "t" };
    expect(estimateSchema.parse(ok).range_agent).toEqual([2.5, 2.5]);
    expect(() => estimateSchema.parse({ ...ok, basis: null })).toThrow(/basis/);
    expect(() => estimateSchema.parse({ ...ok, values: [{ ...value, usd_per_b: null, reason: "x" }] })).toThrow(/at least one/);
    expect(() => estimateSchema.parse({ ...ok, range_agent: null })).toThrow(/range/);
  });

  test("a zero estimate value is refused, not stored as zero", () => {
    expect(() => estimateSchema.parse({ status: "estimated", reason: null, basis: "b", values: [{ ...value, usd_per_b: 0 }], range_agent: [1, 1], measured_at: stamp, source: "t" })).toThrow();
  });
});

describe("estimates never enter the ranking", () => {
  test("the shipped ranked lanes carry no estimate field and no estimated basis", () => {
    const lanes = read("lanes.json").lanes as Array<Record<string, unknown>>;
    for (const l of lanes) {
      expect(Object.keys(l).some((k) => /estimate/i.test(k))).toBe(false);
      expect(l.usd_per_b_basis).not.toBe("estimated");
      expect(JSON.stringify(l)).not.toMatch(/"estimate"|"estimated"/);
    }
  });

  test("a catalog row cannot carry a per-billion figure at the top level, whatever its estimate", () => {
    expect(() => catalogRowSchema.parse({ ...baseRow(), usd_per_b: 3 })).toThrow();
  });
});

describe("shipped catalog estimates are consistent", () => {
  const file = catalogFileSchema.parse(read("catalog.json"));

  test("a row with no published allowance is unavailable and carries no number", () => {
    for (const r of file.rows) {
      if (r.allowance.length === 0) {
        expect(r.estimate?.status).toBe("unavailable");
        expect(r.estimate?.values).toEqual([]);
      }
    }
  });

  test("each estimated range sits between the smallest and largest agent value", () => {
    for (const r of file.rows) {
      if (r.estimate?.status !== "estimated") continue;
      const agent = r.estimate.values.filter((v) => v.shape === "agent" && v.usd_per_b !== null).map((v) => v.usd_per_b as number);
      expect(r.estimate.range_agent![0]).toBeCloseTo(Math.min(...agent), 9);
      expect(r.estimate.range_agent![1]).toBeCloseTo(Math.max(...agent), 9);
    }
  });

  test("CommandCode GOAT is estimated from the $80 usage allowance: fee/allowance = 0.125", () => {
    const row = file.rows.find((r) => r.plan_id === "commandcode-goat-published")!;
    expect(row.estimate?.status).toBe("estimated");
    const flash = row.estimate!.values.find((v) => v.ref === "deepseek-v4-flash" && v.shape === "agent")!;
    expect(flash.fee_over_allowance).toBeCloseTo(0.125, 9);
  });
});

function baseRow() {
  return {
    plan_id: "x-y", product: "X", tier: "Y", label: "X - Y", status: "catalog", provider: null,
    price_month_usd: 10, price_native: null, currency: "USD", price_annual_usd: null,
    allowance_model: "usd_usage", allowance_detail: "d", credits_to_usd: null, cli_compat: "c",
    heat_samples: null, exclusion_reason: null, price_note: null, measured_at: stamp,
    sources: [{ kind: "official_page", url: "https://example.com", note: "n" }], allowance: [],
  };
}
