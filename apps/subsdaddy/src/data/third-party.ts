import { z } from "zod";

/**
 * Third-party weekly API-equivalent values (data/third-party-allowances.json). A measured value is a third party's
 * measurement; a projected value is a third party's projection and is never shown as a measurement.
 */
const iso = z.iso.date();

/** One X post that reports a plan's weekly API-equivalent value. The post's own text is the quote; the tweet id and URL are checked (r56). */
export const communityObservationSchema = z.strictObject({
  author: z.string().regex(/^[A-Za-z0-9_]+$/),
  tweet_id: z.string().regex(/^\d+$/),
  url: z.url(),
  date: iso,
  quote: z.string().min(1),
  weekly_usd: z.number().positive(),
  note: z.string().min(1),
});
export type CommunityObservation = z.infer<typeof communityObservationSchema>;

/** The median of a list of values (the middle one, or the mean of the middle two). */
export function medianOf(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = v.length / 2;
  return v.length % 2 === 1 ? v[Math.floor(mid)] : (v[mid - 1] + v[mid]) / 2;
}

export const mixClassSchema = z.strictObject({
  label: z.string().min(1),
  short: z.string().min(1),
  in_per_m: z.number().nonnegative(),
  out_per_m: z.number().nonnegative(),
  cache_per_m: z.number().nonnegative(),
  cache_write_per_m: z.number().nonnegative(),
  source: z.strictObject({ url: z.url(), read_date: iso, quote: z.string().min(1) }),
});

/** The token volume a source measured on a real account, with the source's own figures (r59). Average traffic is not a cap reading. */
export const tokenAnchorSchema = z.strictObject({
  label: z.string().min(1),
  weekly_tokens_total: z.number().positive(),
  weekly_cache_read_tokens: z.number().nonnegative().nullable(),
  weekly_uncached_tokens: z.number().nonnegative().nullable(),
  value_usd_week: z.number().positive(),
  measurement: z.enum(["at_cap", "average_traffic"]),
  publisher: z.string().min(1),
  url: z.url(),
  date: iso,
  quote: z.string().min(1),
  sample: z.string().min(1),
});
export type TokenAnchor = z.infer<typeof tokenAnchorSchema>;

export const thirdPartyEntrySchema = z.strictObject({
  token_anchor: tokenAnchorSchema.nullable().default(null),
  token_anchor_absent_reason: z.string().min(1).nullable().default(null),
  plan_id: z.string().min(1),
  plan: z.string().min(1),
  fee_usd_per_month: z.number().positive(),
  weekly_usd: z.number().positive(),
  value_kind: z.enum(["measured", "projected"]),
  value_rule: z.enum(["headline", "lower_bound", "projection", "median_of_sources"]),
  /** r56: the publisher's own value, before it is combined with the community observations into the median. */
  primary_weekly_usd: z.number().positive().nullable().optional(),
  /** r56: X posts that report this plan's weekly value. Used only in a median_of_sources row. */
  community_observations: z.array(communityObservationSchema).default([]),
  range_usd: z.tuple([z.number().positive(), z.number().positive()]).nullable(),
  range_note: z.string().min(1).nullable(),
  publisher: z.string().min(1),
  url: z.url(),
  published: iso,
  measured_window: z.string().min(1).nullable(),
  sample: z.string().min(1),
  read_date: iso,
  quote: z.string().min(1),
  mix_class: z.enum(["sonnet", "luna"]),
  mix_class_note: z.string().min(1),
  cross_check: z.strictObject({ publisher: z.string().min(1), url: z.url(), published: iso, value_usd: z.number().positive(), note: z.string().min(1) }).nullable(),
}).superRefine((e, ctx) => {
  if (e.value_rule === "lower_bound") {
    if (!e.range_usd) ctx.addIssue({ code: "custom", message: "a lower_bound value needs its range" });
    else if (e.weekly_usd !== e.range_usd[0]) ctx.addIssue({ code: "custom", message: "lower_bound value must equal the range's low end" });
  }
  if (e.value_rule === "headline" && !e.range_usd) ctx.addIssue({ code: "custom", message: "a headline value needs its account spread" });
  if (e.value_kind === "projected" && e.value_rule !== "projection") ctx.addIssue({ code: "custom", message: "a projected value has the projection rule" });
  if (e.value_rule === "median_of_sources") {
    if (e.primary_weekly_usd === null || e.primary_weekly_usd === undefined) ctx.addIssue({ code: "custom", message: "a median row needs its primary value" });
    if (e.community_observations.length === 0) ctx.addIssue({ code: "custom", message: "a median row needs at least one community observation" });
    else if (e.primary_weekly_usd !== null && e.primary_weekly_usd !== undefined) {
      const m = medianOf([e.primary_weekly_usd, ...e.community_observations.map((o) => o.weekly_usd)]);
      if (e.weekly_usd !== m) ctx.addIssue({ code: "custom", message: "weekly_usd must be the median of the primary and community values (" + m + ")" });
    }
  } else if (e.community_observations.length > 0) {
    ctx.addIssue({ code: "custom", message: "community observations are used only in a median row" });
  }
  for (const o of e.community_observations) {
    if (o.url !== "https://x.com/" + o.author + "/status/" + o.tweet_id) ctx.addIssue({ code: "custom", message: "the URL must be https://x.com/<author>/status/<tweet id>" });
    if (!o.quote.includes(o.weekly_usd.toLocaleString("en-US"))) ctx.addIssue({ code: "custom", message: "the quote of " + o.tweet_id + " does not show " + o.weekly_usd });
  }
  if (e.value_kind === "measured" && e.value_rule === "projection") ctx.addIssue({ code: "custom", message: "a measured value cannot use the projection rule" });
  if (e.token_anchor === null && !e.token_anchor_absent_reason) ctx.addIssue({ code: "custom", message: "a plan with no token anchor needs the reason" });
  // the quote is the source's own text, so it must show the value as printed (1,602, 940, 270)
  const shown = e.value_rule === "median_of_sources" && e.primary_weekly_usd ? e.primary_weekly_usd : e.weekly_usd;
  if (!e.quote.includes(shown.toLocaleString("en-US"))) ctx.addIssue({ code: "custom", message: "the quote does not show the value" });
});

export const thirdPartyFileSchema = z.object({
  policy: z.string().min(1),
  cycle_days: z.literal(30),
  entries: z.array(thirdPartyEntrySchema).min(1),
  mix_classes: z.record(z.enum(["sonnet", "luna"]), mixClassSchema),
  not_found: z.array(z.strictObject({ plan_id: z.string().min(1), note: z.string().min(1) })),
});
export type ThirdPartyEntry = z.infer<typeof thirdPartyEntrySchema>;
export type ThirdPartyFile = z.infer<typeof thirdPartyFileSchema>;

/** The monthly allowance a weekly value gives over a 30-day cycle: weekly × 30 / 7, to the cent. */
export function monthlyUsd(weekly: number, cycleDays = 30): number {
  return Math.round(((weekly * cycleDays) / 7) * 100) / 100;
}
