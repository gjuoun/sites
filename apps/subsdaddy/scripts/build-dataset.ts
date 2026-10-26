#!/usr/bin/env bun
/**
 * Derives data/lanes.json (one record per plan) from usage.json + quota.json + plans.json and the
 * raw row export. Every number carries its method; a plan with no capacity carries an explicit
 * reason. A plan without its own dollar figure takes its same-rate peer's, marked "derived".
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  LANES,
  type LaneId,
  type LaneRecord,
  lanesFileSchema,
  migrateQuotaFile,
  planSchema,
  plansFileSchema,
  quotaFileSchema,
  type QuotaObservationOrGap,
  usageFileSchema,
} from "../src/data/schema";
import {
  type Capacity,
  type PricedRow,
  capacityConfidence,
  capacityFromDelta,
  capacityFromSnapshot,
  elapsedCoverage,
  fitPriceVector,
  mixShares,
  presetsFor,
  resolveDollarPerB,
  usdB,
} from "../src/data/derive";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const read = (p: string) => JSON.parse(readFileSync(join(dataDir, p), "utf8"));
const now = new Date().toISOString();
const nowMs = Date.parse(now);
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/** Same-rate peer that stands in while a plan has no capacity reading of its own (owner ruling 2026-10-26). */
const RATE_PEER: Partial<Record<LaneId, LaneId>> = { "commandcode-goat": "opencode-go" };
const RATE_PEER_SOURCE = "同费率推算（owner 2026-10-26）；实测待 CommandCode GOAT 周窗 2026-10-28 复位后替换";

/** Plans whose quota reading covers one of several accounts: the capacity is stated for the single plan. */
const SINGLE_ACCOUNT_READING = new Set<LaneId>(["opencode-go"]);

/** Seed allowance used only when a plan has no reading at all; it is badged seed and kept out of the ranking. */
const SEED: Partial<Record<LaneId, { tokens_per_week: number; source: string }>> = {
  "zai-glm-max": { tokens_per_week: 5.7e9, source: "published allowance, flash weight (seed, unverified against console)" },
};

const usage = usageFileSchema.parse(read("usage.json"));
const quota = quotaFileSchema.parse(migrateQuotaFile(read("quota.json")));
const plans = plansFileSchema.parse(read("plans.json"));

const rawRowSchema = z.object({
  lane: z.enum(LANES),
  metered: z.boolean(),
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

// delta-pair history: every earlier quota observation per plan, from the raw quota history
const quotaHistory = new Map<LaneId, { measured_at: string; used_pct: number }[]>();
const rawQuotaDir = join(dataDir, "raw", "quota");
if (existsSync(rawQuotaDir)) {
  for (const f of readdirSync(rawQuotaDir).filter((x) => x.endsWith(".json"))) {
    const parsed = quotaFileSchema.parse(migrateQuotaFile(JSON.parse(readFileSync(join(rawQuotaDir, f), "utf8"))));
    for (const o of parsed.observations) {
      if ("used_pct" in o) {
        const list = quotaHistory.get(o.lane) ?? [];
        list.push({ measured_at: o.measured_at, used_pct: o.used_pct });
        quotaHistory.set(o.lane, list);
      }
    }
  }
}

/** Capacity comes only from the metered accounts: the tokens that the quota reading actually counted. */
function capacityFor(lane: LaneId, obs: QuotaObservationOrGap | undefined): {
  cap: Capacity;
  method: LaneRecord["capacity"]["method"];
  window: "weekly" | "monthly" | null;
  coverage: number | null;
  seeded: boolean;
  cost_in_window: number;
} {
  const laneRows = rows.filter((r) => r.lane === lane && r.metered);
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
  const inside = laneRows.filter((r) => inWindow(r, windowStart, nowMs));
  const tokensInWindow = inside.reduce((a, r) => a + tokensOf(r), 0);
  const costInWindow = inside.reduce((a, r) => a + r.total_cost, 0);
  const coverage = elapsedCoverage({ coverage_start_ms: Date.parse(usage.coverage_start), window_start_ms: windowStart, now_ms: nowMs });
  const win: "weekly" | "monthly" = obs.window === "monthly" ? "monthly" : "weekly";
  const snap = capacityFromSnapshot({ tokens_in_window: tokensInWindow, used_pct: obs.used_pct, window_ms: windowMs, coverage });
  if (snap.ok) return { cap: snap, method: "window_snapshot", window: win, coverage, seeded: false, cost_in_window: costInWindow };

  // fallback: delta pair against the latest earlier reading at least an hour old
  const prior = (quotaHistory.get(lane) ?? []).filter((p) => nowMs - Date.parse(p.measured_at) >= 3_600_000).at(-1);
  const snapReason = (snap as { unavailable: string }).unavailable;
  if (prior) {
    const between = laneRows.filter((r) => inWindow(r, Date.parse(prior.measured_at), nowMs)).reduce((a, r) => a + tokensOf(r), 0);
    const delta = capacityFromDelta({
      tokens_between: between,
      used_pct_before: prior.used_pct,
      used_pct_after: obs.used_pct,
      elapsed_ms: nowMs - Date.parse(prior.measured_at),
    });
    if (delta.ok) return { cap: delta, method: "delta_pair", window: win, coverage: null, seeded: false, cost_in_window: costInWindow };
    return { cap: { ok: false, unavailable: `${snapReason}+${delta.unavailable}` }, method: "unavailable", window: null, coverage: null, seeded: false, cost_in_window: costInWindow };
  }
  return { cap: { ok: false, unavailable: snapReason + "+no_prior_observation" }, method: "unavailable", window: null, coverage: null, seeded: false, cost_in_window: costInWindow };
}

// pooled mix across all accounts, computed from the same window the plans are measured in
const poolShares = mixShares(rows.map((r) => ({ tokens: { input: r.input, cache_creation: r.cache_creation, cache_read: r.cache_read, output: r.output }, total_cost: r.total_cost })));

type Draft = {
  lane: LaneId;
  plan: z.infer<typeof planSchema>;
  u: (typeof usage.lanes)[number];
  obs: QuotaObservationOrGap | undefined;
  cap: Capacity;
  method: LaneRecord["capacity"]["method"];
  window: "weekly" | "monthly" | null;
  coverage: number | null;
  seeded: boolean;
  costInWindow: number;
  fit: ReturnType<typeof fitPriceVector>;
  pricedShare: number;
  usdMeasured: number | null;
  presets: LaneRecord["presets"];
  flags: string[];
  confidence: { confidence: "low" | "normal"; reason: string | null } | null;
};

// pass 1: every plan's own measured figures
const drafts: Draft[] = LANES.map((lane) => {
  const plan = planSchema.parse(plans.plans.find((p) => p.plan_id === lane));
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

  const usdMeasured = cap.ok && !seeded ? usdB(plan.price_month_usd, cap.tokens_per_week) : null;

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
    capacity_tokens_per_week: cap.ok ? cap.tokens_per_week : null,
  });
  if (presetRaw.some((p) => p.unavailable === "capacity_conflict")) flags.push("capacity_conflict");
  const presets = presetRaw.map((p) =>
    p.usd_per_b !== undefined ? { shape: p.shape, usd_per_b: p.usd_per_b } : { shape: p.shape, unavailable: p.unavailable ?? "unknown" },
  );

  const reading = obs && !("unavailable" in obs) ? obs.used_pct : null;
  return { lane, plan, u, obs, cap, method, window, coverage, seeded, costInWindow: cost_in_window, fit, pricedShare, usdMeasured, presets, flags, confidence: capacityConfidence(reading) };
});

