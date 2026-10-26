#!/usr/bin/env bun
/**
 * Writes an estimate onto every catalog row:
 *   estimated_usd_per_b(plan, model, shape) = (fee_usd / allowance_usd) × blended_usd_per_b(model, shape, prompt length)
 * The blend splits prompt tokens into input, cache write and cache read, and prices a request at the
 * prompt-length band its prompt reaches. Two prompt lengths are used: the measured p50 and p90 of
 * request prompts (raw usage export, pooled over the lanes). The table shows p50; p90 is kept beside it.
 * Catalog rows only; the ranking never reads these values.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema, type CatalogRow } from "../src/data/catalog";
import { REF_IDS, SHAPES, estimateOne, pooledMix, type RefId, type RefPrice, type Shape } from "../src/data/estimate";
import { modelsFileSchema, usageFileSchema } from "../src/data/schema";
import { averagePrice, tierBasis } from "../src/data/peak-offpeak";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const now = new Date().toISOString();
const SOURCE = "usage.json measured mix (pooled) × OpenRouter list prices and prompt-length bands (models.json)";

const usage = usageFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "usage.json"), "utf8")));
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const mix = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
// each measured plan is estimated on its own measured token mix; the others on the pooled mix
const laneMix = new Map(usage.lanes.map((l) => [l.lane, pooledMix([{ tokens: l.tokens }])] as const));
const price = new Map<RefId, RefPrice>(
  models.reference.map((r) => [
    r.ref,
    { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides },
  ]),
);
for (const id of REF_IDS) if (!price.has(id)) throw new Error("missing reference price for " + id);

/** The measured prompt length of a request (input + cache write + cache read), p50 and p90, pooled over the raw export. */
function promptProfile(): { p50: number; p90: number; n: number } {
  const dir = join(dataDir, "raw", "usage");
  const latest = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().at(-1);
  if (!latest) throw new Error("no raw usage export for the prompt profile");
  const rows = JSON.parse(readFileSync(join(dir, latest), "utf8")).rows as Array<{ input: number; cache_creation: number; cache_read: number }>;
  const xs = rows.map((r) => r.input + r.cache_creation + r.cache_read).sort((a, b) => a - b);
  if (xs.length === 0) throw new Error("empty raw usage export");
  const mid = Math.floor(xs.length / 2);
  const p50 = xs.length % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  const p90 = xs[Math.min(xs.length - 1, Math.round(0.9 * (xs.length - 1)))];
  return { p50, p90, n: xs.length };
}
const PROFILE = promptProfile();

const file = catalogFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "catalog.json"), "utf8")));

/** The price a plan pays for a reference model: its official peak/off-peak average where its lane has one, else the list price. */
function priceFor(row: CatalogRow, ref: RefId): { price: RefPrice; note: string | null } {
  if (row.measured_lane) {
    const laneModels = models.models.filter((m) => m.lane === row.measured_lane).map((m) => m.upstream_model);
    const tier = models.usage_models.find((u) => laneModels.includes(u.upstream_model) && u.peak_offpeak?.ref === ref && u.peak_offpeak.provider === row.provider);
    if (tier?.peak_offpeak) {
      const tiers = { peak: tier.peak_offpeak.peak_usd_per_m, offpeak: tier.peak_offpeak.offpeak_usd_per_m };
      return { price: averagePrice(tiers), note: tierBasis(tier.upstream_model, tiers, { band_inherited_from: tier.peak_offpeak.band_inherited_from, priced_as: tier.peak_offpeak.priced_as }) };
    }
  }
  return { price: price.get(ref)!, note: null };
}

type Value = { ref: RefId; shape: Shape; usd_per_b: number | null; reason: string | null; fee_over_allowance: number | null; blended_usd_per_b: number; measured_at: string; source: string; usd_per_b_p90: number | null; band_p50: string; band_p90: string | null };

