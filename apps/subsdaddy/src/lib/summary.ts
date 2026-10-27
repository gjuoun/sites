import shapesRaw from "../../data/shapes.json";
import { shapesFileSchema, mixOf, type ShapeDef } from "../data/shapes";
import { priceAt, blendedUsdPerB, type RefPrice } from "../data/estimate";

/** The Shape switch: the token mixes every plan is priced at (data/shapes.json). */
export const ALL_SHAPES: ShapeDef[] = shapesFileSchema.parse(shapesRaw).shapes;
/** The Shape switch offers the enabled shapes; a disabled one (the local collector's) is data, not UI. */
export const SHAPES: ShapeDef[] = ALL_SHAPES.filter((x) => x.enabled);
export const DEFAULT_SHAPE_ID = shapesFileSchema.parse(shapesRaw).default;
export const DEFAULT_SHAPE: ShapeDef = SHAPES.find((s) => s.id === DEFAULT_SHAPE_ID) ?? SHAPES[0];

import { na, value, type BadgeKind, type Cell } from "./cells";
import { REF_IDS, REF_NAMES, pooledMix, type RefId } from "../data/estimate";
import { contextLabel, type ContextId } from "../data/context";
import { CONTEXTS, WINDOWS_PER_DAY, monthlyTokens, tokensPerMessage, usdPerBOfTokens } from "../data/messages";
import type { CatalogRow } from "../data/catalog";
import { orForModel } from "./or-stats";
import { money, usd, type Column, type DS, type Table } from "./sections";

/**
 * The front page: one table for one view at a time. The views are Measured (our own traffic) and one
 * per reference model that some plan offers. The context switch (100K or 350K) sets the prompt length
 * the model prices are read at; Measured $/B is what the plan delivered, so it does not depend on it.
 *
 * Each plan's model $/B uses its own measured traffic shape: its own cache-read share and its own allowance.
 * The Measured view takes a derived $/B from its same-rate peer when the plan's own window is saturated.
 * Marks: * a derived $/B (its lane is derived); dagger, a $/B converted from vendor message limits.
 * Every number is a single value; a missing value is N/A. The footnote carries at most four lines: the view's marks, the allowance legend and the collector note.
 */

export const MEASURED = "measured" as const;
export type ViewId = typeof MEASURED | RefId;
export type Chip = { id: ViewId; label: string; rows: number };

export const DERIVED_FOOTNOTE = "* derived from the same-rate peer plan — this plan's own window is saturated";
export const CONVERTED_FOOTNOTE = (ctx: ContextId) => "† converted from vendor message limits at " + contextLabel(ctx) + " context per message";
export const ARCHIVED_FOOTNOTE = (ctx: ContextId) => "‡ converted from vendor prompt-count guidance (2025 archive) at " + contextLabel(ctx) + " context per prompt";

export const SUMMARY_COLUMNS: Column[] = [
  { key: "plan", label: "Plan", width: "26%" },
  { key: "fee", label: "Fee/mo", width: "10%", numeric: true },
  { key: "allowance", label: "Allowance", width: "15%", numeric: true },
  { key: "capacity", label: "Capacity", width: "14%", numeric: true },
  { key: "usd", label: "$/B", width: "12%", numeric: true },
  { key: "tps", label: "tok/s", width: "12%", numeric: true },
  { key: "ttft", label: "TTFT p50", width: "11%", numeric: true },
];

/** A weighted median: the value at which half of the total weight lies at or below it (ascending order). */
export function weightedMedian(pairs: Array<{ value: number; weight: number }>): number | null {
  const v = pairs.filter((p) => p.weight > 0).sort((a, b) => a.value - b.value);
  const total = v.reduce((a, p) => a + p.weight, 0);
  if (total <= 0) return null;
  let acc = 0;
  for (const p of v) {
    acc += p.weight;
    if (acc >= total / 2) return p.value;
  }
  return v[v.length - 1].value;
}

/** Two significant figures, grouped: 126 -> 130, 3700 -> 3,700, 520 -> 520. */
export function sig2(v: number): string {
  return Number(v.toPrecision(2)).toLocaleString("en-US");
}

export function orModelOf(ds: DS, ref: RefId): string | null {
  return ds.models.reference.find((r) => r.ref === ref)?.openrouter ?? null;
}

/**
 * Cache read as a share of prompt tokens (input + cache write + cache read): the measured traffic shape of one
 * lane, or of all lanes pooled when the plan has no lane of its own.
 */
