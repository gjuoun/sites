import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "../lib/dataset";
import { contextFileSchema, CONTEXT_IDS, contextLabel, contextTokens } from "./context";
import { quantile } from "../lib/quantile";
import { sanity } from "../lib/price-guard";
import { MEASURED, summaryTable, viewRows } from "../lib/summary";
import type { DS } from "../lib/sections";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const ds = dataset as unknown as DS;

describe("the session-end context sample", () => {
  const ctx = contextFileSchema.parse(read("context.json"));

  test("the four quantiles are ordered and the histogram accounts for every sampled session", () => {
    const q = ctx.quantiles;
    expect(q.p50).toBeLessThanOrEqual(q.p75);
    expect(q.p75).toBeLessThanOrEqual(q.p90);
    expect(q.p90).toBeLessThanOrEqual(q.max);
    expect(ctx.histogram.reduce((a, h) => a + h.sessions, 0)).toBe(ctx.sample_sessions);
  });

  test("the stored file carries no session id, path, prompt or message content", () => {
    const s = readFileSync(join(DATA, "context.json"), "utf8");
    expect(s).not.toMatch(/\.jsonl|\/Users\/|\.pi\/|sessionId|session_id|"content"|"role"/);
    expect(s).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  test("the standard 100K sits at the median, 350K inside the p75-to-max band of the sample", () => {
    expect(Math.abs(contextTokens("short") - ctx.quantiles.p50)).toBeLessThan(ctx.quantiles.p50 * 0.15);
    // the 350K standard is fixed (r26); the sample p90 drifts with the 45-day window, so the standard must sit in the p75-to-max band
    expect(contextTokens("long")).toBeGreaterThan(ctx.quantiles.p75);
    expect(contextTokens("long")).toBeLessThan(ctx.quantiles.max);
  });
});

describe("quantile method", () => {
  test("linear interpolation between order statistics (R-7)", () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.75)).toBe(3.25);
    expect(quantile([10], 0.9)).toBe(10);
  });
});

describe("the context switch on the front page", () => {
  test("the two contexts are 100K and 350K, labelled", () => {
    expect(CONTEXT_IDS).toEqual(["short", "long"]);
    expect(contextLabel("short")).toBe("100K");
    expect(contextLabel("long")).toBe("350K");
  });

  test("Haiku is cheaper per B at 100K than at 350K (its low tier applies at 100K); Luna moves up at 350K", () => {
    const h100 = viewRows(ds, "claude-haiku-5.5", "short").find((r) => r.key === "opencode-go-go")!.usd!;
    const h350 = viewRows(ds, "claude-haiku-5.5", "long").find((r) => r.key === "opencode-go-go")!.usd!;
    const l100 = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === "opencode-go-go")!.usd!;
    const l350 = viewRows(ds, "gpt-6-luna", "long").find((r) => r.key === "opencode-go-go")!.usd!;
    expect(h100).toBeLessThan(h350);
    expect(l350).toBeGreaterThan(l100);
  });

  test("a model view footnote names its context; the Measured view has no context footnote", () => {
    expect(summaryTable(ds, "gpt-6-luna", "short").footnote).toContain("Prices assume a 100K-token context");
    expect(summaryTable(ds, "gpt-6-luna", "long").footnote).toContain("Prices assume a 350K-token context");
    expect(summaryTable(ds, MEASURED, "long").footnote ?? "").not.toContain("token context");
  });

  test("the Measured $/B does not depend on the context", () => {
    const a = summaryTable(ds, MEASURED, "short").rows.map((r) => r.cells.usd.text);
    const b = summaryTable(ds, MEASURED, "long").rows.map((r) => r.cells.usd.text);
    expect(a).toEqual(b);
  });
});

describe("price guard: a listing that fails the sanity rule never replaces the snapshot", () => {
  test("completion below prompt is refused", () => {
    expect(sanity({ in_per_m: 0.0432, out_per_m: 0.01, cache_per_m: 0.034 })).toContain("completion < prompt");
  });

  test("a zero or missing price is refused", () => {
    expect(sanity({ in_per_m: 0, out_per_m: 1, cache_per_m: 0.01 })).toContain("zero or negative");
    expect(sanity({ in_per_m: 0.1, out_per_m: null, cache_per_m: 0.01 })).toContain("missing");
  });

  test("cache read above prompt is refused", () => {
    expect(sanity({ in_per_m: 0.1, out_per_m: 0.5, cache_per_m: 0.2 })).toContain("cache read > prompt");
  });

  test("a sane listing is accepted", () => {
    expect(sanity({ in_per_m: 0.1, out_per_m: 0.5, cache_per_m: 0.01 })).toBeNull();
  });

  test("the shipped DeepSeek reference is the official mean, a verified listing, or its last verified snapshot, with status and source priority", () => {
    const d = read("models.json").reference.find((r: { ref: string }) => r.ref === "deepseek-v4.1-flash");
    expect(["official", "verified", "anomaly", "unavailable"]).toContain(d.price_status);
    expect(d.source_priority).toBe("official > openrouter");
    if (d.price_status === "official") {
      expect(d.official.source).toBe("https://api-docs.deepseek.com/quick_start/pricing/");
      expect(d.price_note).toContain("Official documentation is authoritative for first-party models");
    } else if (d.price_status === "verified") {
      expect(d.in_per_m).toBe(d.openrouter_listed.in_per_m);
    } else if (d.price_status === "anomaly") {
      expect(d.price_anomaly).toContain("price_anomaly: listing shows completion < prompt");
      expect(d.price_anomaly).toContain("using last verified snapshot " + String(d.last_verified_at).slice(0, 10));
    }
  });

  test("the DeepSeek estimate basis names the anomaly it kept", () => {
    const d = read("models.json").reference.find((r: { ref: string }) => r.ref === "deepseek-v4.1-flash");
    const row = read("catalog.json").rows.find((r: { plan_id: string }) => r.plan_id === "opencode-go-go");
    if (d.price_status === "anomaly") expect(row.estimate.basis).toContain("price_anomaly");
  });
});
