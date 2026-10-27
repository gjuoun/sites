import { z } from "zod";

/** Aggregates from the local logs of the official clients. No ids, paths, prompts or account details. */
const totals = z.object({
  calls: z.number().int().nonnegative(),
  input: z.number().int().nonnegative(),
  cache_read: z.number().int().nonnegative(),
  cache_write: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});
const speed = z.object({ tps_p50: z.number().positive(), n: z.number().int().positive() });

export const officialFileSchema = z.object({
  window_days: z.number().positive(),
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
  providers: z
    .array(
      z.object({
        provider: z.enum(["codex", "claude-code"]),
        plan: z.string().min(1),
        fee_usd: z.number().positive().nullable(),
        fee_claimed_usd: z.number().positive().nullable(),
        fee_status: z.enum(["confirmed", "unverified"]),
        fee_reason: z.string().min(1),
        window: z
          .object({
            five_hour_pct: z.number().min(0).max(100).nullable(),
            weekly_pct: z.number().min(0).max(100).nullable(),
            resets_at: z.iso.datetime().nullable(),
          })
          .nullable(),
        window_reason: z.string().min(1).nullable(),
        tokens_7d: totals,
        speed_7d: speed.nullable(),
        speed_reason: z.string().min(1).nullable(),
        ttft_reason: z.string().min(1),
        all_time: totals.extend({ first_day: z.string().nullable(), last_day: z.string().nullable(), speed: speed.nullable() }),
        measured_at: z.iso.datetime(),
        source: z.string().min(1),
      }),
    )
    .length(2),
});
export type OfficialFile = z.infer<typeof officialFileSchema>;
