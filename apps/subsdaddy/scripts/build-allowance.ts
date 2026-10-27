#!/usr/bin/env bun
/**
 * data/allowance.json: each lane's usage allowance in list dollars per billing cycle, read from its quota
 * windows (see src/data/allowance.ts). Reads quota.json (windows), the raw usage export (metered rows, with
 * model and tokens; every row of the lane counts, as the quota meter does), usage.json (the lane's measured mix) and models.json (list prices). Writes nothing else.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANES } from "../src/data/schema";
import { allowanceFileSchema, analyzeWindow, bindingWindow, cycleOf, modelPerB, type PriceLookup, type UsageRow, type WindowReading } from "../src/data/allowance";
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
const rawDir = join(dataDir, "raw", "usage");
const latest = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!latest) throw new Error("no raw usage export; run collect:usage first");
const raw = JSON.parse(readFileSync(join(rawDir, latest), "utf8")).rows as Array<Record<string, unknown>>;
const covStart = Date.parse(usage.coverage_start);

/** The list price of an upstream model on a lane, or null when no list price exists (never zero). */
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
    const orId = model.includes("/") ? model : mapped;
    const ref = orId ? models.reference.find((r: any) => r.openrouter === orId) : undefined;
    if (!ref) return null;
    return { in_per_m: ref.in_per_m, out_per_m: ref.out_per_m, cache_per_m: ref.cache_per_m, cache_write_per_m: ref.cache_write_per_m ?? null, overrides: ref.overrides ?? [] };
  };
}

const MODEL_LABEL: Record<string, string> = { "deepseek/deepseek-v4.1-flash": "DeepSeek V4.1 Flash", "deepseek-v4.1-flash": "DeepSeek V4.1 Flash", "deepseek-v4.1-flash-1017": "DeepSeek V4.1 Flash (1017)", "deepseek/deepseek-v4.1-flash-fast": "DeepSeek V4.1 Flash (fast)", "z-ai/glm-5.3-flash": "GLM-5.3-Flash", "glm-5.3-flash": "GLM-5.3-Flash", "xiaomi/mimo-v2.6-flash": "MiMo v2.6 Flash", "mimo-v2.6-flash": "MiMo v2.6 Flash", "qwen3.8-flash": "Qwen3.8 Flash", "qwen3.8-max": "Qwen3.8 Max" };
const labelOf = (m: string) => MODEL_LABEL[m] ?? m;

const refPrice = (r: any): RefPrice => ({ in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides ?? [] });

