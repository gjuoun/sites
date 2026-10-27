#!/usr/bin/env bun
/**
 * data/allowance.json: each lane's usage allowance in list dollars per billing cycle (src/data/allowance.ts).
 * Reads quota.json (windows and any vendor-reported pool), the raw usage export (every row of the lane, with
 * model and tokens), usage.json (the lane's measured mix), models.json (list prices, aliases) and catalog.json
 * (annual price, for a plan whose billing period is a year). Writes nothing else.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANES } from "../src/data/schema";
import { allowanceFileSchema, analyzeWindow, bindingWindow, cycleOf, modelPerB, vendorAllowance, type PriceLookup, type UsageRow, type WindowReading } from "../src/data/allowance";
import { pooledMix, type RefPrice } from "../src/data/estimate";
import { averagePrice } from "../src/data/peak-offpeak";
import { LMC_CONTEXT_LONG, LMC_CONTEXT_SHORT } from "../src/data/context";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const read = (p: string) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));
const now = new Date().toISOString();
const quota = read("quota.json");
const usage = read("usage.json");
const models = read("models.json");
const plans = read("plans.json");
const catalog = read("catalog.json");
const rawDir = join(dataDir, "raw", "usage");
const latest = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!latest) throw new Error("no raw usage export; run collect:usage first");
const raw = JSON.parse(readFileSync(join(rawDir, latest), "utf8")).rows as Array<Record<string, unknown>>;
const covStart = Date.parse(usage.coverage_start);
const aliases: Record<string, string> = models.model_aliases ?? {};
const usagePrices: Array<{ openrouter: string; in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null }> = models.usage_prices ?? [];

const MODEL_LABEL: Record<string, string> = {
  "deepseek/deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "deepseek/deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash (1017)",
  "deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash (1017)",
  "deepseek/deepseek-v4.1-flash-fast": "DeepSeek V4.1 Flash (fast, unpriced)",
  "z-ai/glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5.3-flash": "GLM-5.3-Flash",
  "glm-5.3": "GLM-5.3 (no list price)",
  "xiaomi/mimo-v2.6-flash": "MiMo v2.6 Flash",
  "mimo-v2.6-flash": "MiMo v2.6 Flash",
  "qwen3.8-flash": "Qwen3.8 Flash",
  "qwen3.8-max": "Qwen3.8 Max",
};
const labelOf = (m: string) => MODEL_LABEL[m] ?? m;

/** The list price of a model on a lane, or null when no list price exists. Never zero. */
function resolverFor(lane: string): PriceLookup {
  return (model) => {
    if (lane === "qwen-cloud-token") {
      const u = models.usage_models.find((x: any) => x.upstream_model === model && x.peak_offpeak && x.peak_offpeak.provider === "qwen-cloud");
      if (u) {
        const a = averagePrice({ peak: u.peak_offpeak.peak_usd_per_m, offpeak: u.peak_offpeak.offpeak_usd_per_m });
        return { in_per_m: a.in_per_m, out_per_m: a.out_per_m, cache_per_m: a.cache_per_m, cache_write_per_m: null, overrides: [] };
      }
    }
    const mapped = models.models.find((m: any) => m.lane === lane && m.upstream_model === model)?.openrouter ?? null;
    const orId = aliases[model] ?? (model.includes("/") ? model : mapped);
    if (!orId) return null;
    const ref = models.reference.find((r: any) => r.openrouter === orId);
    if (ref) return { in_per_m: ref.in_per_m, out_per_m: ref.out_per_m, cache_per_m: ref.cache_per_m, cache_write_per_m: ref.cache_write_per_m ?? null, overrides: ref.overrides ?? [] };
    const up = usagePrices.find((p) => p.openrouter === orId);
    if (up) return { in_per_m: up.in_per_m, out_per_m: up.out_per_m, cache_per_m: up.cache_per_m, cache_write_per_m: up.cache_write_per_m, overrides: [] };
    return null;
  };
}

const refPrice = (r: any): RefPrice => ({ in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides ?? [] });

