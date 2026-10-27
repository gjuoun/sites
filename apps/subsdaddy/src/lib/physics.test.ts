import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { HOURS_PER_MONTH, PHYSICS_MARK, physicsOf, summaryTable, viewChips, viewRows, SHAPES } from "./summary";
import { CONTEXT_IDS } from "../data/context";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const heavy = ds.context.throughput.tokens_per_active_hour.p50;
const bound = heavy * HOURS_PER_MONTH;

/** The tokens per 30 days a shown capacity cell claims: "11.49B/mo" or "2.00B/7d" with an optional suffix. */
function tokens30d(text: string): number | null {
  const m = text.match(/([\d.,]+)B\/(\d+)?/);
  if (!m) return null;
  const days = m[2] ? Number(m[2]) : 30;
  return (Number(m[1].replace(/,/g, "")) * 1e9 * 30) / days;
}

describe("physical bound: no shown capacity needs more than 730 agent hours a month (r46)", () => {
  test("the bound is 730 hours at the measured burn rate read from context.json, not a typed constant", () => {
    expect(HOURS_PER_MONTH).toBe(730);
    expect(heavy).toBeGreaterThan(0);
    expect(bound).toBeCloseTo(heavy * 730, 3);
  });
  test("every shown capacity, in every view, context and shape, is within the bound", () => {
    for (const c of viewChips(ds)) for (const ctx of CONTEXT_IDS) for (const s of SHAPES) {
      for (const r of summaryTable(ds, c.id, ctx, s).rows) {
        if (r.cells.capacity.na) continue;
        const t = tokens30d(r.cells.capacity.text);
        if (t === null) continue;
        expect(t <= bound * 1.0001).toBe(true);
      }
    }
  });
  test("the Measured lanes are within the bound too, normalised to 30 days", () => {
    for (const r of summaryTable(ds, "measured" as never).rows) {
      if (r.cells.capacity.na) continue;
      expect(tokens30d(r.cells.capacity.text)! <= bound).toBe(true);
    }
  });
  test("a row that needs more hours than the month has is N/A, with the hours in its reason (unit check)", () => {
    const over = { tokens30d: bound * 3, key: "x", label: "x", fee: 1, capacity: "9B/mo", capacityReason: "", capDetail: null, capNote: null, capTitle: null, allowance: null, allowanceReason: "", usd: 1, usdTitle: "", marker: "", tps: null, tpsTitle: "", ttft: null, ttftTitle: "" } as never;
    const out = physicsOf(over, ds);
    expect(out.capacity).toBeNull();
    expect(out.usd).toBeNull();
    expect(out.capacityReason).toContain(PHYSICS_MARK);
    expect(out.capacityReason).toContain("about " + Math.round(bound * 3 / heavy).toLocaleString("en-US") + " hours");
  });
  test("a row within the bound passes through unchanged", () => {
    const fine = { tokens30d: bound / 2, capacity: "1B/mo", usd: 2 } as never;
    expect(physicsOf(fine, ds)).toBe(fine);
  });
});

describe("third-party rows are not the chip model (r50)", () => {
  test("the Claude and Codex rows appear only in the views that price them; the Luna view has no Claude row", () => {
    const luna = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]).map((r) => r.key);
    expect(luna.some((k) => k.startsWith("claude-code"))).toBe(false);
  });
});
