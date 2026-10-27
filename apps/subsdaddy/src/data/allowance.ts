import { z } from "zod";
import { blendedUsdPerB, cacheFor, pooledMix, priceAt, type RefPrice } from "./estimate";
import { windowUseSchema } from "./published";

/**
 * The usage allowance of a subscription, in list dollars per billing cycle, read from its quota windows.
 *
 *  1. For each window the codexbar reading gives: the window runs from resets_at minus its own length to the
 *     reading time. Every usage row inside that span is priced at its model's list price (banded by its own
 *     prompt length) and summed: cost_usd and tokens. A model with no list price is counted as unpriced tokens.
 *  2. The window's full-cycle allowance = cost ÷ used_fraction × (cycle ÷ window length).
 *     The cycle is the monthly window's length from the reading; with no monthly window, the longest window's.
 *  3. The derived allowance is the minimum over the competing windows (r47: low-signal windows do not compete). A window is usable unless it is partial
 *     (log covers under 95% of its span), unused (0%), or has no priced usage. A window at 2% or less is
 *     low_signal and still usable; it carries low confidence.
 *  4. A vendor-reported pool, when codexbar states one and its used share matches the monthly window, is the
 *     allowance (basis vendor_reported). The derived figure is kept beside it.
 *  5. A model's $/B on the plan is fee ÷ (allowance ÷ blended list price of that model at the plan's traffic shape).
 */

export const COVERAGE_MIN = 0.95;
export const LOW_SIGNAL_USED = 0.02;
export const LOW_CONFIDENCE_USED = 0.1;
export const LOW_COVERAGE_UNPRICED = 0.05;
export const VENDOR_MATCH_POINTS = 1;

export type WindowName = "5h" | "weekly" | "monthly";
export type WindowReading = { window: WindowName; window_minutes: number; used_pct: number; resets_at: string; measured_at: string };
export type UsageRow = { ms: number; model: string; input: number; cache_creation: number; cache_read: number; output: number };
export type PriceLookup = (model: string) => RefPrice | null;
export type VendorPool = { used_usd: number; total_usd: number; source: string; measured_at: string };

export type WindowStatus = "usable" | "partial" | "unused" | "low_signal" | "no_priced_usage";
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
  confidence: "low" | "normal";
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
  else if (used <= 0) status = "unused";
  else if (cost <= 0) status = "no_priced_usage";
  else if (used <= LOW_SIGNAL_USED) status = "low_signal";
  const usable = status === "usable" || status === "low_signal";
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
    confidence: r.used_pct / 100 < LOW_CONFIDENCE_USED ? "low" : "normal",
    allowance_usd_cycle: usable ? (cost / used) * factor : null,
    tokens_cycle: usable ? (tokens / used) * factor : null,
  };
}

/**
 * The window that sets the derived allowance (r47). A low-signal window (2% used or less) does not compete: its figure
 * scales with 1/used, so a reading of 1% moves it by whole multiples. Among the other usable windows the tightest
 * (smallest allowance) binds. When every usable window is low-signal, the longest window binds, with low confidence.
 * Null when no window is usable.
 */
export function bindingWindow(windows: WindowAnalysis[]): WindowAnalysis | null {
  const usable = windows.filter((w) => w.allowance_usd_cycle !== null);
  if (usable.length === 0) return null;
  const competing = usable.filter((w) => w.status !== "low_signal");
  if (competing.length > 0) return competing.reduce((a, b) => ((b.allowance_usd_cycle as number) < (a.allowance_usd_cycle as number) ? b : a));
  return usable.reduce((a, b) => (b.window_minutes > a.window_minutes ? b : a));
}

/** True when every usable window is low-signal: the binding figure then rests on the longest window alone. */
export function allWindowsLowSignal(windows: WindowAnalysis[]): boolean {
  const usable = windows.filter((w) => w.allowance_usd_cycle !== null);
  return usable.length > 0 && usable.every((w) => w.status === "low_signal");
}

/** The billing cycle: the monthly window's length when the plan has one; else the longest window. */
export function cycleOf(readings: WindowReading[]): { minutes: number; billed: boolean } | null {
  if (readings.length === 0) return null;
  const monthly = readings.find((r) => r.window === "monthly");
  if (monthly) return { minutes: monthly.window_minutes, billed: true };
  return { minutes: Math.max(...readings.map((r) => r.window_minutes)), billed: false };
}

/**
 * The vendor-reported pool as the allowance, when its used share matches the monthly window's used percent.
 * A pool that does not match is not used; the reason says why.
 */
export function vendorAllowance(pool: VendorPool | null | undefined, monthly: WindowAnalysis | undefined): { usd: number | null; reason: string } {
  if (!pool) return { usd: null, reason: "no vendor-reported pool" };
  if (!(pool.total_usd > 0)) return { usd: null, reason: "vendor pool total is not positive" };
  if (!monthly) return { usd: null, reason: "no monthly window to match the vendor pool to" };
  const poolPct = (pool.used_usd / pool.total_usd) * 100;
  if (Math.abs(poolPct - monthly.used_pct) > VENDOR_MATCH_POINTS) {
    return { usd: null, reason: "vendor pool " + poolPct.toFixed(1) + "% used does not match the monthly window (" + monthly.used_pct.toFixed(1) + "%)" };
  }
  return { usd: pool.total_usd, reason: "vendor-reported pool, its used share matches the monthly window" };
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
  status: z.enum(["usable", "partial", "unused", "low_signal", "no_priced_usage"]),
  confidence: z.enum(["low", "normal"]),
  allowance_usd_cycle: z.number().positive().nullable(),
  tokens_cycle: z.number().positive().nullable(),
  source: z.string().min(1),
  assumed_share: z.number().min(0).max(1).optional(),
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
      /** Set when the lane holds its last stable reading (r48): every window is at or under 2% used. */
      stale: z.object({ read_at: z.string().min(1), published_on: z.string().min(1), current_windows: z.array(windowUseSchema), reason: z.string().min(1) }).nullable().optional(),
      fee_usd: z.number().positive().nullable(),
      fee_per_cycle_usd: z.number().positive().nullable(),
      fee_basis: z.string().nullable(),
      cycle_minutes: z.number().positive().nullable(),
      cycle_days: z.number().positive().nullable(),
      cycle_billed: z.boolean(),
      allowance_usd_per_cycle: z.number().positive().nullable(),
      allowance_basis: z.enum(["vendor_published", "vendor_reported", "derived"]).nullable(),
      allowance_published_usd: z.number().positive().nullable().optional(),
      allowance_vendor_usd: z.number().positive().nullable(),
      allowance_vendor_reason: z.string().nullable(),
      allowance_derived_usd: z.number().positive().nullable(),
      tokens_per_cycle: z.number().positive().nullable(),
      binding_window: z.enum(["5h", "weekly", "monthly"]).nullable(),
      binding_coverage: z.number().min(0).max(1).nullable(),
      binding_unpriced_share: z.number().min(0).max(1).nullable(),
      binding_assumed_share: z.number().min(0).max(1).nullable().optional(),
      low_coverage: z.boolean(),
      confidence: z.enum(["low", "normal"]).nullable(),
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
