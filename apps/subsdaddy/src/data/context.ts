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
  throughput: z.object({
    window_days: z.number().int().positive(),
    source: z.string().min(1),
    method: z.string().min(1),
    /** Clock hours with any usage in the window, across all sessions (r55). */
    active_hours: z.number().int().nonnegative(),
    /** Session-hours: one session with usage in one clock hour (r55). */
    session_hours: z.number().int().nonnegative(),
    tokens: z.number().nonnegative(),
    /** Tokens per session-hour. aggregate = tokens / session_hours; the Threads formula reads aggregate (r55). */
    tokens_per_session_hour: z.object({ aggregate: z.number().positive(), median: z.number().nonnegative(), mean: z.number().nonnegative(), p90: z.number().nonnegative() }),
    /** Distinct sessions with usage in the same clock hour (r55). */
    concurrency: z.object({ median: z.number().nonnegative(), p90: z.number().nonnegative(), max: z.number().nonnegative() }),
    sample_sessions: z.number().int().nonnegative(),
  }),
});
export type ContextFile = z.infer<typeof contextFileSchema>;
