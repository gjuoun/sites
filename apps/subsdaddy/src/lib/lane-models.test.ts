import { describe, expect, test } from "bun:test";
import { laneModelRows, trafficOf, OTHER_SHARE } from "./lane-models";
import type { LaneUsage } from "../data/schema";

const NOW = "2026-10-30T12:00:00Z";
const SRC = "test";

function usage(models: Array<{ m: string; i: number; cr: number; o: number; rows: number; tps?: number | null }>): LaneUsage {
  const tokens = models.reduce((a, m) => ({ input: a.input + m.i, cache_creation: 0, cache_read: a.cache_read + m.cr, output: a.output + m.o }), { input: 0, cache_creation: 0, cache_read: 0, output: 0 });
  return {
    lane: "opencode-go",
    rows: models.reduce((a, m) => a + m.rows, 0),
    tokens,
    cache_share: null,
    p50_ttft_ms: null,
    p90_ttft_ms: null,
    p50_output_tps: null,
    models: models.map((m) => ({
      upstream_model: m.m,
      rows: m.rows,
      tokens: { input: m.i, cache_creation: 0, cache_read: m.cr, output: m.o },
      cost_usd: 0,
      p50_ttft_ms: 1000,
      p90_ttft_ms: 2000,
      p50_output_tps: m.tps ?? null,
      measured_at: NOW,
      source: SRC,
    })),
    measured_at: NOW,
    source: SRC,
  };
}

describe("model rows for a lane", () => {
  const lane = usage([
    { m: "deepseek-v4.1-flash", i: 100, cr: 800, o: 100, rows: 60, tps: 150 },
    { m: "mimo-v2.6-flash", i: 50, cr: 300, o: 50, rows: 35, tps: 70 },
    { m: "glm-5.3-flash", i: 1, cr: 5, o: 0, rows: 2, tps: 60 },
  ]);

  test("a model under one percent of the lane's tokens folds into one other row", () => {
    const rows = laneModelRows({ usage: lane, limits: null, measuredAt: NOW, source: SRC });
    expect(rows.length).toBe(3);
    expect(rows[0].upstream_model).toBe("deepseek-v4.1-flash");
    expect(rows[0].label).toBe("DeepSeek V4.1 Flash");
    expect(rows[2].upstream_model).toBe("__other__");
    expect(rows[2].label).toBe("Other models (1)");
    expect(rows.some((r) => r.upstream_model === "glm-5.3-flash")).toBe(false);
    expect(rows.reduce((a, r) => a + r.share_7d, 0)).toBeCloseTo(1, 6);
    expect(rows[0].share_7d).toBeGreaterThan(rows[1].share_7d);
    expect(rows[2].limit_reason).toContain("under");
    expect(rows[2].p50_output_tps).toBeNull();
  });

  test("only the OpenCode Go plan carries per-model limits, and the map names each model", () => {
    const limits = new Map<string, number>([["DeepSeek V4.1 Flash", 80], ["MiMo-V2.6-Flash", 60]]);
    const rows = laneModelRows({ usage: lane, limits, measuredAt: NOW, source: SRC });
    expect(rows[0].limit_usd_month).toBe(80);
    expect(rows[0].limit_reason).toBeNull();
    expect(rows[1].limit_usd_month).toBe(60);
    expect(rows[1].limit_reason).toBeNull();
    expect(rows[2].limit_usd_month).toBeNull();
    expect(rows[2].limit_reason).toContain("pooled");
    const noPlan = laneModelRows({ usage: lane, limits: null, measuredAt: NOW, source: SRC });
    expect(noPlan[0].limit_usd_month).toBeNull();
    expect(noPlan[0].limit_reason).toBe("this plan publishes no per-model limit");
  });

  test("a lane with no recent rows has no model rows and a reason, not a zero", () => {
    const empty = usage([]);
    expect(laneModelRows({ usage: empty, limits: null, measuredAt: NOW, source: SRC })).toEqual([]);
    const t = trafficOf(empty);
    expect(t.tokens).toBeNull();
    expect(t.requests).toBe(0);
    expect(t.reason).toBe("no traffic in the recent window");
    expect(t.p50_ttft_ms).toBeNull();
  });

  test("traffic is the lane's own 7-day volume, and the cache share is over prompt tokens", () => {
    const t = trafficOf(lane);
    expect(t.tokens).toBe(1406);
    expect(t.requests).toBe(97);
    expect(t.cache_share).toBeCloseTo(1105 / (151 + 1105), 6);
    expect(t.window_days).toBe(7);
  });

  test("the threshold is one percent of the lane, not of a window", () => {
    expect(OTHER_SHARE).toBe(0.01);
  });
});
