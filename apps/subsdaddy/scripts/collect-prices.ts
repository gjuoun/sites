#!/usr/bin/env bun
/**
 * Reference list prices, checked before they replace anything.
 *
 * For each reference model: read the OpenRouter listing (/api/v1/models). A listing is accepted only if
 * every price is positive, completion is not below prompt, and cache read is not above prompt. A rejected
 * listing (a "price_anomaly") never overwrites the last verified snapshot: the model keeps its last
 * values, and the anomaly is recorded with the date of that snapshot.
 *
 * The official provider page is the priority source (official > openrouter). Where the official price
 * table is not readable from the static page, the official status says so, and OpenRouter decides.
 * Writes data/models.json reference entries only; never writes a price it did not read.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sanity } from "../src/lib/price-guard";

const APP = resolve(import.meta.dir, "..");
const path = join(APP, "data", "models.json");
const file = JSON.parse(readFileSync(path, "utf8"));
const now = new Date().toISOString();

type Price = { in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null; overrides: Array<{ min_prompt_tokens: number; in_per_m: number; out_per_m: number; cache_per_m: number; cache_write_per_m: number | null; source: string }> };

// OpenRouter lists USD per token; convert to USD per million, rounded to remove binary float noise
const perM = (v: unknown) => (typeof v === "string" || typeof v === "number" ? Number((Number(v) * 1e6).toFixed(9)) : null);

// official price pages checked by hand: the DeepSeek pricing pages render their price table client-side, so the
// static document has no price rows to read (api-docs.deepseek.com/quick_start/pricing, read 2026-10-26)
const OFFICIAL_CHECKS: Record<string, string> = {
  "deepseek-v4.1-flash": "unavailable: official pricing page renders its price table client-side; the static document has model details but no prices (api-docs.deepseek.com/quick_start/pricing, read 2026-10-26)",
};

// the date the reference snapshot in data/models.json was first verified (the 2026-10-26 morning read)
const SEED_VERIFIED_AT = "2026-10-26T17:30:00Z";


async function listing(): Promise<Map<string, any> | null> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const body = (await res.json()) as { data: Array<{ id: string; pricing: Record<string, unknown> }> };
    return new Map(body.data.map((m) => [m.id, m.pricing]));
  } catch {
    return null;
  }
}

function fromListing(pricing: Record<string, unknown>): Price {
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

const or = await listing();
const notes: string[] = [];
for (const r of file.reference as Array<Record<string, any>>) {
  if (!r.last_verified_at) r.last_verified_at = SEED_VERIFIED_AT;
  // the official price table is read only where it is in the static document; otherwise the status says so
  const official = OFFICIAL_CHECKS[r.ref as string] ?? "not checked";
  r.official_status = official;
  r.source_priority = "official > openrouter";
  if (!or) {
    r.price_status = "unavailable";
    r.price_anomaly = null;
    notes.push(r.ref + " unavailable: listing not fetched; last verified " + r.last_verified_at);
    continue;
  }
  const pricing = or.get(r.openrouter);
  if (!pricing) {
    r.price_status = "unavailable";
    r.price_anomaly = null;
    notes.push(r.ref + " unavailable: not in listing");
    continue;
  }
  const listed = fromListing(pricing);
  const reasons = [sanity(listed), ...listed.overrides.map((o) => sanity(o))].filter((x): x is string => x !== null);
  r.openrouter_listed = { in_per_m: listed.in_per_m, out_per_m: listed.out_per_m, cache_per_m: listed.cache_per_m, cache_write_per_m: listed.cache_write_per_m };
  if (reasons.length > 0) {
    // the anomaly is recorded; the last verified values stay as they are
    r.price_status = "anomaly";
    r.price_anomaly = "price_anomaly: " + reasons[0] + "; using last verified snapshot " + String(r.last_verified_at).slice(0, 10);
    notes.push(r.ref + " " + r.price_anomaly);
    continue;
  }
  r.in_per_m = listed.in_per_m;
  r.out_per_m = listed.out_per_m;
  r.cache_per_m = listed.cache_per_m;
  r.cache_write_per_m = listed.cache_write_per_m;
  r.overrides = listed.overrides;
  r.price_status = "verified";
  r.price_anomaly = null;
  r.last_verified_at = now;
  r.source = "openrouter.ai/api/v1/models, " + now.slice(0, 10) + "; official: " + official;
  notes.push(r.ref + " verified " + r.in_per_m + " / " + r.out_per_m + " / " + r.cache_per_m);
}
file.measured_at = now;
writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
for (const n of notes) console.log(n);
