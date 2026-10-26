import { z } from "zod";

/**
 * Every number that reaches the site carries where it came from and when it was
 * read. A value we could not read is an explicit `unavailable` with a reason —
 * never a 0, because a 0 ranks as "free" in every downstream sort.
 */

export const LANES = ["cc", "go-1", "go-2", "zai", "qwen"] as const;
export const laneSchema = z.enum(LANES);
export type LaneId = z.infer<typeof laneSchema>;

/** sub2api account_id -> lane id. Account 3 (pay-as-you-go) is not a lane. */
export const ACCOUNT_TO_LANE: Record<number, LaneId> = {
  2: "go-1",
  6: "go-2",
  7: "cc",
  8: "zai",
  9: "qwen",
};

export const provenance = {
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
};

export const unavailable = z.object({
  unavailable: z.string().min(1),
});
export type Unavailable = z.infer<typeof unavailable>;

/** A number we read, or the reason we could not read it. */
export const reading = z.union([
  z.object({ value: z.number(), ...provenance }),
  unavailable,
]);
export type Reading = z.infer<typeof reading>;

export const planSchema = z.object({
  lane: laneSchema,
  label: z.string().min(1),
  provider: z.string().min(1),
  price_month_usd: z.number().positive(),
  badge: z.enum(["plan_spec", "console"]),
  ...provenance,
});
export type Plan = z.infer<typeof planSchema>;

export const plansFileSchema = z.object({
  plans: z.array(planSchema).length(5),
  ...provenance,
});

/** One provider window reading, e.g. codexbar's weekly window for a lane. */
export const quotaObservationSchema = z.object({
  lane: laneSchema,
  window: z.enum(["5h", "weekly", "monthly"]),
  window_minutes: z.number().positive(),
  used_pct: z.number().min(0).max(100),
  resets_at: z.iso.datetime(),
  plan_level: z.string().nullable().optional(),
  ...provenance,
});
export type QuotaObservation = z.infer<typeof quotaObservationSchema>;

export const quotaObservationOrGapSchema = z.union([
  quotaObservationSchema,
  z.object({
    lane: laneSchema,
    window: z.enum(["5h", "weekly", "monthly"]).optional(),
    ...unavailable.shape,
    ...provenance,
  }),
]);
export type QuotaObservationOrGap = z.infer<typeof quotaObservationOrGapSchema>;

export const quotaFileSchema = z.object({
  observations: z.array(quotaObservationOrGapSchema),
  ...provenance,
});

export const tokenCountsSchema = z.object({
  input: z.number().min(0),
  cache_creation: z.number().min(0),
  cache_read: z.number().min(0),
  output: z.number().min(0),
});
export type TokenCounts = z.infer<typeof tokenCountsSchema>;

export const modelUsageSchema = z.object({
  upstream_model: z.string().min(1),
  rows: z.number().int().min(0),
  tokens: tokenCountsSchema,
  cost_usd: z.number().min(0),
  p50_ttft_ms: z.number().nullable(),
  p90_ttft_ms: z.number().nullable(),
  p50_output_tps: z.number().nullable(),
  ...provenance,
});

export const laneUsageSchema = z.object({
  lane: laneSchema,
  rows: z.number().int().min(0),
  tokens: tokenCountsSchema,
  cache_share: z.number().min(0).max(1).nullable(),
  p50_ttft_ms: z.number().nullable(),
  p90_ttft_ms: z.number().nullable(),
  p50_output_tps: z.number().nullable(),
  models: z.array(modelUsageSchema),
  ...provenance,
});
export type LaneUsage = z.infer<typeof laneUsageSchema>;

export const usageFileSchema = z.object({
  window_days: z.number().positive(),
  coverage_start: z.iso.datetime(),
  coverage_end: z.iso.datetime(),
  lanes: z.array(laneUsageSchema).length(5),
  ...provenance,
});
export type UsageFile = z.infer<typeof usageFileSchema>;

/** One OpenRouter endpoint row, from the bare model page's stats payload. */
export const orEndpointSchema = z.object({
  model: z.string().min(1),
  provider_display_name: z.string().min(1),
  quantization: z.string().min(1),
  p50_latency_ms: z.number().positive(),
  p50_throughput: z.number().positive(),
  p90_throughput: z.number().positive().nullable(),
  request_count: z.number().int().min(0),
  window_minutes: z.number().positive(),
  confidence: z.enum(["ok", "low_confidence", "stale"]),
  ...provenance,
});
export type OrEndpoint = z.infer<typeof orEndpointSchema>;

export const benchmarkFileSchema = z.object({
  endpoints: z.array(orEndpointSchema),
  ...provenance,
});

export const modelsFileSchema = z.object({
  models: z.array(
    z.object({
      lane: laneSchema,
      upstream_model: z.string().min(1),
      openrouter: z.string().regex(/^[^/]+\/[^/]+$/),
    }),
  ),
  ...provenance,
});

/** The lane record the site renders. */
export const laneRecordSchema = z.object({
  lane: laneSchema,
  label: z.string().min(1),
  price_month_usd: z.number().positive(),
  price_badge: z.enum(["plan_spec", "console"]),
  capacity: z.object({
    method: z.enum(["window_snapshot", "delta_pair", "plan_spec", "unavailable"]),
    window: z.enum(["weekly", "monthly"]).nullable(),
    tokens_per_week: z.number().positive().nullable(),
    coverage: z.number().min(0).max(1).nullable(),
    seeded: z.boolean(),
    reason: z.string().nullable(),
    confidence: z.enum(["low", "normal"]).nullable(),
    confidence_reason: z.string().nullable(),
    ...provenance,
  }),
  usd_per_b: z.number().positive().nullable(),
  measured: z.object({
    p50_ttft_ms: z.number().nullable(),
    p90_ttft_ms: z.number().nullable(),
    p50_output_tps: z.number().nullable(),
    n: z.number().int().min(0),
    ...provenance,
  }),
  presets: z.array(
    z.union([
      z.object({ shape: z.enum(["interactive", "agent", "cache_heavy"]), usd_per_b: z.number().positive() }),
      z.object({ shape: z.enum(["interactive", "agent", "cache_heavy"]), unavailable: z.string().min(1) }),
    ]),
  ),
  flags: z.array(z.string().min(1)),
  ...provenance,
});
export type LaneRecord = z.infer<typeof laneRecordSchema>;

export const lanesFileSchema = z.object({
  lanes: z.array(laneRecordSchema).length(5),
  ...provenance,
});
export type LanesFile = z.infer<typeof lanesFileSchema>;
