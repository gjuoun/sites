import { z } from "zod";
import { LANES } from "./schema";

/**
 * The plans catalog: published prices and published allowance models only.
 * Catalog rows have no local token measurement, so they are never ranked and never carry a
 * dollars-per-billion figure. The schema is strict: a per-B key is a parse error, by construction.
 */

export const ALLOWANCE_MODELS = ["credits", "usd_usage", "window_percent", "window_tokens", "premium_requests", "tier_multiple", "unverified"] as const;
export type AllowanceModel = (typeof ALLOWANCE_MODELS)[number];

const sourceSchema = z.strictObject({
  kind: z.enum(["official_page", "official_post", "x_post", "owner_confirmed", "console_reading", "unverified"]),
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

export const catalogRowSchema = z
  .strictObject({
    plan_id: z.string().regex(/^[a-z0-9-]+$/),
    product: z.string().min(1),
    tier: z.string().min(1),
    label: z.string().min(1),
    status: z.enum(["catalog", "excluded"]),
    provider: z.string().min(1).nullable(),
    price_month_usd: z.number().positive().nullable(),
    price_native: z.string().min(1).nullable(),
    currency: z.enum(["USD", "CNY"]),
    price_annual_usd: z.number().positive().nullable(),
    allowance_model: z.enum(ALLOWANCE_MODELS),
    allowance_detail: z.string().min(1),
    credits_to_usd: z.strictObject({ usd_per_credit: z.number().positive(), basis: z.string().min(1) }).nullable(),
    cli_compat: z.string().min(1),
    heat_samples: z.number().int().nonnegative().nullable(),
    exclusion_reason: z.string().min(1).nullable(),
    price_note: z.string().min(1).nullable(),
    window_readings: z.array(windowReadingSchema).optional(),
    reading_error: z.string().min(1).nullable().optional(),
    measured_at: z.iso.datetime(),
    sources: z.array(sourceSchema).min(1),
  })
  .superRefine((r, ctx) => {
    const add = (message: string) => ctx.addIssue({ code: "custom", message, path: [] });
    if (r.label !== `${r.product} - ${r.tier}`) add(`label must be "Product - Tier" (got "${r.label}")`);
    // a USD price must come from a published page, or from the owner's own confirmation (labelled as such)
    const officialKinds = r.sources.some((s) => s.kind === "official_page" || s.kind === "official_post" || s.kind === "owner_confirmed");
    const hasPrice = r.price_month_usd !== null || r.price_native !== null;
    if (r.price_month_usd !== null && !officialKinds) add("a USD price needs an official source");
    if (r.price_native !== null && !officialKinds) add("a native-currency price needs an official source");
    if (!hasPrice && !r.sources.some((s) => s.kind === "unverified" && s.note.startsWith("unverified:"))) {
      add("a row without a price needs an unverified source note");
    }
    if (r.currency === "CNY" && r.price_month_usd !== null) add("a CNY row cannot carry a USD price");
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
};

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
    credits_text: r.credits_to_usd ? formatUsdPerCredit(r.credits_to_usd.usd_per_credit) : "—",
    credits_basis: r.credits_to_usd ? r.credits_to_usd.basis : null,
    cli_compat: r.cli_compat,
    badge: "unmeasured",
    source_badge,
    reason: r.exclusion_reason,
    price_note: r.price_note,
  };
}
