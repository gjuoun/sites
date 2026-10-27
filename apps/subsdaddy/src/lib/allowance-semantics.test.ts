import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { summaryTable, capDetailOf } from "./summary";
import { monthlyTokens } from "../data/messages";
import { CONTEXTS } from "../data/messages";
import type { DS } from "./sections";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const allowance = read("allowance.json");
const lanes = read("lanes.json").lanes;
const catalog = read("catalog.json");
const ds = dataset as unknown as DS;
const byLane = (id: string) => allowance.lanes.find((l: any) => l.lane === id);
const laneRec = (id: string) => lanes.find((l: any) => l.lane === id);

describe("allowance: the tightest usable window binds, from the window's own cost", () => {
  test("CommandCode: the monthly window binds; its allowance is the monthly cost over its used fraction", () => {
    const cc = byLane("commandcode-goat");
    expect(cc.binding_window).toBe("monthly");
    const m = cc.windows.find((w: any) => w.window === "monthly");
    expect(cc.allowance_basis).toBe("vendor_published");
    expect(cc.allowance_usd_per_cycle).toBe(80);
    expect(cc.allowance_vendor_usd).toBe(70);
    expect(cc.allowance_derived_usd).toBeCloseTo(m.cost_usd / (m.used_pct / 100), 6);
  });

  test("the plan allowance is the minimum over its usable windows, for CommandCode and OpenCode Go", () => {
    for (const id of ["commandcode-goat", "opencode-go"]) {
      const l = byLane(id);
      const usable = l.windows.filter((w: any) => w.allowance_usd_cycle !== null).map((w: any) => w.allowance_usd_cycle);
      expect(l.allowance_derived_usd).toBeCloseTo(Math.min(...usable), 9);
    }
  });

  test("the cycle is the monthly window's length from the reading: 43,200 minutes, 30 days", () => {
    for (const id of ["commandcode-goat", "opencode-go", "qwen-cloud-token"]) {
      expect(byLane(id).cycle_minutes).toBe(43200);
      expect(byLane(id).cycle_days).toBe(30);
    }
  });

  test("CommandCode's weekly window is saturated and usable, and its weekly-scaled allowance does not bind", () => {
    const cc = byLane("commandcode-goat");
    const w = cc.windows.find((x: any) => x.window === "weekly");
    expect(w.used_pct).toBe(100);
    expect(w.status).toBe("usable");
    expect(w.allowance_usd_cycle).toBeGreaterThan(cc.allowance_usd_per_cycle);
  });

  test("OpenCode Go's monthly window binds, with its tokens per cycle, and its measured $/B is fee over those tokens", () => {
    const go = byLane("opencode-go");
    expect(go.binding_window).toBe("monthly");
    // the live window moves with each refresh: the check is that the figure is a usable monthly window, not a fixed value
    expect(go.tokens_per_cycle / 1e9).toBeGreaterThan(1);
    const rec = laneRec("opencode-go");
    expect(rec.usd_per_b).toBeCloseTo(10 / (go.tokens_per_cycle / 1e9), 9);
  });

  test("CommandCode is measured on its own window, not derived from a peer", () => {
    expect(laneRec("commandcode-goat").usd_per_b_basis).toBe("measured");
    expect(laneRec("commandcode-goat").usd_per_b).toBeCloseTo(10 / (byLane("commandcode-goat").tokens_per_cycle / 1e9), 9);
  });
});

describe("every token is priced: no binding window has unpriced tokens", () => {
  test("no lane has an unpriced binding window; CommandCode is not flagged low coverage", () => {
    for (const id of ["commandcode-goat", "opencode-go", "zai-glm-max", "qwen-cloud-token"]) {
      expect(byLane(id).binding_unpriced_share).toBe(0);
      expect(byLane(id).low_coverage).toBe(false);
    }
  });

  test("no window in the data names an unpriced model", () => {
    for (const l of allowance.lanes) for (const w of l.windows) expect(w.unpriced_models).toEqual([]);
  });

  test("deepseek-v4.1-flash-fast is priced as an assumed alias of deepseek-v4.1-flash, and says so", () => {
    const fast = read("models.json").usage_prices.find((p: any) => p.openrouter === "deepseek/deepseek-v4.1-flash-fast");
    expect(fast.price_basis).toBe("assumed_alias_rate");
    expect([fast.in_per_m, fast.out_per_m, fast.cache_per_m]).toEqual([0.18125, 0.725, 0.003625]);
    expect(fast.source).toContain("no public listing");
  });

  test("glm-5.3 is priced at the QwenCloud listed rate, not as an assumed alias", () => {
    const g = read("models.json").usage_prices.find((p: any) => p.openrouter === "z-ai/glm-5.3");
    expect(g.price_basis).toBe("list price");
    expect([g.in_per_m, g.out_per_m, g.cache_per_m]).toEqual([1.4, 4.4, 0.28]);
  });
});