export function cacheShare(ds: DS, lane: string | null): { share: number; scope: string } {
  const pooled = pooledMix(ds.usage.lanes.map((l) => ({ tokens: l.tokens })));
  const own = lane ? ds.usage.lanes.find((l) => l.lane === lane) : undefined;
  if (!own) return { share: pooled.agent_cache_share, scope: "pooled over all four lanes; this plan has no lane of its own" };
  return { share: pooledMix([{ tokens: own.tokens }]).agent_cache_share, scope: "its own lane " + own.lane };
}

/** Whether the plan's own lane has a derived $/B (its own window is saturated). */
export function isDerivedLane(ds: DS, lane: string | null): boolean {
  if (!lane) return false;
  return ds.lanes.lanes.find((l) => l.lane === lane)?.usd_per_b_basis === "derived";
}

export type Sup = "p" | "r" | "d" | "c" | "h";
export type AllowanceCell = { usd: number; cycle: number; sup: Sup; title: string };

/** A credit-denominated allowance (QwenCloud credits, Copilot base credits) is c, whatever its basis says. */
export function isCreditRow(r: CatalogRow | undefined): boolean {
  return !!r && ((r.credits_to_usd !== null && r.credits_to_usd !== undefined) || r.allowance_model === "credits");
}
/** The source marker: p published, r vendor reading, d derived from quota windows, c credit value. */
export function supOf(basis: string | null | undefined, credit: boolean): Sup | null {
  if (basis === "credits") return "c";
  if (basis === "vendor_published" || basis === "vendor_published_per_model") return "p";
  if (basis === "vendor_hours") return "h";
  if (basis === "vendor_reported") return "r";
  if (basis === "derived") return credit ? "c" : "d";
  return null;
}
export const creditRowOfLane = (ds: DS, lane: string): CatalogRow | undefined => ds.catalog.rows.find((r) => r.measured_lane === lane) as CatalogRow | undefined;

/** Every source of a lane's allowance on one line: the published figure, the dashboard pool, the derived figure. */
export function allowanceTitleOf(c: DsLane["capacity"]): string {
  const parts: string[] = [];
  if (c.allowance_published_usd !== null && c.allowance_published_usd !== undefined) parts.push("published $" + c.allowance_published_usd.toFixed(2));
  if (c.allowance_vendor_usd !== null && c.allowance_vendor_usd !== undefined) {
    const m = c.windows.find((w) => w.window === "monthly");
    parts.push("dashboard pool $" + c.allowance_vendor_usd.toFixed(2) + (m ? " (" + Math.round(m.used_pct) + "% used)" : ""));
  }
  if (c.allowance_derived_usd !== null && c.allowance_derived_usd !== undefined) parts.push("derived $" + c.allowance_derived_usd.toFixed(2));
  return parts.join(" · ");
}
/** A lane's allowance per cycle, with the basis the build recorded. */
export function laneAllowance(ds: DS, l: DsLane): AllowanceCell | null {
  const c = l.capacity as DsLane["capacity"];
  const usd = c.allowance_usd_per_cycle;
  if (usd === null || usd === undefined) return null;
  const sup = supOf(c.allowance_basis, isCreditRow(creditRowOfLane(ds, l.lane)));
  if (!sup) return null;
  return { usd, cycle: c.cycle_days ?? 30, sup, title: allowanceTitleOf(c) };
}
/** One lane's cache mix from its usage: cache read over prompt tokens (usage.json cache_share), the other parts, and the request count. */
export function cacheMixOf(ds: DS, lane: string): { share: number; short: string; line: string } | null {
  const u = ds.usage.lanes.find((x) => x.lane === lane);
  if (!u) return null;
  const t = u.tokens;
  const prompt = t.input + t.cache_creation + t.cache_read;
  const all = prompt + t.output;
  const p = (n: number, d: number) => (d > 0 ? ((n / d) * 100).toFixed(1) + "%" : "N/A");
  if (u.cache_share === null || u.cache_share === undefined) return null;
  const share = u.cache_share;
  return {
    share,
    short: "cache " + (share * 100).toFixed(1) + "%",
    line: "cache read " + (share * 100).toFixed(1) + "% of prompt · fresh input " + p(t.input + t.cache_creation, prompt) + " of prompt · output " + p(t.output, all) + " of all tokens · " + u.rows.toLocaleString("en-US") + " requests in window",
  };
}
export const withSup = (c: Cell, sup: Sup): Cell => ({ ...c, sup });
const pct = (s: number) => Math.round(s * 100) + "%";

