import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * OpenCode Go's own pricing page: the per-model monthly dollar limit for Go and Go Plus. The parser is strict.
 * Any page shape it does not recognise throws, and runOpencodeGo then writes nothing: the previous files stay.
 */
export const OPENCODE_GO_URL = "https://opencode.ai/docs/go";
export const OPENCODE_GO_PARSER = "opencode-go-docs-v1";

export type GoPlan = "Go" | "Go Plus";
/** The two plans, by the id of their pricing tab panel on the page, and the catalog row each one prices. */
export const PLAN_PANELS: Array<{ panel: string; plan: GoPlan; plan_id: string }> = [
  { panel: "go", plan: "Go", plan_id: "opencode-go-go" },
  { panel: "go-plus", plan: "Go Plus", plan_id: "opencode-go-plus" },
];
/** Page model name (the text before its parenthesised variant) mapped to a reference model. Anything not listed keeps ref null. */
export const REF_BY_PAGE_NAME: Record<string, string> = {
  "DeepSeek V4.1 Flash": "deepseek-v4.1-flash",
  "Claude Haiku 5.5": "claude-haiku-5.5",
  "GPT 6 Luna": "gpt-6-luna",
  "GLM-5.3-Flash": "glm-5.3-flash",
};
/** Every reference model that must appear in both plans, or the page has changed shape. */
export const REQUIRED_REFS = Object.values(REF_BY_PAGE_NAME);
const EXPECTED_HEADER = ["Model", "Input", "Output", "Cached Read", "Cached Write", "Monthly limit"];

export type GoModel = {
  model: string;
  base: string;
  ref: string | null;
  input_usd_per_m: number | null;
  output_usd_per_m: number | null;
  cache_read_usd_per_m: number | null;
  cache_write_usd_per_m: number | null;
  prices_raw: string[];
  monthly_limit_usd: number | null;
  limit_raw: string;
};
export type GoPlanData = { plan: GoPlan; plan_id: string; fee_usd_per_month: number; models: GoModel[] };
export type GoParsed = { source: string; fetched_at: string; parser: string; plans: GoPlanData[] };

export class OpencodeGoError extends Error {}
const fail = (message: string): never => {
  throw new OpencodeGoError(message);
};

/** Visible text of an HTML fragment, with the few entities the page uses. */
export function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The HTML of one plan's pricing panel: from its pricing tab panel (by id) to the next tab panel of any kind. */
export function panelOf(html: string, panel: string): string {
  const marker = 'id="go-pricing-panel-' + panel + '"';
  const start = html.indexOf(marker);
  if (start < 0) fail("no pricing panel '" + panel + "' on the page");
  if (html.indexOf(marker, start + 1) >= 0) fail("two pricing panels named '" + panel + "'");
  const next = html.indexOf('role="tabpanel"', start + marker.length);
  return html.slice(start, next < 0 ? html.length : next);
}

function rowsOf(table: string): string[][] {
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => textOf(c[1])));
}

function priceCell(cell: string): number | null {
  if (cell === "-") return null;
  const m = cell.match(/^\$(\d+(?:\.\d+)?)$/);
  return m ? Number(m[1]) : null;
}

function limitCell(cell: string, model: string): { usd: number | null; raw: string } {
  const m = cell.match(/^\$(\d+(?:\.\d+)?)$/);
  if (m) return { usd: Number(m[1]), raw: cell };
  if (/^Unlimited/i.test(cell)) return { usd: null, raw: cell };
  return fail("unparseable monthly limit '" + cell + "' on " + model);
}

/** One plan's table: the header must match exactly, every row must have six cells, and every limit must parse. */
export function parsePlanTable(panelHtml: string, plan: GoPlan): GoModel[] {
  const tables = panelHtml.match(/<table[\s\S]*?<\/table>/g) ?? [];
  if (tables.length !== 1) fail(plan + ": expected one pricing table, found " + tables.length);
  const rows = rowsOf(tables[0] as string);
  if (rows.length < 2) fail(plan + ": pricing table has no model rows");
  if (JSON.stringify(rows[0]) !== JSON.stringify(EXPECTED_HEADER)) fail(plan + ": header is " + JSON.stringify(rows[0]));
  return rows.slice(1).map((cells) => {
    if (cells.length !== 6) fail(plan + ": a row has " + cells.length + " cells, expected 6: " + cells.join(" | "));
    const [model, input, output, cacheRead, cacheWrite, limit] = cells as [string, string, string, string, string, string];
    const base = model.replace(/\s*\(.*\)\s*$/, "").trim();
    const lim = limitCell(limit, model);
    return {
      model,
      base,
      ref: REF_BY_PAGE_NAME[base] ?? null,
      input_usd_per_m: priceCell(input),
      output_usd_per_m: priceCell(output),
      cache_read_usd_per_m: priceCell(cacheRead),
      cache_write_usd_per_m: priceCell(cacheWrite),
      prices_raw: [input, output, cacheRead, cacheWrite],
      monthly_limit_usd: lim.usd,
      limit_raw: lim.raw,
    };
  });
}

