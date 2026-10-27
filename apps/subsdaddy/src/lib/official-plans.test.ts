import { describe, expect, test } from "bun:test";
import { cycleUsd } from "./claude-hours";
import { pooledMix, type TokenTotals } from "../data/estimate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { catalogFileSchema } from "../data/catalog";
import { summaryTable, viewRows } from "./summary";
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

describe("Claude: allowance from Anthropic's hour figure × measured throughput (r43)", () => {
  const ids = ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"];
  const plansFile = JSON.parse(readFileSync(join(APP_ROOT, "data", "claude-plans.json"), "utf8"));
  const ctx = JSON.parse(readFileSync(join(APP_ROOT, "data", "context.json"), "utf8"));
  const usage = JSON.parse(readFileSync(join(APP_ROOT, "data", "usage.json"), "utf8"));

  test("each Claude plan carries a vendor_hours allowance, with no N/A reason", () => {
    for (const id of ids) {
      const r = catalog.rows.find((x) => x.plan_id === id)!;
      expect(r.allowance.length).toBe(1);
      expect(r.allowance[0].kind).toBe("vendor_hours");
      expect(r.allowance_reason ?? null).toBeNull();
    }
  });

  test("the allowance is lower-bound hours × the context.json throughput × the Sonnet 5.5 blend at the measured mix × 30/7", () => {
    const mixRaw = pooledMix(usage.lanes.map((l: { tokens: TokenTotals }) => ({ tokens: l.tokens })));
    const mix = { output_share: mixRaw.output_share, cache_share: mixRaw.agent_cache_share, cache_write_share: mixRaw.cache_write_share ?? 0 };
    const pr = plansFile.price;
    const price = { in_per_m: pr.in_per_m, out_per_m: pr.out_per_m, cache_per_m: pr.cache_read_per_m, cache_write_per_m: pr.cache_write_per_m };
    for (const p of plansFile.plans) {
      const expected = cycleUsd(p.hours_per_week_low, ctx.throughput.tokens_per_active_hour.p50, price, mix).usdPerCycle;
      const stored = catalog.rows.find((x) => x.plan_id === p.plan_id)!.allowance[0].usd;
      expect(Math.abs(stored - expected)).toBeLessThan(0.01);
    }
  });

  test("the hours are the archived quotes, and the lower bound is the one used", () => {
    const by = Object.fromEntries(plansFile.plans.map((p: { plan_id: string }) => [p.plan_id, p]));
    expect([by["claude-code-pro"].hours_per_week_low, by["claude-code-pro"].hours_per_week_high]).toEqual([40, 80]);
    expect([by["claude-code-max-5x"].hours_per_week_low, by["claude-code-max-5x"].hours_per_week_high]).toEqual([140, 280]);
    expect([by["claude-code-max-20x"].hours_per_week_low, by["claude-code-max-20x"].hours_per_week_high]).toEqual([240, 480]);
    for (const p of plansFile.plans) {
      expect(p.source.capture).toMatch(/^https:\/\/web\.archive\.org\/web\/20260103125258\//);
      expect(p.source.quote).toContain(String(p.hours_per_week_low) + "-" + String(p.hours_per_week_high) + " hours");
    }
  });

  test("the Sonnet 5.5 price is the pricing page's row: $2 in, $10 out, $0.10 cache read, $2.50 cache write", () => {
    expect(plansFile.price.model).toBe("Claude Sonnet 5.5");
    expect([plansFile.price.in_per_m, plansFile.price.out_per_m, plansFile.price.cache_read_per_m, plansFile.price.cache_write_per_m]).toEqual([2, 10, 0.1, 2.5]);
    expect(plansFile.price.source.quote).toContain("Read $0.10 / MTok");
  });

  test("the throughput is read from context.json, and the file holds no session id, path or prompt", () => {
    const tp = ctx.throughput;
    expect(tp.tokens_per_active_hour.p50).toBeGreaterThan(0);
    expect(tp.window_days).toBe(30);
    expect(tp.min_active_minutes).toBe(9);
    const text = JSON.stringify(tp);
    expect(text).not.toMatch(/\.jsonl|\/Users\/|[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});

describe("reference models: the Luna and Haiku prices are the ones the official plans are read at", () => {
  test("the reference list has Haiku 5.5 and GPT-6 Luna", () => {
    expect(models.reference.map((r) => r.ref)).toEqual(expect.arrayContaining(["claude-haiku-5.5", "gpt-6-luna"]));
  });
});
