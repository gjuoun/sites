#!/usr/bin/env bun
/**
 * Writes an estimate onto every catalog row:
 *   estimated_usd_per_b(plan, model, shape) = (fee_usd / allowance_usd) × blended_usd_per_b(model, shape)
 * Reads the measured token mix from usage.json (pooled over the four plans) and the reference list
 * prices from models.json. Catalog rows only; the ranking never reads these values.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema, type CatalogRow } from "../src/data/catalog";
import { REF_IDS, SHAPES, estimateOne, pooledMix, type RefId, type Shape } from "../src/data/estimate";
import { modelsFileSchema, usageFileSchema } from "../src/data/schema";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const now = new Date().toISOString();
const SOURCE = "usage.json measured mix (pooled) × OpenRouter list prices (models.json)";

const usage = usageFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "usage.json"), "utf8")));
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const mix = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
// each measured plan is estimated on its own measured token mix; the others on the pooled mix
const laneMix = new Map(usage.lanes.map((l) => [l.lane, pooledMix([{ tokens: l.tokens }])] as const));
const price = new Map(models.reference.map((r) => [r.ref, { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m }]));
for (const id of REF_IDS) if (!price.has(id)) throw new Error("missing reference price for " + id);

const file = catalogFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "catalog.json"), "utf8")));

function estimateRow(row: CatalogRow) {
  const rowMix = row.measured_lane ? (laneMix.get(row.measured_lane) ?? mix) : mix;
  const fee = row.price_month_usd;
  if (fee === null) return { status: "unavailable" as const, reason: "no USD fee to divide", basis: null, values: [], range_agent: null };
  if (row.allowance.length === 0) {
    const reason = row.status === "excluded" ? (row.exclusion_reason ?? "excluded") : (row.allowance_reason ?? "no published usage-dollar allowance");
    return { status: "unavailable" as const, reason, basis: null, values: [], range_agent: null };
  }
  if (row.offered_models.length === 0) {
    return { status: "unavailable" as const, reason: "its checked model list names no reference model, so no estimate is made for one", basis: null, values: [], range_agent: null };
  }
  const values = [] as Array<{ ref: RefId; shape: Shape; usd_per_b: number | null; reason: string | null; fee_over_allowance: number | null; blended_usd_per_b: number; measured_at: string; source: string }>;
  const ratios: string[] = [];
  for (const ref of REF_IDS) {
    if (!row.offered_models.includes(ref)) continue;
    const entry = row.allowance.find((a) => a.ref === ref) ?? row.allowance.find((a) => a.ref === "*") ?? null;
    for (const shape of SHAPES) {
      const e = estimateOne({
        fee_usd: fee,
        allowance_usd: entry ? entry.usd : null,
        allowance_reason: entry ? null : "no published allowance for this model in this plan",
        price: price.get(ref)!,
        mix: rowMix,
        shape,
      });
      values.push({ ref, shape, usd_per_b: e.usd_per_b, reason: e.reason, fee_over_allowance: e.fee_over_allowance, blended_usd_per_b: e.blended_usd_per_b, measured_at: now, source: SOURCE });
      if (shape === "agent" && e.fee_over_allowance !== null) ratios.push(ref + " " + Number(e.fee_over_allowance.toPrecision(3)));
    }
  }
  const agent = values.filter((v) => v.shape === "agent" && v.usd_per_b !== null).map((v) => v.usd_per_b as number);
  if (agent.length === 0) {
    return { status: "unavailable" as const, reason: "no allowance matches any reference model", basis: null, values, range_agent: null };
  }
  const low = Math.min(...agent);
  const high = Math.max(...agent);
  const basis =
    "fee $" + fee + "/mo ÷ published usage-dollar allowance (" + ratios.join(", ") + ") × blended list cost per billion tokens of each reference model; " +
    (row.measured_lane ? "this plan's own measured" : "pooled measured") + " mix: output share " + (rowMix.output_share * 100).toFixed(2) + "%, agent cache share " + (rowMix.agent_cache_share * 100).toFixed(2) + "% (interactive 0%, cache_heavy 94%)";
  return { status: "estimated" as const, reason: null, basis, values, range_agent: [low, high] as [number, number] };
}

for (const row of file.rows) {
  row.estimate = { ...estimateRow(row), measured_at: now, source: SOURCE };
}
const checked = catalogFileSchema.parse(file);
writeFileSync(join(dataDir, "catalog.json"), JSON.stringify(checked, null, 2) + "\n");

const est = checked.rows.filter((r) => r.estimate?.status === "estimated");
for (const r of est) console.log(r.label.padEnd(40) + " " + r.estimate!.range_agent!.map((v) => String(Number(v.toPrecision(3)))).join(" .. "));
console.log("catalog=" + checked.rows.length + " estimated=" + est.length + " unavailable=" + (checked.rows.length - est.length) + " mix_output=" + mix.output_share.toFixed(4) + " mix_agent_cache=" + mix.agent_cache_share.toFixed(4));
