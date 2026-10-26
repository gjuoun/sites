import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogFileSchema } from "./catalog";
import { modelsFileSchema } from "./schema";
import { averagePrice, tierBasis } from "./peak-offpeak";

const APP_ROOT = join(import.meta.dir, "..", "..");
const DATA = join(APP_ROOT, "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const models = modelsFileSchema.parse(read("models.json"));
const qwen = catalog.rows.find((r) => r.plan_id === "qwen-cloud-token-owner-10")!;
const cc = catalog.rows.find((r) => r.plan_id === "commandcode-goat-published")!;
const oc = catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;
const tierOf = (id: string) => models.usage_models.find((u) => u.upstream_model === id)!.peak_offpeak!;

describe("official peak and off-peak tiers", () => {
  test("the DeepSeek off-peak band is exactly half of peak, as the official page states", () => {
    const ds = tierOf("deepseek-v4.1-flash");
    expect(ds.offpeak_usd_per_m.in_per_m).toBeCloseTo(ds.peak_usd_per_m.in_per_m * 0.5, 9);
    expect(ds.offpeak_usd_per_m.out_per_m).toBeCloseTo(ds.peak_usd_per_m.out_per_m * 0.5, 9);
    expect(ds.offpeak_usd_per_m.cache_per_m).toBeCloseTo(ds.peak_usd_per_m.cache_per_m * 0.5, 9);
  });

  test("qwen3.8 off-peak is 0.6 x peak, and its time band is inherited from DeepSeek", () => {
    for (const id of ["qwen3.8-max", "qwen3.8-flash"]) {
      const t = tierOf(id);
      expect(t.offpeak_usd_per_m.in_per_m).toBeCloseTo(t.peak_usd_per_m.in_per_m * 0.6, 9);
      expect(t.band_inherited_from).toBe("deepseek-v4.1-flash");
      expect(t.peak_hours).toBe(14);
      expect(t.offpeak_hours).toBe(10);
    }
  });

  test("DeepSeek rows inherit no band; the 1017 snapshot is priced as the deepseek-v4.1-flash row", () => {
    expect(tierOf("deepseek-v4.1-flash").band_inherited_from).toBeNull();
    expect(tierOf("deepseek-v4.1-flash").priced_as).toBeNull();
    const t1017 = tierOf("deepseek-v4.1-flash-1017");
    expect(t1017.band_inherited_from).toBeNull();
    expect(t1017.priced_as).toBe("deepseek-v4.1-flash");
    expect(t1017.note).toContain("no -1017 row");
  });

  test("no tier note carries to-confirm, brief or assumption wording", () => {
    for (const u of models.usage_models) if (u.peak_offpeak) {
      expect(u.peak_offpeak.note).not.toMatch(/confirm|brief|assumption/i);
    }
  });

  test("the hour weights are 14 peak and 10 off-peak, and the tier average uses them", () => {
    const t = tierOf("deepseek-v4.1-flash");
    expect(t.peak_hours).toBe(14);
    expect(t.offpeak_hours).toBe(10);
    expect(averagePrice({ peak: t.peak_usd_per_m, offpeak: t.offpeak_usd_per_m }).in_per_m).toBeCloseTo(0.2375, 12);
  });

  test("tierBasis appends the band and price source tags only when given", () => {
    const t = { peak: { in_per_m: 2, out_per_m: 6, cache_per_m: 0.25 }, offpeak: { in_per_m: 1.2, out_per_m: 3.6, cache_per_m: 0.15 } };
    expect(tierBasis("qwen3.8-max", t, { band_inherited_from: "deepseek-v4.1-flash" })).toContain("; band_inherited_from: deepseek-v4.1-flash");
    expect(tierBasis("deepseek-v4.1-flash-1017", t, { priced_as: "deepseek-v4.1-flash" })).toContain("; priced_as: deepseek-v4.1-flash");
    expect(tierBasis("x", t)).not.toContain("band_inherited_from");
  });
});

describe("the tiers apply only to the QwenCloud plan", () => {
  test("the QwenCloud credit basis names each family, its average and its band source", () => {
    const basis = qwen.credits_to_usd!.basis;
    expect(basis).toContain("peak $0.3 / $1.2 / $0.03 × 14h");
    expect(basis).toContain("off-peak $0.15 / $0.6 / $0.015 × 10h");
    expect(basis).toContain("avg $0.2375 / $0.95 / $0.02375 per M");
    expect(basis).toContain("priced_as: deepseek-v4.1-flash");
    expect(basis).toContain("qwen3.8-max: peak $2 / $6 / $0.25 × 14h, off-peak $1.2 / $3.6 / $0.15 × 10h → avg $1.667 / $5 / $0.2083 per M (in / out / cache); band_inherited_from: deepseek-v4.1-flash");
  });

  test("the QwenCloud estimate basis carries the average and the price source it used", () => {
    expect(qwen.estimate!.basis).toContain("avg $0.2375 / $0.95 / $0.02375 per M");
    expect(qwen.estimate!.basis).toContain("priced_as: deepseek-v4.1-flash");
  });

  test("CommandCode and OpenCode Go keep their list prices: no tier text on their estimates", () => {
    for (const row of [cc, oc]) {
      expect(row.estimate?.basis ?? "").not.toContain("off-peak");
      expect(row.estimate?.basis ?? "").not.toContain("avg $");
    }
  });

  test("the numbers are unchanged by the wording: $0.000794 per credit and a DeepSeek estimate of about $23.41", () => {
    expect(qwen.credits_to_usd!.usd_per_credit).toBeCloseTo(0.000794, 6);
    const agent = qwen.estimate!.values.find((v) => v.ref === "deepseek-v4.1-flash" && v.shape === "agent")!;
    expect(agent.usd_per_b!).toBeCloseTo(23.41, 1);
  });
});

describe("the methodology states the band fallback", () => {
  test("the DeepSeek band rule appears on the methodology page", () => {
    const page = readFileSync(join(APP_ROOT, "src", "routes", "methodology.tsx"), "utf8");
    expect(page).toContain("When a provider publishes a time-of-day discount without naming the band, the DeepSeek band is used.");
  });
});