const lanes = LANES.map((lane) => {
  const obs = quota.observations.find((o: any) => o.lane === lane);
  const plan = plans.plans.find((p: any) => p.plan_id === lane);
  const fee: number | null = plan?.price_month_usd ?? null;
  const catRow = catalog.rows.find((r: any) => r.measured_lane === lane);
  const annual: number | null = catRow?.price_annual_usd ?? null;
  const published: number | null = catRow?.published_allowance_usd ?? null;
  const u = usage.lanes.find((x: any) => x.lane === lane);
  const mix = pooledMix([{ tokens: u.tokens }]);
  const base = {
    lane,
    measured_at: now,
    source: "quota windows (codexbar) x usage logs at list price",
    mix: { output_share: mix.output_share, agent_cache_share: mix.agent_cache_share, cache_write_share: mix.cache_write_share ?? 0 },
  };
  const readings: WindowReading[] = (obs?.windows ?? []).map((w: any) => ({ window: w.window, window_minutes: w.window_minutes, used_pct: w.used_pct, resets_at: w.resets_at, measured_at: obs.measured_at }));
  const cycle = cycleOf(readings);
  const empty = (reason: string, extra: Record<string, unknown> = {}) => ({
    ...base, fee_usd: fee, fee_per_cycle_usd: null, fee_basis: null, cycle_minutes: cycle?.minutes ?? null, cycle_days: cycle ? cycle.minutes / 1440 : null, cycle_billed: cycle?.billed ?? false,
    allowance_usd_per_cycle: null, allowance_basis: null, allowance_published_usd: null, allowance_vendor_usd: null, allowance_vendor_reason: null, allowance_derived_usd: null,
    tokens_per_cycle: null, binding_window: null, binding_coverage: null, binding_unpriced_share: null, low_coverage: false, confidence: null,
    list_usd_per_b_effective: null, usd_per_b_measured: null, reason, top_models: [], windows: [], models: [], ...extra,
  });
  if (!cycle) return empty("no quota windows in the reading");

  const rows: UsageRow[] = raw
    .filter((r) => r.lane === lane)
    .map((r) => ({ ms: Date.parse(String(r.created_at_utc)), model: String(r.upstream_model), input: Number(r.input), cache_creation: Number(r.cache_creation), cache_read: Number(r.cache_read), output: Number(r.output) }));
  const lookup = resolverFor(lane);
  const analyses = readings.map((r) => analyzeWindow(r, rows, lookup, covStart, cycle.minutes));
  const windows = analyses.map((w) => ({ ...w, source: "codexbar quota reading" }));
  const monthly = analyses.find((w) => w.window === "monthly");
  const b = bindingWindow(analyses);
  const vendor = vendorAllowance(obs?.vendor_pool ?? null, monthly);

  // the fee of one cycle: the monthly fee when the cycle is the monthly window; for a yearly plan, the annual fee prorated to the cycle
  const feeBasis = cycle.billed ? "monthly fee" : annual !== null ? "annual fee prorated to the cycle (365 days)" : null;
  const feePerCycle = cycle.billed ? fee : annual !== null ? annual * (cycle.minutes / (365 * 1440)) : null;

  if (!b) return empty("no usable window: " + analyses.map((w) => w.window + " " + w.status).join(", "), { windows, fee_per_cycle_usd: feePerCycle, fee_basis: feeBasis });

  const startMs = Date.parse(b.start_iso);
  const endMs = Date.parse(b.measured_at);
  const inBinding = rows.filter((r) => r.ms >= startMs && r.ms <= endMs);
  const byModel = new Map<string, number>();
  for (const r of inBinding) byModel.set(r.model, (byModel.get(r.model) ?? 0) + r.input + r.cache_creation + r.cache_read + r.output);
  const total = [...byModel.values()].reduce((a, x) => a + x, 0);
  const top = [...byModel.entries()].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([model, t]) => ({ model, label: labelOf(model), share: total > 0 ? t / total : 0 }));

  const derived = b.allowance_usd_cycle as number;
  // the published figure is the allowance; else a matching dashboard pool; else the derived figure. All are recorded.
  const chosen = published ?? vendor.usd ?? derived;
  const allowanceBasis = published !== null ? "vendor_published" : vendor.usd !== null ? "vendor_reported" : "derived";
  const tokensCycle = b.tokens_cycle as number;
  const measuredPerB = feePerCycle !== null ? feePerCycle / (tokensCycle / 1e9) : null;
  const modelRows = models.reference.map((r: any) => {
    const cell = (context: number, label: string) => {
      if (feePerCycle === null) return null;
      const x = modelPerB({ allowance_usd: chosen, fee_usd: feePerCycle, ref: refPrice(r), mix: base.mix, context_tokens: context });
      return { tokens_per_cycle: x.tokens_cycle, usd_per_b: x.usd_per_b, blended_usd_per_b: x.blended_usd_per_b, measured_at: now, source: "allowance (" + allowanceBasis + ") x list price (models.json) at " + label + " context" };
    };
    return { ref: r.ref, short: cell(LMC_CONTEXT_SHORT, "100K"), long: cell(LMC_CONTEXT_LONG, "350K"), reason: feePerCycle === null ? "no fee for the cycle" : null };
  });
  return {
    ...base,
    fee_usd: fee,
    fee_per_cycle_usd: feePerCycle,
    fee_basis: feeBasis,
    cycle_minutes: cycle.minutes,
    cycle_days: cycle.minutes / 1440,
    cycle_billed: cycle.billed,
    allowance_usd_per_cycle: chosen,
    allowance_basis: allowanceBasis,
    allowance_published_usd: published,
    allowance_vendor_usd: vendor.usd,
    allowance_vendor_reason: vendor.reason,
    allowance_derived_usd: derived,
    tokens_per_cycle: tokensCycle,
    binding_window: b.window,
    binding_coverage: b.coverage,
    binding_unpriced_share: b.unpriced_share,
    low_coverage: b.unpriced_share > 0.05,
    confidence: b.confidence,
    list_usd_per_b_effective: b.tokens > 0 && b.cost_usd > 0 ? (b.cost_usd / b.tokens) * 1e9 : null,
    usd_per_b_measured: measuredPerB,
    reason: feePerCycle === null ? "no fee for the cycle: no monthly window and no annual price" : null,
    top_models: top,
    windows,
    models: modelRows,
  };
});

