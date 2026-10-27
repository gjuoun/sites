import { z } from "zod";
import { LANES } from "./schema";
import { REF_IDS, REF_NAMES } from "./estimate";

/**
 * The plans catalog: published prices and published allowance models only.
 * Catalog rows have no local token measurement, so they are never ranked and never carry a
 * dollars-per-billion figure. The schema is strict: a per-B key is a parse error, by construction.
 */

export const ALLOWANCE_MODELS = ["credits", "usd_usage", "window_percent", "window_tokens", "premium_requests", "tier_multiple", "unverified"] as const;
export type AllowanceModel = (typeof ALLOWANCE_MODELS)[number];

const sourceSchema = z.strictObject({
  kind: z.enum(["official_page", "official_post", "x_post", "owner_confirmed", "console_reading", "unverified", "third_party_measured", "archived_official"]),
  url: z.string().regex(/^https?:\/\//).nullable(),
  note: z.string().min(1),
});

const windowReadingSchema = z.strictObject({
  window: z.enum(["5h", "weekly"]),
  used_pct: z.number().min(0).max(100),
  resets_at: z.iso.datetime(),
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
});

const REF_LITERALS = REF_IDS;

/** A published usage-dollar allowance: "*" applies to every reference model, otherwise one reference model. */
export const allowanceEntrySchema = z.strictObject({
  ref: z.enum([...REF_LITERALS, "*"]),
  usd: z.number().positive(),
  basis: z.string().min(1),
  /** third_party_measured (t) and third_party_projected (j) carry their source; absent kinds are the build's own bases. */
  kind: z.enum(["third_party_measured", "third_party_projected"]).optional(),
  /** The measurement class whose list blend prices this allowance (r46): capacity = allowance / blend, shape-invariant. */
  mix_class: z.enum(["sonnet", "luna"]).optional(),
  mix_blend_usd_per_million: z.number().positive().optional(),
  /** r56: the X reports behind a median row: their range, count, and month. */
  community: z.strictObject({ min: z.number().positive(), max: z.number().positive(), count: z.number().int().positive(), period: z.string().min(1) }).optional(),
  source: z.strictObject({ publisher: z.string().min(1), url: z.url(), published: z.iso.date(), note: z.string().min(1) }).optional(),
});

const estimateValueSchema = z.strictObject({
  ref: z.enum(REF_LITERALS),
  shape: z.enum(["interactive", "agent", "cache_heavy"]),
  usd_per_b: z.number().positive().nullable(),
  reason: z.string().min(1).nullable(),
  fee_over_allowance: z.number().positive().nullable(),
  blended_usd_per_b: z.number().positive(),
  measured_at: z.iso.datetime(),
  source: z.string().min(1),
  // the standard contexts: usd_per_b is at 100K; usd_per_b_long at 350K; usd_per_b_p75 is the sensitivity point
  usd_per_b_long: z.number().positive().nullable().optional(),
  usd_per_b_p75: z.number().positive().nullable().optional(),
  band_short: z.string().min(1).optional(),
  band_long: z.string().min(1).optional(),
  band_p75: z.string().min(1).optional(),
  // the inputs of this value, so a Shape can be applied to it at render time
  allowance_usd: z.number().positive().nullable().optional(),
  allowance_basis: z.string().nullable().optional(),
  allowance_cycle_days: z.number().int().positive().nullable().optional(),
  fee_usd: z.number().positive().nullable().optional(),
  price_used: z.object({ in_per_m: z.number().nonnegative(), out_per_m: z.number().nonnegative(), cache_per_m: z.number().nonnegative(), cache_write_per_m: z.number().nonnegative().nullable().optional(), overrides: z.array(z.object({ min_prompt_tokens: z.number().int().positive(), in_per_m: z.number().nonnegative(), out_per_m: z.number().nonnegative(), cache_per_m: z.number().nonnegative(), cache_write_per_m: z.number().nonnegative().nullable().optional() })).optional() }).nullable().optional(),
});

/** A catalog estimate. Status "unavailable" carries a reason and no values; "estimated" carries at least one value. */
export const estimateSchema = z
  .strictObject({
    status: z.enum(["estimated", "unavailable"]),
    reason: z.string().min(1).nullable(),
    basis: z.string().min(1).nullable(),
    values: z.array(estimateValueSchema),
    range_agent: z.tuple([z.number().positive(), z.number().positive()]).nullable(),
    measured_at: z.iso.datetime(),
    source: z.string().min(1),
  })
  .superRefine((e, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message, path: [] });
    if (e.status === "unavailable") {
      if (!e.reason) add("an unavailable estimate needs a reason");
      if (e.values.length > 0 || e.range_agent !== null) add("an unavailable estimate carries no values");
    } else {
      if (!e.basis) add("an estimated value needs its basis");
      if (!e.values.some((v) => v.usd_per_b !== null)) add("an estimated row needs at least one value");
      if (e.range_agent === null) add("an estimated row needs its agent range");
    }
  });
