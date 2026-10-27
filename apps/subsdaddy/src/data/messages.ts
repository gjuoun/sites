import { LMC_CONTEXT_LONG, LMC_CONTEXT_SHORT } from "./context";

/**
 * Consumer plans that publish a message limit per five-hour window (OpenAI Codex) are converted to tokens
 * with one convention, fixed here:
 *   tokens per message = context per message + output per message
 *   context per message = the standard context (100K, or 350K for the long standard)
 *   output per message  = 462 tokens, the median output of one assistant turn in our pi session logs
 *                         (recount 2026-10-26: 43,582 turns in 45 days)
 * Monthly capacity = messages per window × windows per day × 30 × tokens per message.
 * The vendor gives a range. The front page uses its LOWER bound; the upper bound is shown in methodology.
 * Two window rhythms: realistic (3 active windows a day) and ceiling (24 hours of continuous use, 24 / 5 = 4.8 a day).
 */
export const OUTPUT_TOKENS_PER_MESSAGE = 462;
export const DAYS_PER_MONTH = 30;
export const WINDOW_HOURS = 5;
export const WINDOWS_PER_DAY = { realistic: 3, ceiling: 24 / WINDOW_HOURS } as const;
export type Bound = "low" | "high";

export function tokensPerMessage(contextTokens: number): number {
  return contextTokens + OUTPUT_TOKENS_PER_MESSAGE;
}

/** The messages per window at one end of the vendor range. */
export function boundMessages(limit: { low: number; high: number }, bound: Bound): number {
  return bound === "low" ? limit.low : limit.high;
}

/** Tokens a plan can run in a month at a given context, range end and window rhythm. */
export function monthlyTokens(limit: { low: number; high: number }, contextTokens: number, windowsPerDay: number, bound: Bound = "low"): number {
  return boundMessages(limit, bound) * windowsPerDay * DAYS_PER_MONTH * tokensPerMessage(contextTokens);
}

/** USD per billion tokens of a plan's fee over its monthly token capacity. */
export function usdPerBOfTokens(feeUsd: number, tokens: number): number {
  return feeUsd / (tokens / 1e9);
}

export const CONTEXTS = { short: LMC_CONTEXT_SHORT, long: LMC_CONTEXT_LONG } as const;
