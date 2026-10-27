import { LMC_CONTEXT_LONG, LMC_CONTEXT_SHORT } from "./context";

/**
 * Consumer plans that publish a message limit per five-hour window (OpenAI Codex) are converted to tokens
 * with one convention, fixed here:
 *   tokens per message = context per message + output per message
 *   context per message = the standard context (100K, or 350K for the long standard)
 *   output per message  = 467 tokens, the median output of one assistant turn in our pi session logs
 * Monthly capacity = messages per window (midpoint of the vendor range) × windows per day × 30 × tokens per message.
 * Two window rhythms: realistic (3 active windows a day) and ceiling (24 hours of continuous use, 24 / 5 = 4.8 windows a day).
 */
export const OUTPUT_TOKENS_PER_MESSAGE = 467;
export const DAYS_PER_MONTH = 30;
export const WINDOW_HOURS = 5;
export const WINDOWS_PER_DAY = { realistic: 3, ceiling: 24 / WINDOW_HOURS } as const;

export function tokensPerMessage(contextTokens: number): number {
  return contextTokens + OUTPUT_TOKENS_PER_MESSAGE;
}

/** The vendor range's midpoint: the single value the table shows for a range such as 350-3,000. */
export function midpointMessages(low: number, high: number): number {
  return (low + high) / 2;
}

/** Tokens a plan can run in a month at a given context and window rhythm. */
export function monthlyTokens(limit: { low: number; high: number }, contextTokens: number, windowsPerDay: number): number {
  return midpointMessages(limit.low, limit.high) * windowsPerDay * DAYS_PER_MONTH * tokensPerMessage(contextTokens);
}

/** USD per billion tokens of a plan's fee over its monthly token capacity. */
export function usdPerBOfTokens(feeUsd: number, tokens: number): number {
  return feeUsd / (tokens / 1e9);
}

export const CONTEXTS = { short: LMC_CONTEXT_SHORT, long: LMC_CONTEXT_LONG } as const;