export type Estimate = z.infer<typeof estimateSchema>;

export const catalogRowSchema = z
  .strictObject({
    plan_id: z.string().regex(/^[a-z0-9-]+$/),
    product: z.string().min(1),
    tier: z.string(),
    label: z.string().min(1),
    status: z.enum(["catalog", "excluded"]),
    provider: z.string().min(1).nullable(),
    price_month_usd: z.number().positive().nullable(),
    price_native: z.string().min(1).nullable(),
    currency: z.enum(["USD", "CNY"]),
    price_annual_usd: z.number().positive().nullable(),
    allowance_model: z.enum(ALLOWANCE_MODELS),
    allowance_detail: z.string().min(1),
    // paid_price: fee ÷ credits (what a credit costs). usage_value: list-price usage a credit buys (measured)
    credits_to_usd: z.strictObject({ usd_per_credit: z.number().positive(), basis: z.string().min(1), meaning: z.enum(["paid_price", "usage_value"]).default("paid_price") }).nullable(),
    cli_compat: z.string().min(1),
    heat_samples: z.number().int().nonnegative().nullable(),
    exclusion_reason: z.string().min(1).nullable(),
    price_note: z.string().min(1).nullable(),
    allowance: z.array(allowanceEntrySchema).default([]),
    allowance_reason: z.string().min(1).nullable().default(null),
    // the reference models this plan offers, from its official model list; a model not listed gets no row
    offered_models: z.array(z.enum(REF_LITERALS)).default([]),
    offered_basis: z.string().min(1).nullable().default(null),
    // the allowance the vendor publishes for this plan, in usage dollars per cycle; null when it publishes none
    published_allowance_usd: z.number().positive().nullable().optional(),
    /** The plan whose per-model monthly limits this row carries (OpenCode Go docs): such a row has no pool, only per-model limits. */
    per_model_limit_plan: z.enum(["Go", "Go Plus"]).nullable().optional(),
    published_allowance_basis: z.string().min(1).nullable().optional(),
    // the measured lane whose $/B is this plan's own measurement, when there is one
    measured_lane: z.enum(LANES).nullable().default(null),
    // a plan published as messages per five-hour window (Codex): converted to tokens in messages.ts, never a dollar allowance
    message_limit: z
      .strictObject({
        model: z.enum(REF_LITERALS),
        unit: z.enum(["messages", "prompts"]).default("messages"),
        low: z.number().int().positive(),
        high: z.number().int().positive(),
        window_hours: z.number().positive(),
        source_url: z.string().regex(/^https:\/\//),
        read_date: z.string().min(1),
        note: z.string().min(1),
      })
      .nullable()
      .optional(),
    estimate: estimateSchema.nullable().optional(),
    window_readings: z.array(windowReadingSchema).optional(),
    reading_error: z.string().min(1).nullable().optional(),
    measured_at: z.iso.datetime(),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((r, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message, path: [] });
    // a product whose name is the product itself has an empty tier and a label equal to the product
    const expectedLabel = r.tier === "" ? r.product : `${r.product} - ${r.tier}`;
    if (r.label !== expectedLabel) add(`label must be "Product - Tier", or the product alone when tier is empty (got "${r.label}")`);
    // a USD price must come from a published page, or from the owner's own confirmation (labelled as such)
    const officialKinds = r.sources.some((s) => s.kind === "official_page" || s.kind === "official_post" || s.kind === "owner_confirmed");
    const hasPrice = r.price_month_usd !== null || r.price_native !== null;
    if (r.price_month_usd !== null && !officialKinds) add("a USD price needs an official source");
    if (r.price_native !== null && !officialKinds) add("a native-currency price needs an official source");
    if (!hasPrice && !r.sources.some((s) => s.kind === "unverified" && s.note.startsWith("unverified:"))) {
      add("a row without a price needs an unverified source note");
    }
    if (r.currency === "CNY" && r.price_month_usd !== null) add("a CNY row cannot carry a USD price");
    // a third-party figure is labelled and linked, or it is not used at all
    for (const s of r.sources) if (s.kind === "third_party_measured" && !s.url) add("a third-party figure needs its source link");
    if (r.allowance.some((a) => /third-party/i.test(a.basis)) && !r.sources.some((s) => s.kind === "third_party_measured")) {
      add("a third-party allowance needs a third_party_measured source");
    }
    if (r.price_annual_usd !== null && r.price_month_usd === null) add("annual price needs a monthly price");
    if (r.status === "excluded" && !r.exclusion_reason) add("an excluded row needs exclusion_reason");
    if (r.status === "catalog" && r.exclusion_reason) add("a catalog row cannot carry exclusion_reason");
    if (r.credits_to_usd && r.allowance_model !== "credits") add("credits_to_usd is only for credit-based allowances");
    // a credit-based allowance without a published conversion must say why, as an unverified source
    if (r.allowance_model === "credits" && r.credits_to_usd === null && !r.sources.some((s) => s.kind === "unverified" && s.note.startsWith("unverified:"))) {
      add("a credit-based row without a conversion needs an unverified source note");
    }
  });
export type CatalogRow = z.infer<typeof catalogRowSchema>;

export const catalogFileSchema = z
  .strictObject({
    rows: z.array(catalogRowSchema).min(1),
    measured_at: z.iso.datetime(),
    source: z.string().min(1),
  })
  .superRefine((f, ctx) => {
    const ids = f.rows.map((r) => r.plan_id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "plan_id must be unique" });
    for (const id of ids) {
      if ((LANES as readonly string[]).includes(id)) {
        ctx.addIssue({ code: "custom", message: `plan_id ${id} reuses a ranked lane id` });
      }
    }
  });
