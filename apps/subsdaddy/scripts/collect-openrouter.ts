#!/usr/bin/env bun
/**
 * Fetches the BARE model page for every model we show a speed for: each plan's lane model and the reference models.
 * Each model gets one status (src/lib/openrouter-outcome.ts): ok, stats_unavailable (every endpoint reported zero
 * throughput), kept_previous (this run could not read the page and the last trusted snapshot is kept, dated), or
 * unavailable. A run exits 0 when one model fails; nothing is written as zero, and a model is never dropped silently.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { benchmarkFileSchema, modelsFileSchema, type OrEndpoint } from "../src/data/schema";
import { outcomeForModel, type PreviousModel } from "../src/lib/openrouter-outcome";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const measuredAt = new Date().toISOString();
const SOURCE = "openrouter.ai bare model page stats payload (unofficial), 30-minute window";
const models = modelsFileSchema.parse(JSON.parse(readFileSync(join(dataDir, "models.json"), "utf8")));
const slugs = [...new Set([...models.models.map((m) => m.openrouter), ...models.reference.map((r) => r.openrouter)])];

// the last run's file, read before it is overwritten: a model whose page fails this run keeps its trusted snapshot (r57)
const benchPath = join(dataDir, "benchmark.json");
const prevParsed = existsSync(benchPath) ? benchmarkFileSchema.safeParse(JSON.parse(readFileSync(benchPath, "utf8"))) : null;
const prevFile = prevParsed && prevParsed.success ? prevParsed.data : null;
function previousFor(slug: string): PreviousModel {
  if (!prevFile) return null;
  const st = prevFile.models_status.find((s) => s.model === slug);
  if (!st) return null;
  return { status: st.status, endpoints: prevFile.endpoints.filter((e) => e.model === slug), measured_at: st.measured_at };
}

const endpoints: OrEndpoint[] = [];
const status: Array<{ model: string; status: "ok" | "unavailable" | "stats_unavailable" | "kept_previous"; reason: string | null; endpoints: number; measured_at: string; source: string }> = [];
let stale = 0;
let skippedZero = 0;
let kept = 0;
let statsUnavailable = 0;
let unavailable = 0;
let fixtureSaved = false;

for (const slug of slugs) {
  const url = "https://openrouter.ai/" + slug;
  let html: string | null = null;
  let fetchError: string | null = null;
  try {
    const res = await fetch(url, { headers: { "user-agent": "subsdaddy-collector/0.1" } });
    if (res.ok) html = await res.text();
    else fetchError = "http " + res.status;
  } catch (e) {
    fetchError = "network: " + (e instanceof Error ? e.name : "error");
  }
  if (html !== null && !fixtureSaved && slug === "deepseek/deepseek-v4.1-flash") {
    mkdirSync(join(APP, "fixtures"), { recursive: true });
    writeFileSync(join(APP, "fixtures", "openrouter.deepseek-v4.1-flash.html"), html);
    fixtureSaved = true;
  }
  const o = outcomeForModel({ slug, html, fetchError, measuredAt, previous: previousFor(slug) });
  endpoints.push(...o.endpoints);
  stale += o.stale;
  skippedZero += o.skipped_zero_tput;
  for (const s of o.skipped) console.log("skipped endpoint: " + slug + " " + s.provider + " (" + s.field + ")");
  status.push({ model: slug, status: o.status, reason: o.reason, endpoints: o.endpoints.length, measured_at: o.kept_from ?? measuredAt, source: SOURCE });
  if (o.status === "ok") console.log(slug + " ok endpoints=" + o.endpoints.length + " skipped_zero_tput=" + o.skipped_zero_tput);
  else if (o.status === "kept_previous") {
    kept++;
    console.log("openrouter: " + o.reason + " for " + slug);
  } else if (o.status === "stats_unavailable") {
    statsUnavailable++;
    console.log(slug + " stats_unavailable: " + o.reason);
  } else {
    unavailable++;
    console.log(slug + " unavailable: " + o.reason);
  }
}

const file = benchmarkFileSchema.parse({ endpoints, models_status: status, measured_at: measuredAt, source: SOURCE });
writeFileSync(benchPath, JSON.stringify(file, null, 2) + "\n");
const zeroed = endpoints.filter((e) => e.p50_throughput === 0 || e.p50_latency_ms === 0).length;
const ok = status.filter((s) => s.status === "ok").length;
console.log("models=" + slugs.length + " ok=" + ok + " kept_previous=" + kept + " stats_unavailable=" + statsUnavailable + " unavailable=" + unavailable + " endpoints=" + endpoints.length + " skipped_zero_tput=" + skippedZero + " stale=" + stale + " zeroed=" + zeroed);
