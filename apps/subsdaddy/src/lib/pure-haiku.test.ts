import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { summaryTable, viewRows, SHAPES, CAP_FOOTNOTE, HOURS_PER_MONTH, fmtBillions, MEASURED } from "./summary";
import { blendedUsdPerB, priceAt, type RefPrice } from "../data/estimate";
import { mixOf } from "../data/shapes";
import { CONTEXTS } from "../data/messages";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const heavy = ds.context.throughput.tokens_per_active_hour.p50;
const ceilTokens = heavy * HOURS_PER_MONTH;
const ref = (id: string): RefPrice => {
  const r = ds.models.reference.find((x) => x.ref === id)!;
  return { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides ?? [] };
};
const blendAt = (id: string, shape: number, ctx: "short" | "long") => blendedUsdPerB(priceAt(ref(id), CONTEXTS[ctx]).price, mixOf(SHAPES[shape]));
const CLAUDE = [["claude-code-pro", 20, 672.86], ["claude-code-max-5x", 100, 4028.57], ["claude-code-max-20x", 200, 6865.71]] as const;

describe("pure Haiku pricing: the Claude rows are priced at the selected model, not Sonnet (r50)", () => {
  test("dollar-implied tokens are the allowance over the Haiku blend at the shape and context", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const blend = blendAt("claude-haiku-5.5", 0, "short");
    for (const [id, , usd] of CLAUDE) {
      const tip = rows.find((r) => r.key === id)!.cells.capacity.title ?? "";
      expect(tip).toContain("dollar-implied: " + fmtBillions((usd / blend) ));
    }
  });
  test("the Haiku blend is the base tier at 100K (the prompt is at the threshold, so it stays low)", () => {
    expect(priceAt(ref("claude-haiku-5.5"), CONTEXTS.short).band).toBe("band: ≤100k base");
  });
  test("the Sonnet blend does not appear: no Sonnet price in any Claude row", () => {
    for (const v of viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0])) {
      if (!v.key.startsWith("claude-code")) continue;
      expect(v.usdTitle).not.toContain("Sonnet");
    }
  });
});

describe("the hour ceiling caps the dollar figure, and the row says so (r50)", () => {
  test("at Cache-heavy 100K, every Claude row is capped: capacity is the hour ceiling and $/B is fee over it", () => {
    const rows = viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]);
    for (const [id, fee] of CLAUDE) {
      const v = rows.find((r) => r.key === id)!;
      expect(v.capped).toBe(true);
      expect(v.tokens30d).toBeCloseTo(ceilTokens, 0);
      expect(v.usd).toBeCloseTo(fee / (ceilTokens / 1e9), 9);
    }
  });
  test("the capped cell carries the suffix capped by hours; an uncapped cell carries none", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    for (const [id] of CLAUDE) expect(rows.find((r) => r.key === id)!.cells.capacity.note).toBe("capped by hours");
    const cold = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[2]).rows;
    const pro = cold.find((r) => r.key === "claude-code-pro")!;
    expect(pro.cells.capacity.note ?? null).toBeNull();
    expect(pro.cells.capacity.text).toMatch(/B\/mo$/);
  });
  test("the uncapped Pro at Cold 100K is priced from its dollars: $/B is fee over dollar-implied tokens", () => {
    const v = viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[2]).find((r) => r.key === "claude-code-pro")!;
    expect(v.capped).toBe(false);
    const dollarB = 672.86 / blendAt("claude-haiku-5.5", 2, "short");
    expect(v.usd).toBeCloseTo(20 / dollarB, 6);
  });
  test("the tooltip gives both values, dollar-implied and hour-implied, for a capped row", () => {
    const tip = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === "claude-code-max-5x")!.cells.capacity.title ?? "";
    expect(tip).toContain("dollar-implied: ");
    expect(tip).toContain("hour-implied: " + fmtBillions(ceilTokens / 1e9));
  });
  test("the tooltip keeps the measured-mix counterpart, so the reader can see the Sonnet figure beside the Haiku one", () => {
    const tip = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === "claude-code-max-5x")!.cells.capacity.title ?? "";
    expect(tip).toContain("measured-mix counterpart (sonnet): ");
  });
  test("the footnote names the rule when a row is capped, in the words of the brief", () => {
    const foot = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).footnote ?? "";
    expect(foot).toContain(CAP_FOOTNOTE);
    expect(CAP_FOOTNOTE).toBe("at pure Haiku the weekly/hour window binds before the dollar allowance, so these rows reflect the hour ceiling, not the dollar ceiling");
  });
  test("the footnote is absent when no row is capped (Measured view)", () => {
    expect(summaryTable(ds, MEASURED).footnote ?? "").not.toContain(CAP_FOOTNOTE);
  });
});

describe("the table never shows the measurement-class label (r50)", () => {
  test("no cell in any model view, context or shape contains @sonnet, @luna or the word mix", () => {
    for (const ctx of ["short", "long"] as const) for (const s of SHAPES) {
      for (const ref of ["claude-haiku-5.5", "gpt-6-luna"] as const) {
        for (const r of summaryTable(ds, ref as never, ctx, s).rows) {
          for (const c of Object.values(r.cells)) {
            expect(c.text).not.toMatch(/@sonnet|@luna|@mix|sonnet mix/i);
            expect(c.note ?? "").not.toMatch(/@sonnet|@luna|sonnet mix/i);
          }
        }
      }
    }
  });
});

describe("the Codex rows are priced at GPT-6 Luna (r50)", () => {
  test("Codex Pro 5x in the Luna view is capped; its tooltip names the Luna counterpart, and the Haiku view has no Codex rows", () => {
    const v = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]).find((r) => r.key === "codex-pro")!;
    expect(v.capped).toBe(true);
    expect(v.usd).toBeCloseTo(100 / (ceilTokens / 1e9), 9);
    const tip = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows.find((r) => r.key === "codex-pro")!.cells.capacity.title ?? "";
    expect(tip).toContain("measured-mix counterpart (luna): ");
  });
  test("the Luna view's cap footnote names GPT-6 Luna, not Haiku", () => {
    const foot = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).footnote ?? "";
    expect(foot).toContain("at pure GPT-6 Luna the weekly/hour window binds");
    expect(foot).not.toContain("at pure Haiku");
  });
});
