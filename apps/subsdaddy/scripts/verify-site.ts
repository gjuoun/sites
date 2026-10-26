#!/usr/bin/env bun
/**
 * Reads the prerendered output in dist/client and asserts the public page's contract: every plan
 * appears once (ranked or excluded), each plan has a page, no cell mixes the measured and
 * OpenRouter layers, no unavailable value renders as zero or NaN, a low-confidence capacity is
 * visible on its row, and a derived dollar figure is visible as derived.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { formatUsdPerCredit } from "../src/data/catalog";
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

// a zero price is "$0.00" exactly; per-credit values such as "$0.000392" are not zero prices
const zeroed = (index.match(/\$0\.00(?!\d)/g) ?? []).length;
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

// catalog: every catalog row once, no per-B figure, no measured layer, an unmeasured badge on each row,
// and no catalog plan appears in the ranking table
const catalogFile = JSON.parse(readFileSync(join(APP, "data", "catalog.json"), "utf8")) as {
  rows: Array<{ plan_id: string; status: string; allowance_model: string; credits_to_usd: { usd_per_credit: number } | null }>;
};
const catalogTable = index.match(/<table[^>]*data-catalog="rows"[\s\S]*?<\/table>/);
let catalogRendered = 0;
if (!catalogTable) {
  problems.push("catalog table missing from the index");
} else {
  const section = catalogTable[0];
  catalogRendered = (section.match(/data-catalog-row="/g) ?? []).length;
  if (catalogRendered !== catalogFile.rows.length) problems.push(`catalog rows rendered ${catalogRendered} != ${catalogFile.rows.length}`);
  if (/\$\/B/.test(section)) problems.push("catalog section shows $/B");
  if (/data-layer="measured"/.test(section)) problems.push("catalog section carries the measured layer");
  if (/\$0(?![.\d])/.test(section)) problems.push("catalog section renders $0 for an unverified or absent price");
  if (/NaN/.test(section)) problems.push("catalog section renders NaN");
  // every published conversion shows its per-credit dollar value; every credit row without one says unverified
  for (const r of catalogFile.rows) {
    const rowHtml = section.match(new RegExp('<tr[^>]*data-catalog-row="' + r.plan_id + '"[\\s\\S]*?</tr>'))?.[0] ?? "";
    if (r.credits_to_usd && !rowHtml.includes(formatUsdPerCredit(r.credits_to_usd.usd_per_credit))) {
      problems.push("credits value missing on the catalog row for " + r.plan_id);
    }
    if (r.allowance_model === "credits" && !r.credits_to_usd && !rowHtml.includes('data-credits="unverified"')) {
      problems.push("credit row " + r.plan_id + " shows no unverified marker");
    }
  }
  const unmeasured = (section.match(/data-badge="unmeasured"/g) ?? []).length;
  if (unmeasured !== catalogFile.rows.length) problems.push(`unmeasured badge on ${unmeasured} of ${catalogFile.rows.length} catalog rows`);
  const rankingTable = index.match(/<table[^>]*data-testid="ranking"[\s\S]*?<\/table>/)?.[0] ?? "";
  for (const r of catalogFile.rows) {
    if (rankingTable.includes(`data-lane-row="${r.plan_id}"`)) problems.push(`catalog plan ${r.plan_id} appears in the ranking`);
  }
}

const summary = `pages=${pages.length} lanes=${seen.size} ranked=${ranked} excluded=${excluded} catalog=${catalogRendered} derived=${derivedRows} low_confidence=${lowRows} mixed_layers=${mixed} zeroed=${zeroed}`;
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.log(summary);
  process.exit(1);
}
console.log(summary);
