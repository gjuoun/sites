#!/usr/bin/env bun
/**
 * Reference list prices for the reference models, checked before they replace anything.
 *
 *  - A model with an official price table (DeepSeek V4.1 Flash, from the provider's pricing document) takes
 *    its price from that table: the flat price is the arithmetic mean of peak and off-peak (owner ruling,
 *    2026-10-26). A disagreeing OpenRouter listing is recorded and rejected.
 *  - Any other model takes its OpenRouter listing, if the listing passes the sanity rule. A refused listing
 *    never replaces the last verified snapshot; the anomaly is recorded with that snapshot's date.
 *
 * Writes data/models.json reference entries only. It never writes a price it did not read.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { reconcile, sanity } from "../src/lib/price-guard";
import { DEEPSEEK_PRICING_URL, hourWeighted, parseDeepSeekFlash, type OfficialTiers, type PriceTriple } from "../src/lib/official-prices";

const APP = resolve(import.meta.dir, "..");
const path = join(APP, "data", "models.json");
const file = JSON.parse(readFileSync(path, "utf8"));
const now = new Date().toISOString();
const today = now.slice(0, 10);

// the date the reference snapshot in data/models.json was first verified (the 2026-10-26 morning read)
const SEED_VERIFIED_AT = "2026-10-26T17:30:00Z";
const OFFICIAL_MODEL = "deepseek-v4.1-flash";

type Listed = { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null; overrides: Array<{ min_prompt_tokens: number; in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null; source: string }> };

// OpenRouter lists USD per token; convert to USD per million, rounded to remove binary float noise
const perM = (v: unknown) => (typeof v === "string" || typeof v === "number" ? Number((Number(v) * 1e6).toFixed(9)) : null);

async function listing(): Promise<Map<string, Record<string, unknown>> | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: Array<{ id: string; pricing: Record<string, unknown> }> };
    return new Map(body.data.map((m) => [m.id, m.pricing]));
  } catch {
    return null;
  }
}

function fromListing(pricing: Record<string, unknown>): Listed {
  const overrides = Array.isArray(pricing.overrides)
    ? (pricing.overrides as Array<Record<string, unknown>>)
        .filter((o) => typeof o.min_prompt_tokens === "number")
        .map((o) => ({
          min_prompt_tokens: o.min_prompt_tokens as number,
          in_per_m: perM(o.prompt) ?? NaN,
          out_per_m: perM(o.completion) ?? NaN,
          cache_per_m: perM(o.input_cache_read) ?? NaN,
          cache_write_per_m: perM(o.input_cache_write),
          source: "openrouter listing",
        }))
    : [];
  return { in_per_m: perM(pricing.prompt) ?? NaN, out_per_m: perM(pricing.completion) ?? NaN, cache_per_m: perM(pricing.input_cache_read) ?? NaN, cache_write_per_m: perM(pricing.input_cache_write), overrides };
}

/** The DeepSeek pricing document: its text is parsed for the flash column. A page without the table gives a reason, never a price. */
async function officialDeepSeek(): Promise<{ tiers: OfficialTiers | null; reason: string | null }> {
  try {
    const res = await fetch(DEEPSEEK_PRICING_URL, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { tiers: null, reason: "HTTP " + res.status };
    const html = await res.text();
    const text = html.replace(/<(script|style|svg)[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    const tiers = parseDeepSeekFlash(text);
    return tiers ? { tiers, reason: null } : { tiers: null, reason: "price table not found or not consistent with its footnote" };
  } catch {
    return { tiers: null, reason: "fetch failed" };
  }
}

const or = await listing();
const official = await officialDeepSeek();
const notes: string[] = [];

for (const r of file.reference as Array<Record<string, any>>) {
  if (!r.last_verified_at) r.last_verified_at = SEED_VERIFIED_AT;
  const snapshot: PriceTriple = { in_per_m: r.in_per_m, out_per_m: r.out_per_m, cache_per_m: r.cache_per_m };
  const pricing = or ? or.get(r.openrouter) : undefined;
  const listed = pricing ? fromListing(pricing) : null;
  const refusal = listed ? ([sanity(listed), ...listed.overrides.map((o) => sanity(o))].find((x) => x !== null) ?? null) : null;
  const isOfficial = r.ref === OFFICIAL_MODEL && official.tiers !== null;
  const off = isOfficial ? hourWeighted(official.tiers!) : null;
  const listedTriple = listed && Number.isFinite(listed.in_per_m) ? { in_per_m: listed.in_per_m, out_per_m: listed.out_per_m, cache_per_m: listed.cache_per_m } : null;
  const res = reconcile({ official: off, listing: listedTriple, listingRefusal: refusal, snapshot, snapshotDate: String(r.last_verified_at).slice(0, 10) });
  r.openrouter_listed = listed ? { in_per_m: listed.in_per_m, out_per_m: listed.out_per_m, cache_per_m: listed.cache_per_m, cache_write_per_m: listed.cache_write_per_m } : null;
  r.source_priority = "official > openrouter";

  if (r.ref === OFFICIAL_MODEL) {
    r.official_status = official.tiers
      ? "read " + today + " from " + DEEPSEEK_PRICING_URL
      : "unavailable: " + (official.reason ?? "not read") + " (" + DEEPSEEK_PRICING_URL + ", " + today + ")";
  } else {
    r.official_status = "not checked";
  }

  if (res.status === "official") {
    const t = official.tiers!;
    r.in_per_m = res.values.in_per_m;
    r.out_per_m = res.values.out_per_m;
    r.cache_per_m = res.values.cache_per_m;
    r.cache_write_per_m = null;
    r.overrides = [];
    r.official = {
      source: DEEPSEEK_PRICING_URL,
      fetched_at: now,
      model_label: "deepseek-flash, served by DeepSeek-V4.1-Flash-1017, 1M context",
      peak: t.peak,
      off_peak: t.off_peak,
      peak_hours_utc: t.peak_hours_utc,
      combination: "hour-weighted: peak 35 of 168 hours a week (01:00-04:00 and 06:00-10:00 UTC, Monday to Friday), off-peak 133 of 168 (r42 ruling 2026-10-27)",
    };
    r.price_status = "official";
    r.price_anomaly = null;
    r.price_note = res.note;
    r.last_verified_at = now;
    r.source = DEEPSEEK_PRICING_URL + ", " + today + "; hour-weighted peak/off-peak (35/168)";
    notes.push(r.ref + " official " + res.values.in_per_m + " / " + res.values.out_per_m + " / " + res.values.cache_per_m + " per M (" + res.note + ")");
    continue;
  }
  if (res.status === "verified" && listed) {
    r.in_per_m = listed.in_per_m;
    r.out_per_m = listed.out_per_m;
    r.cache_per_m = listed.cache_per_m;
    r.cache_write_per_m = listed.cache_write_per_m;
    r.overrides = listed.overrides;
    r.price_status = "verified";
    r.price_anomaly = null;
    r.price_note = null;
    r.last_verified_at = now;
    r.source = "openrouter.ai/api/v1/models, " + today;
    notes.push(r.ref + " verified " + listed.in_per_m + " / " + listed.out_per_m + " / " + listed.cache_per_m);
    continue;
  }
  if (res.status === "anomaly") {
    r.price_status = "anomaly";
    r.price_anomaly = res.note;
    r.price_note = null;
    notes.push(r.ref + " " + res.note);
    continue;
  }
  r.price_status = "unavailable";
  r.price_anomaly = null;
  r.price_note = null;
  notes.push(r.ref + " unavailable: " + res.note);
}
file.measured_at = now;
writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
for (const n of notes) console.log(n);
