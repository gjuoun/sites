import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { catalogTable, modelTable, modelTables, officialTable, vsMeasuredText, type DS } from "./sections";
import { REF_IDS } from "../data/estimate";
import { priceAt, blendedUsdPerB } from "../data/estimate";
import { LMC_CONTEXT_SHORT } from "../data/context";
import { catalogFileSchema } from "../data/catalog";
import { officialFileSchema } from "../data/official";
import { wellFormed, type Cell } from "./cells";

const ds = dataset as unknown as DS;
const allCells = (t: { rows: Array<{ cells: Record<string, Cell> }> }) => t.rows.flatMap((r) => Object.values(r.cells));
const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));

describe("offered models: a plan with no listing for a model is not a row", () => {
  test("OpenCode is not in the Gemini table, because OpenCode does not offer Gemini 3.8 Flash", () => {
    const gemini = modelTable(ds, "gemini-3.8-flash");
    expect(gemini.rows.map((r) => r.key)).not.toContain("opencode-go-go");
    expect(gemini.rows.map((r) => r.key)).not.toContain("opencode-go-plus");
  });

  test("every row in a model table is a plan whose whitelist contains that model", () => {
    const catalog = catalogFileSchema.parse(read("catalog.json"));
    for (const ref of REF_IDS) {
      const t = modelTable(ds, ref);
      for (const r of t.rows) {
        const row = catalog.rows.find((c) => c.plan_id === r.key)!;
        expect(row.offered_models).toContain(ref);
      }
    }
  });

  test("a model no plan offers has a table with no rows, and the page says so in the table's place", () => {
    const tables = modelTables(ds);
    const counts = tables.map((t) => [t.ref, t.table.rows.length]);
    const offeredByAny = new Set(catalogFileSchema.parse(read("catalog.json")).rows.flatMap((r) => r.offered_models));
    for (const [ref, n] of counts) if (!offeredByAny.has(ref as never)) expect(n).toBe(0);
  });

  test("the whitelist is written with a source for each plan that lists models", () => {
    const catalog = catalogFileSchema.parse(read("catalog.json"));
    for (const r of catalog.rows) if (r.offered_models.length > 0) expect(r.offered_basis).toBeTruthy();
  });
});

describe("estimates exist only for models a plan offers", () => {
  test("no stored estimate value sits on a model outside the plan's offered_models", () => {
    const catalog = catalogFileSchema.parse(read("catalog.json"));
    for (const r of catalog.rows) for (const v of r.estimate?.values ?? []) {
      if (v.usd_per_b !== null) expect(r.offered_models).toContain(v.ref);
    }
  });

  test("a plan that names no reference model is unavailable, with its reason, and carries no value", () => {
    const catalog = catalogFileSchema.parse(read("catalog.json"));
    for (const r of catalog.rows) if (r.offered_models.length === 0) {
      expect(r.estimate?.status).toBe("unavailable");
      expect(r.estimate?.values.every((v) => v.usd_per_b === null)).toBe(true);
    }
  });
});

describe("vs measured: est against the plan's own measured $/B", () => {
  test("a signed percent of est over measured", () => {
    expect(vsMeasuredText(2.5077, 1.64)).toBe("+53%");
    expect(vsMeasuredText(1.64, 2.5077)).toBe("−35%");
    expect(vsMeasuredText(1.64, 1.64)).toBe("+0%");
  });

  test("the OpenCode Go rows compare against the measured $/B; CommandCode, which is only derived, shows N/A", () => {
    const deepseek = modelTable(ds, "deepseek-v4.1-flash");
    const go = deepseek.rows.find((r) => r.key === "opencode-go-go")!;
    expect(go.cells.vs.na).toBe(false);
    expect(go.cells.vs.text).toMatch(/^[+−]\d+%$/);
    const cc = deepseek.rows.find((r) => r.key === "commandcode-goat-published")!;
    expect(cc.cells.vs.na).toBe(true);
    expect(cc.cells.vs.reason).toContain("derived");
  });

  test("every value cell in the model tables is well-formed", () => {
    for (const t of modelTables(ds)) for (const c of allCells(t.table)) expect(wellFormed(c)).toBe(true);
  });
});

