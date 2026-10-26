#!/usr/bin/env bun
/**
 * Reads the prerendered pages in dist/client and checks the public contract:
 *  - Section A (measured) lists the ranked plans, with the eight columns the spec names;
 *  - Section B has one section per reference model, in order, each listing the by-model plans;
 *  - every table uses the one unified style (same header and cell classes);
 *  - no cell is empty, no cell shows a dash, and every N/A names its reason;
 *  - value cells never print "$/B" or "$0.00"; estimates never appear in Section A.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { REF_IDS } from "../src/data/estimate";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));
const lanes = read("lanes.json").lanes as Array<{ lane: string; usd_per_b: number | null; measured: { p50_output_tps: number | null; p50_ttft_ms: number | null } }>;
const laneModels = read("models.json").models as Array<{ lane: string; openrouter: string }>;
const orEndpoints = new Set((read("benchmark.json").endpoints as Array<{ model: string }>).map((e) => e.model));
const catalog = read("catalog.json").rows as Array<{ plan_id: string; price_month_usd: number | null; allowance_model: string; estimate: { status: string; values: Array<{ ref: string; shape: string; usd_per_b: number | null }> } | null }>;

const byModelPlans = catalog.filter((r) => r.estimate?.status === "estimated" || (r.allowance_model === "credits" && r.price_month_usd !== null));
const estimatedPairs = catalog.flatMap((r) => (r.estimate?.status === "estimated" ? r.estimate.values.filter((v) => v.shape === "agent" && v.usd_per_b !== null) : []));

const indexPath = join(client, "index.html");
const catalogPath = join(client, "catalog", "index.html");
for (const p of [indexPath, catalogPath]) if (!existsSync(p)) {
  console.error("verify-site: missing " + p + "; run build first");
  process.exit(2);
}
const index = readFileSync(indexPath, "utf8");
const catalogHtml = readFileSync(catalogPath, "utf8");

const main = (h: string) => (h.match(/<main[\s\S]*?<\/main>/) ?? [""])[0];
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tables = (h: string) => [...h.matchAll(/<table[^>]*data-table="unified"[^>]*>[\s\S]*?<\/table>/g)].map((m) => m[0]);
const cells = (h: string) => [...h.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);

// 1. layout order: Section A, then the five model sections in order
const idxA = index.indexOf('data-testid="measured"');
const idxModels = REF_IDS.map((r) => index.indexOf('data-model="' + r + '"'));
if (idxA < 0) fail("Section A table missing");
if (idxModels.some((i) => i < 0)) fail("a model section is missing");
if (idxModels.some((v, i) => i > 0 && v <= idxModels[i - 1])) fail("model sections out of order");
if (idxA >= 0 && idxModels.some((i) => i >= 0 && i < idxA)) fail("model sections appear before Section A");

// 2. Section A: ranked plans, eight headers
const measuredTable = (index.match(/<table[^>]*data-testid="measured"[\s\S]*?<\/table>/) ?? [""])[0];
const headers = (measuredTable.match(/<th\s[^>]*>/g) ?? []).length; // <th followed by whitespace, not <thead>
if (headers !== 8) fail("Section A has " + headers + " header cells, expected 8");
for (const l of lanes) if (!measuredTable.includes('data-row="' + l.lane + '"')) fail("Section A missing plan " + l.lane);
const measuredRows = (measuredTable.match(/data-row="/g) ?? []).length;
if (measuredRows !== lanes.length) fail("Section A has " + measuredRows + " rows, expected " + lanes.length);
if (/data-badge="estimated"/.test(measuredTable)) fail("an estimate leaked into Section A");

// 2b. regression: a plan with a measured value never shows N/A for it; its OR cell is filled when OpenRouter has its model
for (const l of lanes) {
  const row = (measuredTable.match(new RegExp('<tr data-row="' + l.lane + '">([\\s\\S]*?)<\\/tr>')) ?? [])[1] ?? "";
  const cell = (col: string) => (row.match(new RegExp('<td[^>]*data-col="' + col + '"[\\s\\S]*?<\\/td>')) ?? [])[0] ?? ""; // whole cell, attributes included
  if (l.measured.p50_output_tps !== null && /data-na="yes"/.test(cell("tps"))) fail("Section A shows N/A for measured tok/s of " + l.lane);
  if (l.measured.p50_ttft_ms !== null && /data-na="yes"/.test(cell("ttft"))) fail("Section A shows N/A for measured TTFT of " + l.lane);
  const orModel = laneModels.find((m) => m.lane === l.lane)?.openrouter;
  if (orModel && orEndpoints.has(orModel) && /data-na="yes"/.test(cell("or"))) fail("Section A shows N/A for the OR p50 of " + l.lane + " although OpenRouter has " + orModel);
}

// 3. Section B: each model table lists the by-model plans
const modelRowCounts: Record<string, number> = {};
for (const ref of REF_IDS) {
  const t = (index.match(new RegExp('<table[^>]*data-testid="model-' + ref + '"[\\s\\S]*?<\\/table>')) ?? [""])[0];
  if (!t) { fail("model table missing for " + ref); continue; }
  const n = (t.match(/data-row="/g) ?? []).length;
  modelRowCounts[ref] = n;
  if (n !== byModelPlans.length) fail("model table " + ref + " has " + n + " rows, expected " + byModelPlans.length);
  for (const r of byModelPlans) if (!t.includes('data-row="' + r.plan_id + '"')) fail("model table " + ref + " missing plan " + r.plan_id);
}
const estimatedBadges = (index.match(/data-badge="estimated"/g) ?? []).length;
if (estimatedBadges !== estimatedPairs.length) fail("estimated badges " + estimatedBadges + " != estimated (plan, model) values " + estimatedPairs.length);

// 4. one table style: identical header and cell classes across every table on both pages
const styleOf = (t: string) => {
  const th = (t.match(/<thead>[\s\S]*?<tr class="([^"]+)"/) ?? [])[1] ?? "";
  const td = (t.match(/<td class="([^"]+)"/) ?? [])[1] ?? "";
  return th + "|" + td;
};
const allTables = [...tables(index), ...tables(catalogHtml)];
if (allTables.length === 0) fail("no unified tables rendered");
const styles = new Set(allTables.map(styleOf));
if (styles.size !== 1) fail("tables use " + styles.size + " different style sets");

// 5. cells: no empty cell, no dash, every N/A names its reason, no $/B or $0.00 in value cells
let na = 0;
for (const [name, html] of [["index", main(index)], ["catalog", main(catalogHtml)]] as const) {
  if (text(html).includes("—")) fail(name + " shows a dash");
  for (const c of cells(html)) {
    const t = text(c);
    if (t.length === 0) { fail(name + " has an empty cell"); continue; }
    if (/data-na="yes"/.test(c)) {
      na++;
      if (t === "N/A") fail(name + " has a bare N/A with no reason");
    }
    if (!/data-na="yes"/.test(c) && /\$\/B/.test(t)) fail(name + " prints $/B in a value cell");
    if (!/data-na="yes"/.test(c) && /\$0\.00(?!\d)/.test(t)) fail(name + " prints $0.00 in a value cell");
  }
}

// 6. catalog page: one row per catalog row
const catalogTable = (catalogHtml.match(/<table[^>]*data-testid="catalog"[\s\S]*?<\/table>/) ?? [""])[0];
const catalogRows = (catalogTable.match(/data-row="/g) ?? []).length;
if (catalogRows !== catalog.length) fail("catalog page has " + catalogRows + " rows, expected " + catalog.length);

// 7. OpenRouter cells carry their badge
const orCells = (index.match(/data-badge="OR p50"/g) ?? []).length;
if (orCells === 0) fail("no OpenRouter values rendered");

console.log(
  "pages=" + [indexPath, catalogPath].filter(existsSync).length +
    " sectionA_rows=" + measuredRows +
    " models=" + REF_IDS.length + " rows_per_model=" + byModelPlans.length +
    " tables=" + allTables.length + " styles=" + styles.size +
    " estimated=" + estimatedBadges + " or_values=" + orCells + " na_cells=" + na +
    " catalog_rows=" + catalogRows + " zeroed=" + (problems.some((p) => p.includes("$0.00")) ? 1 : 0),
);
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
