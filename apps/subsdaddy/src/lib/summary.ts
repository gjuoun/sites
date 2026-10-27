import { na, value, type Cell } from "./cells";
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
 * Every number is a single value; a missing value is N/A. The footnote carries at most two lines.
 */

export const MEASURED = "measured" as const;
export type ViewId = typeof MEASURED | RefId;
export type Chip = { id: ViewId; label: string; rows: number };

export const DERIVED_FOOTNOTE = "* derived from the same-rate peer plan — this plan's own window is saturated";
export const CONVERTED_FOOTNOTE = (ctx: ContextId) => "† converted from vendor message limits at " + contextLabel(ctx) + " context per message";
export const ARCHIVED_FOOTNOTE = (ctx: ContextId) => "‡ converted from vendor prompt-count guidance (2025 archive) at " + contextLabel(ctx) + " context per prompt";

export const SUMMARY_COLUMNS: Column[] = [
  { key: "plan", label: "Plan", width: "30%" },
  { key: "fee", label: "Fee/mo", width: "12%", numeric: true },
  { key: "capacity", label: "Capacity", width: "15%", numeric: true },
  { key: "usd", label: "$/B", width: "12%", numeric: true },
  { key: "tps", label: "tok/s", width: "14%", numeric: true },
  { key: "ttft", label: "TTFT p50", width: "17%", numeric: true },
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

const pct = (s: number) => Math.round(s * 100) + "%";

type ViewRow = {
  key: string; label: string; fee: number; capacity: string | null; capacityReason: string; capDetail?: string[] | null; capNote?: string | null;
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
  const vendor = c.allowance_vendor_usd ?? null;
  const derived = c.allowance_derived_usd ?? null;
  if (vendor !== null && derived !== null) {
    lines.push("vendor-reported pool: $" + vendor.toFixed(2) + " per cycle (used by the model views)");
    const unpriced = c.unpriced_share === null || c.unpriced_share === undefined ? "" : ", includes " + Math.round(c.unpriced_share * 100) + "% unpriced";
    lines.push("derived: $" + derived.toFixed(2) + " (lower estimate" + unpriced + ")");
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
    const shape = cacheShare(ds, l.lane);
    const shapeNote = "own traffic: cache read " + pct(shape.share) + " of prompt tokens (" + shape.scope + ")";
    const sourceNote = l.usd_per_b === null ? (l.capacity.reason ?? "no measured $/B") : (l.usd_per_b_basis === "derived" ? "derived: " : "") + (l.usd_per_b_source ?? "measured $/B");
    return {
      key: l.lane,
      label: l.label,
      fee: l.price_month_usd,
      capacity: l.capacity.tokens_per_cycle === null ? null : (l.capacity.tokens_per_cycle / 1e9).toFixed(2) + "B/" + l.capacity.cycle_days + "d",
      capDetail: capDetailOf(l),
      capNote: capNoteOf(l),
      capacityReason: l.capacity.reason ?? "no capacity reading",
      usd: l.usd_per_b,
      usdTitle: sourceNote + " · " + shapeNote,
      marker: l.usd_per_b_basis === "derived" ? "*" : "",
      tps: l.measured.p50_output_tps,
      tpsTitle: "our usage logs, p50 output tok/s",
      ttft: l.measured.p50_ttft_ms,
      ttftTitle: "our usage logs, p50 time to first token",
    };
  });
}

/** A plan published as messages per five-hour window: its value at the lower bound of the vendor range, realistic rhythm. The upper bound and the ceiling are in the title. */
function messageRow(r: CatalogRow, ref: RefId, ctx: ContextId): ViewRow | null {
  const ml = r.message_limit;
  if (!ml || ml.model !== ref || r.price_month_usd === null) return null;
  const fee = r.price_month_usd;
  const low = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.realistic, "low");
  const high = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.realistic, "high");
  const ceiling = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.ceiling, "low");
  const usdVal = usdPerBOfTokens(fee, low);
  const k = (n: number) => n.toLocaleString("en-US");
  return {
    key: r.plan_id,
    label: r.label,
    fee,
    capacity: (low / 1e9).toFixed(2) + "B/mo",
    capacityReason: "",
    usd: usdVal,
    usdTitle: "converted at the lower bound: " + k(ml.low) + " messages per 5h × 3 windows a day × 30 days × " + k(tokensPerMessage(CONTEXTS[ctx])) + " tokens per message (" + contextLabel(ctx) + " context); upper bound " + k(ml.high) + " messages gives " + usdPerBOfTokens(fee, high).toFixed(2) + " $/B; ceiling (4.8 windows a day) at the lower bound gives " + usdPerBOfTokens(fee, ceiling).toFixed(2) + " $/B",
    marker: ml.unit === "prompts" ? "‡" : "†",
    tps: null,
    tpsTitle: "",
    ttft: null,
    ttftTitle: "",
  };
}