type ViewRow = {
  key: string; label: string; fee: number; capacity: string | null; capacityReason: string; capDetail?: string[] | null; capNote?: string | null; capBadges?: BadgeKind[];
  allowance: AllowanceCell | null; allowanceReason: string;
  usd: number | null; usdTitle: string; marker: "" | "*" | "†" | "‡";
  tps: number | null; tpsTitle: string; ttft: number | null; ttftTitle: string;
};

/** OpenRouter's traffic-weighted p50 for one model: tok/s and TTFT, one value each. */
export function orWeighted(ds: DS, ref: RefId): { tps: number | null; ttft: number | null; title: string; reason: string | null } {
  const orId = orModelOf(ds, ref);
  if (!orId) return { tps: null, ttft: null, title: "", reason: "no OpenRouter model mapped" };
  const or = orForModel(ds.benchmark, orId);
  if (!or.summary) return { tps: null, ttft: null, title: "", reason: or.reason };
  const eps = ds.benchmark.endpoints.filter((e) => e.model === orId);
  const requests = eps.reduce((a, e) => a + (e.request_count ?? 0), 0);
  const tps = weightedMedian(eps.filter((e) => e.p50_throughput !== null).map((e) => ({ value: e.p50_throughput as number, weight: e.request_count ?? 0 })));
  const ttft = weightedMedian(eps.filter((e) => e.p50_latency_ms !== null).map((e) => ({ value: e.p50_latency_ms as number, weight: e.request_count ?? 0 })));
  return { tps, ttft, title: orId + " · " + eps.length + " endpoints · " + requests.toLocaleString("en-US") + " requests", reason: null };
}

type DsLane = DS["lanes"]["lanes"][number];

/** The capacity hover panel: the windows, the allowance (vendor-reported and derived), the binding window and the model mix. */
export function capDetailOf(l: DsLane): string[] {
  const c = l.capacity as DsLane["capacity"];
  const lines: string[] = c.windows.map((w) => {
    const head = w.window + " · used " + w.used_pct.toFixed(1) + "% · " + w.status;
    if (w.tokens <= 0) return head;
    const cost = "$" + w.cost_usd.toFixed(2) + " at list · " + (w.tokens / 1e9).toFixed(2) + "B in window · " + Math.round(w.unpriced_share * 100) + "% unpriced";
    const allow = w.allowance_usd_cycle === null ? "" : " · allowance $" + w.allowance_usd_cycle.toFixed(2) + " per cycle";
    return head + " · " + cost + allow;
  });
  if (c.tokens_per_cycle !== null) lines.push("binding: " + c.window + " window · cycle " + c.cycle_days + " days" + (c.cycle_billed ? "" : " · fee " + (c.fee_basis ?? "not read")));
  const published = c.allowance_published_usd ?? null;
  const vendor = c.allowance_vendor_usd ?? null;
  const derived = c.allowance_derived_usd ?? null;
  const unpricedNote = c.unpriced_share === null || c.unpriced_share === undefined || c.unpriced_share === 0 ? "" : ", includes " + Math.round(c.unpriced_share * 100) + "% unpriced";
  if (published !== null) {
    lines.push("published allowance: $" + published.toFixed(2) + " per cycle (used by the model views)");
    if (vendor !== null) lines.push("dashboard pool: $" + vendor.toFixed(2) + " (matches the monthly window): recorded as a difference from the published figure");
    if (derived !== null) lines.push("derived: $" + derived.toFixed(2) + " (from the quota windows" + unpricedNote + ")");
  } else if (vendor !== null && derived !== null) {
    lines.push("vendor-reported pool: $" + vendor.toFixed(2) + " per cycle (used by the model views)");
    lines.push("derived: $" + derived.toFixed(2) + " (lower estimate" + unpricedNote + ")");
  } else if (derived !== null) {
    lines.push("allowance: derived $" + derived.toFixed(2) + " per cycle" + (c.allowance_vendor_reason ? " (" + c.allowance_vendor_reason + ")" : ""));
  }
  const binding = c.windows.find((w) => w.window === c.window);
  if (c.confidence === "low" && binding) lines.push("used " + Math.round(binding.used_pct) + "% — capacity estimate has a wide error bar");
  if (c.top_models.length > 0) lines.push("model mix (binding window): " + c.top_models.map((m) => m.label + " " + Math.round(m.share * 100) + "%").join(", "));
  if (c.low_coverage) lines.push("low coverage: more than 5% of the binding window's tokens have no list price");
  return lines;
}

