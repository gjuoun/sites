import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogFileSchema } from "./catalog";
import { modelsFileSchema } from "./schema";
import { averagePrice } from "./peak-offpeak";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const models = modelsFileSchema.parse(read("models.json"));
const qwen = catalog.rows.find((r) => r.plan_id === "qwen-cloud-token-owner-10")!;
const cc = catalog.rows.find((r) => r.plan_id === "commandcode-goat-published")!;
const oc = catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;

describe("official peak and off-peak tiers", () => {
  test("the DeepSeek off-peak band is exactly half of peak, as the official page states", () => {
    const ds = models.usage_models.find((u) => u.upstream_model === "deepseek-v4.1-flash")!.peak_offpeak!;
    expect(ds.offpeak_usd_per_m.in_per_m).toBeCloseTo(ds.peak_usd_per_m.in_per_m * 0.5, 9);
    expect(ds.offpeak_usd_per_m.out_per_m).toBeCloseTo(ds.peak_usd_per_m.out_per_m * 0.5, 9);
    expect(ds.offpeak_usd_per_m.cache_per_m).toBeCloseTo(ds.peak_usd_per_m.cache_per_m * 0.5, 9);
  });

  test("qwen3.8 off-peak is 0.6 x peak, the brief's family ratio, and is labelled as such", () => {
    for (const id of ["qwen3.8-max", "qwen3.8-flash"]) {
      const t = models.usage_models.find((u) => u.upstream_model === id)!.peak_offpeak!;
      expect(t.offpeak_usd_per_m.in_per_m).toBeCloseTo(t.peak_usd_per_m.in_per_m * 0.6, 9);
      expect(t.note).toContain("0.6");
    }
  });

  test("the 1017 snapshot has no row on the official page and says so", () => {
    const t = models.usage_models.find((u) => u.upstream_model === "deepseek-v4.1-flash-1017")!.peak_offpeak!;
    expect(t.note).toContain("no -1017 row");
  });

  test("the hour weights are 14 peak and 10 off-peak, and the tier average uses them", () => {
    const t = models.usage_models.find((u) => u.upstream_model === "deepseek-v4.1-flash")!.peak_offpeak!;
    expect(t.peak_hours).toBe(14);
    expect(t.offpeak_hours).toBe(10);
    expect(averagePrice({ peak: t.peak_usd_per_m, offpeak: t.offpeak_usd_per_m }).in_per_m).toBeCloseTo(0.2375, 12);
  });
});

describe("the tiers apply only to the QwenCloud plan", () => {
  test("the QwenCloud credit basis names the peak, off-peak and average prices of both families", () => {
    const basis = qwen.credits_to_usd!.basis;
    expect(basis).toContain("peak $0.3 / $1.2 / $0.03 × 14h");
    expect(basis).toContain("off-peak $0.15 / $0.6 / $0.015 × 10h");
    expect(basis).toContain("avg $0.2375 / $0.95 / $0.02375 per M");
    expect(basis).toContain("qwen3.8-max: peak $2 / $6 / $0.25 × 14h");
    expect(basis).toContain("off-peak $1.2 / $3.6 / $0.15 × 10h");
  });

  test("the QwenCloud estimate basis carries the average it used", () => {
    expect(qwen.estimate!.basis).toContain("avg $0.2375 / $0.95 / $0.02375 per M");
  });

  test("CommandCode and OpenCode Go keep their list prices: no tier text on their estimates", () => {
    for (const row of [cc, oc]) {
      expect(row.estimate?.basis ?? "").not.toContain("off-peak");
      expect(row.estimate?.basis ?? "").not.toContain("avg $");
    }
  });

  test("the QwenCloud credit value is measured, not refused: a positive $ per credit and a pool", () => {
    expect(qwen.credits_to_usd!.usd_per_credit).toBeGreaterThan(0);
    expect(qwen.allowance[0]!.usd).toBeGreaterThan(0);
  });
});
