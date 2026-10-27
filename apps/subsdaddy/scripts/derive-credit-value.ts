#!/usr/bin/env bun
/**
 * Derives the usage value of one QwenCloud credit from the same window the quota reading covers, and
 * writes it to the catalog row. If the chain cannot be completed, the row gets credits_to_usd null, an
 * unverified note with the reason, and no allowance. Nothing is assumed to fill a gap.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { catalogFileSchema } from "../src/data/catalog";
import { creditUsageValue, formatSmall, type CreditRow, type ListPrice } from "../src/data/credits";
import { modelsFileSchema, quotaFileSchema, usageFileSchema } from "../src/data/schema";
import { averagePrice, tierBasis } from "../src/data/peak-offpeak";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const ROW = "qwen-cloud-token-owner-10";
const LANE = "qwen-cloud-token";

const quota = quotaFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "quota.json"), "utf8")));
const obs = quota.observations.find((o) => o.lane === LANE);
const usage = usageFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "usage.json"), "utf8")));
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const catalog = catalogFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "catalog.json"), "utf8")));
const row = catalog.rows.find((r) => r.plan_id === ROW);
if (!row) throw new Error("catalog row missing: " + ROW);

const prices: Record<string, ListPrice | undefined> = {};
const tierNotes: string[] = [];
for (const m of models.usage_models) {
  if (m.peak_offpeak) {
    const tiers = { peak: m.peak_offpeak.peak_usd_per_m, offpeak: m.peak_offpeak.offpeak_usd_per_m };
    prices[m.upstream_model] = averagePrice(tiers);
    tierNotes.push(tierBasis(m.upstream_model, tiers, { band_inherited_from: m.peak_offpeak.band_inherited_from, priced_as: m.peak_offpeak.priced_as }));
    continue;
  }
  prices[m.upstream_model] = m.in_per_m !== null && m.out_per_m !== null && m.cache_per_m !== null
    ? { in_per_m: m.in_per_m, out_per_m: m.out_per_m, cache_per_m: m.cache_per_m }
    : null;
}

const rawDir = join(dataDir, "raw", "usage");
const latest = readdirSync(rawDir).filter((f) => f.endsWith(".json")).sort().at(-1);
if (!latest) throw new Error("no raw usage export");
const raw = JSON.parse(readFileSync(join(rawDir, latest), "utf8")).rows as Array<Record<string, unknown>>;
const rows: CreditRow[] = raw
  .filter((r) => r.lane === LANE)
  .map((r) => ({
    created_ms: Date.parse(String(r.created_at_utc)),
    model: String(r.upstream_model),
    input: Number(r.input),
    cache_creation: Number(r.cache_creation),
    cache_read: Number(r.cache_read),
    output: Number(r.output),
  }));

let result: ReturnType<typeof creditUsageValue>;
if (!obs || !("used_pct" in obs)) {
  result = { ok: false, unavailable: "no quota reading for the lane" };
} else {
  const windowMs = (obs.window_minutes ?? 43200) * 60_000;
  result = creditUsageValue({
    credits_used: obs.credits_used ?? null,
    window_start_ms: Date.parse(obs.resets_at) - windowMs,
    window_end_ms: Date.parse(obs.measured_at),
    coverage_start_ms: Date.parse(usage.coverage_start),
    rows,
    prices,
    price_basis: "official QwenCloud prices, hour-weighted average of peak (14h) and off-peak (10h)",
  });
}

const pool = obs && "used_pct" in obs ? obs.credits_total ?? null : null;
const keepSources = row.sources.filter((s) => s.kind !== "unverified");
if (result.ok && pool !== null) {
  row.credits_to_usd = { usd_per_credit: result.usd_per_credit, basis: result.basis + " Tiers: " + tierNotes.join("; ") + ".", meaning: "usage_value" };
  row.allowance = [{ ref: "*", usd: pool * result.usd_per_credit, basis: "credit pool " + pool.toLocaleString("en-US") + " credits × measured usage value $" + formatSmall(result.usd_per_credit) + " per credit (see credits_to_usd basis)" }];
  row.allowance_reason = null;
  row.sources = keepSources;
  console.log("credit value: $" + formatSmall(result.usd_per_credit) + " per credit (usage value); pool $" + formatSmall(pool * result.usd_per_credit) + " of usage");
} else {
  const reason = result.ok ? "credit pool size not in the reading" : result.unavailable;
  row.credits_to_usd = null;
  row.allowance = [];
  row.allowance_reason = "credit usage value not measured: " + reason;
  row.sources = [...keepSources, { kind: "unverified", url: null, note: "unverified: usage value of one credit not measured (" + reason + ")" }];
  console.log("credit value: unavailable — " + reason);
}
row.measured_at = new Date().toISOString();
writeFileSync(join(dataDir, "catalog.json"), JSON.stringify(catalogFileSchema.parse(catalog), null, 2) + "\n");