export function capNoteOf(l: DsLane): string | null {
  const c = l.capacity as DsLane["capacity"];
  if (c.tokens_per_cycle === null) return null;
  const parts = [c.window + " window" + (c.cycle_billed ? " binds" : " (weekly cap)")];
  if (c.confidence === "low") parts.push("low confidence");
  return parts.join(" · ");
}

const withDetail = (cell: Cell, detail: string[] | null): Cell => (detail && detail.length > 0 ? { ...cell, detail } : cell);

function measuredRows(ds: DS): ViewRow[] {
  return ds.lanes.lanes.map((l) => {
    const cm = cacheMixOf(ds, l.lane);
    const sourceNote = l.usd_per_b === null ? (l.capacity.reason ?? "no measured $/B") : (l.usd_per_b_basis === "derived" ? "derived: " : "") + (l.usd_per_b_source ?? "measured $/B");
    return {
      key: l.lane,
      label: l.label,
      fee: l.price_month_usd,
      capacity: l.capacity.tokens_per_cycle === null ? null : (l.capacity.tokens_per_cycle / 1e9).toFixed(2) + "B/" + l.capacity.cycle_days + "d",
      capDetail: capDetailOf(l),
      capNote: cm ? cm.short : null,
      capBadges: l.capacity.confidence === "low" ? ["low confidence"] : [],
      capacityReason: l.capacity.reason ?? "no capacity reading",
      allowance: laneAllowance(ds, l),
      allowanceReason: "no allowance reading for this lane",
      usd: l.usd_per_b,
      usdTitle: sourceNote + " · " + (cm ? cm.line : "own traffic"),
      marker: l.usd_per_b_basis === "derived" ? "*" : "",
      tps: l.measured.p50_output_tps,
      tpsTitle: "our usage logs, p50 output tok/s",
      ttft: l.measured.p50_ttft_ms,
      ttftTitle: "our usage logs, p50 time to first token",
    };
  });
}
/** A plan published as messages per five-hour window: its value at the lower bound of the vendor range, realistic rhythm. Its allowance is the list value of that capacity. */
function messageRow(r: CatalogRow, ref: RefId, ctx: ContextId, ds: DS, shape: ShapeDef): ViewRow | null {
  const ml = r.message_limit;
  if (!ml || ml.model !== ref || r.price_month_usd === null) return null;
  const fee = r.price_month_usd;
  const low = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.realistic, "low");
  const high = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.realistic, "high");
  const ceiling = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.ceiling, "low");
  const usdVal = usdPerBOfTokens(fee, low);
  const k = (n: number) => n.toLocaleString("en-US");
  const refRow = ds.models.reference.find((x) => x.ref === ref);
  const blend = refRow ? shapeUsd({ fee: 1, allowance: 1, price: refRow as unknown as RefPrice, ctx_tokens: CONTEXTS[ctx], shape }).blend : null;
  const listUsd = blend === null ? null : (low / 1e9) * blend;
  return {
    key: r.plan_id,
    label: r.label,
    fee,
    capacity: (low / 1e9).toFixed(2) + "B/mo",
    capacityReason: "",
    allowance: listUsd === null ? null : { usd: listUsd, cycle: 30, sup: "d", title: "list value of the monthly capacity (" + (low / 1e9).toFixed(2) + "B tokens) at " + REF_NAMES[ref] + " list price, " + shape.label },
    allowanceReason: "no list price for " + REF_NAMES[ref],
    usd: usdVal,
    usdTitle: "converted at the lower bound: " + k(ml.low) + " messages per 5h × 3 windows a day × 30 days × " + k(tokensPerMessage(CONTEXTS[ctx])) + " tokens per message (" + contextLabel(ctx) + " context); upper bound " + k(ml.high) + " messages gives " + usdPerBOfTokens(fee, high).toFixed(2) + " $/B; ceiling (4.8 windows a day) at the lower bound gives " + usdPerBOfTokens(fee, ceiling).toFixed(2) + " $/B",
    marker: ml.unit === "prompts" ? "‡" : "†",
    tps: null,
    tpsTitle: "",
    ttft: null,
    ttftTitle: "",
  };
}

/** One value under a shape: the blended list $/B at the context, the tokens an allowance buys, and the $/B of the fee. */
export function shapeUsd(input: { fee: number; allowance: number; price: RefPrice; ctx_tokens: number; shape: ShapeDef }): { usd: number; tokens_b: number; blend: number; band: string } {
  const p = priceAt(input.price, input.ctx_tokens);
  const blend = blendedUsdPerB(p.price, mixOf(input.shape));
  const tokensB = input.allowance / blend;
  return { usd: input.fee / tokensB, tokens_b: tokensB, blend, band: p.band };
}