describe("Z.ai stays on the board: its weekly window binds at low confidence", () => {
  test("both readings are low_signal, both are usable, and the binding window is the tighter of the two (r46: the live reading moves it)", () => {
    const z = byLane("zai-glm-max");
    expect(z.windows.every((w: any) => w.status === "low_signal")).toBe(true);
    expect(["5h", "weekly"]).toContain(z.binding_window);
    expect(z.allowance_usd_per_cycle).toBeGreaterThan(0);
  });
  test("Z.ai is ranked with a $/B, its confidence is low, and the basis is the annual fee prorated to 7 days", () => {
    const rec = laneRec("zai-glm-max");
    expect(rec.usd_per_b).not.toBeNull();
    expect(rec.usd_per_b_basis).toBe("measured");
    expect(rec.capacity.confidence).toBe("low");
    expect(rec.capacity.fee_basis).toContain("annual fee prorated");
  });

  test("the prorated fee is the $672 annual price times 7 days over 365", () => {
    expect(byLane("zai-glm-max").fee_per_cycle_usd).toBeCloseTo(672 * 7 / 365, 6);
  });

  test("Z.ai's $/B is its fee per cycle over its weekly tokens per cycle", () => {
    const z = byLane("zai-glm-max");
    expect(laneRec("zai-glm-max").usd_per_b).toBeCloseTo(z.fee_per_cycle_usd / (z.tokens_per_cycle / 1e9), 6);
  });
});

describe("Qwen: the monthly window reproduces the credit pool it already valued", () => {
  test("allowance within 1% of the $20.26 credit-pool value", () => {
    const q = byLane("qwen-cloud-token");
    expect(Math.abs(q.allowance_usd_per_cycle - 20.26) / 20.26).toBeLessThan(0.01);
  });
});

describe("model views: an allowance-based $/B on each plan's own traffic shape", () => {
  test("CommandCode's DeepSeek $/B = fee ÷ allowance × that model's blended list $/B, from the stored blend", () => {
    const cc = catalog.rows.find((r: any) => r.plan_id === "commandcode-goat-published");
    const v = cc.estimate.values.find((x: any) => x.ref === "deepseek-v4.1-flash" && x.shape === "agent");
    expect(v.usd_per_b).toBeCloseTo((10 / byLane("commandcode-goat").allowance_usd_per_cycle) * v.blended_usd_per_b, 6);
    expect(cc.estimate.basis).toContain("is the published allowance");
  });

  test("OpenCode Go Plus has no lane of its own, so it keeps its published allowance and says so", () => {
    const plus = catalog.rows.find((r: any) => r.plan_id === "opencode-go-plus");
    expect(plus.estimate.basis).not.toContain("allowance measured from the quota windows");
  });
});

describe("Claude: the prompt-count conversion stays a methodology lower bound; the table shows the third-party allowance (r45)", () => {
  test("the lower-bound conversion is 3 windows a day, 30 days, 100,462 tokens per prompt: Pro 0.090B, Max 5x 0.452B, Max 20x 1.809B per month", () => {
    expect(monthlyTokens({ low: 10, high: 40 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(0.0904158, 6);
    expect(monthlyTokens({ low: 50, high: 200 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(0.4520790, 6);
    expect(monthlyTokens({ low: 200, high: 800 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(1.8083160, 6);
  });

  test("the Haiku table shows each Claude plan with a t marker and no prompt footnote", () => {
    const t = summaryTable(ds, "claude-haiku-5.5", "short");
    for (const k of ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"]) {
      const r = t.rows.find((x) => x.key === k)!;
      expect(r.cells.allowance.na).toBe(false);
      expect((r.cells.allowance as { sup?: string }).sup).toBe("t");
    }
    expect(t.footnote ?? "").not.toContain("converted from vendor prompt-count guidance");
  });
});

describe("capacity hover panel: three windows, the binding window, the model mix, no raw ids", () => {
  test("CommandCode's panel lists its three windows, names the binding window and its model labels", () => {
    const l = ds.lanes.lanes.find((x: any) => x.lane === "commandcode-goat")!;
    const lines = capDetailOf(l);
    expect(lines.some((x) => x.startsWith("monthly · used 50.0%"))).toBe(true);
    expect(lines.some((x) => x.startsWith("weekly · used 100.0%"))).toBe(true);
    expect(lines.some((x) => x.startsWith("binding: monthly window"))).toBe(true);
    expect(lines).toContain("published allowance: $80.00 per cycle (used by the model views)");
    expect(lines).toContain("dashboard pool: $70.00 (matches the monthly window): recorded as a difference from the published figure");
    expect(lines.join(" ")).not.toMatch(/deepseek\/|z-ai\/|xiaomi\//);
  });
});