describe("estimate formula, recomputed from the stored data", () => {
  test("each stored agent estimate equals fee/allowance × the blended list cost, using its own plan's measured mix", () => {
    const catalog = catalogFileSchema.parse(read("catalog.json"));
    const usage = read("usage.json");
    const models = read("models.json");
    const price = new Map<string, { in_per_m: number; out_per_m: number; cache_per_m: number }>(models.reference.map((r: { ref: string; in_per_m: number; out_per_m: number; cache_per_m: number }) => [r.ref, r]));
    const mixOf = (t: { input: number; cache_creation: number; cache_read: number; output: number }) => {
      const total = t.input + t.cache_creation + t.cache_read + t.output;
      const prompt = t.input + t.cache_creation + t.cache_read;
      return { o: t.output / total, c: t.cache_read / prompt };
    };
    const modelsAll = models.usage_models as Array<{ peak_offpeak: null | { provider: string; ref: string | null; peak_usd_per_m: Record<string, number>; offpeak_usd_per_m: Record<string, number> } }>;
    for (const row of catalog.rows) {
      if (row.estimate?.status !== "estimated") continue;
      // a same-rate copy is checked against its peer, in same-rate-views.test.ts
      if (row.estimate.derived_from) continue;
      const lane = row.measured_lane ? usage.lanes.find((l: { lane: string }) => l.lane === row.measured_lane) : null;
      const { o, c } = lane ? mixOf(lane.tokens) : mixOf(usage.lanes.reduce((a: { input: number; cache_creation: number; cache_read: number; output: number }, l: { tokens: typeof a }) => ({ input: a.input + l.tokens.input, cache_creation: a.cache_creation + l.tokens.cache_creation, cache_read: a.cache_read + l.tokens.cache_read, output: a.output + l.tokens.output }), { input: 0, cache_creation: 0, cache_read: 0, output: 0 }));
      for (const v of row.estimate.values) {
        if (v.shape !== "agent" || v.usd_per_b === null) continue;
        const tier = (row as { provider?: string }).provider === "qwen-cloud" ? modelsAll.find((u) => u.peak_offpeak?.provider === "qwen-cloud" && u.peak_offpeak?.ref === v.ref)?.peak_offpeak : null;
        const p = tier
          ? { in_per_m: (tier.peak_usd_per_m.in_per_m * 14 + tier.offpeak_usd_per_m.in_per_m * 10) / 24, out_per_m: (tier.peak_usd_per_m.out_per_m * 14 + tier.offpeak_usd_per_m.out_per_m * 10) / 24, cache_per_m: (tier.peak_usd_per_m.cache_per_m * 14 + tier.offpeak_usd_per_m.cache_per_m * 10) / 24 }
          : price.get(v.ref)!;
        const p50 = LMC_CONTEXT_SHORT;
        const banded = priceAt(p as never, p50).price;
        const blended = blendedUsdPerB(banded, { output_share: o, cache_share: c });
        expect(Math.abs(v.fee_over_allowance! * blended - v.usd_per_b)).toBeLessThan(1e-6);
      }
    }
  });
});

describe("section C: official subscriptions, aggregates only", () => {
  const off = officialFileSchema.parse(read("official.json"));
  test("two providers, each row well-formed; the fee is unverified with the claimed figure shown", () => {
    const t = officialTable(ds);
    expect(t.rows.length).toBe(2);
    for (const c of allCells(t)) expect(wellFormed(c)).toBe(true);
    const codex = t.rows.find((r) => r.key === "codex")!;
    expect(codex.cells.fee.text).toBe("unverified");
    expect(codex.cells.fee.note).toContain("claimed");
  });

  test("no $/B without a confirmed fee: the cell says why", () => {
    for (const r of officialTable(ds).rows) {
      expect(r.cells.perB.na).toBe(true);
      expect(r.cells.perB.reason).toContain("fee not confirmed");
    }
  });

  test("a provider with no 7-day session shows 0 tokens with the last session day, and no speed", () => {
    for (const r of off.providers) if (r.tokens_7d.calls === 0) {
      const row = officialTable(ds).rows.find((x) => x.key === r.provider)!;
      expect(row.cells.tokens.text).toBe("0 tokens");
      expect(row.cells.tps.na).toBe(true);
    }
  });

  test("the official data carries no session id, path, prompt or account detail", () => {
    const s = readFileSync(join(DATA, "official.json"), "utf8");
    expect(s).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(s).not.toMatch(/\/Users\//);
    expect(s).not.toMatch(/@/);
    expect(s).not.toMatch(/sessionId|session_id|\.jsonl/);
  });
});
