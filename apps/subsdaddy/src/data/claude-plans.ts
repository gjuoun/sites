import { z } from "zod";

/** A sourced quotation: the URL it was read from, the date it was read, and the exact words. */
const sourceSchema = z.object({ url: z.string().url(), read_date: z.iso.date(), quote: z.string().min(1), capture: z.string().url().optional(), capture_timestamp: z.iso.datetime().optional() });

/** Anthropic's own hour figures for one plan (per week, lower and upper bound), and the model they are quoted for. */
export const claudePlansFileSchema = z.object({
  window_note: z.string().min(1),
  fee_source: sourceSchema,
  price: z.object({
    model: z.string().min(1),
    in_per_m: z.number().nonnegative(),
    out_per_m: z.number().nonnegative(),
    cache_read_per_m: z.number().nonnegative(),
    cache_write_per_m: z.number().nonnegative(),
    source: sourceSchema,
  }),
  plans: z.array(z.object({
    plan_id: z.string().min(1),
    plan: z.string().min(1),
    fee_usd_per_month: z.number().positive(),
    hours_per_week_low: z.number().positive(),
    hours_per_week_high: z.number().positive(),
    opus_hours_low: z.number().positive().nullable(),
    opus_hours_high: z.number().positive().nullable(),
    model_for_hours: z.string().min(1),
    source: sourceSchema,
  }).refine((p) => p.hours_per_week_low <= p.hours_per_week_high, "low bound above high bound")).length(3),
});
export type ClaudePlansFile = z.infer<typeof claudePlansFileSchema>;
