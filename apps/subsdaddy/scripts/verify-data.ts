#!/usr/bin/env bun
/**
 * Provenance gate over data/*.json.
 *  - any object carrying a reading (used_pct, p50_*, tokens_per_week, usd_per_b, ...) must name
 *    measured_at and either a source or an explicit unavailable reason;
 *  - no reading may be the number 0 (an unavailable value must be an explicit reason);
 *  - a ranked lane must name a capacity method;
 *  - a file whose measured_at predates SUBSDADDY_REFRESH_START is stale.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const started = Date.parse(process.env.SUBSDADDY_REFRESH_START ?? "") || 0;
const READING = ["used_pct", "p50_throughput", "p50_latency_ms", "tokens_per_week", "usd_per_b", "p50_ttft_ms", "p50_output_tps", "usd_per_b_obs"];
const REFRESHED = new Set(["usage.json", "quota.json", "lanes.json", "benchmark.json"]);
const problems: string[] = [];
let provenanceMissing = 0;
let zeroed = 0;

function walk(node: unknown, file: string, path: string): void {
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, file, `${path}[${i}]`));
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const hasReading = READING.some((k) => k in o && o[k] !== null);
  if (hasReading) {
    if (typeof o.measured_at !== "string") {
      provenanceMissing++;
      problems.push(`${file}${path}: reading without measured_at`);
    }
    if (typeof o.source !== "string" && typeof o.unavailable !== "string" && typeof o.reason !== "string") {
      provenanceMissing++;
      problems.push(`${file}${path}: reading without source or reason`);
    }
  }
  for (const [k, v] of Object.entries(o)) {
    if (v === 0 && READING.includes(k)) {
      zeroed++;
      problems.push(`${file}${path}.${k} is 0 (unavailable must be explicit)`);
    }
    walk(v, file, `${path}.${k}`);
  }
}

for (const f of readdirSync(dataDir).filter((x) => x.endsWith(".json"))) {
  const parsed = JSON.parse(readFileSync(join(dataDir, f), "utf8"));
  walk(parsed, f, "");
  const measured = Date.parse(parsed.measured_at ?? "");
  // freshness applies to what the refresh regenerates; curated inputs (plans, models) carry their own dates
  if (REFRESHED.has(f) && started && measured && measured < started) problems.push(`${f}: measured_at predates the refresh start (stale)`);
}

const lanes = JSON.parse(readFileSync(join(dataDir, "lanes.json"), "utf8")).lanes as Array<{ lane: string; usd_per_b: number | null; capacity: { method: string } }>;
for (const l of lanes) {
  if (l.usd_per_b !== null && (l.capacity.method === "unavailable" || !l.capacity.method)) {
    problems.push(`${l.lane}: ranked without a capacity method`);
  }
}

if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.log(`provenance_missing=${provenanceMissing} zeroed=${zeroed} problems=${problems.length}`);
  process.exit(1);
}
console.log(`provenance_missing=${provenanceMissing} zeroed=${zeroed}`);
