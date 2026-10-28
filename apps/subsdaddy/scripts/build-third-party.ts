#!/usr/bin/env bun
/**
 * Writes third-party weekly values into their catalog rows (r45): each plan's monthly allowance is its weekly value
 * × 30/7, with the source, the kind (measured or projected), and the rule the value came from. A plan missing from the
 * catalog, or a fee that differs from the catalog's, fails the build and leaves catalog.json as it was.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema } from "../src/data/catalog";
import { thirdPartyFileSchema, monthlyUsd, medianOf } from "../src/data/third-party";
import { blendedUsdPerB, pooledMix } from "../src/data/estimate";

const APP = resolve(import.meta.dir, "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));
const file = thirdPartyFileSchema.parse(read("third-party-allowances.json"));
const catalogRaw = read("catalog.json");
const usage = read("usage.json") as { lanes: Array<{ tokens: { input: number; cache_creation: number; cache_read: number; output: number } }> };
const pooled = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
const mix = { output_share: pooled.output_share, cache_share: pooled.agent_cache_share, cache_write_share: pooled.cache_write_share ?? 0 };
const catalog = catalogFileSchema.parse(catalogRaw);

const fail = (m: string): never => {
  console.log("build:third-party FAILED: " + m + "; data/catalog.json kept");
  process.exit(1);
};

const rows = catalogRaw.rows as Array<Record<string, unknown> & { allowance: unknown[] }>;
for (const e of file.entries) {
  const row = catalog.rows.find((r) => r.plan_id === e.plan_id);
  if (!row) fail("no catalog row " + e.plan_id);
  if (row!.price_month_usd !== e.fee_usd_per_month) fail(e.plan_id + ": catalog fee " + String(row!.price_month_usd) + " differs from the source's " + e.fee_usd_per_month);
  const kind = e.value_kind === "measured" ? "third_party_measured" : "third_party_projected";
  const monthly = monthlyUsd(e.weekly_usd, file.cycle_days);
  const how = e.value_kind === "measured"
    ? "measured by " + e.publisher + " (" + e.measured_window + ", " + e.sample + "): weekly API-equivalent $" + e.weekly_usd.toLocaleString("en-US") + (e.value_rule === "headline" ? " (headline; account spread " + e.range_note + ")" : " (lower bound of $" + e.range_usd![0].toLocaleString("en-US") + "–" + e.range_usd![1].toLocaleString("en-US") + ")")
    : "projected by " + e.publisher + ", not measured: weekly API-equivalent $" + e.weekly_usd.toLocaleString("en-US") + " (" + e.sample + ")";
  const comm = e.community_observations;
  const medianHow = e.value_rule === "median_of_sources"
    ? "median of " + (comm.length + 1 === 3 ? "three" : "two") + " independent measurements (" + [e.publisher + " (" + e.measured_window + ")", ...comm.map((o) => "X @" + o.author + " " + o.date)].join("; ") + "): " + [e.primary_weekly_usd!, ...comm.map((o) => o.weekly_usd)].map((v) => "$" + v.toLocaleString("en-US")).join(", ") + " → weekly API-equivalent $" + e.weekly_usd.toLocaleString("en-US")
    : how;
  const basis = medianHow + " × 30/7 = $" + monthly.toFixed(2) + " per 30 days";
  const community = comm.length === 0 ? undefined : {
    min: Math.min(...comm.map((o) => o.weekly_usd)),
    max: Math.max(...comm.map((o) => o.weekly_usd)),
    count: comm.length,
    period: new Date(comm.map((o) => o.date).sort().at(-1) + "T00:00:00Z").toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
  };
  if (e.value_rule === "median_of_sources" && medianOf([e.primary_weekly_usd!, ...comm.map((o) => o.weekly_usd)]) !== e.weekly_usd) fail(e.plan_id + ": weekly is not the median of its sources");
  const target = rows.find((r) => r.plan_id === e.plan_id)!;
  const cls = file.mix_classes[e.mix_class];
  const classUsdPerB = blendedUsdPerB({ in_per_m: cls.in_per_m, out_per_m: cls.out_per_m, cache_per_m: cls.cache_per_m, cache_write_per_m: cls.cache_write_per_m }, mix);
  target.allowance = [{ ref: "*", usd: monthly, basis, kind, ...(community ? { community } : {}), anchor: e.token_anchor, anchor_absent_reason: e.token_anchor === null ? e.token_anchor_absent_reason : null, mix_class: e.mix_class, mix_blend_usd_per_million: Number((classUsdPerB / 1000).toPrecision(12)), source: { publisher: e.publisher, url: e.url, published: e.published, note: e.value_kind === "measured" ? "weekly API-equivalent, lower bound of the stated figure: " + (e.value_rule === "headline" ? "headline value" : "range low end") : "projection, not a measurement" } }];
  target.allowance_reason = null;
  console.log("build:third-party " + e.plan_id + " weekly=$" + e.weekly_usd + " monthly=$" + monthly.toFixed(2) + " " + kind + " class=" + e.mix_class + " $/B=" + classUsdPerB.toFixed(2));
}

const out = { ...catalogRaw, rows };
if (!catalogFileSchema.safeParse(out).success) fail("catalog no longer validates");
writeFileSync(join(APP, "data", "catalog.json"), JSON.stringify(out, null, 2) + "\n");
console.log("build:third-party ok entries=" + file.entries.length);
