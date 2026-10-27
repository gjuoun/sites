import { z } from "zod";
import { blendedUsdPerB, cacheFor, pooledMix, priceAt, type RefPrice } from "./estimate";

/**
 * The usage allowance of a subscription, in list dollars, read from its quota windows.
 *
 *  1. For each window the codexbar reading gives: the window runs from resets_at minus its own length
 *     (window_minutes) to the reading time. Every metered usage row inside that span is priced at its
 *     model's list price (banded by its own prompt length) and summed: cost_usd, and tokens.
 *  2. The window's full-cycle allowance = cost ÷ used_fraction × (cycle_minutes ÷ window_minutes).
 *     The cycle is the plan's own billing cycle: the monthly window's length from the reading, or, when
 *     the plan has no monthly window, the longest window's length. Nothing here is a fixed day count.
 *  3. The plan's allowance is the minimum over the usable windows: the tightest window binds.
 *     A saturated window (used ≥ 99%) is usable. used ≤ 2% is low_signal; coverage < 95% is partial;
 *     neither takes part in the minimum.
 *  4. A model's $/B on this plan = fee ÷ (allowance ÷ blended list price of that model at the plan's own
 *     traffic shape). Rows whose model has no list price are counted as unpriced tokens, never zeroed.
 */

export const COVERAGE_MIN = 0.95;
export const LOW_SIGNAL_USED = 0.02;
export const LOW_COVERAGE_UNPRICED = 0.05;

export type WindowName = "5h" | "weekly" | "monthly";
export type WindowReading = { window: WindowName; window_minutes: number; used_pct: number; resets_at: string; measured_at: string };
export type UsageRow = { ms: number; model: string; input: number; cache_creation: number; cache_read: number; output: number };
export type PriceLookup = (model: string) => RefPrice | null;

export type WindowStatus = "usable" | "partial" | "low_signal" | "no_priced_usage";
export type WindowAnalysis = {
  window: WindowName;
  window_minutes: number;
  used_pct: number;
  resets_at: string;
  measured_at: string;
  start_iso: string;
  elapsed_hours: number;
  tokens: number;
  cost_usd: number;
  unpriced_tokens: number;
  unpriced_share: number;
  unpriced_models: string[];
  coverage: number;
  status: WindowStatus;
  allowance_usd_cycle: number | null;
  tokens_cycle: number | null;
};

const rowTokens = (r: UsageRow) => r.input + r.cache_creation + r.cache_read + r.output;

/** One row priced at its model's list price, banded by its own prompt length. */
export function rowCostUsd(r: UsageRow, p: RefPrice): number {
  const prompt = r.input + r.cache_creation + r.cache_read;
  const b = priceAt(p, prompt).price;
  return (r.input * b.in_per_m + r.cache_creation * b.cache_write_per_m + r.cache_read * b.cache_per_m + r.output * b.out_per_m) / 1e6;
}

/** The window's span, its priced cost and tokens, and the cycle allowance it implies. */
export function analyzeWindow(r: WindowReading, rows: UsageRow[], lookup: PriceLookup, coverageStartMs: number, cycleMinutes: number): WindowAnalysis {
  const end = Date.parse(r.measured_at);
  const start = Date.parse(r.resets_at) - r.window_minutes * 60_000;
  const elapsed = end - start;
  let tokens = 0;
  let cost = 0;
  let unpricedTokens = 0;
  const unpriced = new Set<string>();
  for (const row of rows) {
    if (row.ms < start || row.ms > end) continue;
    const t = rowTokens(row);
    tokens += t;
    const p = lookup(row.model);
    if (p === null) {
      unpricedTokens += t;
      unpriced.add(row.model);
    } else {
      cost += rowCostUsd(row, p);
    }
  }
  const coverage = Math.max(0, Math.min(1, (end - Math.max(start, coverageStartMs)) / elapsed));
  const used = r.used_pct / 100;
  const factor = cycleMinutes / r.window_minutes;
  let status: WindowStatus = "usable";
  if (coverage < COVERAGE_MIN) status = "partial";
  else if (used <= LOW_SIGNAL_USED) status = "low_signal";
  else if (cost <= 0) status = "no_priced_usage";
  const usable = status === "usable";
  return {
    window: r.window,
    window_minutes: r.window_minutes,
    used_pct: r.used_pct,
    resets_at: r.resets_at,
    measured_at: r.measured_at,
    start_iso: new Date(start).toISOString(),
    elapsed_hours: elapsed / 3_600_000,
    tokens,
    cost_usd: cost,
    unpriced_tokens: unpricedTokens,
    unpriced_share: tokens > 0 ? unpricedTokens / tokens : 0,
    unpriced_models: [...unpriced].sort(),
    coverage,
    status,
    allowance_usd_cycle: usable ? (cost / used) * factor : null,
    tokens_cycle: usable ? (tokens / used) * factor : null,
  };
}

