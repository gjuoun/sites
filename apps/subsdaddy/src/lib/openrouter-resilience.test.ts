import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractEndpoints } from "./openrouter";
import { outcomeForModel, type PreviousModel } from "./openrouter-outcome";
import { orForModel } from "./or-stats";
import { benchmarkFileSchema, orEndpointSchema, type OrEndpoint } from "../data/schema";

const MEASURED = "2026-10-27T00:00:00.000Z";
const SLUG = "deepseek/deepseek-v4.1-flash-1017";

type Row = { name: string; stats: { endpoint_id: string; p50_latency: number | null; p50_throughput: number | null; p90_throughput: number | null; request_count: number; window_minutes: number } };
const row = (id: string, name: string, over: Partial<Row["stats"]> = {}): Row => ({
  name,
  stats: { endpoint_id: id, p50_latency: 500, p50_throughput: 50, p90_throughput: 60, request_count: 2000, window_minutes: 30, ...over },
});

/** A bare-model page with a flight payload holding these endpoint rows, as the real page embeds them. */
function page(rows: Row[]): string {
  const payload = "[" + rows.map((r) => JSON.stringify({ provider_display_name: r.name, quantization: "fp8", stats: r.stats })).join(",") + "]";
  return "<script>self.__next_f.push([1," + JSON.stringify(payload) + "])</script>";
}

const endpoint = (id: string, tput = 40): OrEndpoint =>
  orEndpointSchema.parse({ model: SLUG, provider_display_name: "Prev " + id, quantization: "fp8", p50_latency_ms: 400, p50_throughput: tput, p90_throughput: tput + 10, request_count: 3000, window_minutes: 30, confidence: "ok", measured_at: "2026-10-26T23:57:00.000Z", source: "test" });

const previousOk = (): PreviousModel => ({ status: "ok", endpoints: [endpoint("a"), endpoint("b", 35)], measured_at: "2026-10-26T23:57:00.000Z" });

describe("zero throughput is skipped, counted, and never written as a value (r57)", () => {
  test("an endpoint with zero p50 or zero p90 throughput is skipped; the healthy one is kept", () => {
    const html = page([row("ok1", "DeepInfra"), row("z50", "Zeroed50", { p50_throughput: 0 }), row("z90", "Zeroed90", { p90_throughput: 0 })]);
    const out = extractEndpoints(html, SLUG, MEASURED);
    expect(out.endpoints.map((e) => e.provider_display_name)).toEqual(["DeepInfra"]);
    expect(out.skipped_zero_tput).toBe(2);
    expect(out.skipped.map((s) => s.field).sort()).toEqual(["p50_throughput=0", "p90_throughput=0"]);
    for (const e of out.endpoints) expect(e.p50_throughput).toBeGreaterThan(0);
  });
  test("a null or negative throughput is skipped too; the reason names the field", () => {
    const html = page([row("n", "NullTput", { p50_throughput: null }), row("neg", "Negative", { p50_throughput: -3 }), row("ok", "Fine")]);
    const out = extractEndpoints(html, SLUG, MEASURED);
    expect(out.endpoints.length).toBe(1);
    expect(out.skipped_zero_tput).toBe(2);
  });
  test("a row the schema refuses (zero latency) is excluded and counted stale; the page still parses", () => {
    const html = page([row("lat0", "ZeroLatency", { p50_latency: 0 }), row("ok", "Fine")]);
    const out = extractEndpoints(html, SLUG, MEASURED);
    expect(out.endpoints.map((e) => e.provider_display_name)).toEqual(["Fine"]);
    expect(out.stale).toBe(1);
  });
});

describe("a model whose endpoints all report zero throughput is stats_unavailable, not zero (r57)", () => {
  test("two zero-throughput endpoints and no others give stats_unavailable with no endpoints and a count reason", () => {
    const o = outcomeForModel({ slug: SLUG, html: page([row("a", "A", { p50_throughput: 0 }), row("b", "B", { p90_throughput: 0 })]), fetchError: null, measuredAt: MEASURED, previous: null });
    expect(o.status).toBe("stats_unavailable");
    expect(o.endpoints).toEqual([]);
    expect(o.skipped_zero_tput).toBe(2);
    expect(o.reason).toContain("skipped_zero_tput=2");
  });
  test("the speed column shows N/A for it, with that reason, and never a zero", () => {
    const file = benchmarkFileSchema.parse({
      endpoints: [],
      models_status: [{ model: SLUG, status: "stats_unavailable", reason: "every endpoint reported zero throughput (skipped_zero_tput=2); no speed is published", endpoints: 0, measured_at: MEASURED, source: "test" }],
      measured_at: MEASURED,
      source: "test",
    });
    const r = orForModel(file, SLUG);
    expect(r.summary).toBeNull();
    expect(r.reason).toContain("no speed is published");
  });
});

