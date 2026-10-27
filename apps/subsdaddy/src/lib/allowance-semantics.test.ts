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
    expect(cc.allowance_basis).toBe("vendor_reported");
    expect(cc.allowance_usd_per_cycle).toBe(70);
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

describe("unpriced models are named, and only what has no listing stays unpriced", () => {
  test("CommandCode's binding window flags low coverage; OpenCode Go's does not (its mimo and deepseek ids are priced)", () => {
    expect(byLane("commandcode-goat").low_coverage).toBe(true);
    expect(byLane("opencode-go").low_coverage).toBe(false);
    expect(byLane("opencode-go").binding_unpriced_share).toBeLessThan(0.01);
  });

  test("the one id with no list price on any lane is deepseek-v4.1-flash-fast, named in the data and in models.json", () => {
    const named = new Set<string>();
    for (const l of allowance.lanes) for (const w of l.windows) for (const m of w.unpriced_models) named.add(m);
    expect([...named].filter((m) => m !== "glm-5.3")).toEqual(["deepseek/deepseek-v4.1-flash-fast"]);
    expect(read("models.json").unpriced_notes["deepseek/deepseek-v4.1-flash-fast"]).toContain("no listing");
  });

  test("mimo and the -1017 snapshot are priced through the price table and the aliases, not left unpriced", () => {
    const m = read("models.json");
    expect(m.model_aliases["mimo-v2.6-flash"]).toBe("xiaomi/mimo-v2.6-flash");
    expect(m.model_aliases["deepseek-flash"]).toBe("deepseek/deepseek-v4.1-flash-1017");
    const mimo = m.usage_prices.find((p: any) => p.openrouter === "xiaomi/mimo-v2.6-flash");
    expect([mimo.in_per_m, mimo.out_per_m, mimo.cache_per_m]).toEqual([0.14, 0.28, 0.0028]);
    const ds1017 = m.usage_prices.find((p: any) => p.openrouter === "deepseek/deepseek-v4.1-flash-1017");
    expect([ds1017.in_per_m, ds1017.out_per_m, ds1017.cache_per_m]).toEqual([0.225, 0.9, 0.0045]);
  });
});

describe("Z.ai stays on the board: its weekly window binds at low confidence", () => {
  test("both readings are low_signal (1% used), both are usable, and the weekly window binds", () => {
    const z = byLane("zai-glm-max");
    expect(z.windows.every((w: any) => w.status === "low_signal")).toBe(true);
    expect(z.binding_window).toBe("weekly");
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
    expect(cc.estimate.basis).toContain("is the vendor-reported pool");
  });

  test("OpenCode Go Plus has no lane of its own, so it keeps its published allowance and says so", () => {
    const plus = catalog.rows.find((r: any) => r.plan_id === "opencode-go-plus");
    expect(plus.estimate.basis).not.toContain("allowance measured from the quota windows");
  });
});

describe("Claude: archived prompt counts, the same convention as Codex", () => {
  test("the three plans carry their archived ranges, lower bound used", () => {
    const get = (id: string) => catalog.rows.find((r: any) => r.plan_id === id).message_limit;
    expect([get("claude-code-pro").low, get("claude-code-pro").high]).toEqual([10, 40]);
    expect([get("claude-code-max-5x").low, get("claude-code-max-5x").high]).toEqual([50, 200]);
    expect([get("claude-code-max-20x").low, get("claude-code-max-20x").high]).toEqual([200, 800]);
  });

  test("lower bound, 3 windows a day, 30 days, 100,462 tokens per prompt: Pro 0.090B, Max 5x 0.452B, Max 20x 1.809B per month", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5", "short").rows;
    const cap = (k: string) => rows.find((r) => r.key === k)!.cells.capacity.text;
    expect(cap("claude-code-pro")).toBe("0.09B/mo");
    expect(cap("claude-code-max-5x")).toBe("0.45B/mo");
    expect(cap("claude-code-max-20x")).toBe("1.81B/mo");
    expect(monthlyTokens({ low: 10, high: 40 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(0.0904158, 6);
    expect(monthlyTokens({ low: 50, high: 200 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(0.4520790, 6);
    expect(monthlyTokens({ low: 200, high: 800 }, CONTEXTS.short, 3) / 1e9).toBeCloseTo(1.8083160, 6);
  });

  test("the prompt rows carry the double dagger and their own footnote line, and the view has two lines at most", () => {
    const t = summaryTable(ds, "claude-haiku-5.5", "short");
    expect(t.rows.find((r) => r.key === "claude-code-pro")!.cells.usd.text.endsWith("‡")).toBe(true);
    const lines = (t.footnote ?? "").split("\n");
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(lines).toContain("‡ converted from vendor prompt-count guidance (2025 archive) at 100K context per prompt");
  });
});

describe("capacity hover panel: three windows, the binding window, the model mix, no raw ids", () => {
  test("CommandCode's panel lists its three windows, names the binding window and its model labels", () => {
    const l = ds.lanes.lanes.find((x: any) => x.lane === "commandcode-goat")!;
    const lines = capDetailOf(l);
    expect(lines.some((x) => x.startsWith("monthly · used 50.0%"))).toBe(true);
    expect(lines.some((x) => x.startsWith("weekly · used 100.0%"))).toBe(true);
    expect(lines.some((x) => x.startsWith("binding: monthly window"))).toBe(true);
    expect(lines).toContain("vendor-reported pool: $70.00 per cycle (used by the model views)");
    expect(lines.join(" ")).not.toMatch(/deepseek\/|z-ai\/|xiaomi\//);
  });
});
