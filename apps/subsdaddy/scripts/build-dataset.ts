#!/usr/bin/env bun
/**
 * Derives data/lanes.json from usage.json + quota.json + plans.json and the raw row export.
 * Every number carries its method; a lane with no capacity carries an explicit reason and is
 * excluded from the measured ranking. Exits non-zero when a lane has neither a capacity nor a reason.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  LANES,
  type LaneId,
  type LaneRecord,
  lanesFileSchema,
  planSchema,
  plansFileSchema,
  quotaFileSchema,
  usageFileSchema,
  type QuotaObservationOrGap,
} from "../src/data/schema";
import {
  capacityConfidence,
  capacityFromDelta,
  capacityFromSnapshot,
  elapsedCoverage,
  fitPriceVector,
  mixShares,
  presetsFor,
  usdB,
  type Capacity,
  type PricedRow,
} from "../src/data/derive";
import { z } from "zod";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const read = (p: string) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));
const now = new Date().toISOString();
const nowMs = Date.parse(now);
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

const usage = usageFileSchema.parse(read("usage.json"));
const quota = quotaFileSchema.parse(read("quota.json"));
const plans = plansFileSchema.parse(read("plans.json"));

const rawRowSchema = z.object({
  lane: z.enum(LANES),
  upstream_model: z.string(),
  input: z.number(),
  cache_creation: z.number(),
  cache_read: z.number(),
  output: z.number(),
  total_cost: z.number(),
  first_token_ms: z.number().nullable(),
  duration_ms: z.number().nullable(),
  created_at_utc: z.iso.datetime(),
});
type RawRow = z.infer<typeof rawRowSchema>;
const rawDir = join(dataDir, "raw", "usage");
const latestRaw = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!latestRaw) throw new Error("no raw usage export; run collect:usage first");
const rows: RawRow[] = z.array(rawRowSchema).parse(JSON.parse(readFileSync(join(rawDir, latestRaw), "utf8")).rows);

const tokensOf = (r: RawRow) => r.input + r.cache_creation + r.cache_read + r.output;
const inWindow = (r: RawRow, from: number, to: number) => {
  const t = Date.parse(r.created_at_utc);
  return t >= from && t <= to;
};

// delta-pair history: every earlier quota observation per lane, from the raw quota history
const quotaHistory = new Map<LaneId, { measured_at: string; used_pct: number }[]>();
const rawQuotaDir = join(dataDir, "raw", "quota");
if (existsSync(rawQuotaDir)) {
  for (const f of readdirSync(rawQuotaDir).filter((x) => x.endsWith(".json"))) {
    for (const o of quotaFileSchema.parse(JSON.parse(readFileSync(join(rawQuotaDir, f), "utf8"))).observations) {
      if ("used_pct" in o) {
        const list = quotaHistory.get(o.lane) ?? [];
        list.push({ measured_at: o.measured_at, used_pct: o.used_pct });
        quotaHistory.set(o.lane, list);
      }
    }
  }
}

// zai has no codexbar strategy; its seed is a published allowance (unverified), badged seed
const SEED: Partial<Record<LaneId, { tokens_per_week: number; source: string }>> = {
  zai: { tokens_per_week: 5.7e9, source: "published allowance, flash weight (seed, unverified against console)" },
};

function capacityFor(lane: LaneId, obs: QuotaObservationOrGap | undefined): { cap: Capacity; method: LaneRecord["capacity"]["method"]; window: "weekly" | "monthly" | null; coverage: number | null; seeded: boolean; cost_in_window: number } {
  const laneRows = rows.filter((r) => r.lane === lane);
  const seed = SEED[lane];
  if (!obs || "unavailable" in obs) {
    if (seed) {
      return { cap: { ok: true, tokens_per_week: seed.tokens_per_week, coverage: null }, method: "plan_spec", window: "weekly", coverage: null, seeded: true, cost_in_window: 0 };
    }
    const reason = obs ? obs.unavailable : "no_quota_observation";
    return { cap: { ok: false, unavailable: reason }, method: "unavailable", window: null, coverage: null, seeded: false, cost_in_window: 0 };
  }
  const windowMs = obs.window_minutes * 60_000;
  const windowStart = Date.parse(obs.resets_at) - windowMs;
  const tokensInWindow = laneRows.filter((r) => inWindow(r, windowStart, nowMs)).reduce((a, r) => a + tokensOf(r), 0);
  const costInWindow = laneRows.filter((r) => inWindow(r, windowStart, nowMs)).reduce((a, r) => a + r.total_cost, 0);
  const coverage = elapsedCoverage({ coverage_start_ms: Date.parse(usage.coverage_start), window_start_ms: windowStart, now_ms: nowMs });
  const win: "weekly" | "monthly" = obs.window === "monthly" ? "monthly" : "weekly";
  const snap = capacityFromSnapshot({ tokens_in_window: tokensInWindow, used_pct: obs.used_pct, window_ms: windowMs, coverage });
  if (snap.ok) return { cap: snap, method: "window_snapshot", window: win, coverage, seeded: false, cost_in_window: costInWindow };

  // fallback: delta pair against the latest earlier reading at least an hour old
  const prior = (quotaHistory.get(lane) ?? []).filter((p) => nowMs - Date.parse(p.measured_at) >= 3_600_000).at(-1);
  if (prior) {
    const between = laneRows.filter((r) => inWindow(r, Date.parse(prior.measured_at), nowMs)).reduce((a, r) => a + tokensOf(r), 0);
    const delta = capacityFromDelta({
      tokens_between: between,
      used_pct_before: prior.used_pct,
      used_pct_after: obs.used_pct,
      elapsed_ms: nowMs - Date.parse(prior.measured_at),
    });
    if (delta.ok) return { cap: delta, method: "delta_pair", window: win, coverage: null, seeded: false, cost_in_window: costInWindow };
    return { cap: { ok: false, unavailable: `${snap.ok ? "" : (snap as { unavailable: string }).unavailable}+${delta.unavailable}` }, method: "unavailable", window: null, coverage: null, seeded: false, cost_in_window: costInWindow };
  }
  return { cap: { ok: false, unavailable: (snap as { unavailable: string }).unavailable + "+no_prior_observation" }, method: "unavailable", window: null, coverage: null, seeded: false, cost_in_window: costInWindow };
}

// pooled five-lane mix, computed from the same window the lanes are measured in
const poolShares = mixShares(rows.map((r) => ({ tokens: { input: r.input, cache_creation: r.cache_creation, cache_read: r.cache_read, output: r.output }, total_cost: r.total_cost })));

const lanes: LaneRecord[] = LANES.map((lane) => {
  const plan = planSchema.parse(plans.plans.find((p) => p.lane === lane));
  const u = usage.lanes.find((x) => x.lane === lane)!;
  const obs = quota.observations.find((o) => o.lane === lane);
  const { cap, method, window, coverage, seeded, cost_in_window } = capacityFor(lane, obs);
  const laneRows = rows.filter((r) => r.lane === lane);
  const priced: PricedRow[] = laneRows.map((r) => ({ tokens: { input: r.input, cache_creation: r.cache_creation, cache_read: r.cache_read, output: r.output }, total_cost: r.total_cost }));
  const fit = fitPriceVector(priced);
  const pricedShare = laneRows.length ? priced.filter((p) => p.total_cost > 0).length / laneRows.length : 0;

  const flags: string[] = [];
  if (seeded) flags.push("seed");
  if (!fit.ok) flags.push("no_fit:" + fit.unavailable);
  else if (fit.residual > 0.05) flags.push("low_fit");
  if (pricedShare < 0.5) flags.push("low_priced_share");

  const tokensPerWeek = cap.ok ? cap.tokens_per_week : null;
  const usd = cap.ok && !seeded ? usdB(plan.price_month_usd, cap.tokens_per_week) : null;

  // capacity in dollars per month, from the window's list-price cost over its consumed fraction
  let capacityUsdMonth: number | null = null;
  if (cap.ok && obs && !("unavailable" in obs) && obs.used_pct > 0) {
    const windowMs = obs.window_minutes * 60_000;
    capacityUsdMonth = (cost_in_window / (obs.used_pct / 100)) * (MONTH_MS / windowMs);
  }
  const presetRaw = presetsFor({
    fit,
    capacity_usd: capacityUsdMonth,
    plan_price_month_usd: plan.price_month_usd,
    agent_share: poolShares.agent,
    capacity_tokens_per_week: tokensPerWeek,
  });
  if (presetRaw.some((p) => p.unavailable === "capacity_conflict")) flags.push("capacity_conflict");
  const presets = presetRaw.map((p) =>
    p.usd_per_b !== undefined ? { shape: p.shape, usd_per_b: p.usd_per_b } : { shape: p.shape, unavailable: p.unavailable ?? "unknown" },
  );

  if (!cap.ok) flags.push("excluded_from_ranking");
  else if (seeded) flags.push("excluded_from_ranking");

  const reason = cap.ok ? null : cap.unavailable;
  return {
    lane,
    label: plan.label,
    price_month_usd: plan.price_month_usd,
    price_badge: plan.badge,
    capacity: {
      method,
      window,
      tokens_per_week: tokensPerWeek,
      coverage,
      seeded,
      reason: seeded ? (SEED[lane]?.source ?? "seed") : reason,
      confidence: cap.ok && !seeded ? (capacityConfidence(obs && !("unavailable" in obs) ? obs.used_pct : null)?.confidence ?? null) : null,
      confidence_reason: cap.ok && !seeded ? (capacityConfidence(obs && !("unavailable" in obs) ? obs.used_pct : null)?.reason ?? null) : null,
      measured_at: now,
      source: seeded ? (SEED[lane]?.source ?? "seed") : obs ? obs.source : "codexbar (no reading)",
    },
    usd_per_b: usd,
    measured: {
      p50_ttft_ms: u.p50_ttft_ms,
      p90_ttft_ms: u.p90_ttft_ms,
      p50_output_tps: u.p50_output_tps,
      n: u.rows,
      measured_at: now,
      source: `usage_logs(${usage.window_days}d) rows=${u.rows}`,
    },
    presets,
    flags,
    measured_at: now,
    source: `usage_logs(${usage.window_days}d) + codexbar quota + plans.json`,
  };
});

// every lane must be either priced for ranking or carry an explicit reason
for (const l of lanes) {
  if (l.capacity.method === "unavailable" && !l.capacity.reason) {
    console.error(`build-dataset: ${l.lane} has neither capacity nor a reason`);
    process.exit(4);
  }
}

writeFileSync(join(dataDir, "lanes.json"), JSON.stringify(lanesFileSchema.parse({ lanes, measured_at: now, source: "build-dataset" }), null, 2) + "\n");

for (const l of lanes) {
  const usd = l.usd_per_b === null ? "null" : l.usd_per_b.toFixed(4);
  const cap = l.capacity.tokens_per_week === null ? "unavailable:" + l.capacity.reason : (l.capacity.tokens_per_week / 1e9).toFixed(3) + "B/wk";
  console.log(`${l.lane.padEnd(6)} method=${l.capacity.method} cap=${cap} usd_per_b=${usd} flags=${l.flags.join(",") || "-"}`);
}
const finite = lanes.filter((l) => l.usd_per_b !== null).length;
console.log(`lanes=${lanes.length} ranked=${finite} excluded=${lanes.length - finite}`);