describe("a page that cannot be read keeps the previous trusted snapshot, dated (r57)", () => {
  test("an HTTP failure keeps the previous endpoints and says so, with the snapshot date", () => {
    const prev = previousOk()!;
    const o = outcomeForModel({ slug: SLUG, html: null, fetchError: "http 503", measuredAt: MEASURED, previous: prev });
    expect(o.status).toBe("kept_previous");
    expect(o.endpoints).toEqual(prev.endpoints);
    expect(o.reason).toBe("kept previous snapshot (2026-10-26): http 503");
    expect(o.kept_from).toBe("2026-10-26T23:57:00.000Z");
  });
  test("a page whose structure changed (no stats blocks) keeps the previous snapshot", () => {
    const o = outcomeForModel({ slug: SLUG, html: "<html>new layout, no payload</html>", fetchError: null, measuredAt: MEASURED, previous: previousOk() });
    expect(o.status).toBe("kept_previous");
    expect(o.reason).toContain("payload has no stats blocks");
  });
  test("a payload that throws while parsing keeps the previous snapshot instead of failing the run", () => {
    const bad = "<script>self.__next_f.push([1," + JSON.stringify('[{"provider_display_name":"P","stats":{"endpoint_id": "x" "p50_latency":1}}]') + "])</script>";
    const o = outcomeForModel({ slug: SLUG, html: bad, fetchError: null, measuredAt: MEASURED, previous: previousOk() });
    expect(o.status).toBe("kept_previous");
    expect(o.reason).toContain("payload did not parse");
  });
  test("with no trusted snapshot to keep, the model is unavailable with the reason", () => {
    const o = outcomeForModel({ slug: SLUG, html: null, fetchError: "http 503", measuredAt: MEASURED, previous: null });
    expect(o.status).toBe("unavailable");
    expect(o.reason).toBe("http 503");
    expect(o.endpoints).toEqual([]);
  });
  test("a previous status that was itself unavailable is not kept", () => {
    const o = outcomeForModel({ slug: SLUG, html: null, fetchError: "http 500", measuredAt: MEASURED, previous: { status: "unavailable", endpoints: [], measured_at: "2026-10-26T00:00:00.000Z" } });
    expect(o.status).toBe("unavailable");
  });
  test("the speed tooltip shows the kept note beside the figures", () => {
    const prev = previousOk()!;
    const o = outcomeForModel({ slug: SLUG, html: null, fetchError: "http 503", measuredAt: MEASURED, previous: prev });
    const file = benchmarkFileSchema.parse({
      endpoints: o.endpoints,
      models_status: [{ model: SLUG, status: o.status, reason: o.reason, endpoints: o.endpoints.length, measured_at: o.kept_from ?? MEASURED, source: "test" }],
      measured_at: MEASURED,
      source: "test",
    });
    const r = orForModel(file, SLUG);
    expect(r.summary).not.toBeNull();
    expect(r.kept).toBe("kept previous snapshot (2026-10-26): http 503");
  });
});

describe("the shipped benchmark holds no zero or missing throughput (r57)", () => {
  const file = benchmarkFileSchema.parse(JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "benchmark.json"), "utf8")));
  test("every shipped endpoint has positive p50 and p90 throughput", () => {
    for (const e of file.endpoints) {
      expect(e.p50_throughput).toBeGreaterThan(0);
      expect(e.p90_throughput).not.toBeNull();
      expect(e.p90_throughput as number).toBeGreaterThan(0);
    }
  });
  test("every model status is one of the four named states", () => {
    for (const s of file.models_status) expect(["ok", "unavailable", "stats_unavailable", "kept_previous"]).toContain(s.status);
  });
});
