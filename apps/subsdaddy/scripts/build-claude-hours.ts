#!/usr/bin/env bun
/**
 * Writes the Claude plans' N/A reason into their catalog rows (r44). Claude plans carry no dollar allowance: the
 * reason is computed from the sourced hours, the measured burn rate and the list prices, and it names the span a
 * conversion would give. A missing input or a fee that differs from the catalog fails the build and keeps catalog.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { claudePlansFileSchema } from "../src/data/claude-plans";
import { catalogFileSchema } from "../src/data/catalog";
import { contextFileSchema } from "../src/data/context";
import { modelsFileSchema } from "../src/data/schema";
import { pooledMix } from "../src/data/estimate";
import { cycleUsd, unavailableReason } from "../src/lib/claude-hours";

const APP = resolve(import.meta.dir, "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));
const plans = claudePlansFileSchema.parse(read("claude-plans.json"));
const context = contextFileSchema.parse(read("context.json"));
const models = modelsFileSchema.parse(read("models.json"));
const usage = read("usage.json") as { lanes: Array<{ tokens: { input: number; cache_creation: number; cache_read: number; output: number } }> };
const catalogRaw = read("catalog.json");
const catalog = catalogFileSchema.parse(catalogRaw);

const fail = (m: string): never => {
  console.log("build:claude-hours FAILED: " + m + "; data/catalog.json kept");
  process.exit(1);
};

const heavy = context.throughput.tokens_per_active_hour.p50;
const pooled = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
const mix = { output_share: pooled.output_share, cache_share: pooled.agent_cache_share, cache_write_share: pooled.cache_write_share ?? 0 };
const pr = plans.price;
const price = { in_per_m: pr.in_per_m, out_per_m: pr.out_per_m, cache_per_m: pr.cache_read_per_m, cache_write_per_m: pr.cache_write_per_m };
if (!models.reference.some((r) => r.ref === "claude-haiku-5.5")) fail("no claude-haiku-5.5 reference price in models.json");

const lowest: number[] = [];
for (const p of plans.plans) {
  const row = catalog.rows.find((r) => r.plan_id === p.plan_id);
  if (!row) fail("no catalog row " + p.plan_id);
  if (row!.price_month_usd !== p.fee_usd_per_month) fail(p.plan_id + ": catalog fee " + String(row!.price_month_usd) + " differs from the source's " + p.fee_usd_per_month);
  lowest.push(cycleUsd(p.hours_per_week_low, heavy, price, mix).usdPerCycle);
}
const reason = unavailableReason(Math.min(...lowest), Math.max(...lowest), heavy);

const rows = catalogRaw.rows as Array<Record<string, unknown>>;
for (const p of plans.plans) {
  const target = rows.find((r) => r.plan_id === p.plan_id);
  if (!target) fail("no catalog row " + p.plan_id);
  target!.allowance = [];
  target!.allowance_reason = reason;
}

const out = { ...catalogRaw, rows };
if (!catalogFileSchema.safeParse(out).success) fail("catalog no longer validates");
writeFileSync(join(APP, "data", "catalog.json"), JSON.stringify(out, null, 2) + "\n");
console.log("build:claude-hours ok plans=" + plans.plans.length + " heavy_tok_per_h=" + heavy + " lowest_usd=" + Math.min(...lowest).toFixed(2) + " highest_usd=" + Math.max(...lowest).toFixed(2));
