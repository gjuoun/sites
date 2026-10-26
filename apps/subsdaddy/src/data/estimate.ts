/**
 * Catalog estimates: a plan's fee per usage dollar, times the blended list-price cost of one billion
 * tokens for a reference model. Used only for catalog rows. Estimated values never enter the ranking.
 *
 *   estimated_usd_per_b(plan, model, shape) = (fee_usd / allowance_usd) × blended_usd_per_b(model, shape)
 *
 * blended_usd_per_b uses OpenRouter list prices and the measured token mix of this site:
 *   output share o       = output / all tokens (measured, pooled over the four plans)
 *   cache share c        = cache_read / prompt tokens (interactive: 0; agent: measured; cache_heavy: 0.94)
 *   blended ($/token)    = (1−o)(1−c)·in + (1−o)·c·cache + o·out
 *   blended ($/B tokens) = blended ($/token) × 1e9
 */

export const REF_IDS = ["deepseek-v4-flash", "claude-haiku-5.5", "gpt-6-luna"] as const;
export type RefId = (typeof REF_IDS)[number];
export const SHAPES = ["interactive", "agent", "cache_heavy"] as const;
export type Shape = (typeof SHAPES)[number];
export const CACHE_HEAVY = 0.94;

/** USD per one million tokens, OpenRouter list price. */
export type RefPrice = { in_per_m: number; out_per_m: number; cache_per_m: number };

export type MeasuredMix = { output_share: number; agent_cache_share: number };

export type TokenTotals = { input: number; cache_creation: number; cache_read: number; output: number };

/** Pooled over all lanes: output share of all tokens, and the agent cache share over prompt tokens. */
export function pooledMix(lanes: Array<{ tokens: TokenTotals }>): MeasuredMix {
  const sum = (f: (t: TokenTotals) => number) => lanes.reduce((a, l) => a + f(l.tokens), 0);
  const input = sum((t) => t.input);
  const creation = sum((t) => t.cache_creation);
  const read = sum((t) => t.cache_read);
  const output = sum((t) => t.output);
  const total = input + creation + read + output;
  const prompt = input + creation + read;
  if (total <= 0 || prompt <= 0) throw new Error("pooledMix: no tokens in the measured window");
  return { output_share: output / total, agent_cache_share: read / prompt };
}

export function cacheFor(shape: Shape, mix: MeasuredMix): number {
  if (shape === "interactive") return 0;
  if (shape === "cache_heavy") return CACHE_HEAVY;
  return mix.agent_cache_share;
}

/** Blended list-price cost of one billion tokens for a model at a given token mix. */
export function blendedUsdPerB(price: RefPrice, mix: { output_share: number; cache_share: number }): number {
  const o = mix.output_share;
  const c = mix.cache_share;
  if (o < 0 || o > 1 || c < 0 || c > 1) throw new Error("blendedUsdPerB: shares must be in [0,1]");
  const perToken =
    ((1 - o) * (1 - c) * price.in_per_m + (1 - o) * c * price.cache_per_m + o * price.out_per_m) / 1e6;
  return perToken * 1e9;
}

/** The estimate for one plan and one reference model, or null with a reason. Never zero. */
export function estimateOne(input: {
  fee_usd: number;
  allowance_usd: number | null;
  allowance_reason: string | null;
  price: RefPrice;
  mix: MeasuredMix;
  shape: Shape;
}): { usd_per_b: number | null; reason: string | null; fee_over_allowance: number | null; blended_usd_per_b: number } {
  const blended = blendedUsdPerB(input.price, { output_share: input.mix.output_share, cache_share: cacheFor(input.shape, input.mix) });
  if (input.allowance_usd === null || !(input.allowance_usd > 0)) {
    return { usd_per_b: null, reason: input.allowance_reason ?? "no published usage-dollar allowance", fee_over_allowance: null, blended_usd_per_b: blended };
  }
  const ratio = input.fee_usd / input.allowance_usd;
  return { usd_per_b: ratio * blended, reason: null, fee_over_allowance: ratio, blended_usd_per_b: blended };
}
