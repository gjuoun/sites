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

export const REF_IDS = ["deepseek-v4.1-flash", "gemini-3.8-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"] as const;
/** Display names for the reference models, used in the catalog table. */
export const REF_NAMES: Record<RefId, string> = {
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "claude-haiku-5.5": "Claude Haiku 5.5",
  "gpt-6-luna": "GPT-6 Luna",
  "glm-5.3-flash": "GLM-5.3-Flash",
};
export type RefId = (typeof REF_IDS)[number];
export const SHAPES = ["interactive", "agent", "cache_heavy"] as const;
export type Shape = (typeof SHAPES)[number];
export const CACHE_HEAVY = 0.94;

/** A prompt-length band: above min_prompt_tokens the whole request is priced at these rates (OpenRouter "overrides"). */
export type PriceOverride = { min_prompt_tokens: number; in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null };

/** USD per one million tokens, OpenRouter list price. cache_write_per_m and overrides are optional; absent means base only. */
export type RefPrice = {
  in_per_m: number;
  out_per_m: number;
  cache_per_m: number;
  cache_write_per_m?: number | null;
  overrides?: PriceOverride[];
};

/** cache_write_share is the share of prompt tokens written to cache; 0 when the measured traffic writes none. */
export type MeasuredMix = { output_share: number; agent_cache_share: number; cache_write_share?: number };

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
  return { output_share: output / total, agent_cache_share: read / prompt, cache_write_share: creation / prompt };
}

export function cacheFor(shape: Shape, mix: MeasuredMix): number {
  if (shape === "interactive") return 0;
  if (shape === "cache_heavy") return CACHE_HEAVY;
  return mix.agent_cache_share;
}

export function writeFor(shape: Shape, mix: MeasuredMix): number {
  return shape === "agent" ? (mix.cache_write_share ?? 0) : 0;
}

const kTokens = (n: number) => (n >= 1000 ? String(n / 1000) + "k" : String(n));

/**
 * The price for one request of a given prompt length. A request whose prompt reaches an override's
 * threshold is priced at that override's rates for the whole request; below every threshold the base
 * rates apply. A missing cache-write price falls back to the input price, as before.
 */
export function priceAt(price: RefPrice, promptTokens?: number): { price: { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number }; band: string } {
  const base = { in_per_m: price.in_per_m, out_per_m: price.out_per_m, cache_per_m: price.cache_per_m, cache_write_per_m: price.cache_write_per_m ?? price.in_per_m };
  const overrides = [...(price.overrides ?? [])].sort((a, b) => a.min_prompt_tokens - b.min_prompt_tokens);
  if (overrides.length === 0) return { price: base, band: "base price (no prompt-length band)" };
  if (promptTokens === undefined) return { price: base, band: "band: base (prompt length not given)" };
  // strictly above the threshold: a prompt of exactly min_prompt_tokens stays in the band below (<= 100K is the low tier)
  const hit = overrides.filter((o) => promptTokens > o.min_prompt_tokens).pop();
  if (!hit) return { price: base, band: "band: ≤" + kTokens(overrides[0].min_prompt_tokens) + " base" };
  const mult = Math.round((hit.in_per_m / base.in_per_m) * 100) / 100;
  return {
    price: { in_per_m: hit.in_per_m, out_per_m: hit.out_per_m, cache_per_m: hit.cache_per_m, cache_write_per_m: hit.cache_write_per_m ?? base.cache_write_per_m },
    band: "band: >" + kTokens(hit.min_prompt_tokens) + " ×" + String(mult),
  };
}

/** Blended list-price cost of one billion tokens for a model at a given token mix. Prompt tokens are split into input, cache write and cache read. */
export function blendedUsdPerB(
  price: { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m?: number | null },
  mix: { output_share: number; cache_share: number; cache_write_share?: number },
): number {
  const o = mix.output_share;
  const c = mix.cache_share;
  const w = mix.cache_write_share ?? 0;
  if (o < 0 || o > 1 || c < 0 || c > 1 || w < 0 || c + w > 1 + 1e-9) throw new Error("blendedUsdPerB: shares must be in [0,1] and read + write ≤ 1");
  const cw = price.cache_write_per_m ?? price.in_per_m;
  const inShare = Math.max(0, 1 - c - w);
  const perToken = ((1 - o) * (inShare * price.in_per_m + w * cw + c * price.cache_per_m) + o * price.out_per_m) / 1e6;
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
  /** The prompt length of a request, for the prompt-length band. Omit for base pricing. */
  prompt_tokens?: number;
}): { usd_per_b: number | null; reason: string | null; fee_over_allowance: number | null; blended_usd_per_b: number; band: string } {
  const banded = priceAt(input.price, input.prompt_tokens);
  const blended = blendedUsdPerB(banded.price, { output_share: input.mix.output_share, cache_share: cacheFor(input.shape, input.mix), cache_write_share: writeFor(input.shape, input.mix) });
  if (input.allowance_usd === null || !(input.allowance_usd > 0)) {
    return { usd_per_b: null, reason: input.allowance_reason ?? "no published usage-dollar allowance", fee_over_allowance: null, blended_usd_per_b: blended, band: banded.band };
  }
  const ratio = input.fee_usd / input.allowance_usd;
  return { usd_per_b: ratio * blended, reason: null, fee_over_allowance: ratio, blended_usd_per_b: blended, band: banded.band };
}
