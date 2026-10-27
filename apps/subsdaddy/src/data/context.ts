import { z } from "zod";

/**
 * The standard context: the two prompt lengths every model price is read at. They are fixed, not
 * fitted per refresh. LMC_CONTEXT_SHORT is the median session-end context of the pi sessions (98K);
 * LMC_CONTEXT_LONG is their p90 (352K). Prompt-length price bands are applied at these two lengths.
 */
export const LMC_CONTEXT_SHORT = 100_000;
export const LMC_CONTEXT_LONG = 350_000;
/** The p75 sensitivity point: the p75 of the same session sample, reported beside the two standards. */
export type ContextId = "short" | "long";
export const CONTEXT_IDS: ContextId[] = ["short", "long"];
export const contextTokens = (id: ContextId) => (id === "short" ? LMC_CONTEXT_SHORT : LMC_CONTEXT_LONG);
export const contextLabel = (id: ContextId) => (id === "short" ? "100K" : "350K");

export const contextFileSchema = z.object({
  window_days: z.number().int().positive(),
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
  method: z.string().min(1),
  sample_sessions: z.number().int().positive(),
  quantiles: z.object({ p50: z.number().nonnegative(), p75: z.number().nonnegative(), p90: z.number().nonnegative(), max: z.number().nonnegative() }),
  histogram: z.array(z.object({ bucket: z.string().min(1), sessions: z.number().int().nonnegative() })).min(1),
  /** Tokens per active hour of pi sessions (see collect-session-context.ts). Read by the Claude hours allowance; never hard-coded. */
  throughput: z.object({
    window_days: z.number().int().positive(),
    source: z.string().min(1),
    method: z.string().min(1),
    idle_cap_minutes: z.number().positive(),
    min_active_minutes: z.number().positive(),
    sample_sessions: z.number().int().positive(),
    tokens_per_active_hour: z.object({ p25: z.number().nonnegative(), p50: z.number().nonnegative(), p75: z.number().nonnegative() }),
  }),
});
export type ContextFile = z.infer<typeof contextFileSchema>;
