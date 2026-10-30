#!/usr/bin/env bun
/**
 * Derives data/lanes.json (one record per plan) from allowance.json (the quota-window allowance, see
 * src/data/allowance.ts), usage.json (the speeds) and the raw row export (the price fit). Every number
 * carries its method; a plan with no usable window carries an explicit reason. No plan is special-cased.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import { LANES, type LaneId, type LaneRecord, lanesFileSchema, plansFileSchema, usageFileSchema } from "../src/data/schema";
import { allowanceFileSchema } from "../src/data/allowance";
import { type PricedRow, capacityConfidence, fitPriceVector, mixShares, presetsFor, resolveDollarPerB } from "../src/data/derive";
import { laneModelRows, trafficOf } from "../src/lib/lane-models";
import { pageLimitsFor, type PageDoc } from "../src/data/per-model-limit";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const read = (p: string) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));
const now = new Date().toISOString();

const usage = usageFileSchema.parse(read("usage.json"));
const plans = plansFileSchema.parse(read("plans.json"));
const allowance = allowanceFileSchema.parse(read("allowance.json"));
// the plan's own page: the per-model monthly limits of OpenCode Go (nothing is fetched here)
const goDocs = JSON.parse(readFileSync(join(dataDir, "opencode-go.json"), "utf8")) as PageDoc;

const rawRowSchema = z.object({
  lane: z.enum(LANES),
  metered: z.boolean(),
  upstream_model: z.string(),
  input: z.number(),
  cache_creation: z.number(),
  cache_read: z.number(),
  output: z.number(),
  total_cost: z.number(),
  created_at_utc: z.iso.datetime(),
});
const rawDir = join(dataDir, "raw", "usage");
const latestRaw = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!latestRaw) throw new Error("no raw usage export; run collect:usage first");
const rows = z.array(rawRowSchema).parse(JSON.parse(readFileSync(join(rawDir, latestRaw), "utf8")).rows);

/** Plans whose quota reading covers one of several accounts: the capacity is stated for the single plan. */
const SINGLE_ACCOUNT_READING = new Set<LaneId>(["opencode-go"]);

const poolShares = mixShares(rows.map((r) => ({ tokens: { input: r.input, cache_creation: r.cache_creation, cache_read: r.cache_read, output: r.output }, total_cost: r.total_cost })));

