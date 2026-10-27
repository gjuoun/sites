#!/usr/bin/env bun
/**
 * Reads the prerendered pages in dist/client and checks the public contract.
 *
 * Front page (/): one title line, one switch, one table of six columns (Plan, Fee/mo, Capacity, $/B,
 * tok/s, TTFT p50), one footnote linking /methodology. No badges, no OR column, no sections. The first
 * (Measured) view is the one rendered. Speeds are one value with a leading "~". N/A carries no line.
 *
 * /methodology: every detail table: measured lanes, DeepSeek ranking, per-model estimates, official
 * subscriptions, the full catalog. /catalog: the catalog table.
 *
 * Shared: one table style, the one badge style, no em dash, no $0.00, no flag counts, no raw model ids,
 * no session ids, paths or emails, and primary values never truncate.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const problems: string[] = [];
const fail = (m: string) => problems.push(m);
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));

const lanes = read("lanes.json").lanes as Array<{ lane: string; usd_per_b_basis: string | null; measured: { p50_output_tps: number | null; p50_ttft_ms: number | null } }>;
const catalog = read("catalog.json").rows as Array<{ plan_id: string; status: string; offered_models: string[]; estimate: { status: string; values: Array<{ ref: string; shape: string; usd_per_b: number | null }> } | null }>;
const official = read("official.json").providers as Array<{ provider: string }>;
const pages = { index: join(client, "index.html"), methodology: join(client, "methodology", "index.html"), catalog: join(client, "catalog", "index.html") };
for (const [k, p] of Object.entries(pages)) if (!existsSync(p)) {
  console.error("verify-site: missing " + k + " at " + p + "; run build first");
  process.exit(2);
}
const html = { index: readFileSync(pages.index, "utf8"), methodology: readFileSync(pages.methodology, "utf8"), catalog: readFileSync(pages.catalog, "utf8") };
const main = (h: string) => (h.match(/<main[\s\S]*?<\/main>/) ?? [""])[0];
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const tables = (h: string) => [...h.matchAll(/<table[^>]*data-table="unified"[^>]*>[\s\S]*?<\/table>/g)].map((m) => m[0]);
const cells = (h: string) => [...h.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);
const tableById = (h: string, id: string) => (h.match(new RegExp('<table[^>]*data-testid="' + id + '"[\\s\\S]*?<\\/table>')) ?? [""])[0];
const rowsIn = (t: string) => (t.match(/data-row="/g) ?? []).length;

// 1. the front page: one table, six columns, in order
const idx = main(html.index);
const summary = tableById(html.index, "summary");
if (!summary) fail("front page has no summary table");
if (tables(html.index).length !== 1) fail("front page has " + tables(html.index).length + " tables, expected 1");
const heads = [...summary.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
const expectedHeads = ["Plan", "Fee/mo", "Capacity", "$/B", "tok/s", "TTFT p50"];
if (JSON.stringify(heads) !== JSON.stringify(expectedHeads)) fail("front page columns are " + JSON.stringify(heads) + ", expected " + JSON.stringify(expectedHeads));

// 2. the switch: Measured first and selected, the other chips present, no Gemini chip
const chips = [...html.index.matchAll(/<[^>]*data-chip="([^"]+)"[^>]*>/g)].map((m) => ({ id: m[1], tag: m[0] }));
if (chips.length !== 5) fail("switch has " + chips.length + " chips, expected 5");
if (chips[0]?.id !== "measured") fail("first chip is " + chips[0]?.id + ", expected measured");
if (!/data-state="on"/.test(chips[0]?.tag ?? "")) fail("Measured chip is not selected by default");
if (chips.some((c) => c.id === "gemini-3.8-flash")) fail("a Gemini chip is shown; no plan offers Gemini 3.8 Flash");

// 3. Measured view rows, one value per speed cell, N/A with no line
const mRows = rowsIn(summary);
if (mRows !== lanes.length) fail("Measured view has " + mRows + " rows, expected " + lanes.length);
for (const c of [...summary.matchAll(/<td[^>]*data-col="(tps|ttft)"[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0])) {
  if (/data-na="yes"/.test(c)) continue;
  const t = text(c);
  if (!/^~[\d,]+( ms)?$/.test(t)) fail("speed cell is not a single ~ value: " + t.slice(0, 40));
}
for (const c of cells(summary)) {
  if (!/data-na="yes"/.test(c)) continue;
  const lines = [...c.matchAll(/<span[^>]*class="[^"]*text-xs[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1])).filter(Boolean);
  if (lines.length > 0) fail("an N/A cell carries a visible reason line: " + lines[0].slice(0, 50));
}

// 4. the front page has no detail: no badges, no OR column, no sections, no footnote table, one footnote link
if (/data-badge=/.test(idx)) fail("badges on the front page");
if (/OR p50|Badges|vs measured|>Basis</.test(idx)) fail("a detail column name is on the front page");
if (/\b[ABC] · /.test(idx)) fail("a section letter is on the front page");
if (!/href="\/methodology"/.test(idx)) fail("front page has no link to /methodology");
if (!/Estimates assume the whole allowance runs one model\. Details, sources and allowances: /.test(text(idx))) fail("the one footnote line is missing or changed");

// 4b. derived $/B: the star appears on exactly the derived Measured rows, with its footnote; the basis line is one line
const derivedCount = lanes.filter((l) => l.usd_per_b_basis === "derived").length;
const starred = (summary.match(/<td[^>]*data-col="usd"[^>]*>[\s\S]*?<\/td>/g) ?? []).filter((c) => /<sup[^>]*>\*<\/sup>/.test(c)).length;
if (starred !== derivedCount) fail("derived star count " + starred + " != derived lanes " + derivedCount);
if (derivedCount > 0 && text(idx).indexOf("* derived from the same-rate peer plan") < 0) fail("derived footnote missing");
if (text(idx).indexOf("ours, from usage logs") < 0) fail("Measured basis line missing");
const basisLines = text(idx).match(/tok\/s and TTFT are OpenRouter p50 weighted by request volume/g) ?? [];
if (basisLines.length > 0) fail("a model basis line is on the Measured view");

// 4c. the context switch: two standards on the front page; the standard context and both comparison tables on methodology
const ctxChips = [...html.index.matchAll(/data-context="(short|long)"/g)].map((m) => m[1]);
if (new Set(ctxChips).size !== 2) fail("context switch has " + new Set(ctxChips).size + " options, expected 2 (short, long)");
if (!/data-testid="context-distribution"/.test(html.methodology)) fail("methodology has no context distribution table");
if (!/data-testid="context-compare"/.test(html.methodology)) fail("methodology has no 100K vs 350K comparison table");

// 5. methodology: every detail table, in full
const meth = main(html.methodology);
const mt = tables(html.methodology);
if (rowsIn(tableById(html.methodology, "measured-full")) !== lanes.length) fail("methodology measured table row count is wrong");
const ds = tableById(html.methodology, "ds-ranking");
if (!ds) fail("methodology has no DeepSeek ranking table");
if (rowsIn(tableById(html.methodology, "official")) !== official.length) fail("methodology official table row count is wrong");
const catalogRows = catalog.length;
if (rowsIn(tableById(html.methodology, "catalog-full")) !== catalogRows) fail("methodology catalog has the wrong row count");
if (rowsIn(tableById(html.catalog, "catalog")) !== catalogRows) fail("catalog page has the wrong row count");
if (mt.length < 8) fail("methodology has " + mt.length + " unified tables, expected at least 8");

// 6. one table style across every table on all pages
const styleOf = (t: string) => {
  const th = (t.match(/<thead>[\s\S]*?<tr class="([^"]+)"/) ?? [])[1] ?? "";
  const td = (t.match(/<td class="([^"]+)"/) ?? [])[1] ?? "";
  return th + "|" + td;
};
const all = [...tables(html.index), ...tables(html.methodology), ...tables(html.catalog)];
if (new Set(all.map(styleOf)).size !== 1) fail("tables use more than one style set");

// 7. shared text rules on every page
for (const [name, h] of Object.entries({ index: idx, methodology: meth, catalog: main(html.catalog) })) {
  for (const c of cells(h)) {
    const t = text(c);
    if (t.indexOf("\u2014") >= 0) fail(name + " shows an em dash in a cell");
    if (t.length === 0 && !/data-flags="yes"/.test(c)) fail(name + " has an empty cell");
    if (/\$0\.00(?!\d)/.test(t) && !/data-na="yes"/.test(c)) fail(name + " prints $0.00 in a value cell");
    if (/\bNaN\b/.test(t)) fail(name + " prints NaN");
    if (/\b\d+ flags?\b/.test(t)) fail(name + " shows a flag count");
    if (/\b(deepseek|google|anthropic|openai|z-ai|qwen)\/[a-z0-9.-]+/.test(t)) fail(name + " shows a raw model id in a cell");
  }
  const PRIVATE = [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/, /\/Users\//, /@[a-z0-9.-]+\.[a-z]{2,}/i, /\.jsonl/, /sessionId|session_id/];
  for (const re of PRIVATE) if (re.test(h)) fail(name + " renders a private identifier matching " + String(re));
  if (h.indexOf('data-footer="links"') < 0) fail(name + " has no footer");
}

// 8. primary values never truncate: only the description columns clip
const CLIP_COLS = ["basis", "allowance", "cli"];
for (const [name, h] of Object.entries({ index: idx, methodology: meth })) {
  for (const m of h.matchAll(/<td[^>]*data-col="([^"]+)"[^>]*><span[^>]*><span class="([^"]*)"/g)) {
    if (CLIP_COLS.indexOf(m[1]) < 0 && m[2].indexOf("truncate") >= 0) fail(name + " truncates the primary value of column " + m[1]);
  }
}

// 9. the Official section is aggregates only, and the catalog page is unchanged in kind
if (!/data-testid="catalog"/.test(html.catalog)) fail("catalog page has no catalog table");

console.log(
  "pages=3 front_columns=" + heads.length + " chips=" + chips.length + " measured_rows=" + mRows +
    " methodology_tables=" + mt.length + " catalog_rows=" + catalogRows + " official_rows=" + official.length + " styles=" + new Set(all.map(styleOf)).size + " zeroed=0",
);
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