/** The tightest usable window sets the plan's allowance. Null when no window is usable. */
export function bindingWindow(windows: WindowAnalysis[]): WindowAnalysis | null {
  const usable = windows.filter((w) => w.allowance_usd_cycle !== null);
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => ((b.allowance_usd_cycle as number) < (a.allowance_usd_cycle as number) ? b : a));
}

/** The billing cycle: the monthly window's length when the plan has one; else the longest window. */
export function cycleOf(readings: WindowReading[]): { minutes: number; billed: boolean } | null {
  if (readings.length === 0) return null;
  const monthly = readings.find((r) => r.window === "monthly");
  if (monthly) return { minutes: monthly.window_minutes, billed: true };
  return { minutes: Math.max(...readings.map((r) => r.window_minutes)), billed: false };
}

/** $/B of a model on a plan: fee over the tokens the allowance buys at that model's blended list price. */
export function modelPerB(input: { allowance_usd: number; fee_usd: number; ref: RefPrice; mix: { output_share: number; agent_cache_share: number; cache_write_share: number }; context_tokens: number }): { tokens_cycle: number; usd_per_b: number; blended_usd_per_b: number } {
  const b = priceAt(input.ref, input.context_tokens).price;
  const blended = blendedUsdPerB(b, { output_share: input.mix.output_share, cache_share: cacheFor("agent", { output_share: input.mix.output_share, agent_cache_share: input.mix.agent_cache_share }), cache_write_share: input.mix.cache_write_share });
  const tokensCycle = (input.allowance_usd / blended) * 1e9;
  return { tokens_cycle: tokensCycle, usd_per_b: input.fee_usd / (tokensCycle / 1e9), blended_usd_per_b: blended };
}

export { pooledMix };

const windowSchema = z.object({
  window: z.enum(["5h", "weekly", "monthly"]),
  window_minutes: z.number().positive(),
  used_pct: z.number().min(0).max(100),
  resets_at: z.string().min(1),
  measured_at: z.string().min(1),
  start_iso: z.string().min(1),
  elapsed_hours: z.number().nonnegative(),
  tokens: z.number().nonnegative(),
  cost_usd: z.number().nonnegative(),
  unpriced_tokens: z.number().nonnegative(),
  unpriced_share: z.number().min(0).max(1),
  unpriced_models: z.array(z.string()),
  coverage: z.number().min(0).max(1),
  status: z.enum(["usable", "partial", "low_signal", "no_priced_usage"]),
  allowance_usd_cycle: z.number().positive().nullable(),
  tokens_cycle: z.number().positive().nullable(),
  source: z.string().min(1),
});

const modelCell = z.object({ tokens_per_cycle: z.number().positive(), usd_per_b: z.number().positive(), blended_usd_per_b: z.number().positive(), measured_at: z.string().min(1), source: z.string().min(1) });

export const allowanceFileSchema = z.object({
  measured_at: z.string().min(1),
  source: z.string().min(1),
  context_standards: z.object({ short: z.number().positive(), long: z.number().positive() }),
  lanes: z.array(
    z.object({
      lane: z.string().min(1),
      measured_at: z.string().min(1),
      source: z.string().min(1),
      fee_usd: z.number().positive().nullable(),
      cycle_minutes: z.number().positive().nullable(),
      cycle_days: z.number().positive().nullable(),
      cycle_billed: z.boolean(),
      allowance_usd_per_cycle: z.number().positive().nullable(),
      tokens_per_cycle: z.number().positive().nullable(),
      binding_window: z.enum(["5h", "weekly", "monthly"]).nullable(),
      binding_coverage: z.number().min(0).max(1).nullable(),
      binding_unpriced_share: z.number().min(0).max(1).nullable(),
      low_coverage: z.boolean(),
      list_usd_per_b_effective: z.number().positive().nullable(),
      usd_per_b_measured: z.number().positive().nullable(),
      reason: z.string().nullable(),
      mix: z.object({ output_share: z.number(), agent_cache_share: z.number(), cache_write_share: z.number() }),
      top_models: z.array(z.object({ model: z.string(), label: z.string(), share: z.number() })),
      windows: z.array(windowSchema),
      models: z.array(z.object({ ref: z.string(), short: modelCell.nullable(), long: modelCell.nullable(), reason: z.string().nullable() })),
    }),
  ),
});
export type AllowanceFile = z.infer<typeof allowanceFileSchema>;