const file = allowanceFileSchema.parse({
  measured_at: now,
  source: "quota windows (codexbar), vendor-reported pool where stated, usage logs priced at list (models.json)",
  context_standards: { short: LMC_CONTEXT_SHORT, long: LMC_CONTEXT_LONG },
  lanes,
});
writeFileSync(join(dataDir, "allowance.json"), JSON.stringify(file, null, 2) + "\n");
for (const l of lanes as any[]) {
  const f = (x: number | null | undefined, d = 2) => (x === null || x === undefined ? "N/A" : x.toFixed(d));
  console.log(l.lane.padEnd(18) + " binding=" + (l.binding_window ?? "-") + " allowance=" + f(l.allowance_usd_per_cycle) + " (" + (l.allowance_basis ?? "-") + ") vendor=" + f(l.allowance_vendor_usd) + " derived=" + f(l.allowance_derived_usd) + " fee/cycle=" + f(l.fee_per_cycle_usd) + " tokens=" + (l.tokens_per_cycle ? (l.tokens_per_cycle / 1e9).toFixed(3) + "B" : "-") + " usd/B=" + f(l.usd_per_b_measured) + " conf=" + (l.confidence ?? "-") + " unpriced=" + f(l.binding_unpriced_share === null ? null : l.binding_unpriced_share * 100, 1) + "%");
  for (const w of l.windows) console.log("   " + w.window + ":" + w.status + " used=" + w.used_pct.toFixed(1) + " cost=" + w.cost_usd.toFixed(2) + " unpriced=" + (w.unpriced_share * 100).toFixed(2) + "% named=" + w.unpriced_models.join("|"));
}
