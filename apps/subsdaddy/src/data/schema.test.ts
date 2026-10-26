import { describe, expect, test } from "bun:test";
import { ACCOUNT_TO_LANE, LANES, laneRecordSchema, quotaObservationSchema, reading } from "./schema";

const stamp = "2026-10-26T06:06:22Z";

describe("provenance", () => {
  test("a reading without a source is rejected", () => {
    expect(() => reading.parse({ value: 1, measured_at: stamp })).toThrow();
  });

  test("a reading without a timestamp is rejected", () => {
    expect(() => reading.parse({ value: 1, source: "codexbar" })).toThrow();
  });

  test("an unavailable reading carries a reason and no number", () => {
    expect(reading.parse({ unavailable: "no fetch strategy" })).toEqual({ unavailable: "no fetch strategy" });
  });

  test("a quota observation must name a real lane and a bounded percentage", () => {
    const ok = quotaObservationSchema.parse({
      lane: "go-1",
      window: "weekly",
      window_minutes: 10080,
      used_pct: 6.33,
      resets_at: "2026-11-01T23:59:59Z",
      measured_at: stamp,
      source: "codexbar usage --provider opencodego",
    });
    expect(ok.lane).toBe("go-1");
    expect(() => quotaObservationSchema.parse({ ...ok, used_pct: 140 })).toThrow();
    expect(() => quotaObservationSchema.parse({ ...ok, lane: "deepseek-official" })).toThrow();
  });

  test("the pay-as-you-go account is not one of the five lanes", () => {
    expect(LANES).toHaveLength(5);
    expect(Object.keys(ACCOUNT_TO_LANE)).toEqual(["2", "6", "7", "8", "9"]);
    expect(ACCOUNT_TO_LANE[3]).toBeUndefined();
  });

  test("a lane record cannot carry a number and its own absence at once", () => {
    const base = {
      lane: "qwen",
      label: "QwenCloud token plan",
      price_month_usd: 10,
      price_badge: "plan_spec",
      capacity: {
        method: "unavailable",
        window: null,
        tokens_per_week: null,
        coverage: null,
        seeded: false,
        reason: "no window reading",
        confidence: null,
        confidence_reason: null,
        measured_at: stamp,
        source: "codexbar usage",
      },
      usd_per_b: null,
      measured: { p50_ttft_ms: 3116, p90_ttft_ms: 6007, p50_output_tps: 148, n: 1261, measured_at: stamp, source: "usage_logs" },
      presets: [{ shape: "agent", unavailable: "capacity_usd_unavailable" }],
      flags: [],
      measured_at: stamp,
      source: "usage_logs",
    };
    expect(laneRecordSchema.parse(base).usd_per_b).toBeNull();
    expect(() => laneRecordSchema.parse({ ...base, measured: { ...base.measured, n: -1 } })).toThrow();
  });
});
