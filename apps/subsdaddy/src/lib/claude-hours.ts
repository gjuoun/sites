import { blendedUsdPerB } from "../data/estimate";

/**
 * A Claude plan's usage dollars per cycle, from Anthropic's own hour figure:
 *   tokens per week   = hours per week (lower bound, Sonnet 4) × tokens per active hour (measured, pi sessions)
 *   dollars per week  = tokens per week × blended list price of Claude Sonnet 5.5 at the measured mix
 *   dollars per cycle = dollars per week × cycle days / 7
 * Every term is read from data/: the hours from claude-plans.json, the throughput from context.json, the price
 * from claude-plans.json, the mix from usage.json. The mix is the pooled measured mix, so the figure does not
 * move with the Shape switch, the same as every other pool.
 */
export const CLAUDE_CYCLE_DAYS = 30;

export type Price = { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number };
export type MeasuredShares = { output_share: number; cache_share: number; cache_write_share: number };

export function weeklyTokens(hoursPerWeek: number, tokensPerActiveHour: number): number {
  return hoursPerWeek * tokensPerActiveHour;
}

/** Dollars per billion tokens at the given list price and measured mix. */
export function listUsdPerB(price: Price, mix: MeasuredShares): number {
  return blendedUsdPerB(price, mix);
}

export function cycleUsd(hoursPerWeek: number, tokensPerActiveHour: number, price: Price, mix: MeasuredShares): { tokensPerWeek: number; usdPerWeek: number; usdPerCycle: number; usdPerB: number } {
  const tokensPerWeek = weeklyTokens(hoursPerWeek, tokensPerActiveHour);
  const usdPerB = listUsdPerB(price, mix);
  const usdPerWeek = (tokensPerWeek / 1e9) * usdPerB;
  return { tokensPerWeek, usdPerWeek, usdPerCycle: usdPerWeek * CLAUDE_CYCLE_DAYS / 7, usdPerB };
}