export type CatalogFile = z.infer<typeof catalogFileSchema>;

/** Per-credit dollars at three significant figures: 0.125 -> "$0.125", 10/25500 -> "$0.000392". */
export function formatUsdPerCredit(v: number): string {
  return "$" + Number(v.toPrecision(3)).toString() + " / credit";
}

export type CatalogDisplay = {
  plan_id: string;
  label: string;
  status: "catalog" | "excluded";
  fee: string;
  allowance_model: AllowanceModel;
  allowance_detail: string;
  credits_text: string;
  credits_basis: string | null;
  cli_compat: string;
  badge: "unmeasured";
  source_badge: "official" | "post" | "owner" | "unverified";
  reason: string | null;
  price_note: string | null;
  estimate_status: "estimated" | "unavailable" | "none";
  estimate_text: string;
  estimate_reason: string | null;
  estimate_basis: string | null;
  estimate_models: Array<{ ref: string; name: string; text: string | null; reason: string | null; basis: string | null }>;
};

/** Two significant figures, dollars, no unit: 3.6 -> "$3.6", 19.07 -> "$19", 0.0004 -> "$0.00040". */
export function formatEstimate(v: number): string {
  return "$" + Number(v.toPrecision(2)).toString();
}

/** The only shape the site renders for catalog rows: fee text, allowance text, no measured or per-B fields. */
export function catalogDisplayRow(r: CatalogRow): CatalogDisplay {
  const fee =
    r.price_month_usd !== null
      ? "$" + r.price_month_usd.toFixed(r.price_month_usd % 1 === 0 ? 0 : 2)
      : r.price_native !== null
        ? r.price_native
        : "unverified";
  const official = r.sources.find((s) => s.kind === "official_page" || s.kind === "official_post");
  const owner = r.sources.some((s) => s.kind === "owner_confirmed");
  const source_badge: CatalogDisplay["source_badge"] =
    r.price_month_usd === null && r.price_native === null
      ? "unverified"
      : owner && !official
        ? "owner"
        : official?.kind === "official_post"
          ? "post"
          : "official";
  return {
    plan_id: r.plan_id,
    label: r.label,
    status: r.status,
    fee,
    allowance_model: r.allowance_model,
    allowance_detail: r.allowance_detail,
    credits_text: r.credits_to_usd ? formatUsdPerCredit(r.credits_to_usd.usd_per_credit) : "N/A",
    credits_basis: r.credits_to_usd ? r.credits_to_usd.basis : null,
    cli_compat: r.cli_compat,
    badge: "unmeasured",
    source_badge,
    reason: r.exclusion_reason,
    price_note: r.price_note,
    ...estimateDisplay(r.estimate ?? null),
  };
}

function estimateDisplay(e: Estimate | null): Pick<CatalogDisplay, "estimate_status" | "estimate_text" | "estimate_reason" | "estimate_basis" | "estimate_models"> {
  if (!e) return { estimate_status: "none", estimate_text: "N/A", estimate_reason: null, estimate_basis: null, estimate_models: [] };
  if (e.status === "unavailable") return { estimate_status: "unavailable", estimate_text: "N/A", estimate_reason: e.reason, estimate_basis: null, estimate_models: [] };
  const [low, high] = e.range_agent!;
  const text = low === high ? formatEstimate(low) : formatEstimate(low) + " – " + formatEstimate(high);
  const estimate_models = REF_IDS.map((ref) => {
    const v = e.values.find((x) => x.ref === ref && x.shape === "agent");
    if (!v) return { ref, name: REF_NAMES[ref], text: null, reason: "not evaluated", basis: null };
    if (v.usd_per_b === null) return { ref, name: REF_NAMES[ref], text: null, reason: v.reason, basis: null };
    const basis = v.fee_over_allowance === null ? null : "fee/allowance = " + Number(v.fee_over_allowance.toPrecision(3)) + " × blended " + Number(v.blended_usd_per_b.toPrecision(3)) + " per B tokens (agent mix)";
    return { ref, name: REF_NAMES[ref], text: formatEstimate(v.usd_per_b), reason: null, basis };
  });
  return { estimate_status: "estimated", estimate_text: text, estimate_reason: null, estimate_basis: e.basis, estimate_models };
}
