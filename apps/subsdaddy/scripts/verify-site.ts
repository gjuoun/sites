#!/usr/bin/env bun
/**
 * Reads the prerendered output in dist/client and asserts the public page's contract: every plan
 * appears once (ranked or excluded), each plan has a page, no cell mixes the measured and
 * OpenRouter layers, no unavailable value renders as zero or NaN, a low-confidence capacity is
 * visible on its row, and a derived dollar figure is visible as derived.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const LANES = ["commandcode-goat", "opencode-go", "zai-glm-max", "qwen-cloud-token"];
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
const rowOf = (lane: string) => {
  const m = index.match(new RegExp('<tr[^>]*data-lane-row="' + lane + '"[\\s\\S]*?</tr>'));
  return m ? m[0] : "";
};

const rows = [...index.matchAll(/data-lane-row="([^"]+)"/g)].map((m) => m[1]);
const seen = new Set(rows);
for (const l of LANES) {
  const n = rows.filter((r) => r === l).length;
  if (n !== 1) problems.push(`plan ${l} appears ${n} times on the index (expected 1)`);
}
const ranked = (index.match(/data-ranked="yes"/g) ?? []).length;
const excluded = (index.match(/data-ranked="no"/g) ?? []).length;

for (const l of LANES) {
  if (!existsSync(join(client, "lane", l, "index.html"))) problems.push(`missing page for plan ${l}`);
}

const mixed = [...index.matchAll(/<[^>]*data-layer="([^"]*)"[^>]*>/g)].filter((m) => m[1].includes(" ") || m[1].includes(",")).length;
if (mixed > 0) problems.push(`${mixed} element(s) mix layers`);

const zeroed = (index.match(/\$0\.00/g) ?? []).length;
if (zeroed > 0) problems.push(`${zeroed} zero price(s) rendered`);
if (/NaN/.test(index)) problems.push("NaN rendered on the index");

const lanesFile = JSON.parse(readFileSync(join(APP, "data", "lanes.json"), "utf8")) as {
  lanes: Array<{ lane: string; usd_per_b: number | null; usd_per_b_basis: string | null; capacity: { confidence: string | null } }>;
};
let lowRows = 0;
let derivedRows = 0;
for (const l of lanesFile.lanes) {
  const row = rowOf(l.lane);
  if (l.usd_per_b !== null && l.capacity.confidence === "low") {
    lowRows++;
    if (!row.includes('data-confidence="low"')) problems.push(`low-confidence badge missing on the row for ${l.lane}`);
  }
  if (l.usd_per_b_basis === "derived") {
    derivedRows++;
    if (!row.includes('data-basis="derived"') || !row.includes(">derived<")) problems.push(`derived badge missing on the row for ${l.lane}`);
  }
}

const summary = `pages=${pages.length} lanes=${seen.size} ranked=${ranked} excluded=${excluded} derived=${derivedRows} low_confidence=${lowRows} mixed_layers=${mixed} zeroed=${zeroed}`;
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.log(summary);
  process.exit(1);
}
console.log(summary);
