/**
 * The model rows of one lane: what it actually ran in the recent window, with its own share,
 * speed and — only where the plan publishes them — its per-model monthly limit.
 *
 * A model under one percent of the lane's tokens folds into a single "other models" row: the
 * page stays readable, and the fold carries the count and its reason instead of a p50 it cannot have.
 */
import type { LaneUsage, TokenCounts } from "../data/schema";
import { limitOfUpstream } from "../data/per-model-limit";
import { modelLabel } from "./model-label";

export const OTHER_SHARE = 0.01;
export const RECENT_DAYS = 7;
export const OTHER_MODEL = "__other__";

export type LaneModelRow = {
  upstream_model: string;
  label: string;
  tokens_7d: number;
  share_7d: number;
  rows_7d: number;
  cache_share_7d: number | null;
  p50_ttft_ms: number | null;
  p50_output_tps: number | null;
  limit_usd_month: number | null;
  limit_reason: string | null;
  measured_at: string;
  source: string;
};

export type LaneTraffic = {
  window_days: number;
  tokens: number | null;
  requests: number;
  cache_share: number | null;
  p50_ttft_ms: number | null;
  p90_ttft_ms: number | null;
  p50_output_tps: number | null;
  reason: string | null;
  measured_at: string;
  source: string;
};

const total = (t: TokenCounts) => t.input + t.cache_creation + t.cache_read + t.output;
const cacheShareOf = (t: TokenCounts): number | null => {
  const prompt = t.input + t.cache_creation + t.cache_read;
  return prompt > 0 ? t.cache_read / prompt : null;
};

/** The lane's own volume in the recent window; an idle lane says so instead of reporting 0. */
export function trafficOf(usage: LaneUsage, windowDays = RECENT_DAYS): LaneTraffic {
  const tokens = total(usage.tokens);
  return {
    window_days: windowDays,
    tokens: tokens > 0 ? tokens : null,
    requests: usage.rows,
    cache_share: cacheShareOf(usage.tokens),
    p50_ttft_ms: usage.p50_ttft_ms,
    p90_ttft_ms: usage.p90_ttft_ms,
    p50_output_tps: usage.p50_output_tps,
    reason: tokens > 0 ? null : "no traffic in the recent window",
    measured_at: usage.measured_at,
    source: usage.source,
  };
}

export function laneModelRows(input: {
  usage: LaneUsage;
  /** The plan's published per-model limits, keyed by page model name; null when the plan publishes none. */
  limits: Map<string, number> | null;
  measuredAt: string;
  source: string;
}): LaneModelRow[] {
  const { usage, limits, measuredAt, source } = input;
  const all = usage.models.map((m) => ({ m, tokens: total(m.tokens) })).filter((x) => x.tokens > 0);
  const laneTotal = all.reduce((a, x) => a + x.tokens, 0);
  if (laneTotal <= 0) return [];

  const limitFor = (upstream: string): { usd: number | null; reason: string | null } => {
    if (!limits) return { usd: null, reason: "this plan publishes no per-model limit" };
    const usd = limitOfUpstream(upstream, limits);
    return usd === null ? { usd: null, reason: "no published limit for this model" } : { usd, reason: null };
  };

  const kept: LaneModelRow[] = [];
  const folded: Array<{ rows: number; tokens: number; input: number; cache_creation: number; cache_read: number }> = [];
  for (const { m, tokens } of all.sort((a, b) => b.tokens - a.tokens)) {
    const share = tokens / laneTotal;
    if (share < OTHER_SHARE) {
      folded.push({ rows: m.rows, tokens, input: m.tokens.input, cache_creation: m.tokens.cache_creation, cache_read: m.tokens.cache_read });
      continue;
    }
    const limit = limitFor(m.upstream_model);
    kept.push({
      upstream_model: m.upstream_model,
      label: modelLabel(m.upstream_model),
      tokens_7d: tokens,
      share_7d: share,
      rows_7d: m.rows,
      cache_share_7d: cacheShareOf(m.tokens),
      p50_ttft_ms: m.p50_ttft_ms,
      p50_output_tps: m.p50_output_tps,
      limit_usd_month: limit.usd,
      limit_reason: limit.reason,
      measured_at: measuredAt,
      source,
    });
  }

  if (folded.length > 0) {
    const tokens = folded.reduce((a, f) => a + f.tokens, 0);
    const prompt = folded.reduce((a, f) => a + f.input + f.cache_creation + f.cache_read, 0);
    const cached = folded.reduce((a, f) => a + f.cache_read, 0);
    kept.push({
      upstream_model: OTHER_MODEL,
      label: "Other models (" + folded.length + ")",
      tokens_7d: tokens,
      share_7d: tokens / laneTotal,
      rows_7d: folded.reduce((a, f) => a + f.rows, 0),
      cache_share_7d: prompt > 0 ? cached / prompt : null,
      p50_ttft_ms: null,
      p50_output_tps: null,
      limit_usd_month: null,
      limit_reason: "pooled, under " + Math.round(OTHER_SHARE * 100) + "% each",
      measured_at: measuredAt,
      source,
    });
  }
  return kept;
}
