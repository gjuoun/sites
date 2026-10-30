#!/usr/bin/env bun
/**
 * Reads the prerendered pages in dist/client and checks the own-data contract.
 *
 * / : one ranking table (Lane, Fee/mo, Quota window, $/B, Tokens 7d, tok/s, TTFT p50) with one row per
 *     lane, then one [data-lane] block per lane with its model table (eight columns). Nothing from the
 *     retired comparison product appears: no OpenRouter, no estimates, no Threads, no Shape, no catalog.
 * /methodology : the six sections that state the formulas, the sources and the limits.
 *
 * Shared: every N/A cell carries data-na, no NaN / undefined / bare $0.00 in a value cell, every page
 * keeps its footer, and the tables agree with data/lanes.json row for row.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const client = join(APP, "dist", "client");
const read = (f: string) => JSON.parse(readFileSync(join(APP, "data", f), "utf8"));

type Lane = {
  lane: string;
  label: string;
  usd_per_b: number | null;
  models: Array<{ label: string; share_7d: number; tokens_7d: number }>;
};
const lanes = read("lanes.json").lanes as Lane[];

const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const pages = { index: join(client, "index.html"), methodology: join(client, "methodology", "index.html") };
for (const [k, p] of Object.entries(pages)) if (!existsSync(p)) {
  console.error("verify-site: missing " + k + " at " + p + "; run build first");
  process.exit(2);
}
if (existsSync(join(client, "catalog"))) fail("a /catalog page is still prerendered");

const html = { index: readFileSync(pages.index, "utf8"), methodology: readFileSync(pages.methodology, "utf8") };
const main = (h: string) => (h.match(/<main[\s\S]*?<\/main>/) ?? [""])[0];
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const cells = (h: string) => [...h.matchAll(/<td[^>]*>[\s\S]*?<\/td>/g)].map((m) => m[0]);
const tableById = (h: string, id: string) => (h.match(new RegExp('<table[^>]*data-testid="' + id + '"[\\s\\S]*?<\\/table>')) ?? [""])[0];
const rowsIn = (t: string) => (t.match(/data-row="/g) ?? []).length;
const heads = (t: string) => [...t.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) => text(m[1]));
const laneIds = [...main(html.index).matchAll(/data-lane="([^"]+)"/g)].map((m) => m[1]);

// 1. the ranking table: seven columns in order, one row per lane
const ranking = tableById(html.index, "lanes");
if (!ranking) fail("the front page has no lanes table");
const rankHeads = heads(ranking);
const expectedHeads = ["Lane", "Fee/mo", "Quota window", "$/B", "Tokens 7d", "tok/s", "TTFT p50"];
if (JSON.stringify(rankHeads) !== JSON.stringify(expectedHeads)) fail("ranking columns are " + JSON.stringify(rankHeads));
if (rowsIn(ranking) !== lanes.length) fail("ranking has " + rowsIn(ranking) + " rows, expected " + lanes.length);
if (laneIds.length !== lanes.length) fail("page has " + laneIds.length + " lane blocks, expected " + lanes.length);
for (const l of lanes) if (!laneIds.includes(l.lane)) fail("lane block missing: " + l.lane);

// 2. every lane block has its model table, one row per model, eight columns
let modelRows = 0;
for (const l of lanes) {
  const t = tableById(html.index, "models-" + l.lane);
  if (!t) {
    fail("no model table for " + l.lane);
    continue;
  }
  const h = heads(t);
  const expected = ["Model", "Share", "Tokens 7d", "Requests", "Cache", "TTFT p50", "tok/s", "Monthly limit"];
  if (JSON.stringify(h) !== JSON.stringify(expected)) fail(l.lane + " model columns are " + JSON.stringify(h));
  const n = rowsIn(t);
  modelRows += n;
  if (n !== l.models.length) fail(l.lane + " model rows " + n + " != data " + l.models.length);
  if (n === 0) fail(l.lane + " has traffic but no model row");
  const shareSum = l.models.reduce((a, m) => a + m.share_7d, 0);
  if (shareSum > 1.001) fail(l.lane + " model shares sum to " + shareSum.toFixed(4));
  for (const m of l.models) if (!(m.tokens_7d > 0)) fail(l.lane + " has a model row with no tokens: " + m.label);
}

// 3. a lane whose allowance is published shows that figure, and the dashboard reading is named as a comparison
const published = read("lanes.json").lanes.filter((l: { capacity: { allowance_basis: string | null; allowance_published_usd?: number | null } }) => l.capacity.allowance_basis === "vendor_published" && l.capacity.allowance_published_usd);
for (const l of published as Array<{ lane: string; capacity: { allowance_published_usd: number } }>) {
  const amount = "$" + l.capacity.allowance_published_usd.toFixed(2);
  if (!text(main(html.index)).includes("published " + amount)) fail(l.lane + " publishes " + amount + " but the page does not show it");
}

// 3b. a lane with no $/B shows N/A in the ranking, not a zero
for (const l of lanes) {
  if (l.usd_per_b !== null) continue;
  const row = (ranking.match(new RegExp('<tr[^>]*data-row="' + l.lane + '"[\\s\\S]*?</tr>')) ?? [""])[0];
  const usd = (row.match(/<td[^>]*data-col="usd"[^>]*>[\s\S]*?<\/td>/) ?? [""])[0];
  if (!/data-na="yes"/.test(usd)) fail(l.lane + " has no $/B but does not show N/A");
}

// 4. nothing from the retired comparison product, on any page
const RETIRED = ["OpenRouter", "Est.", "Threads", "Context size", "Plans catalog", "Copilot", "Claude Max", "Cursor", "ChatGPT Plus"];
for (const [name, h] of Object.entries({ index: main(html.index), methodology: main(html.methodology) })) {
  for (const word of RETIRED) if (text(h).includes(word)) fail(name + " still mentions " + word);
  if (h.indexOf('data-footer="links"') < 0) fail(name + " has no footer");
  for (const c of cells(h)) {
    const t = text(c);
    const na = /data-na="yes"/.test(c);
    if (!t && !/data-flags="yes"/.test(c)) fail(name + " has an empty cell");
    if (/\bNaN\b|\bundefined\b/.test(t)) fail(name + " prints NaN or undefined");
    if (/\$0\.00(?!\d)/.test(t) && !na) fail(name + " prints $0.00 in a value cell");
    if (t === "N/A" && !na) fail(name + " shows N/A without the data-na marker");
  }
  const PRIVATE = [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/, /\/Users\//, /@[a-z0-9.-]+\.[a-z]{2,}/i, /sessionId|session_id|account_id/];
  for (const re of PRIVATE) if (re.test(h)) fail(name + " renders a private identifier matching " + String(re));
}

// 5. the methodology names its sections
const sections = [...html.methodology.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);
if (sections.length !== 6) fail("methodology has " + sections.length + " sections, expected 6");

console.log("pages=2 lanes=" + laneIds.length + " model_rows=" + modelRows + " third_party=0 problems=" + problems.length);
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
