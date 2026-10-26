import { describe, expect, test } from "bun:test";
import { ACCOUNT_TO_LANE, LANES, laneRecordSchema, migrateQuotaFile, quotaFileSchema, quotaObservationSchema, reading } from "./schema";

const stamp = "2026-10-26T06:06:22Z";

const lane = {
  lane: "qwen-cloud-token",
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
    badge: null,
    measured_at: stamp,
    source: "codexbar quota reading",
  },
  usd_per_b: null,
  usd_per_b_basis: null,
  usd_per_b_derived_from: null,
  usd_per_b_source: null,
  measured: { p50_ttft_ms: 3116, p90_ttft_ms: 6007, p50_output_tps: 148, n: 1261, measured_at: stamp, source: "usage_logs" },
  presets: [{ shape: "agent", unavailable: "capacity_usd_unavailable" }],
  flags: [],
  measured_at: stamp,
  source: "usage_logs",
};

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

  test("a quota observation must name a real plan and a bounded percentage", () => {
    const ok = quotaObservationSchema.parse({
      lane: "opencode-go",
      window: "weekly",
      window_minutes: 10080,
      used_pct: 6.33,
      resets_at: "2026-11-01T23:59:59Z",
      measured_at: stamp,
      source: "codexbar quota reading",
    });
    expect(ok.lane).toBe("opencode-go");
    expect(() => quotaObservationSchema.parse({ ...ok, used_pct: 140 })).toThrow();
    expect(() => quotaObservationSchema.parse({ ...ok, lane: "deepseek-official" })).toThrow();
  });

  test("the pay-as-you-go account is not one of the plans", () => {
    expect(LANES).toHaveLength(4);
    expect(Object.keys(ACCOUNT_TO_LANE)).toEqual(["2", "6", "7", "8", "9"]);
    expect(ACCOUNT_TO_LANE[3]).toBeUndefined();
  });

  test("a plan record cannot carry a negative count", () => {
    expect(laneRecordSchema.parse(lane).usd_per_b).toBeNull();
    expect(() => laneRecordSchema.parse({ ...lane, measured: { ...lane.measured, n: -1 } })).toThrow();
  });

  test("a derived dollar figure must name the peer it came from", () => {
    const derived = { ...lane, usd_per_b: 9.5, usd_per_b_basis: "derived", usd_per_b_derived_from: "opencode-go", usd_per_b_source: "same-rate estimate" };
    expect(laneRecordSchema.parse(derived).usd_per_b_derived_from).toBe("opencode-go");
    expect(() => laneRecordSchema.parse({ ...derived, usd_per_b_derived_from: "deepseek-official" })).toThrow();
  });
});

describe("legacy quota history", () => {
  test("pre-plan lane ids migrate to plan ids; the second OpenCode subscription has no own line", () => {
    const legacy = {
      observations: [
        { lane: "cc", window: "weekly", window_minutes: 10080, used_pct: 100, resets_at: "2026-10-28T15:50:44Z", measured_at: stamp, source: "codexbar usage" },
        { lane: "go-1", window: "weekly", window_minutes: 10080, used_pct: 7, resets_at: "2026-11-01T23:59:59Z", measured_at: stamp, source: "codexbar usage" },
        { lane: "go-2", unavailable: "no account", measured_at: stamp, source: "codexbar usage" },
      ],
      measured_at: stamp,
      source: "codexbar usage",
    };
    const parsed = quotaFileSchema.parse(migrateQuotaFile(legacy));
    expect(parsed.observations.map((o) => o.lane)).toEqual(["commandcode-goat", "opencode-go"]);
  });
});