const measuredUsd = new Map<LaneId, number | null>(drafts.map((d) => [d.lane, d.usdMeasured]));

// pass 2: the dollar figure, with its basis; a plan with no own figure takes its rate peer's measured one
const lanes: LaneRecord[] = drafts.map((d) => {
  const peer = RATE_PEER[d.lane] ?? null;
  const dollar = resolveDollarPerB({ own: d.usdMeasured, rate_peer: peer, peer_value: peer ? (measuredUsd.get(peer) ?? null) : null });
  const flags = [...d.flags];
  if (dollar.usd_per_b === null) flags.push("excluded_from_ranking");
  const reason = d.cap.ok ? null : d.cap.unavailable;
  return {
    lane: d.lane,
    label: d.plan.label,
    price_month_usd: d.plan.price_month_usd,
    price_badge: d.plan.badge,
    capacity: {
      method: d.method,
      window: d.window,
      tokens_per_week: d.cap.ok ? d.cap.tokens_per_week : null,
      coverage: d.coverage,
      seeded: d.seeded,
      reason: d.seeded ? (SEED[d.lane]?.source ?? "seed") : reason,
      confidence: d.cap.ok && !d.seeded ? (d.confidence?.confidence ?? null) : null,
      confidence_reason: d.cap.ok && !d.seeded ? (d.confidence?.reason ?? null) : null,
      badge: SINGLE_ACCOUNT_READING.has(d.lane) && d.cap.ok && !d.seeded ? "single_account_reading" : null,
      measured_at: now,
      source: d.seeded ? (SEED[d.lane]?.source ?? "seed") : d.obs ? d.obs.source : "codexbar (no reading)",
    },
    usd_per_b: dollar.usd_per_b,
    usd_per_b_basis: dollar.basis,
    usd_per_b_derived_from: dollar.derived_from as LaneId | null,
    usd_per_b_source: dollar.basis === "derived" ? RATE_PEER_SOURCE : dollar.basis === "measured" ? "usage logs, quota reading, published price" : null,
    measured: { p50_ttft_ms: d.u.p50_ttft_ms, p90_ttft_ms: d.u.p90_ttft_ms, p50_output_tps: d.u.p50_output_tps, n: d.u.rows, measured_at: now, source: `usage_logs(${usage.window_days}d) rows=${d.u.rows}` },
    presets: d.presets,
    flags,
    measured_at: now,
    source: `usage_logs(${usage.window_days}d) + quota reading + published price`,
  };
});

// every plan is either priced for ranking or carries an explicit reason
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
  console.log(`${l.lane.padEnd(18)} method=${l.capacity.method} cap=${cap} usd_per_b=${usd} basis=${l.usd_per_b_basis ?? "-"} flags=${l.flags.join(",") || "-"}`);
}
const ranked = lanes.filter((l) => l.usd_per_b !== null).length;
const derived = lanes.filter((l) => l.usd_per_b_basis === "derived").length;
console.log(`lanes=${lanes.length} ranked=${ranked} excluded=${lanes.length - ranked} derived=${derived}`);
