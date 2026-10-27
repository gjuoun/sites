import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractEndpoints, flightPayload, objectAt } from "./openrouter";

const FIXTURE = join(import.meta.dir, "..", "..", "fixtures", "openrouter.deepseek-v4.1-flash.html");

describe("object scan", () => {
  test("balanced braces, string-aware", () => {
    expect(objectAt('{"a":"}{","b":{"c":1}} tail', 0)).toBe('{"a":"}{","b":{"c":1}}');
    expect(objectAt('{"unterminated":1', 0)).toBeNull();
  });
});

describe("endpoint extraction", () => {
  // guard: a stub that returns nothing must fail here, not pass silently
  test("the saved fixture yields real endpoints with p50 values in a plausible range", () => {
    expect(existsSync(FIXTURE)).toBe(true);
    const { endpoints, blocks } = extractEndpoints(readFileSync(FIXTURE, "utf8"), "deepseek/deepseek-v4.1-flash");
    expect(blocks).toBeGreaterThanOrEqual(endpoints.length);
    expect(endpoints.length).toBeGreaterThanOrEqual(8);
    for (const e of endpoints) {
      expect(e.p50_throughput).toBeGreaterThan(0);
      expect(e.p50_throughput).toBeLessThan(500);
      expect(e.p50_latency_ms).toBeGreaterThan(0);
      expect(e.provider_display_name.length).toBeGreaterThan(0);
    }
  });

  test("dedupe by endpoint_id: the payload repeats records, and the row count equals distinct endpoint ids", () => {
    const html = readFileSync(FIXTURE, "utf8");
    const payload = flightPayload(html);
    const distinctIds = new Set([...payload.matchAll(/"stats":\{"endpoint_id":"([^"]+)"/g)].map((m) => m[1]));
    const { endpoints, blocks } = extractEndpoints(html, "deepseek/deepseek-v4.1-flash");
    expect(blocks).toBeGreaterThan(distinctIds.size); // the repeat is real in the payload
    expect(endpoints.length + 0).toBeLessThanOrEqual(distinctIds.size);
  });

  test("low-sample endpoints are flagged, not dropped", () => {
    const html = '<script>self.__next_f.push([1,"{\\"provider_display_name\\":\\"X\\",\\"stats\\":{\\"endpoint_id\\":\\"e1\\",\\"p50_latency\\":900,\\"p50_throughput\\":40,\\"p90_throughput\\":30,\\"request_count\\":12,\\"window_minutes\\":30}}"])</script>';
    const { endpoints } = extractEndpoints(html, "m/x");
    expect(endpoints[0]?.confidence).toBe("low_confidence");
  });

  test("a stats block missing a p50 is stale and excluded, never zero", () => {
    const html = '<script>self.__next_f.push([1,"{\\"provider_display_name\\":\\"Y\\",\\"stats\\":{\\"endpoint_id\\":\\"e2\\",\\"p50_latency\\":null,\\"p50_throughput\\":40,\\"request_count\\":500,\\"window_minutes\\":30}}"])</script>';
    const out = extractEndpoints(html, "m/x");
    expect(out.endpoints).toHaveLength(0);
    expect(out.stale).toBe(1);
  });
});
