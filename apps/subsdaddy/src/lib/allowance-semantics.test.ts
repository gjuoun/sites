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
    expect(cc.allowance_usd_per_cycle).toBeCloseTo(m.cost_usd / (m.used_pct / 100), 6);
  });

  test("the plan allowance is the minimum over its usable windows, for CommandCode and OpenCode Go", () => {
    for (const id of ["commandcode-goat", "opencode-go"]) {
      const l = byLane(id);
      const usable = l.windows.filter((w: any) => w.allowance_usd_cycle !== null).map((w: any) => w.allowance_usd_cycle);
      expect(l.allowance_usd_per_cycle).toBeCloseTo(Math.min(...usable), 9);
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

describe("unpriced models are counted, and flag low coverage", () => {
  test("CommandCode and OpenCode Go carry unpriced tokens above 5% and are flagged low_coverage", () => {
    for (const id of ["commandcode-goat", "opencode-go"]) {
      const l = byLane(id);
      expect(l.binding_unpriced_share).toBeGreaterThan(0.05);
      expect(l.low_coverage).toBe(true);
      expect(l.windows.some((w: any) => w.unpriced_models.length > 0)).toBe(true);
    }
  });

  test("the unpriced models are named in the data, never zeroed into the cost", () => {
    const cc = byLane("commandcode-goat");
    const m = cc.windows.find((w: any) => w.window === "monthly");
    expect(m.unpriced_models).toContain("xiaomi/mimo-v2.6-flash");
    expect(m.unpriced_tokens).toBeGreaterThan(0);
  });
});

describe("Z.ai: no usable window, so no allowance and no $/B", () => {
  test("both readings are low_signal (1% used), and the lane says why", () => {
    const z = byLane("zai-glm-max");
    expect(z.windows.every((w: any) => w.status === "low_signal")).toBe(true);
    expect(laneRec("zai-glm-max").capacity.method).toBe("unavailable");
    expect(laneRec("zai-glm-max").capacity.reason).toContain("low_signal");
    expect(laneRec("zai-glm-max").usd_per_b).toBeNull();
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
    expect(cc.estimate.basis).toContain("allowance measured from the quota windows");
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
    expect(lines.join(" ")).not.toMatch(/deepseek\/|z-ai\/|xiaomi\//);
  });
});