const lanes: LaneRecord[] = LANES.map((lane) => {
  const plan = plans.plans.find((p) => p.plan_id === lane);
  if (!plan) throw new Error("no plan record for " + lane);
  const u = usage.lanes.find((x) => x.lane === lane);
  if (!u) throw new Error("no usage for " + lane);
  const a = allowance.lanes.find((x) => x.lane === lane);
  if (!a) throw new Error("no allowance for " + lane);
  const recent = usage.recent.lanes.find((x) => x.lane === lane);
  if (!recent) throw new Error("no recent usage for " + lane);
  const limits = plan.per_model_limit_plan ? pageLimitsFor(goDocs, plan.per_model_limit_plan) : null;
  const models = laneModelRows({
    usage: recent,
    limits,
    measuredAt: now,
    source: "usage_logs(" + usage.recent.window_days + "d) rows=" + recent.rows,
  });
  const laneRows = rows.filter((r) => r.lane === lane);
  const priced: PricedRow[] = laneRows.map((r) => ({ tokens: { input: r.input, cache_creation: r.cache_creation, cache_read: r.cache_read, output: r.output }, total_cost: r.total_cost }));
  const fit = fitPriceVector(priced);
  const pricedShare = laneRows.length ? priced.filter((p) => p.total_cost > 0).length / laneRows.length : 0;
  const binding = a.windows.find((w) => w.window === a.binding_window) ?? null;
  const confidence = capacityConfidence(binding ? binding.used_pct : null);

  const flags: string[] = [];
  if (!fit.ok) flags.push("no_fit:" + fit.unavailable);
  else if (fit.residual > 0.05) flags.push("low_fit");
  if (pricedShare < 0.5) flags.push("low_priced_share");
  if (a.low_coverage) flags.push("low_coverage");

  const presetRaw = presetsFor({
    fit,
    capacity_usd: null,
    plan_price_month_usd: plan.price_month_usd,
    agent_share: poolShares.agent,
    capacity_tokens_per_cycle: a.tokens_per_cycle,
  });
  if (presetRaw.some((p) => p.unavailable === "capacity_conflict")) flags.push("capacity_conflict");
  const presets = presetRaw.map((p) => (p.usd_per_b !== undefined ? { shape: p.shape, usd_per_b: p.usd_per_b } : { shape: p.shape, unavailable: p.unavailable ?? "unknown" }));

  const dollar = resolveDollarPerB({ own: a.usd_per_b_measured, rate_peer: null, peer_value: null });
  if (dollar.usd_per_b === null) flags.push("excluded_from_ranking");

  return {
    lane,
    label: plan.label,
    price_month_usd: plan.price_month_usd,
    price_badge: plan.badge,
    capacity: {
      method: a.binding_window ? "quota_windows" : "unavailable",
      window: a.binding_window,
      cycle_days: a.cycle_days,
      cycle_billed: a.cycle_billed,
      tokens_per_cycle: a.tokens_per_cycle,
      allowance_usd_per_cycle: a.allowance_usd_per_cycle,
      coverage: a.binding_coverage,
      unpriced_share: a.binding_unpriced_share,
      low_coverage: a.low_coverage,
      top_models: a.top_models,
      allowance_basis: a.allowance_basis,
      per_model: a.per_model ?? null,
      allowance_published_usd: a.allowance_published_usd,
      allowance_vendor_usd: a.allowance_vendor_usd,
      allowance_vendor_used_usd: a.allowance_vendor_used_usd ?? null,
      allowance_vendor_reason: a.allowance_vendor_reason,
      allowance_derived_usd: a.allowance_derived_usd,
      fee_per_cycle_usd: a.fee_per_cycle_usd,
      fee_basis: a.fee_basis,
      assumed_share: a.binding_assumed_share,
      seeded: false,
      reason: a.reason,
      confidence: confidence?.confidence ?? null,
      confidence_reason: confidence?.reason ?? null,
      stale: a.stale ?? null,
      badge: SINGLE_ACCOUNT_READING.has(lane) && a.binding_window ? "single_account_reading" : null,
      windows: a.windows,
      measured_at: now,
      source: "quota windows (codexbar) x usage_logs priced at list; allowance.json",
    },
    usd_per_b: dollar.usd_per_b,
    usd_per_b_basis: dollar.basis,
    usd_per_b_derived_from: null,
    usd_per_b_source: dollar.basis === "measured" ? "usage logs priced at list, quota windows, published price" : null,
    measured: { p50_ttft_ms: u.p50_ttft_ms, p90_ttft_ms: u.p90_ttft_ms, p50_output_tps: u.p50_output_tps, n: u.rows, measured_at: now, source: "usage_logs(" + usage.window_days + "d) rows=" + u.rows },
    traffic_7d: trafficOf(recent, usage.recent.window_days),
    models,
    presets,
    flags,
    measured_at: now,
    source: "usage_logs(" + usage.window_days + "d) + quota windows + published price",
  } as LaneRecord;
});

// the outlier guard (r47): a lane whose $/B is more than ten times the median of the other lanes is not published
for (const l of lanes) {
  if (l.usd_per_b === null) continue;
  const others = lanes.filter((x) => x !== l && x.usd_per_b !== null).map((x) => x.usd_per_b as number).sort((a, b) => a - b);
  if (others.length === 0) continue;
  const mid = others.length % 2 === 1 ? others[(others.length - 1) / 2] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2;
  if (l.usd_per_b > 10 * mid) {
    const shown = l.usd_per_b.toFixed(2);
    l.usd_per_b_reason = "not published: $" + shown + " per B is more than ten times the median of the other lanes ($" + mid.toFixed(2) + "); the reading behind it is too thin to rank";
    l.usd_per_b = null;
    l.usd_per_b_basis = null;
    l.usd_per_b_source = null;
  }
}
writeFileSync(join(dataDir, "lanes.json"), JSON.stringify(lanesFileSchema.parse({ lanes, measured_at: now, source: "build-dataset" }), null, 2) + "\n");
for (const l of lanes) {
  const cap = l.capacity.tokens_per_cycle === null ? "unavailable:" + l.capacity.reason : (l.capacity.tokens_per_cycle / 1e9).toFixed(3) + "B/" + l.capacity.cycle_days + "d" + (l.capacity.cycle_billed ? "" : " (not billed)");
  console.log(l.lane.padEnd(18) + " window=" + (l.capacity.window ?? "-") + " cap=" + cap + " usd_per_b=" + (l.usd_per_b === null ? "null" : l.usd_per_b.toFixed(4)) + " basis=" + (l.usd_per_b_basis ?? "-") + " models=" + l.models.length + " traffic7d=" + (l.traffic_7d.tokens ?? "none") + " flags=" + (l.flags.join(",") || "-"));
}
const ranked = lanes.filter((l) => l.usd_per_b !== null).length;
console.log("lanes=" + lanes.length + " ranked=" + ranked + " excluded=" + (lanes.length - ranked));