function modelRows(ds: DS, ref: RefId, ctx: ContextId, shape: ShapeDef): ViewRow[] {
  const or = orWeighted(ds, ref);
  const out: ViewRow[] = [];
  for (const r of ds.catalog.rows) {
    if (r.status !== "catalog" || !r.offered_models.includes(ref) || r.price_month_usd === null) continue;
    const msg = messageRow(r, ref, ctx, ds, shape);
    if (msg) {
      msg.tps = or.tps;
      msg.tpsTitle = or.title || (or.reason ?? "no OpenRouter data");
      msg.ttft = or.ttft;
      msg.ttftTitle = msg.tpsTitle;
      out.push(msg);
      continue;
    }
    // the value's own allowance, fee and price, re-blended under the chosen shape; no allowance means N/A with its reason
    const v = r.estimate?.status === "estimated" ? r.estimate.values.find((x) => x.ref === ref && x.shape === "agent") : undefined;
    const reason = r.estimate?.reason ?? "no estimate for this model";
    let usdVal: number | null = null;
    let capacity: string | null = null;
    let band: string | null = null;
    if (v && v.allowance_usd && v.fee_usd && v.price_used) {
      const x = shapeUsd({ fee: v.fee_usd, allowance: v.allowance_usd, price: v.price_used as RefPrice, ctx_tokens: CONTEXTS[ctx], shape });
      usdVal = x.usd;
      capacity = x.tokens_b.toFixed(2) + "B/mo";
      band = x.band;
    }
    const laneRow = r.measured_lane ? ds.lanes.lanes.find((l) => l.lane === r.measured_lane) : undefined;
    let allowance: AllowanceCell | null = null;
    if (v && v.allowance_usd && v.allowance_basis) {
      const sup = supOf(v.allowance_basis, isCreditRow(r));
      const wild = r.allowance.find((x) => x.ref === "*");
      if (sup) allowance = { usd: v.allowance_usd, cycle: v.allowance_cycle_days ?? 30, sup, title: laneRow ? allowanceTitleOf(laneRow.capacity as DsLane["capacity"]) : sup === "h" && wild ? wild.basis : "published $" + v.allowance_usd.toFixed(2) };
    }
    out.push({
      key: r.plan_id,
      label: r.label,
      fee: r.price_month_usd,
      capacity,
      capacityReason: reason,
      capDetail: null,
      capNote: null,
      allowance,
      allowanceReason: reason,
      usd: usdVal,
      usdTitle: usdVal === null ? reason : "fee ÷ (allowance ÷ blended list $/B) for " + REF_NAMES[ref] + " at a " + contextLabel(ctx) + "-token context, " + shape.label + (band ? "; prices " + band : ""),
      marker: "",
      tps: or.tps,
      tpsTitle: or.title || (or.reason ?? "no OpenRouter data"),
      ttft: or.ttft,
      ttftTitle: or.title || (or.reason ?? "no OpenRouter data"),
    });
  }
  return out;
}
export function viewRows(ds: DS, view: ViewId, ctx: ContextId = "short", shape: ShapeDef = DEFAULT_SHAPE): ViewRow[] {
  const rows = view === MEASURED ? measuredRows(ds) : modelRows(ds, view, ctx, shape);
  return rows.sort((a, b) => (a.usd ?? Infinity) - (b.usd ?? Infinity) || a.label.localeCompare(b.label));
}

/** The chips: Measured, then each reference model that at least one plan offers with a row. */
export function viewChips(ds: DS): Chip[] {
  const chips: Chip[] = [{ id: MEASURED, label: "Measured (own traffic)", rows: ds.lanes.lanes.length }];
  for (const ref of REF_IDS) {
    const n = viewRows(ds, ref).length;
    if (n > 0) chips.push({ id: ref, label: REF_NAMES[ref], rows: n });
  }
  return chips;
}

/** The speed basis, one line under the switch. */
export function basisLine(ds: DS, view: ViewId): string {
  if (view === MEASURED) return "ours, from usage logs";
  return "tok/s and TTFT are OpenRouter p50 weighted by request volume for " + (orModelOf(ds, view) ?? "") + " (30-minute window)";
}

export type SummaryTable = Table & { rows: Array<{ key: string; cells: Record<string, Cell> }>; footnote: string | null; basisLine: string };

