#!/usr/bin/env bun
/**
 * Writes each Claude plan's allowance into its catalog row, from the Anthropic hour figure, the measured
 * throughput and the Sonnet 5.5 list price (src/lib/claude-hours.ts). A row whose inputs are missing or
 * disagree with the catalog fails the build; nothing is written in that case.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { claudePlansFileSchema } from "../src/data/claude-plans";
import { catalogFileSchema } from "../src/data/catalog";
import { contextFileSchema } from "../src/data/context";
import { pooledMix } from "../src/data/estimate";
import { cycleUsd, CLAUDE_CYCLE_DAYS } from "../src/lib/claude-hours";

const APP = resolve(import.meta.dir, "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));
const plans = claudePlansFileSchema.parse(read("claude-plans.json"));
const context = contextFileSchema.parse(read("context.json"));
const usage = read("usage.json") as { lanes: Array<{ tokens: { input: number; cache_creation: number; cache_read: number; output: number } }> };
const catalogRaw = read("catalog.json");
const catalog = catalogFileSchema.parse(catalogRaw);

const perHour = context.throughput.tokens_per_active_hour.p50;
const mixRaw = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
const mix = { output_share: mixRaw.output_share, cache_share: mixRaw.agent_cache_share, cache_write_share: mixRaw.cache_write_share ?? 0 };
const price = { in_per_m: plans.price.in_per_m, out_per_m: plans.price.out_per_m, cache_per_m: plans.price.cache_read_per_m, cache_write_per_m: plans.price.cache_write_per_m };

const fail = (m: string): never => {
  console.log("build:claude-hours FAILED: " + m + "; data/catalog.json kept");
  process.exit(1);
};

const rows = catalogRaw.rows as Array<Record<string, unknown>>;
const sourceDay = plans.plans[0].source.read_date;

for (const p of plans.plans) {
  const row = catalog.rows.find((r) => r.plan_id === p.plan_id);
  if (!row) fail("no catalog row " + p.plan_id);
  if (row!.price_month_usd !== p.fee_usd_per_month) fail(p.plan_id + ": catalog fee " + String(row!.price_month_usd) + " differs from the source's " + p.fee_usd_per_month);
  const c = cycleUsd(p.hours_per_week_low, perHour, price, mix);
  const usd = Number(c.usdPerCycle.toFixed(2));
  const basis = "Anthropic help, archived capture 2026-01-03, read " + sourceDay + ": " + p.hours_per_week_low + " hours of " + p.model_for_hours + " per week (lower bound) × " + (perHour / 1e6).toFixed(1) + "M tokens per active hour (pi sessions, 30 days, measured) × " + plans.price.model + " list blend at the measured mix ($" + c.usdPerB.toFixed(2) + " per B) × " + CLAUDE_CYCLE_DAYS + "/7 days";
  const target = rows.find((r) => r.plan_id === p.plan_id)!;
  target.allowance = [{ ref: "*", usd, basis, kind: "vendor_hours" }];
  target.allowance_reason = null;
  console.log("build:claude-hours " + p.plan_id + " weekly_tokens=" + (c.tokensPerWeek / 1e9).toFixed(2) + "B usd_per_week=" + c.usdPerWeek.toFixed(2) + " usd_per_cycle=" + usd.toFixed(2) + " list_usd_per_B=" + c.usdPerB.toFixed(2));
}

const out = { ...catalogRaw, rows };
const check = catalogFileSchema.safeParse(out);
if (!check.success) fail("catalog no longer validates: " + check.error.issues[0]?.message);
writeFileSync(join(APP, "data", "catalog.json"), JSON.stringify(out, null, 2) + "\n");
console.log("build:claude-hours ok plans=" + plans.plans.length + " throughput_p50=" + perHour + " mix_cache=" + mix.cache_share.toFixed(4));
