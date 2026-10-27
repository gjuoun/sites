import { describe, expect, test } from "bun:test";
import { cycleUsd, fmtK, haikuUsdPerB, sensitivityGrid } from "./claude-hours";
import { pooledMix, type TokenTotals } from "../data/estimate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { catalogFileSchema } from "../data/catalog";
import { summaryTable, viewRows, SHAPES } from "./summary";
import { modelsFileSchema } from "../data/schema";
import type { DS } from "./sections";

const APP_ROOT = join(import.meta.dir, "..", "..");

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const models = modelsFileSchema.parse(read("models.json"));
const ds = dataset as unknown as DS;

describe("Copilot: a dollar allowance from base credits", () => {
  test("Pro is 1,000 base credits at $0.01: a $10 allowance; Pro+ is 3,900 credits: $39", () => {
    const pro = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!;
    const pp = catalog.rows.find((r) => r.plan_id === "github-copilot-pro-plus")!;
    expect(pro.allowance[0]!.usd).toBeCloseTo(1000 * 0.01, 9);
    expect(pp.allowance[0]!.usd).toBeCloseTo(3900 * 0.01, 9);
    expect(pro.allowance_model).toBe("usd_usage");
  });

  test("Copilot lists Claude Haiku 5.5 and GPT-6 Luna, and its estimate is fee over allowance times the blend", () => {
    const pro = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!;
    expect(pro.offered_models).toEqual(["claude-haiku-5.5", "gpt-6-luna"]);
    expect(pro.estimate?.status).toBe("estimated");
    for (const v of pro.estimate!.values) if (v.usd_per_b !== null) expect(v.fee_over_allowance).toBeCloseTo(1, 9);
  });

  test("the Copilot figure is the list-price blend itself, because $10 buys $10 of usage", () => {
    const v = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!.estimate!.values.find((x) => x.ref === "gpt-6-luna" && x.shape === "agent")!;
    expect(v.usd_per_b).toBeCloseTo(v.blended_usd_per_b, 6);
  });
});

describe("Codex: messages per window converted to tokens", () => {
  test("Plus on GPT-6 Luna, at the lower bound, is a converted row with a dagger, not a dollar allowance", () => {
    const plus = catalog.rows.find((r) => r.plan_id === "codex-plus")!;
    expect(plus.allowance).toEqual([]);
    expect(plus.message_limit).toMatchObject({ model: "gpt-6-luna", low: 350, high: 3000, window_hours: 5 });
    const row = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === "codex-plus")!;
    expect(row.marker).toBe("†");
    expect(row.capacity).toBe("3.16B/mo");
    expect(row.usd).toBeCloseTo(20 / (350 * 3 * 30 * 100462 / 1e9), 6);
  });

  test("at the 350K standard the same Plus row is 11.04B/mo and its $/B is lower", () => {
    const short = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === "codex-plus")!;
    const long = viewRows(ds, "gpt-6-luna", "long").find((r) => r.key === "codex-plus")!;
    expect(long.capacity).toBe("11.04B/mo");
    expect(long.usd!).toBeLessThan(short.usd!);
  });

  test("the Codex footnote on the Luna view is the second line, and the view has at most four lines", () => {
    const t = summaryTable(ds, "gpt-6-luna", "short");
    const lines = (t.footnote ?? "").split("\n");
    expect(lines.length).toBe(4);
    expect(lines[1]).toBe("† converted from vendor message limits at 100K context per message");
  });

  test("Codex Pro rows are N/A with the page's reason: no five-hour limit", () => {
    for (const id of ["codex-pro", "codex-pro-20x"]) {
      const row = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === id)!;
      expect(row.usd).toBeNull();
      expect(row.capacityReason).toContain("no five-hour message limit");
    }
  });
});

