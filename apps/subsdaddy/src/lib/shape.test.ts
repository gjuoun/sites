import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { MEASURED, SHAPES, shapeUsd, summaryTable, viewRows } from "./summary";
import type { DS } from "./sections";
import { catalogFileSchema, type CatalogRow } from "../data/catalog";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commandcodeLive } from "./live";

const ds = dataset as unknown as DS;
const CC = "commandcode-goat-published";
const GO = "opencode-go-go";
const catalog = catalogFileSchema.parse(JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "catalog.json"), "utf8")));
const row = (id: string): CatalogRow => catalog.rows.find((r) => r.plan_id === id)!;
const dsValue = (id: string) => row(id).estimate!.values.find((v) => v.ref === "deepseek-v4.1-flash" && v.shape === "agent")!;
const ccV = dsValue(CC);
const goV = dsValue(GO);
const usdOf = (view: string, id: string, shape: (typeof SHAPES)[number]) => viewRows(ds, view as never, "short", shape).find((r) => r.key === id)!.usd!;

describe("the shapes", () => {
  test("every shape's prompt shares sum to one, and the three are cache-heavy, agent and cold", () => {
    expect(SHAPES.map((s) => s.id)).toEqual(["cache_heavy", "agent", "cold"]);
    for (const s of SHAPES) expect((s.cache_read_share_of_prompt ?? 0) + (s.input_share_of_prompt ?? 0)).toBeCloseTo(1, 9);
  });
});

describe("under one shape, the same fee and the same allowance give the same $/B", () => {
  test.skipIf(!commandcodeLive)("with equal allowances, CommandCode and OpenCode Go are equal under every shape (same fee, same DeepSeek price)", () => {
    for (const s of SHAPES) {
      const cc = shapeUsd({ fee: 10, allowance: 80, price: ccV.price_used as never, ctx_tokens: 100_000, shape: s }).usd;
      const go = shapeUsd({ fee: 10, allowance: 80, price: goV.price_used as never, ctx_tokens: 100_000, shape: s }).usd;
      expect(Math.abs(cc - go)).toBeLessThanOrEqual(0.01);
    }
  });

  test.skipIf(!commandcodeLive)("with the allowances the data holds, the two $/B differ by exactly the ratio of the allowances, in every shape", () => {
    for (const s of SHAPES) {
      const cc = usdOf("deepseek-v4.1-flash", CC, s);
      const go = usdOf("deepseek-v4.1-flash", GO, s);
      expect(cc / go).toBeCloseTo(goV.allowance_usd! / ccV.allowance_usd!, 6);
    }
  });

  test.skipIf(!commandcodeLive)("the shape changes the $/B of a plan, so a shape is not a no-op", () => {
    const a = usdOf("deepseek-v4.1-flash", CC, SHAPES[0]);
    const c = usdOf("deepseek-v4.1-flash", CC, SHAPES[2]);
    expect(a).not.toBeCloseTo(c, 6);
  });
});

describe("Measured does not depend on the shape", () => {
  test("the Measured rows are identical under every shape", () => {
    const texts = (s: (typeof SHAPES)[number]) => summaryTable(ds, MEASURED, "short", s).rows.map((r) => [r.cells.usd.text, r.cells.tps.text, r.cells.ttft.text]);
    expect(texts(SHAPES[0])).toEqual(texts(SHAPES[1]));
    expect(texts(SHAPES[0])).toEqual(texts(SHAPES[2]));
  });
});

describe("the assumed-rate share is in the data, and names its rate", () => {
  test.skipIf(!commandcodeLive)("CommandCode's binding window reports a positive assumed share below half, from deepseek-v4.1-flash-fast", () => {
    const s = ds.lanes.lanes.find((l: any) => l.lane === "commandcode-goat")!.capacity.assumed_share ?? 0;
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(0.5);
    const fast = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "models.json"), "utf8")).usage_prices.find((p: any) => p.openrouter === "deepseek/deepseek-v4.1-flash-fast");
    expect(fast.price_basis).toBe("assumed_alias_rate");
  });
});