/** The plan's monthly fee as the subscription table prints it ("Go $10/month"). */
export function feeOf(html: string, plan: GoPlan): number {
  const text = textOf(html);
  const m = text.match(new RegExp(plan.replace(" ", "\\s+") + "\\s*\\$(\\d+(?:\\.\\d+)?)\\s*/month"));
  if (!m) throw new OpencodeGoError("no monthly fee printed for " + plan);
  return Number(m[1]);
}

/** Parse the whole page. Throws on any unrecognised shape, a missing reference model, or disagreeing limits for one reference model. */
export function parseOpencodeGo(html: string, fetchedAt: string, source: string = OPENCODE_GO_URL): GoParsed {
  const plans = PLAN_PANELS.map(({ panel, plan, plan_id }) => {
    const models = parsePlanTable(panelOf(html, panel), plan);
    for (const ref of REQUIRED_REFS) {
      const limits = models.filter((m) => m.ref === ref).map((m) => m.monthly_limit_usd);
      if (limits.length === 0) fail(plan + ": no row for required reference model " + ref);
      if (limits.some((x) => x === null || x !== limits[0])) fail(plan + ": limits for " + ref + " are not one number: " + limits.join(", "));
    }
    return { plan, plan_id, fee_usd_per_month: feeOf(html, plan), models };
  });
  return { source, fetched_at: fetchedAt, parser: OPENCODE_GO_PARSER, plans };
}

/** Apply a parsed page to the catalog rows: the fee must match the catalog, and each reference model's limit becomes a per-model allowance. */
export function applyToCatalog(catalog: { rows: Array<Record<string, unknown>> }, parsed: GoParsed): { rows: Array<Record<string, unknown>>; allowances: number } {
  let allowances = 0;
  const rows = catalog.rows.map((row) => {
    const p = parsed.plans.find((x) => x.plan_id === row.plan_id);
    if (!p) return row;
    if (row.price_month_usd !== p.fee_usd_per_month) fail(p.plan + ": page fee $" + p.fee_usd_per_month + " differs from the catalog's $" + String(row.price_month_usd));
    const day = parsed.fetched_at.slice(0, 10);
    const seen = new Map<string, { ref: string; usd: number; basis: string }>();
    for (const m of p.models) {
      if (!m.ref || m.monthly_limit_usd === null || seen.has(m.ref)) continue;
      seen.set(m.ref, { ref: m.ref, usd: m.monthly_limit_usd, basis: "OpenCode Go docs (" + parsed.source + ", fetched " + day + "): monthly limit for " + m.base + " is $" + m.monthly_limit_usd });
    }
    allowances += seen.size;
    return { ...row, per_model_limit_plan: p.plan, published_allowance_usd: null, published_allowance_basis: null, allowance: [...seen.values()] };
  });
  return { rows, allowances };
}

function writeAtomic(path: string, text: string): void {
  writeFileSync(path + ".tmp", text, "utf8");
  renameSync(path + ".tmp", path);
}

/** Parse, validate, then write both files. Nothing is written unless every check passes. */
export function runOpencodeGo(input: { html: string; dataDir: string; fetchedAt: string; source?: string }): { plans: number; models: number; refs: number } {
  const parsed = parseOpencodeGo(input.html, input.fetchedAt, input.source ?? OPENCODE_GO_URL);
  const catalogPath = join(input.dataDir, "catalog.json");
  if (!existsSync(catalogPath)) fail("catalog.json not found in " + input.dataDir);
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as { rows: Array<Record<string, unknown>> };
  const applied = applyToCatalog(catalog, parsed);
  const catalogText = JSON.stringify({ ...catalog, rows: applied.rows }, null, 2) + "\n";
  const goText = JSON.stringify(parsed, null, 2) + "\n";
  writeAtomic(catalogPath, catalogText);
  writeAtomic(join(input.dataDir, "opencode-go.json"), goText);
  return { plans: parsed.plans.length, models: parsed.plans.reduce((a, p) => a + p.models.length, 0), refs: applied.allowances };
}
