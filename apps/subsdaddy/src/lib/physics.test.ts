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

describe("third-party rows: capacity in their measurement class, not the chip model (r46)", () => {
  test("the Claude rows show the @sonnet mix suffix and the class tooltip in every shape and context", () => {
    for (const ctx of CONTEXT_IDS) for (const s of SHAPES) {
      const rows = summaryTable(ds, "claude-haiku-5.5" as never, ctx, s).rows;
      for (const k of ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"]) {
        const c = rows.find((r) => r.key === k)!.cells.capacity;
        expect(c.note).toBe("@sonnet mix");
        expect(c.title ?? "").toContain("measured under a Sonnet-class mix; a cheaper model does not stretch the same window proportionally");
      }
    }
  });
  test("the Claude $/B is the same under every shape and both contexts: the class blend is fixed at the measured mix", () => {
    const seen = new Set<string>();
    for (const ctx of CONTEXT_IDS) for (const s of SHAPES) {
      const r = summaryTable(ds, "claude-haiku-5.5" as never, ctx, s).rows.find((x) => x.key === "claude-code-max-20x")!;
      seen.add(r.cells.usd.text);
    }
    expect(seen.size).toBe(1);
  });
  test("the Codex rows are priced in the Luna class: N/A here because the Luna mix needs more than 730 hours", () => {
    const rows = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows;
    for (const k of ["codex-pro", "codex-pro-20x"]) {
      const r = rows.find((x) => x.key === k)!;
      expect(r.cells.capacity.na).toBe(true);
      expect(r.cells.capacity.title ?? "").toContain("730 hours a month");
    }
  });
  test("each class blend is the list price at the measured mix: capacity times blend returns the allowance", () => {
    for (const e of ds.catalog.rows.flatMap((r: { allowance: Array<{ mix_class?: string; mix_blend_usd_per_million?: number; usd: number }> }) => r.allowance)) {
      if (!e.mix_class) continue;
      expect(e.mix_blend_usd_per_million! * 1000 * (e.usd / (e.mix_blend_usd_per_million! * 1000))).toBeCloseTo(e.usd, 6);
    }
  });
  test("the Claude rows are not the chip model: the same allowance in the Luna view is not a Claude row", () => {
    const luna = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]).map((r) => r.key);
    expect(luna.some((k) => k.startsWith("claude-code"))).toBe(false);
  });
});