const naShort = (reason: string): Cell => ({ ...na(reason), reason: "" });

export const BRING_YOUR_OWN = "Bring your own shape: a local collector is planned; the site will price every plan against your own cache share.";
export const MEASURED_FOOTNOTE = "Measured $/B is per plan and reflects that plans own cache share; use Shape to compare on equal terms.";
export const SHAPE_FOOTNOTE = "Shape sets the token mix used to price every plan; Measured uses each plans own traffic.";

/** The one-line legend of the four allowance sources, each with a real example from the data. */
export function allowanceLegend(ds: DS): string {
  const lanes = ds.lanes.lanes;
  const pub = lanes.find((l) => l.capacity.allowance_published_usd !== null && l.capacity.allowance_published_usd !== undefined);
  const pool = lanes.find((l) => l.capacity.allowance_vendor_usd !== null && l.capacity.allowance_vendor_usd !== undefined);
  const der = lanes.find((l) => l.capacity.allowance_basis === "derived" && !isCreditRow(creditRowOfLane(ds, l.lane)));
  const cr = lanes.find((l) => l.capacity.allowance_basis === "derived" && isCreditRow(creditRowOfLane(ds, l.lane)));
  const perCredit = cr ? creditRowOfLane(ds, cr.lane)?.credits_to_usd?.usd_per_credit : undefined;
  const hours = ds.catalog.rows.find((r) => r.allowance.some((a) => a.kind === "vendor_hours"));
  const hoursAllow = hours?.allowance.find((a) => a.kind === "vendor_hours");
  return "Allowance source: " + [
    "p published (" + (pub ? pub.label + " $" + (pub.capacity.allowance_published_usd ?? 0).toFixed(2) : "none") + ")",
    "r vendor reading (" + (pool ? pool.label + " pool $" + (pool.capacity.allowance_vendor_usd ?? 0).toFixed(2) : "none") + ")",
    "d derived from quota windows (" + (der ? der.label + " $" + (der.capacity.allowance_usd_per_cycle ?? 0).toFixed(2) : "none") + ")",
    "c credit value (" + (cr && perCredit !== undefined ? cr.label + " $" + Number(perCredit.toPrecision(3)) + " per credit" : "none") + ")",
    "h hours × measured throughput (" + (hours && hoursAllow ? hours.label + " $" + hoursAllow.usd.toFixed(2) : "none") + ")",
  ].join(" · ");
}

export function summaryTable(ds: DS, view: ViewId, ctx: ContextId = "short", shape: ShapeDef = DEFAULT_SHAPE): SummaryTable {
  const data = viewRows(ds, view, ctx, shape);
  const rows = data.map((r) => ({
    key: r.key,
    cells: {
      plan: value(r.label),
      fee: value(money(r.fee) + "/mo"),
      allowance: r.allowance === null ? naShort(r.allowanceReason) : withSup(value("$" + r.allowance.usd.toFixed(2) + "/" + r.allowance.cycle + "d", [], r.allowance.title), r.allowance.sup),
      capacity: r.capacity === null ? naShort(r.capacityReason) : withDetail(value(r.capacity, r.capBadges ?? [], null, r.capNote ?? null), r.capDetail ?? null),
      usd: r.usd === null ? naShort(r.usdTitle) : value(usd(r.usd) + r.marker, [], r.usdTitle),
      tps: r.tps === null ? naShort(r.tpsTitle || "no speed data") : value("~" + sig2(r.tps), [], r.tpsTitle),
      ttft: r.ttft === null ? naShort(r.ttftTitle || "no latency data") : value("~" + sig2(r.ttft) + " ms", [], r.ttftTitle),
    },
  }));
  const lines: string[] = [];
  if (view === MEASURED) {
    if (data.some((r) => r.marker === "*")) lines.push(DERIVED_FOOTNOTE);
    lines.push(MEASURED_FOOTNOTE);
  } else {
    lines.push("Prices assume a " + contextLabel(ctx) + "-token context and the " + shape.label + " shape. " + SHAPE_FOOTNOTE);
    if (data.some((r) => r.marker === "†")) lines.push(CONVERTED_FOOTNOTE(ctx));
    if (data.some((r) => r.marker === "‡")) lines.push(ARCHIVED_FOOTNOTE(ctx));
  }
  lines.push(allowanceLegend(ds));
  lines.push(BRING_YOUR_OWN);
  return { columns: SUMMARY_COLUMNS, rows, footnote: lines.join("\n"), basisLine: basisLine(ds, view) };
}
