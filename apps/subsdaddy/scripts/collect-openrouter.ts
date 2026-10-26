#!/usr/bin/env bun
/**
 * Fetches the BARE model page for every model we show a speed for: each plan's lane model and the five
 * reference models. Each model gets a status: ok (endpoints parsed) or unavailable (with the reason).
 * A model that fails is reported as unavailable and carries no endpoints; nothing is written as zero.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { benchmarkFileSchema, modelsFileSchema, type OrEndpoint } from "../src/data/schema";
import { extractEndpoints } from "../src/lib/openrouter";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const measuredAt = new Date().toISOString();
const SOURCE = "openrouter.ai bare model page stats payload (unofficial), 30-minute window";
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const slugs = [...new Set([...models.models.map((m) => m.openrouter), ...models.reference.map((r) => r.openrouter)])];

const endpoints: OrEndpoint[] = [];
const status: Array<{ model: string; status: "ok" | "unavailable"; reason: string | null; endpoints: number; measured_at: string; source: string }> = [];
let blocks = 0;
let stale = 0;
let fixtureSaved = false;

for (const slug of slugs) {
  const url = `https://openrouter.ai/${slug}`;
  let html: string | null = null;
  let reason: string | null = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "subsdaddy-collector/0.1" } });
    if (res.ok) html = await res.text();
    else reason = `http ${res.status}`;
  } catch (e) {
    reason = "network: " + (e instanceof Error ? e.name : "error");
  }
  let parsed: OrEndpoint[] = [];
  if (html !== null) {
    if (!fixtureSaved && slug === "deepseek/deepseek-v4.1-flash") {
      mkdirSync(join(APP, "fixtures"), { recursive: true });
      writeFileSync(join(APP, "fixtures", "openrouter.deepseek-v4.1-flash.html"), html);
      fixtureSaved = true;
    }
    const out = extractEndpoints(html, slug, measuredAt);
    blocks += out.blocks;
    stale += out.stale;
    parsed = out.endpoints;
    if (out.blocks === 0) reason = "payload has no stats blocks (page shape changed or no stats published)";
    else if (parsed.length === 0) reason = "every stats row is stale (required fields missing)";
  }
  if (reason !== null) {
    status.push({ model: slug, status: "unavailable", reason, endpoints: 0, measured_at: measuredAt, source: SOURCE });
    console.log(`${slug} unavailable: ${reason}`);
    continue;
  }
  endpoints.push(...parsed);
  status.push({ model: slug, status: "ok", reason: null, endpoints: parsed.length, measured_at: measuredAt, source: SOURCE });
  console.log(`${slug} ok endpoints=${parsed.length}`);
}

const file = benchmarkFileSchema.parse({ endpoints, models_status: status, measured_at: measuredAt, source: SOURCE });
writeFileSync(join(dataDir, "benchmark.json"), JSON.stringify(file, null, 2) + "\n");
const zeroed = endpoints.filter((e) => e.p50_throughput === 0 || e.p50_latency_ms === 0).length;
const ok = status.filter((s) => s.status === "ok").length;
console.log(`models=${slugs.length} ok=${ok} unavailable=${slugs.length - ok} endpoints=${endpoints.length} stale=${stale} zeroed=${zeroed} blocks=${blocks}`);
