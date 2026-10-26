#!/usr/bin/env bun
/**
 * Fetches the BARE model page for each mapped OpenRouter model (no /providers suffix: only the
 * bare page carries the stats payload), saves the fetched HTML as the parser fixture, and writes
 * data/benchmark.json. A failed fetch keeps the previous benchmark and prints PARTIAL; the
 * freshness gate (verify:all) then sees the old measured_at and refuses to pass.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { benchmarkFileSchema, modelsFileSchema, type OrEndpoint } from "../src/data/schema";
import { extractEndpoints } from "../src/lib/openrouter";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const measuredAt = new Date().toISOString();
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8"))).models;
const slugs = [...new Set(models.map((m) => m.openrouter))];

const all: OrEndpoint[] = [];
let stale = 0;
let blocks = 0;
let fixtureSaved = false;
let failed = false;
for (const slug of slugs) {
  const url = `https://openrouter.ai/${slug}`;
  const res = await fetch(url, { headers: { "user-agent": "subsdaddy-collector/0.1" } }).catch(() => null);
  if (!res || !res.ok) {
    console.error(`PARTIAL fetch failed: ${url} status=${res?.status ?? "network"}`);
    failed = true;
    continue;
  }
  const html = await res.text();
  if (!fixtureSaved) {
    mkdirSync(join(APP, "fixtures"), { recursive: true });
    writeFileSync(join(APP, "fixtures", "openrouter.deepseek-v4.1-flash.html"), html);
    fixtureSaved = true;
  }
  const out = extractEndpoints(html, slug, measuredAt);
  blocks += out.blocks;
  stale += out.stale;
  if (out.blocks === 0) {
    console.error(`PARTIAL zero stats blocks for ${slug}: payload shape changed`);
    failed = true;
    continue;
  }
  all.push(...out.endpoints);
  console.log(`${slug} blocks=${out.blocks} endpoints=${out.endpoints.length} stale=${out.stale}`);
}

if (failed) {
  console.log(`PARTIAL: kept previous data/benchmark.json (measured_at unchanged)`);
  process.exit(0);
}

const file = benchmarkFileSchema.parse({ endpoints: all, measured_at: measuredAt, source: "openrouter.ai bare model page stats payload (unofficial)" });
writeFileSync(join(dataDir, "benchmark.json"), JSON.stringify(file, null, 2) + "\n");
const zeroed = all.filter((e) => e.p50_throughput === 0 || e.p50_latency_ms === 0).length;
console.log(`models=${slugs.length} endpoints=${all.length} stale=${stale} zeroed=${zeroed} blocks=${blocks}`);
