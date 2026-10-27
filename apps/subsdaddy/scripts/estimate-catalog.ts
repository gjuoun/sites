#!/usr/bin/env bun
/**
 * Writes an estimate onto every catalog row:
 *   estimated_usd_per_b(plan, model, shape, context) = (fee_usd / allowance_usd) × blended_usd_per_b(model, shape, context)
 * The blend splits prompt tokens into input, cache write and cache read, and prices a request at the
 * prompt-length band its prompt reaches. Three contexts are computed for every value:
 *   100K  the standard short context (LMC_CONTEXT_SHORT); the table shows this one
 *   350K  the standard long context (LMC_CONTEXT_LONG)
 *   p75   the sensitivity point: the p75 session-end context in data/context.json
 * Catalog rows only; the ranking never reads these values.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema, type CatalogRow } from "../src/data/catalog";
import { REF_IDS, SHAPES, estimateOne, pooledMix, type RefId, type RefPrice, type Shape } from "../src/data/estimate";
import { modelsFileSchema, usageFileSchema } from "../src/data/schema";
import { contextFileSchema, LMC_CONTEXT_LONG, LMC_CONTEXT_SHORT } from "../src/data/context";
import { averagePrice, tierBasis } from "../src/data/peak-offpeak";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const now = new Date().toISOString();
const SOURCE = "usage.json measured mix (pooled) × OpenRouter list prices and prompt-length bands (models.json); session-end contexts (context.json)";

const usage = usageFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "usage.json"), "utf8")));
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const context = contextFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "context.json"), "utf8")));
const mix = pooledMix(usage.lanes.map((l) => ({ tokens: l.tokens })));
// each measured plan is estimated on its own measured token mix; the others on the pooled mix
const laneMix = new Map(usage.lanes.map((l) => [l.lane, pooledMix([{ tokens: l.tokens }])] as const));
const allowanceFile = JSON.parse(readFileSync(join(dataDir, "allowance.json"), "utf8")) as { lanes: Array<{ lane: string; allowance_usd_per_cycle: number | null; binding_window: string | null; cycle_days: number | null; fee_per_cycle_usd: number | null; allowance_basis: string | null }> };
const measuredAllowance = new Map(allowanceFile.lanes.map((l) => [l.lane, l] as const));
const price = new Map<RefId, RefPrice>(
  models.reference.map((r) => [
    r.ref,
    { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m, cache_write_per_m: r.cache_write_per_m ?? null, overrides: r.overrides },
  ]),
);
for (const id of REF_IDS) if (!price.has(id)) throw new Error("missing reference price for " + id);
const refMeta = new Map(models.reference.map((r) => [r.ref, r]));

const P75 = context.quantiles.p75;
const kTok = (n: number) => Math.round(n / 1000) + "K";

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

type Value = {
  ref: RefId; shape: Shape; usd_per_b: number | null; reason: string | null; fee_over_allowance: number | null; blended_usd_per_b: number;
  measured_at: string; source: string; usd_per_b_long: number | null; usd_per_b_p75: number | null; band_short: string; band_long: string; band_p75: string; allowance_usd?: number | null; allowance_basis?: string | null; allowance_cycle_days?: number | null; fee_usd?: number | null; price_used?: RefPrice | null;
};

function estimateRow(row: CatalogRow) {
  const rowMix = row.measured_lane ? (laneMix.get(row.measured_lane) ?? mix) : mix;
  // a measured lane is priced per its own cycle: its fee for that cycle and its allowance (vendor-reported or derived)
  const measuredLane = row.measured_lane ? measuredAllowance.get(row.measured_lane) : undefined;
  const fee = measuredLane ? (measuredLane.fee_per_cycle_usd ?? null) : row.price_month_usd;
  if (fee === null) return { status: "unavailable" as const, reason: "no USD fee to divide", basis: null, values: [] as Value[], range_agent: null };
  if (row.allowance.length === 0) {
    const reason = row.status === "excluded" ? (row.exclusion_reason ?? "excluded") : (row.allowance_reason ?? "no published usage-dollar allowance");
    return { status: "unavailable" as const, reason, basis: null, values: [] as Value[], range_agent: null };
  }
  if (row.offered_models.length === 0) {
    return { status: "unavailable" as const, reason: "its checked model list names no reference model, so no estimate is made for one", basis: null, values: [] as Value[], range_agent: null };
  }
  // a plan on a measured lane takes the allowance its quota windows give (allowance.json), not the published one
  const measured = row.measured_lane ? measuredAllowance.get(row.measured_lane) : undefined;
  const measuredUsd = measured && measured.allowance_usd_per_cycle !== null ? measured.allowance_usd_per_cycle : null;
  const values: Value[] = [];
  const ratios: string[] = [];
  const tierNotes = new Set<string>();
  const anomalies = new Set<string>();
  for (const ref of REF_IDS) {
    if (!row.offered_models.includes(ref)) continue;
    const refPub = row.allowance.find((a) => a.ref === ref) ?? null;
    const wildcard = row.allowance.find((a) => a.ref === "*") ?? null;
    const entry = refPub ?? wildcard;
    // precedence: the official limit for this model, then the lane allowance (published, vendor pool or derived), then a wildcard
    const allowanceUsd = refPub ? refPub.usd : measuredUsd ?? (wildcard ? wildcard.usd : null);
    const allowanceBasis = refPub ? "vendor_published" : measured ? measured.allowance_basis : wildcard ? (row.allowance_model === "credits" ? "credits" : "vendor_published") : null;
    const allowanceCycle = measured ? measured.cycle_days : 30;
    const pr = priceFor(row, ref);
    if (pr.note) tierNotes.add(pr.note);
    const meta = refMeta.get(ref);
    if (meta?.price_status === "anomaly" && meta.price_anomaly) anomalies.add(ref + " " + meta.price_anomaly);
    for (const shape of SHAPES) {
      const base = { fee_usd: fee, allowance_usd: allowanceUsd, allowance_basis: allowanceBasis, allowance_cycle_days: allowanceCycle, allowance_reason: allowanceUsd !== null ? null : "no published allowance for this model in this plan", price: pr.price, mix: rowMix, shape };
      const s = estimateOne({ ...base, prompt_tokens: LMC_CONTEXT_SHORT });
      const l = estimateOne({ ...base, prompt_tokens: LMC_CONTEXT_LONG });
      const p = estimateOne({ ...base, prompt_tokens: P75 });
      values.push({
        ref, shape, usd_per_b: s.usd_per_b, reason: s.reason, fee_over_allowance: s.fee_over_allowance, blended_usd_per_b: s.blended_usd_per_b,
        measured_at: now, source: SOURCE, usd_per_b_long: l.usd_per_b, usd_per_b_p75: p.usd_per_b,
        band_short: s.band, band_long: l.band, band_p75: p.band, allowance_usd: base.allowance_usd, allowance_basis: base.allowance_basis, allowance_cycle_days: base.allowance_cycle_days, fee_usd: base.fee_usd, price_used: base.price,
      });
      if (shape === "agent" && s.fee_over_allowance !== null) ratios.push(ref + " " + Number(s.fee_over_allowance.toPrecision(3)));
    }
  }
  const agent = values.filter((v) => v.shape === "agent" && v.usd_per_b !== null).map((v) => v.usd_per_b as number);
  if (agent.length === 0) {
    return { status: "unavailable" as const, reason: "no allowance matches any reference model", basis: null, values, range_agent: null };
  }
  const low = Math.min(...agent);
  const high = Math.max(...agent);
  const basis =
    "fee $" + fee + (measuredUsd !== null ? " per cycle ÷ " + (measured!.allowance_basis === "vendor_published" ? "published allowance" : measured!.allowance_basis === "vendor_reported" ? "vendor-reported pool" : "derived allowance") : "/mo ÷ published usage-dollar allowance") + " (" + ratios.join(", ") + ") × blended list cost per billion tokens of each reference model; " +
    (row.measured_lane ? "this plan's own measured" : "pooled measured") + " mix: output share " + (rowMix.output_share * 100).toFixed(2) + "%, agent cache share " + (rowMix.agent_cache_share * 100).toFixed(2) + "%, cache write share " + ((rowMix.cache_write_share ?? 0) * 100).toFixed(2) + "% (interactive 0%, cache_heavy 94%)" +
    "; standard contexts: 100K (table) and 350K, with p75 " + kTok(P75) + " as sensitivity (session-end median " + kTok(context.quantiles.p50) + ", p90 " + kTok(context.quantiles.p90) + ", " + context.sample_sessions.toLocaleString("en-US") + " sessions)" +
    (anomalies.size > 0 ? "; " + [...anomalies].join("; ") : "") +
    (measuredUsd !== null ? "; allowance " + (measured!.allowance_basis === "vendor_published" ? "is the published allowance" : measured!.allowance_basis === "vendor_reported" ? "is the vendor-reported pool" : "is derived from the quota windows") + " (" + measured!.binding_window + " window, " + measured!.cycle_days + "-day cycle): $" + measuredUsd.toFixed(2) + " per cycle, replacing the published allowance" : "") +
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
console.log("catalog=" + checked.rows.length + " estimated=" + est.length + " unavailable=" + (checked.rows.length - est.length) + " contexts=100K/350K/p75:" + kTok(P75) + " mix_output=" + mix.output_share.toFixed(4) + " mix_agent_cache=" + mix.agent_cache_share.toFixed(4));
