import { describe, expect, test } from "bun:test";
import { formatRange, median, orForModel, rangeOf, summarizeOr } from "./or-stats";
import type { OrEndpoint } from "../data/schema";

const ep = (over: Partial<OrEndpoint>): OrEndpoint => ({
  model: "m/x", provider_display_name: "P", quantization: "fp8", p50_latency_ms: 1000, p50_throughput: 50,
  p90_throughput: 40, request_count: 5000, window_minutes: 30, confidence: "ok",
  measured_at: "2026-10-26T17:00:00Z", source: "t", ...over,
});

describe("median and range", () => {
  test("median of an odd and an even sample", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  test("an empty sample has no median and no range: null, never zero", () => {
    expect(median([])).toBeNull();
    expect(rangeOf([])).toBeNull();
  });

  test("range carries min, max and median", () => {
    expect(rangeOf([24, 249, 88])).toEqual({ min: 24, max: 249, median: 88 });
  });
});

describe("OpenRouter summary per model", () => {
  test("no endpoints is no summary", () => {
    expect(summarizeOr([])).toBeNull();
  });

  test("low-confidence endpoints are counted, not dropped", () => {
    const s = summarizeOr([ep({ p50_throughput: 20 }), ep({ p50_throughput: 80, request_count: 400, confidence: "low_confidence" })]);
    expect(s?.endpoints).toBe(2);
    expect(s?.low_confidence).toBe(1);
    expect(s?.tps).toEqual({ min: 20, max: 80, median: 50 });
  });

  test("a model whose fetch failed is N/A with the reason; no endpoints are invented for it", () => {
    const r = orForModel(
      { endpoints: [], models_status: [{ model: "anthropic/claude-haiku-5.5", status: "unavailable", reason: "payload has no stats blocks", endpoints: 0 }] },
      "anthropic/claude-haiku-5.5",
    );
    expect(r.summary).toBeNull();
    expect(r.reason).toBe("payload has no stats blocks");
  });

  test("a model that was never fetched is N/A with a reason", () => {
    const r = orForModel({ endpoints: [], models_status: [] }, "z-ai/glm-5.3-flash");
    expect(r.summary).toBeNull();
    expect(r.reason).toBe("not fetched from OpenRouter");
  });

  test("a fetched model with no endpoints says so", () => {
    const r = orForModel({ endpoints: [], models_status: [{ model: "m/x", status: "ok", reason: null, endpoints: 0 }] }, "m/x");
    expect(r.summary).toBeNull();
    expect(r.reason).toBe("no endpoints reported for this model");
  });
});

describe("range text", () => {
  test("a range reads min–max with the median", () => {
    expect(formatRange({ min: 24, max: 249, median: 88 })).toBe("24–249 (median 88)");
  });

  test("a single value reads as the value", () => {
    expect(formatRange({ min: 88, max: 88, median: 88 })).toBe("88");
  });

  test("no range reads N/A, never a dash or zero", () => {
    expect(formatRange(null)).toBe("N/A");
  });
});
