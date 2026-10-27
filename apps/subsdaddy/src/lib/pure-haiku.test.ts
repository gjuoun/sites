import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { summaryTable, viewRows, SHAPES, fmtBillions, MEASURED } from "./summary";
import { blendedUsdPerB, priceAt, type RefPrice } from "../data/estimate";
import { mixOf } from "../data/shapes";
import { CONTEXTS } from "../data/messages";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const ref = (id: string): RefPrice => {
  const r = ds.models.reference.find((x) => x.ref === id)!;
  return { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides ?? [] };
};
const blendAt = (id: string, shape: number, ctx: "short" | "long") => blendedUsdPerB(priceAt(ref(id), CONTEXTS[ctx]).price, mixOf(SHAPES[shape]));
const CLAUDE = [["claude-code-pro", 20, 672.86], ["claude-code-max-5x", 100, 4028.57], ["claude-code-max-20x", 200, 6865.71]] as const;

describe("pure Haiku pricing: Claude capacity is the allowance over the Haiku blend (r50, r55)", () => {
  test("dollar-implied tokens are the allowance over the Haiku blend at the shape and context", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const blend = blendAt("claude-haiku-5.5", 0, "short");
    for (const [id, , usd] of CLAUDE) {
      const tip = rows.find((r) => r.key === id)!.cells.capacity.title ?? "";
      expect(tip).toContain("dollar-implied: " + fmtBillions(usd / blend));
    }
  });
  test("the Haiku blend is the base tier at 100K (the prompt is at the threshold, so it stays low)", () => {
    expect(priceAt(ref("claude-haiku-5.5"), CONTEXTS.short).band).toBe("band: ≤100k base");
  });
  test("no Sonnet price in any Claude row", () => {
    for (const v of viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0])) {
      if (!v.key.startsWith("claude-code")) continue;
      expect(v.usdTitle).not.toContain("Sonnet");
    }
  });
});

describe("no hour cap: capacity is the allowance over the price, and $/B is fee over that (r55)", () => {
  test("Claude $/B is fee over the dollar-implied tokens, uncapped, at Cache-heavy 100K", () => {
    const rows = viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]);
    const blend = blendAt("claude-haiku-5.5", 0, "short");
    for (const [id, fee, usd] of CLAUDE) {
      const v = rows.find((r) => r.key === id)!;
      expect(v.tokens30d).toBeCloseTo((usd / blend) * 1e9, 0);
      expect(v.usd).toBeCloseTo(fee / ((usd / blend)), 9);
    }
  });
  test("no Claude cell carries the retired hour-cap suffix, in any shape or context", () => {
    for (const ctx of ["short", "long"] as const) for (const s of SHAPES) {
      for (const r of summaryTable(ds, "claude-haiku-5.5" as never, ctx, s).rows) {
        expect(r.cells.capacity.note ?? "").not.toContain("capped by hours");
      }
    }
  });
  test("the Codex Pro 5x row in the Luna view is priced at the Luna blend, with no cap", () => {
    const v = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]).find((r) => r.key === "codex-pro")!;
    const lunaBlend = blendAt("gpt-6-luna", 0, "short");
    expect(v.usd).toBeCloseTo(100 / (1157.14 / lunaBlend), 6);
    expect(v.capNote ?? null).toBeNull();
  });
  test("the footnote carries no hour-cap sentence in the Haiku view or the Measured view", () => {
    for (const v of ["claude-haiku-5.5", MEASURED] as const) {
      const foot = summaryTable(ds, v as never, "short", SHAPES[0]).footnote ?? "";
      expect(foot).not.toContain("hour ceiling");
      expect(foot).not.toContain("window binds before the dollar allowance");
    }
  });
});

describe("the table never shows the measurement-class label (r50)", () => {
  test("no cell in any model view, context or shape contains @sonnet, @luna or the word mix", () => {
    for (const ctx of ["short", "long"] as const) for (const s of SHAPES) {
      for (const r of ["claude-haiku-5.5", "gpt-6-luna"] as const) {
        for (const row of summaryTable(ds, r as never, ctx, s).rows) {
          for (const c of Object.values(row.cells)) {
            expect(c.text).not.toMatch(/@sonnet|@luna|@mix|sonnet mix/i);
            expect(c.note ?? "").not.toMatch(/@sonnet|@luna|sonnet mix/i);
          }
        }
      }
    }
  });
});