function estimateRow(row: CatalogRow) {
  const rowMix = row.measured_lane ? (laneMix.get(row.measured_lane) ?? mix) : mix;
  const fee = row.price_month_usd;
  if (fee === null) return { status: "unavailable" as const, reason: "no USD fee to divide", basis: null, values: [] as Value[], range_agent: null };
  if (row.allowance.length === 0) {
    const reason = row.status === "excluded" ? (row.exclusion_reason ?? "excluded") : (row.allowance_reason ?? "no published usage-dollar allowance");
    return { status: "unavailable" as const, reason, basis: null, values: [] as Value[], range_agent: null };
  }
  if (row.offered_models.length === 0) {
    return { status: "unavailable" as const, reason: "its checked model list names no reference model, so no estimate is made for one", basis: null, values: [] as Value[], range_agent: null };
  }
  const values: Value[] = [];
  const ratios: string[] = [];
  const tierNotes = new Set<string>();
  for (const ref of REF_IDS) {
    if (!row.offered_models.includes(ref)) continue;
    const entry = row.allowance.find((a) => a.ref === ref) ?? row.allowance.find((a) => a.ref === "*") ?? null;
    const pr = priceFor(row, ref);
    if (pr.note) tierNotes.add(pr.note);
    for (const shape of SHAPES) {
      const base = { fee_usd: fee, allowance_usd: entry ? entry.usd : null, allowance_reason: entry ? null : "no published allowance for this model in this plan", price: pr.price, mix: rowMix, shape };
      const e50 = estimateOne({ ...base, prompt_tokens: PROFILE.p50 });
      const e90 = shape === "agent" ? estimateOne({ ...base, prompt_tokens: PROFILE.p90 }) : null;
      values.push({
        ref,
        shape,
        usd_per_b: e50.usd_per_b,
        reason: e50.reason,
        fee_over_allowance: e50.fee_over_allowance,
        blended_usd_per_b: e50.blended_usd_per_b,
        measured_at: now,
        source: SOURCE,
        usd_per_b_p90: e90 ? e90.usd_per_b : null,
        band_p50: e50.band,
        band_p90: e90 ? e90.band : null,
      });
      if (shape === "agent" && e50.fee_over_allowance !== null) ratios.push(ref + " " + Number(e50.fee_over_allowance.toPrecision(3)));
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
    (row.measured_lane ? "this plan's own measured" : "pooled measured") + " mix: output share " + (rowMix.output_share * 100).toFixed(2) + "%, agent cache share " + (rowMix.agent_cache_share * 100).toFixed(2) + "%, cache write share " + ((rowMix.cache_write_share ?? 0) * 100).toFixed(2) + "% (interactive 0%, cache_heavy 94%)" +
    "; prompt-length bands at measured p50 " + PROFILE.p50.toLocaleString("en-US") + " and p90 " + PROFILE.p90.toLocaleString("en-US") + " tokens per request (" + PROFILE.n.toLocaleString("en-US") + " requests, pooled); the table shows p50" +
    (tierNotes.size > 0 ? "; prices: " + [...tierNotes].join("; ") : "") + ".";
  return { status: "estimated" as const, reason: null, basis, values, range_agent: [low, high] as [number, number] };
}

for (const row of file.rows) {
  row.estimate = { ...estimateRow(row), measured_at: now, source: SOURCE };
}
const checked = catalogFileSchema.parse(file);
writeFileSync(join(dataDir, "catalog.json"), JSON.stringify(checked, null, 2) + "\n");

const est = checked.rows.filter((r) => r.estimate?.status === "estimated");
for (const r of est) console.log(r.label.padEnd(40) + " " + r.estimate!.range_agent!.map((v) => String(Number(v.toPrecision(3)))).join(" .. "));
console.log("catalog=" + checked.rows.length + " estimated=" + est.length + " unavailable=" + (checked.rows.length - est.length) + " prompt_p50=" + PROFILE.p50 + " prompt_p90=" + PROFILE.p90 + " mix_output=" + mix.output_share.toFixed(4) + " mix_agent_cache=" + mix.agent_cache_share.toFixed(4));