describe("Claude plans: N/A in the table; the tooltip carries the span; the sensitivity table is methodology only (r44)", () => {
  const ids = ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"];
  const plansFile = JSON.parse(readFileSync(join(APP_ROOT, "data", "claude-plans.json"), "utf8"));
  const ctx = JSON.parse(readFileSync(join(APP_ROOT, "data", "context.json"), "utf8"));
  const usage = JSON.parse(readFileSync(join(APP_ROOT, "data", "usage.json"), "utf8"));
  const heavy = ctx.throughput.tokens_per_active_hour.p50 as number;
  const mixRaw = pooledMix(usage.lanes.map((l: { tokens: TokenTotals }) => ({ tokens: l.tokens })));
  const mix = { output_share: mixRaw.output_share, cache_share: mixRaw.agent_cache_share, cache_write_share: mixRaw.cache_write_share ?? 0 };
  const pr = plansFile.price;
  const price = { in_per_m: pr.in_per_m, out_per_m: pr.out_per_m, cache_per_m: pr.cache_read_per_m, cache_write_per_m: pr.cache_write_per_m };
  const haiku = (modelsFileSchema.parse(JSON.parse(readFileSync(join(APP_ROOT, "data", "models.json"), "utf8")))).reference.find((r) => r.ref === "claude-haiku-5.5")!;

  test("the three Claude plans carry no dollar allowance in the catalog", () => {
    for (const id of ids) {
      const r = catalog.rows.find((x) => x.plan_id === id)!;
      expect(r.allowance.length).toBe(0);
      expect(r.allowance_reason ?? "").toContain("Anthropic publishes hours of usage, not a dollar allowance");
    }
  });

  test("in the Haiku view each Claude plan is N/A in allowance, capacity and $/B", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    for (const id of ids) {
      const r = rows.find((x) => x.key === id)!;
      expect(r.cells.allowance.na).toBe(true);
      expect(r.cells.capacity.na).toBe(true);
      expect(r.cells.usd.na).toBe(true);
    }
  });

  test("the tooltip names the span, computed from the sourced inputs, and the burn rate read from context.json", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const t = rows.find((x) => x.key === "claude-code-max-20x")!.cells.usd.title ?? "";
    const lows = plansFile.plans.map((p: { hours_per_week_low: number }) => cycleUsd(p.hours_per_week_low, heavy, price, mix).usdPerCycle);
    expect(t).toContain("Anthropic publishes hours of usage, not a dollar allowance.");
    expect(t).toContain(fmtK(Math.min(...lows)) + "–" + fmtK(Math.max(...lows)) + "/mo, too wide to publish as a number.");
    expect(t).toContain((heavy / 1e6).toFixed(1) + "M tokens per active hour");
  });

  test("the span is the lower-bound dollars at the measured burn rate, lowest to highest plan, from the sourced inputs", () => {
    const lows = plansFile.plans.map((p: { hours_per_week_low: number }) => cycleUsd(p.hours_per_week_low, heavy, price, mix).usdPerCycle);
    expect(Math.min(...lows)).toBeLessThanOrEqual(Math.max(...lows));
    expect(fmtK(Math.min(...lows))).toMatch(/^\$\d+(\.\d)?k$/);
    expect(fmtK(Math.max(...lows))).toMatch(/^\$\d+(\.\d)?k$/);
  });

  test("the burn-rate constant is read from context.json: no source file types 46.2M or the raw median", () => {
    for (const f of ["src/lib/claude-hours.ts", "scripts/build-claude-hours.ts", "src/routes/methodology.tsx"]) {
      const text = readFileSync(join(APP_ROOT, f), "utf8");
      expect(text).not.toMatch(/46[.,]2|46224649|46_224_649/);
    }
    expect(heavy).toBeGreaterThan(0);
    expect(ctx.throughput.source).toContain("all four token classes");
  });

  test("the price is the pricing page's Sonnet 5.5 row: cache read $0.10, not $0.20", () => {
    expect(pr.model).toBe("Claude Sonnet 5.5");
    expect(pr.cache_read_per_m).toBe(0.1);
    expect(JSON.stringify(plansFile)).not.toMatch(/"\$0\.20 \/ MTok"/);
  });

  test("the sensitivity grid: six rows (three plans, lower and upper), three burn rates; the heavy column is context.json's median", () => {
    const grid = sensitivityGrid({ plans: plansFile.plans.map((p: { plan: string; plan_id: string; hours_per_week_low: number; hours_per_week_high: number }) => ({ plan: p.plan, plan_id: p.plan_id, hours_low: p.hours_per_week_low, hours_high: p.hours_per_week_high })), price, mix, haiku: haiku as never, heavy });
    expect(grid.length).toBe(6);
    expect(grid.every((g) => g.cells.length === 3)).toBe(true);
    expect(grid[0].cells[2].intensity.tokensPerActiveHour).toBe(heavy);
    expect(grid[0].cells[0].intensity.tokensPerActiveHour).toBe(5_000_000);
    expect(grid[0].cells[1].intensity.tokensPerActiveHour).toBe(15_000_000);
  });

  test("a cell is hours x burn rate x blend x 30/7, and its Haiku billions are dollars over Haiku's blend", () => {
    const grid = sensitivityGrid({ plans: plansFile.plans.map((p: { plan: string; plan_id: string; hours_per_week_low: number; hours_per_week_high: number }) => ({ plan: p.plan, plan_id: p.plan_id, hours_low: p.hours_per_week_low, hours_high: p.hours_per_week_high })), price, mix, haiku: haiku as never, heavy });
    const upperMax5x = grid.find((g) => g.plan_id === "claude-code-max-5x" && g.bound === "upper")!;
    const cell = upperMax5x.cells[1];
    const blend = cycleUsd(1, 1e9, price, mix).usdPerB;
    expect(Math.abs(cell.usd - (280 * 15_000_000 / 1e9) * blend * 30 / 7)).toBeLessThan(0.01);
    expect(Math.abs(cell.haikuB * haikuUsdPerB(haiku as never, mix) - cell.usd)).toBeLessThan(0.01);
  });
});

describe("reference models: the Luna and Haiku prices are the ones the official plans are read at", () => {
  test("the reference list has Haiku 5.5 and GPT-6 Luna", () => {
    expect(models.reference.map((r) => r.ref)).toEqual(expect.arrayContaining(["claude-haiku-5.5", "gpt-6-luna"]));
  });
});