function modelRows(ds: DS, ref: RefId, ctx: ContextId): ViewRow[] {
  const or = orWeighted(ds, ref);
  const out: ViewRow[] = [];
  for (const r of ds.catalog.rows) {
    if (r.status !== "catalog" || !r.offered_models.includes(ref) || r.price_month_usd === null) continue;
    const msg = messageRow(r, ref, ctx);
    if (msg) {
      msg.tps = or.tps;
      msg.tpsTitle = or.title || (or.reason ?? "no OpenRouter data");
      msg.ttft = or.ttft;
      msg.ttftTitle = msg.tpsTitle;
      out.push(msg);
      continue;
    }
    // a plan that offers the model but has no dollar allowance is a row with N/A and its reason
    const v = r.estimate?.status === "estimated" ? r.estimate.values.find((x) => x.ref === ref && x.shape === "agent") : undefined;
    const usdVal = !v ? null : ctx === "short" ? v.usd_per_b : (v.usd_per_b_long ?? null);
    const band = !v ? null : ctx === "short" ? (v.band_short ?? null) : (v.band_long ?? null);
    const reason = r.estimate?.reason ?? "no estimate for this model";
    const shape = cacheShare(ds, r.measured_lane);
    const derived = isDerivedLane(ds, r.measured_lane);
    const shapeNote = "its own traffic shape: cache read " + pct(shape.share) + " of prompt tokens (" + shape.scope + ")" + (derived ? "; its own window is saturated, so the * marks a rate-derived allowance" : "");
    out.push({
      key: r.plan_id,
      label: r.label,
      fee: r.price_month_usd,
      capacity: usdVal === null ? null : (r.price_month_usd / usdVal).toFixed(2) + "B/mo",
      capacityReason: reason,
      usd: usdVal,
      usdTitle: usdVal === null ? reason : "estimate at a " + contextLabel(ctx) + "-token context: fee ÷ allowance × blended $/B for " + REF_NAMES[ref] + (band ? "; prices " + band : "") + "; " + shapeNote,
      marker: derived ? "*" : "",
      tps: or.tps,
      tpsTitle: or.title || (or.reason ?? "no OpenRouter data"),
      ttft: or.ttft,
      ttftTitle: or.title || (or.reason ?? "no OpenRouter data"),
    });
  }
  return out;
}

export function viewRows(ds: DS, view: ViewId, ctx: ContextId = "short"): ViewRow[] {
  const rows = view === MEASURED ? measuredRows(ds) : modelRows(ds, view, ctx);
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

export function summaryTable(ds: DS, view: ViewId, ctx: ContextId = "short"): SummaryTable {
  const data = viewRows(ds, view, ctx);
  const rows = data.map((r) => ({
    key: r.key,
    cells: {
      plan: value(r.label),
      fee: value(money(r.fee) + "/mo"),
      capacity: r.capacity === null ? naShort(r.capacityReason) : withDetail(value(r.capacity, [], null, r.capNote ?? null), r.capDetail ?? null),
      usd: r.usd === null ? naShort(r.usdTitle) : value(usd(r.usd) + r.marker, [], r.usdTitle),
      tps: r.tps === null ? naShort(r.tpsTitle || "no speed data") : value("~" + sig2(r.tps), [], r.tpsTitle),
      ttft: r.ttft === null ? naShort(r.ttftTitle || "no latency data") : value("~" + sig2(r.ttft) + " ms", [], r.ttftTitle),
    },
  }));
  // at most two lines: the view's own marks, then the context or the measured note
  const lines: string[] = [];
  if (view === MEASURED) {
    if (data.some((r) => r.marker === "*")) lines.push(DERIVED_FOOTNOTE);
    lines.push("Measured $/B does not depend on the context size.");
  } else {
    lines.push("Prices assume a " + contextLabel(ctx) + "-token context");
    if (data.some((r) => r.marker === "†")) lines.push(CONVERTED_FOOTNOTE(ctx));
    if (data.some((r) => r.marker === "‡")) lines.push(ARCHIVED_FOOTNOTE(ctx));
    if (data.some((r) => r.marker === "*")) lines.push(DERIVED_FOOTNOTE);
  }
  return { columns: SUMMARY_COLUMNS, rows, footnote: lines.join("\n"), basisLine: basisLine(ds, view) };
}
