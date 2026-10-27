import { z } from "zod";

/**
 * Third-party weekly API-equivalent values (data/third-party-allowances.json). A measured value is a third party's
 * measurement; a projected value is a third party's projection and is never shown as a measurement.
 */
const iso = z.iso.date();

export const thirdPartyEntrySchema = z.strictObject({
  plan_id: z.string().min(1),
  plan: z.string().min(1),
  fee_usd_per_month: z.number().positive(),
  weekly_usd: z.number().positive(),
  value_kind: z.enum(["measured", "projected"]),
  value_rule: z.enum(["headline", "lower_bound", "projection"]),
  range_usd: z.tuple([z.number().positive(), z.number().positive()]).nullable(),
  range_note: z.string().min(1).nullable(),
  publisher: z.string().min(1),
  url: z.url(),
  published: iso,
  measured_window: z.string().min(1).nullable(),
  sample: z.string().min(1),
  read_date: iso,
  quote: z.string().min(1),
  cross_check: z.strictObject({ publisher: z.string().min(1), url: z.url(), published: iso, value_usd: z.number().positive(), note: z.string().min(1) }).nullable(),
}).superRefine((e, ctx) => {
  if (e.value_rule === "lower_bound") {
    if (!e.range_usd) ctx.addIssue({ code: "custom", message: "a lower_bound value needs its range" });
    else if (e.weekly_usd !== e.range_usd[0]) ctx.addIssue({ code: "custom", message: "lower_bound value must equal the range's low end" });
  }
  if (e.value_rule === "headline" && !e.range_usd) ctx.addIssue({ code: "custom", message: "a headline value needs its account spread" });
  if (e.value_kind === "projected" && e.value_rule !== "projection") ctx.addIssue({ code: "custom", message: "a projected value has the projection rule" });
  if (e.value_kind === "measured" && e.value_rule === "projection") ctx.addIssue({ code: "custom", message: "a measured value cannot use the projection rule" });
  // the quote is the source's own text, so it must show the value as printed (1,602, 940, 270)
  if (!e.quote.includes(e.weekly_usd.toLocaleString("en-US"))) ctx.addIssue({ code: "custom", message: "the quote does not show the value" });
});

export const thirdPartyFileSchema = z.object({
  policy: z.string().min(1),
  cycle_days: z.literal(30),
  entries: z.array(thirdPartyEntrySchema).min(1),
  not_found: z.array(z.strictObject({ plan_id: z.string().min(1), note: z.string().min(1) })),
});
export type ThirdPartyEntry = z.infer<typeof thirdPartyEntrySchema>;
export type ThirdPartyFile = z.infer<typeof thirdPartyFileSchema>;

/** The monthly allowance a weekly value gives over a 30-day cycle: weekly × 30 / 7, to the cent. */
export function monthlyUsd(weekly: number, cycleDays = 30): number {
  return Math.round(((weekly * cycleDays) / 7) * 100) / 100;
}
