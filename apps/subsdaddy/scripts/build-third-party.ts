#!/usr/bin/env bun
/**
 * Writes third-party weekly values into their catalog rows (r45): each plan's monthly allowance is its weekly value
 * × 30/7, with the source, the kind (measured or projected), and the rule the value came from. A plan missing from the
 * catalog, or a fee that differs from the catalog's, fails the build and leaves catalog.json as it was.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema } from "../src/data/catalog";
import { thirdPartyFileSchema, monthlyUsd } from "../src/data/third-party";

const APP = resolve(import.meta.dir, "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));
const file = thirdPartyFileSchema.parse(read("third-party-allowances.json"));
const catalogRaw = read("catalog.json");
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
  const basis = how + " × 30/7 = $" + monthly.toFixed(2) + " per 30 days";
  const target = rows.find((r) => r.plan_id === e.plan_id)!;
  target.allowance = [{ ref: "*", usd: monthly, basis, kind, source: { publisher: e.publisher, url: e.url, published: e.published, note: e.value_kind === "measured" ? "weekly API-equivalent, lower bound of the stated figure: " + (e.value_rule === "headline" ? "headline value" : "range low end") : "projection, not a measurement" } }];
  target.allowance_reason = null;
  console.log("build:third-party " + e.plan_id + " weekly=$" + e.weekly_usd + " monthly=$" + monthly.toFixed(2) + " " + kind);
}

const out = { ...catalogRaw, rows };
if (!catalogFileSchema.safeParse(out).success) fail("catalog no longer validates");
writeFileSync(join(APP, "data", "catalog.json"), JSON.stringify(out, null, 2) + "\n");
console.log("build:third-party ok entries=" + file.entries.length);
