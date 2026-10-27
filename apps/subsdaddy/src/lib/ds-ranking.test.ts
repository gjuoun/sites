import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogFileSchema } from "../data/catalog";
import { modelsFileSchema, usageFileSchema } from "../data/schema";
import { dsRanking, qwenDsPrice, listDsPrice, DS_REF } from "./ds-ranking";

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const models = modelsFileSchema.parse(read("models.json"));
const usage = usageFileSchema.parse(read("usage.json"));
const rank = dsRanking(catalog.rows, models, usage.lanes, new Map(read("lanes.json").lanes.filter((l: { usd_per_b_basis: string; usd_per_b_derived_from: string | null }) => l.usd_per_b_basis === "derived" && l.usd_per_b_derived_from).map((l: { lane: string; usd_per_b_derived_from: string }) => [l.lane, l.usd_per_b_derived_from])));
const byId = (id: string) => rank.ranked.find((r) => r.plan_id === id);

describe("classification: convertible (a dollar allowance) vs needs_anchor (none)", () => {
  test("every catalog row is counted once, as convertible, needs_anchor or excluded", () => {
    const c = rank.counts;
    expect(c.convertible + c.needs_anchor + c.excluded_status).toBe(catalog.rows.length);
  });

  test("the convertible plans are the ones with a dollar allowance: 10 at r29", () => {
    const conv = catalog.rows.filter((r) => r.status === "catalog" && r.allowance.length > 0).map((r) => r.plan_id).sort();
    expect(conv).toEqual(["commandcode-goat-published", "github-copilot-pro", "github-copilot-pro-plus", "opencode-go-go", "opencode-go-plus", "qwen-cloud-token-owner-10", "trae-pro", "trae-pro-plus", "trae-ultra", "zed-pro"]);
    expect(rank.counts.convertible).toBe(conv.length);
  });

  test("a needs_anchor row never carries a $/B figure, in the catalog or in the ranking", () => {
    const na = catalog.rows.filter((r) => r.status === "catalog" && r.allowance.length === 0);
    expect(na.length).toBe(rank.counts.needs_anchor);
    for (const r of na) {
      expect(r.estimate?.status).toBe("unavailable");
      expect(r.estimate?.values ?? []).toHaveLength(0);
      expect(r.allowance_reason ?? "").toBeTruthy();
      expect(byId(r.plan_id)).toBeUndefined();
    }
  });

  test("Synthetic lists DeepSeek V4.1 Flash but needs an anchor, so it is not ranked", () => {
    expect(catalog.rows.find((r) => r.plan_id === "synthetic-standard")!.offered_models).toEqual([]);
    expect(byId("synthetic-standard")).toBeUndefined();
  });
});

describe("DeepSeek ranking", () => {
  test("only convertible plans that list DeepSeek V4.1 Flash are ranked, and nothing else", () => {
    expect(rank.ranked.map((r) => r.plan_id).sort()).toEqual(["commandcode-goat-published", "opencode-go-go", "opencode-go-plus", "qwen-cloud-token-owner-10"]);
  });

  test("ranked ascending by the QwenCloud-average est $/B", () => {
    for (let i = 1; i < rank.ranked.length; i++) expect(rank.ranked[i - 1].est_qw).toBeLessThanOrEqual(rank.ranked[i].est_qw);
  });

  test("Trae and Zed are convertible but excluded with the reason: DeepSeek V4.1 Flash is not on their model list", () => {
    for (const id of ["trae-pro", "trae-pro-plus", "trae-ultra", "zed-pro"]) {
      const e = rank.excluded.find((x) => x.plan_id === id);
      expect(e?.reason).toContain("not on this plan's published model list");
    }
  });

  test("CommandCode GOAT: $10 over its $80 DeepSeek allowance; list basis matches the catalog estimate", () => {
    const cc = byId("commandcode-goat-published")!;
    expect(cc.fee_usd).toBe(10);
    expect(cc.allowance_usd).toBe(80);
    expect(cc.est_list!).toBeCloseTo(catalog.rows.find((r) => r.plan_id === "commandcode-goat-published")!.estimate!.values.find((v) => v.ref === DS_REF && v.shape === "agent")!.usd_per_b!, 6);
    expect(cc.tokens_b_list!).toBeCloseTo(10 / cc.est_list!, 9);
  });

  test("QwenCloud: the QwenCloud-basis est equals the catalog estimate (about 23.41), and has no list basis", () => {
    const q = byId("qwen-cloud-token-owner-10")!;
    const stored = catalog.rows.find((r) => r.plan_id === "qwen-cloud-token-owner-10")!.estimate!.values.find((v) => v.ref === DS_REF && v.shape === "agent")!.usd_per_b!;
    expect(q.est_qw).toBeCloseTo(stored, 6);
    expect(q.est_list).toBeNull();
    expect(q.list_reason).toContain("qwen3.8-max");
  });

  test("tokens per month are fee over est $/B, in billions", () => {
    for (const r of rank.ranked) expect(r.tokens_b_qw).toBeCloseTo(r.fee_usd / r.est_qw, 9);
  });

  test("the QwenCloud and list price bases are the stated ones: QwenCloud average and OpenRouter list", () => {
    expect(qwenDsPrice(models).in_per_m).toBeCloseTo(0.2375, 9);
    expect(listDsPrice(models).in_per_m).toBeCloseTo(models.reference.find((r) => r.ref === DS_REF)!.in_per_m, 9);
  });
});
