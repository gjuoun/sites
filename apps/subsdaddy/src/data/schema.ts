import { z } from "zod";

/** Public plan ids: the only lane identities that appear in committed data or in dist/. */
export const LANES = ["commandcode-goat", "opencode-go", "zai-glm-max", "qwen-cloud-token"] as const;
export const laneSchema = z.enum(LANES);
export type LaneId = z.infer<typeof laneSchema>;

/**
 * sub2api account_id -> plan. OpenCode Go is two subscriptions merged into one plan.
 * Account 3 is pay-as-you-go and is not a plan at all.
 */
export const ACCOUNT_TO_LANE: Record<number, LaneId> = {
  2: "opencode-go",
  6: "opencode-go",
  7: "commandcode-goat",
  8: "zai-glm-max",
  9: "qwen-cloud-token",
};

/** Accounts whose quota window the codexbar reading comes from. Only these tokens feed capacity. */
export const QUOTA_METERED_ACCOUNTS: ReadonlySet<number> = new Set([2, 7, 8, 9]);

/** Lane ids from the pre-plan model, found in local raw history. null = no longer a plan, dropped. */
const LEGACY_LANE: Record<string, LaneId | null> = {
  cc: "commandcode-goat",
  "go-1": "opencode-go",
  "go-2": null,
  zai: "zai-glm-max",
  qwen: "qwen-cloud-token",
};

/** Maps legacy lane ids in a quota file to plan ids before schema parsing. Unknown shapes pass through. */
export function migrateQuotaFile(raw: unknown): unknown {
  const obj = raw as { observations?: unknown } | null;
  if (!obj || !Array.isArray(obj.observations)) return raw;
  const observations = (obj.observations as Array<{ lane?: unknown }>).flatMap((o) => {
    if (!o || typeof o.lane !== "string" || !Object.hasOwn(LEGACY_LANE, o.lane)) return [o];
    const to = LEGACY_LANE[o.lane];
    return to ? [{ ...o, lane: to }] : [];
  });
  return { ...obj, observations };
}

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
  plan_id: laneSchema,
  label: z.string().min(1),
  price_month_usd: z.number().positive(),
  badge: z.enum(["plan_spec", "console"]),
  ...provenance,
});
export type Plan = z.infer<typeof planSchema>;

export const plansFileSchema = z.object({
  plans: z.array(planSchema).length(LANES.length),
  ...provenance,
});

/** One provider window reading from the codexbar quota source. */
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
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
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
  lanes: z.array(laneUsageSchema).length(LANES.length),
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
  // reference list prices used only for catalog estimates (never for the ranking)
  reference: z
    .array(
      z.object({
        ref: z.enum(["deepseek-v4.1-flash", "gemini-3.8-flash", "claude-haiku-5.5", "gpt-6-luna"]),
        openrouter: z.string().min(1),
        in_per_m: z.number().nonnegative(),
        out_per_m: z.number().nonnegative(),
        cache_per_m: z.number().nonnegative(),
      }),
    )
    .length(4),
  ...provenance,
});

/** The plan record the site renders. */
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
    badge: z.string().nullable(),
    ...provenance,
  }),
  usd_per_b: z.number().positive().nullable(),
  usd_per_b_basis: z.enum(["measured", "derived"]).nullable(),
  usd_per_b_derived_from: laneSchema.nullable(),
  usd_per_b_source: z.string().nullable(),
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
  lanes: z.array(laneRecordSchema).length(LANES.length),
  ...provenance,
});
export type LanesFile = z.infer<typeof lanesFileSchema>;
