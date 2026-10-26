#!/usr/bin/env bun
/**
 * Reads the prerendered pages in dist/client and checks the public contract:
 *  - Section A lists the ranked plans, eight columns, measured values never N/A where measured;
 *  - Section B has one table per model that a plan offers (only those plans), in order, or a sentence
 *    where none does; the estimated badges match the stored estimates;
 *  - Section C lists the two official providers, aggregates only;
 *  - every table uses one style; no empty cell, no dash, every N/A names its reason;
 *  - primary values never truncate; no raw model id, session id, path or email in the rendered text.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { REF_IDS } from "../src/data/estimate";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));

const lanes = read("lanes.json").lanes as Array<{ lane: string; usd_per_b: number | null; usd_per_b_basis: string | null; measured: { p50_output_tps: number | null; p50_ttft_ms: number | null } }>;
const laneModels = read("models.json").models as Array<{ lane: string; openrouter: string }>;
const orEndpoints = new Set((read("benchmark.json").endpoints as Array<{ model: string }>).map((e) => e.model));
const catalog = read("catalog.json").rows as Array<{
  plan_id: string;
  allowance_model: string;
  price_month_usd: number | null;
  offered_models: string[];
  estimate: { status: string; values: Array<{ ref: string; shape: string; usd_per_b: number | null }> } | null;
}>;
const official = read("official.json").providers as Array<{ provider: string }>;

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

// 1. layout order: Section A, the model sections in order, then Section C
const idxA = index.indexOf('data-testid="measured"');
const idxModels = REF_IDS.map((r) => index.indexOf('data-model="' + r + '"'));
const idxC = index.indexOf('data-testid="official"');
if (idxA < 0) fail("Section A table missing");
if (idxModels.some((i) => i < 0)) fail("a model section is missing");
if (idxModels.some((v, i) => i > 0 && v <= idxModels[i - 1])) fail("model sections out of order");
if (idxC < 0) fail("Section C table missing");
if (idxC >= 0 && idxModels.some((i) => i > idxC)) fail("a model section appears after Section C");

// 2. Section A: ranked plans, eight headers, measured values shown
const measuredTable = (index.match(/<table[^>]*data-testid="measured"[\s\S]*?<\/table>/) ?? [""])[0];
const headers = (measuredTable.match(/<th\s[^>]*>/g) ?? []).length;
if (headers !== 8) fail("Section A has " + headers + " header cells, expected 8");
for (const l of lanes) {
  const row = (measuredTable.match(new RegExp('<tr data-row="' + l.lane + '">([\\s\\S]*?)<\\/tr>')) ?? [])[0] ?? "";
  if (!row) { fail("Section A missing plan " + l.lane); continue; }
  const cell = (col: string) => (row.match(new RegExp('<td[^>]*data-col="' + col + '"[\\s\\S]*?<\\/td>')) ?? [])[0] ?? "";
  if (l.measured.p50_output_tps !== null && /data-na="yes"/.test(cell("tps"))) fail("Section A shows N/A for measured tok/s of " + l.lane);
  if (l.measured.p50_ttft_ms !== null && /data-na="yes"/.test(cell("ttft"))) fail("Section A shows N/A for measured TTFT of " + l.lane);
  const orModel = laneModels.find((m) => m.lane === l.lane)?.openrouter;
  if (orModel && orEndpoints.has(orModel) && /data-na="yes"/.test(cell("or"))) fail("Section A shows N/A for the OR p50 of " + l.lane + " although OpenRouter has " + orModel);
}
if (/data-badge="estimated"/.test(measuredTable)) fail("an estimate leaked into Section A");

// 3. Section B: a table per offered model, with exactly the plans that offer it; a sentence when none does
let expectedEstimated = 0;
for (const ref of REF_IDS) {
  const offering = catalog.filter((r) => r.offered_models.indexOf(ref) >= 0 && (r.estimate?.status === "estimated" || (r.allowance_model === "credits" && r.price_month_usd !== null)));
  const t = (index.match(new RegExp('<table[^>]*data-testid="model-' + ref + '"[\\s\\S]*?<\\/table>')) ?? [""])[0];
  if (offering.length === 0) {
    if (t) fail("model table " + ref + " exists but no plan offers it");
    if (index.indexOf('data-no-plan="' + ref + '"') < 0) fail("no sentence for " + ref + ", which no plan offers");
    continue;
  }
  if (!t) { fail("model table missing for " + ref); continue; }
  const n = (t.match(/data-row="/g) ?? []).length;
  if (n !== offering.length) fail("model table " + ref + " has " + n + " rows, expected " + offering.length);
  for (const r of offering) if (t.indexOf('data-row="' + r.plan_id + '"') < 0) fail("model table " + ref + " missing plan " + r.plan_id);
  for (const r of offering) {
    if (r.estimate?.status === "estimated" && r.estimate.values.some((v) => v.ref === ref && v.shape === "agent" && v.usd_per_b !== null)) expectedEstimated++;
  }
}
const estimatedBadges = (index.match(/data-badge="estimated"/g) ?? []).length;
if (estimatedBadges !== expectedEstimated) fail("estimated badges " + estimatedBadges + " != estimated values in the tables " + expectedEstimated);

// 4. Section C: two providers, aggregates only
const cTable = (index.match(/<table[^>]*data-testid="official"[\s\S]*?<\/table>/) ?? [""])[0];
const cRows = (cTable.match(/data-row="/g) ?? []).length;
if (cRows !== official.length) fail("Section C has " + cRows + " rows, expected " + official.length);

// 5. one table style across every table on both pages
const styleOf = (t: string) => {
  const th = (t.match(/<thead>[\s\S]*?<tr class="([^"]+)"/) ?? [])[1] ?? "";
  const td = (t.match(/<td class="([^"]+)"/) ?? [])[1] ?? "";
  return th + "|" + td;
};
const allTables = [...tables(index), ...tables(catalogHtml)];
if (allTables.length === 0) fail("no unified tables rendered");
if (new Set(allTables.map(styleOf)).size !== 1) fail("tables use more than one style set");

// 6. cells: no empty cell, no dash, every N/A names its reason, no $/B or $0.00 in value cells
let na = 0;
for (const [name, html] of [["index", main(index)], ["catalog", main(catalogHtml)]] as const) {
  if (text(html).indexOf("\u2014") >= 0) fail(name + " shows a dash");
  for (const c of cells(html)) {
    const t = text(c);
    if (t.length === 0) { if (!/data-flags="yes"/.test(c)) fail(name + " has an empty cell"); continue; }
    const isNa = /data-na="yes"/.test(c);
    if (isNa) { na++; if (t === "N/A") fail(name + " has a bare N/A with no reason"); }
    if (!isNa && /\$\/B/.test(t)) fail(name + " prints $/B in a value cell");
    if (!isNa && /\$0\.00(?!\d)/.test(t)) fail(name + " prints $0.00 in a value cell");
    if (/\bNaN\b/.test(t)) fail(name + " prints NaN");
  }
}

// 7. catalog page: one row per catalog row
const catalogTable = (catalogHtml.match(/<table[^>]*data-testid="catalog"[\s\S]*?<\/table>/) ?? [""])[0];
const catalogRows = (catalogTable.match(/data-row="/g) ?? []).length;
if (catalogRows !== catalog.length) fail("catalog page has " + catalogRows + " rows, expected " + catalog.length);

// 8. badges: three variants, one class base; flags named and never counted; one OR marker per speed cell
const badgeRe = /data-badge="([^"]+)" data-badge-variant="([^"]+)"/g;
const badges = [...index.matchAll(badgeRe), ...catalogHtml.matchAll(badgeRe)];
const variants = new Set(badges.map((m) => m[2]));
if (variants.size > 3 || [...variants].some((v) => ["source", "confidence", "status"].indexOf(v) < 0)) fail("badge variants are " + [...variants].join(", ") + "; expected at most source, confidence, status");
const baseClass = "inline-flex h-5 items-center whitespace-nowrap rounded-md border px-1.5 text-[11px] font-medium leading-none";
const baseCount = (index.split(baseClass).length - 1) + (catalogHtml.split(baseClass).length - 1);
if (baseCount !== badges.length) fail("badges share one class base: " + baseCount + " of " + badges.length + " carry it");
if (/data-badge="window_saturated"/.test(index + catalogHtml)) fail("window_saturated repeated as a badge");
const RAW = /\b(deepseek|google|anthropic|openai|z-ai|qwen)\/[a-z0-9.-]+/;
for (const [name, html] of [["index", index], ["catalog", catalogHtml]] as const) {
  for (const c of cells(html)) {
    const t = text(c);
    if (/\b\d+ flags?\b/.test(t)) fail(name + " shows a flag count: " + t.slice(0, 60));
    if (RAW.test(t)) fail(name + " shows a raw model id in a cell: " + t.slice(0, 60));
  }
}
const speedCellsOk = [...index.matchAll(/<td[^>]*data-col="(tps|ttft)"[\s\S]*?<\/td>/g)].every((m) => (m[0].match(/data-badge="/g) ?? []).length <= 1);
if (!speedCellsOk) fail("a speed cell carries more than one badge");

// 9. primary values never truncate; only the description columns clip
const CLIP_COLS = ["basis", "allowance", "cli"];
for (const [name, html] of [["index", index], ["catalog", catalogHtml]] as const) {
  for (const m of html.matchAll(/<td[^>]*data-col="([^"]+)"[^>]*><span[^>]*><span class="([^"]*)"/g)) {
    if (CLIP_COLS.indexOf(m[1]) < 0 && m[2].indexOf("truncate") >= 0) fail(name + " truncates the primary value of column " + m[1]);
  }
}

// 10. footer on every page
for (const [name, html] of [["index", index], ["catalog", catalogHtml]] as const) {
  if (html.indexOf('data-footer="links"') < 0) fail(name + " has no footer");
}

// 11. privacy: no session id, path, email or local log name in the rendered text
const PRIVATE = [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/, /\/Users\//, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\.jsonl/, /sessionId|session_id/];
for (const [name, html] of [["index", main(index)], ["catalog", main(catalogHtml)]] as const) {
  for (const re of PRIVATE) if (re.test(html)) fail(name + " renders a private identifier matching " + String(re));
}

// 12. OpenRouter cells carry their badge
if ((index.match(/data-badge="OR p50"/g) ?? []).length === 0) fail("no OpenRouter values rendered");

console.log(
  "pages=" + [indexPath, catalogPath].filter(existsSync).length +
    " sectionA_rows=" + lanes.length +
    " models_with_table=" + REF_IDS.filter((r) => catalog.some((c) => c.offered_models.indexOf(r) >= 0 && (c.estimate?.status === "estimated" || (c.allowance_model === "credits" && c.price_month_usd !== null)))).length + "/" + REF_IDS.length +
    " sectionC_rows=" + cRows + " tables=" + allTables.length + " styles=" + new Set(allTables.map(styleOf)).size +
    " estimated=" + estimatedBadges + " na_cells=" + na + " catalog_rows=" + catalogRows + " zeroed=0",
);
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
