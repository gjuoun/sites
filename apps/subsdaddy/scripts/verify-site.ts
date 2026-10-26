#!/usr/bin/env bun
/**
 * Reads the prerendered output in dist/client and asserts the public page's contract:
 * every lane appears once (ranked or excluded), each lane has a page, no cell mixes the
 * measured and OpenRouter layers, and no unavailable value is rendered as zero.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const LANES = ["cc", "go-1", "go-2", "zai", "qwen"];
const problems: string[] = [];

function htmlFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith(".html")) out.push(p);
  }
  return out;
}

if (!existsSync(client)) {
  console.error("verify-site: dist/client missing; run build first");
  process.exit(2);
}
const pages = htmlFiles(client);
const index = readFileSync(join(client, "index.html"), "utf8");

// every lane appears exactly once on the index, ranked or excluded
const rows = [...index.matchAll(/data-lane-row="([^"]+)"/g)].map((m) => m[1]);
const seen = new Set(rows);
for (const l of LANES) {
  const n = rows.filter((r) => r === l).length;
  if (n !== 1) problems.push(`lane ${l} appears ${n} times on the index (expected 1)`);
}
const ranked = (index.match(/data-ranked="yes"/g) ?? []).length;
const excluded = (index.match(/data-ranked="no"/g) ?? []).length;

// each lane has a page
for (const l of LANES) {
  if (!existsSync(join(client, "lane", l, "index.html"))) problems.push(`missing page for lane ${l}`);
}

// no element declares both layers at once
const mixed = [...index.matchAll(/<[^>]*data-layer="([^"]*)"[^>]*>/g)].filter((m) => m[1].includes(" ") || m[1].includes(",")).length;
if (mixed > 0) problems.push(`${mixed} element(s) mix layers`);

// an unavailable value is never rendered as a $0 price
const zeroed = (index.match(/\$0\.00/g) ?? []).length;
if (zeroed > 0) problems.push(`${zeroed} zero price(s) rendered`);

// a low-confidence capacity must be visible on its ranked row; it does not fail the gate by itself
const lanesFile = JSON.parse(readFileSync(join(APP, "data", "lanes.json"), "utf8")) as { lanes: Array<{ lane: string; usd_per_b: number | null; capacity: { confidence: string | null } }> };
const lowRanked = lanesFile.lanes.filter((l) => l.usd_per_b !== null && l.capacity.confidence === "low");
for (const l of lowRanked) {
  const row = index.match(new RegExp(`<tr[^>]*data-lane-row="${l.lane}"[\\s\\S]*?</tr>`));
  if (!row || !row[0].includes('data-confidence="low"')) problems.push(`low-confidence badge missing on the ranked row for ${l.lane}`);
}
const lowBadges = (index.match(/data-confidence="low"/g) ?? []).length;

const summary = `pages=${pages.length} lanes=${seen.size} ranked=${ranked} excluded=${excluded} low_confidence=${lowBadges} mixed_layers=${mixed} zeroed=${zeroed}`;
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.log(summary);
  process.exit(1);
}
console.log(summary);