const lanes = LANES.map((lane) => {
  const obs = quota.observations.find((o: any) => o.lane === lane);
  const plan = plans.plans.find((p: any) => p.plan_id === lane);
  const fee: number | null = plan?.price_month_usd ?? null;
  const u = usage.lanes.find((x: any) => x.lane === lane);
  const mix = pooledMix([{ tokens: u.tokens }]);
  const base = { lane, measured_at: now, source: "quota windows (codexbar) x usage logs at list price", fee_usd: fee, mix: { output_share: mix.output_share, agent_cache_share: mix.agent_cache_share, cache_write_share: mix.cache_write_share ?? 0 } };
  const readings: WindowReading[] = (obs?.windows ?? []).map((w: any) => ({ window: w.window, window_minutes: w.window_minutes, used_pct: w.used_pct, resets_at: w.resets_at, measured_at: obs.measured_at }));
  const cycle = cycleOf(readings);
  if (!cycle) {
    return { ...base, cycle_minutes: null, cycle_days: null, cycle_billed: false, allowance_usd_per_cycle: null, tokens_per_cycle: null, binding_window: null, binding_coverage: null, binding_unpriced_share: null, low_coverage: false, list_usd_per_b_effective: null, usd_per_b_measured: null, reason: "no quota windows in the reading", top_models: [], windows: [], models: [] };
  }
  const rows: UsageRow[] = raw
    .filter((r) => r.lane === lane)
    .map((r) => ({ ms: Date.parse(String(r.created_at_utc)), model: String(r.upstream_model), input: Number(r.input), cache_creation: Number(r.cache_creation), cache_read: Number(r.cache_read), output: Number(r.output) }));
  const lookup = resolverFor(lane);
  const analyses = readings.map((r) => analyzeWindow(r, rows, lookup, covStart, cycle.minutes));
  const b = bindingWindow(analyses);
  const windows = analyses.map((w) => ({ ...w, source: "codexbar quota reading" }));
  if (!b) {
    return { ...base, cycle_minutes: cycle.minutes, cycle_days: cycle.minutes / 1440, cycle_billed: cycle.billed, allowance_usd_per_cycle: null, tokens_per_cycle: null, binding_window: null, binding_coverage: null, binding_unpriced_share: null, low_coverage: false, list_usd_per_b_effective: null, usd_per_b_measured: null, reason: "no usable window: " + analyses.map((w) => w.window + " " + w.status).join(", "), top_models: [], windows, models: [] };
  }
  const startMs = Date.parse(b.start_iso);
  const endMs = Date.parse(b.measured_at);
  const inBinding = rows.filter((r) => r.ms >= startMs && r.ms <= endMs);
  const byModel = new Map<string, number>();
  for (const r of inBinding) byModel.set(r.model, (byModel.get(r.model) ?? 0) + r.input + r.cache_creation + r.cache_read + r.output);
  const total = [...byModel.values()].reduce((a, x) => a + x, 0);
  const top = [...byModel.entries()].sort((a, c) => c[1] - a[1]).slice(0, 3).map(([model, t]) => ({ model, label: labelOf(model), share: total > 0 ? t / total : 0 }));
  const allowance = b.allowance_usd_cycle as number;
  const tokensCycle = b.tokens_cycle as number;
  const effective = b.tokens > 0 && b.cost_usd > 0 ? (b.cost_usd / b.tokens) * 1e9 : null;
  const measuredPerB = cycle.billed && fee !== null ? fee / (tokensCycle / 1e9) : null;
  const modelRows = models.reference.map((r: any) => {
    const short = modelPerB({ allowance_usd: allowance, fee_usd: fee ?? 0, ref: refPrice(r), mix: base.mix, context_tokens: LMC_CONTEXT_SHORT });
    const long = modelPerB({ allowance_usd: allowance, fee_usd: fee ?? 0, ref: refPrice(r), mix: base.mix, context_tokens: LMC_CONTEXT_LONG });
    const cell = (x: any) => ({ tokens_per_cycle: x.tokens_cycle, usd_per_b: x.usd_per_b, blended_usd_per_b: x.blended_usd_per_b, measured_at: now, source: "binding allowance x list price (models.json) at " + (x === short ? "100K" : "350K") + " context" });
    return { ref: r.ref, short: fee === null ? null : cell(short), long: fee === null ? null : cell(long), reason: fee === null ? "no fee" : null };
  });
  return {
    ...base,
    cycle_minutes: cycle.minutes,
    cycle_days: cycle.minutes / 1440,
    cycle_billed: cycle.billed,
    allowance_usd_per_cycle: allowance,
    tokens_per_cycle: tokensCycle,
    binding_window: b.window,
    binding_coverage: b.coverage,
    binding_unpriced_share: b.unpriced_share,
    low_coverage: b.unpriced_share > 0.05,
    list_usd_per_b_effective: effective,
    usd_per_b_measured: measuredPerB,
    reason: cycle.billed ? null : "no monthly window: the billing cycle is not read, so no monthly $/B",
    top_models: top,
    windows,
    models: modelRows,
  };
});

const file = allowanceFileSchema.parse({
  measured_at: now,
  source: "quota.json windows × usage_logs rows priced at list (models.json) ; mix from usage.json",
  context_standards: { short: LMC_CONTEXT_SHORT, long: LMC_CONTEXT_LONG },
  lanes,
});
writeFileSync(join(dataDir, "allowance.json"), JSON.stringify(file, null, 2) + "\n");
for (const l of lanes) {
  const w = l.windows.map((x: any) => x.window + ":" + x.status + " used=" + x.used_pct.toFixed(1) + " cost=" + x.cost_usd.toFixed(2) + " unpriced=" + (x.unpriced_share * 100).toFixed(1) + "% cov=" + x.coverage.toFixed(3)).join(" | ");
  console.log(l.lane.padEnd(18) + " cycle=" + (l.cycle_days ?? "-") + "d billed=" + l.cycle_billed + " allowance=" + (l.allowance_usd_per_cycle?.toFixed(2) ?? "N/A") + " binding=" + (l.binding_window ?? "-") + " tokens=" + (l.tokens_per_cycle ? (l.tokens_per_cycle / 1e9).toFixed(3) + "B" : "-") + " measured_usd_per_b=" + (l.usd_per_b_measured?.toFixed(2) ?? "N/A") + " low_cov=" + l.low_coverage);
  console.log("   " + w);
}
