import { na, value, type Cell } from "./cells";
import { REF_IDS, REF_NAMES, type RefId } from "../data/estimate";
import { contextLabel, type ContextId } from "../data/context";
import { CONTEXTS, WINDOWS_PER_DAY, monthlyTokens, usdPerBOfTokens } from "../data/messages";
import type { CatalogRow } from "../data/catalog";
import { orForModel } from "./or-stats";
import { money, usd, type Column, type DS, type Table } from "./sections";

/**
 * The front page: one table for one view at a time. The views are Measured (our own traffic) and one
 * per reference model that some plan offers. The context switch (100K or 350K) sets the prompt length
 * the model prices are read at; Measured $/B is what the plan delivered, so it does not depend on it.
 * Marks: * a derived measured $/B; † a $/B converted from vendor message limits. Every number is a single
 * value; a missing value is N/A. The footnote carries at most two lines, separated by a newline.
 */

export const MEASURED = "measured" as const;
export type ViewId = typeof MEASURED | RefId;
export type Chip = { id: ViewId; label: string; rows: number };

export const DERIVED_FOOTNOTE = "* derived from the same-rate peer plan — this plan's own window is saturated";
export const CONVERTED_FOOTNOTE = (ctx: ContextId) => "† converted from vendor message limits at " + contextLabel(ctx) + " context per message";

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

type ViewRow = {
  key: string; label: string; fee: number; capacity: string | null; capacityReason: string;
  usd: number | null; usdTitle: string; marker: "" | "*" | "†";
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

function measuredRows(ds: DS): ViewRow[] {
  return ds.lanes.lanes.map((l) => ({
    key: l.lane,
    label: l.label,
    fee: l.price_month_usd,
    capacity: l.capacity.tokens_per_week === null ? null : (l.capacity.tokens_per_week / 1e9).toFixed(2) + "B/wk",
    capacityReason: l.capacity.reason ?? "no capacity reading",
    usd: l.usd_per_b,
    usdTitle: l.usd_per_b === null ? (l.capacity.reason ?? "no measured $/B") : (l.usd_per_b_basis === "derived" ? "derived: " : "") + (l.usd_per_b_source ?? "measured $/B"),
    marker: l.usd_per_b_basis === "derived" ? "*" : "",
    tps: l.measured.p50_output_tps,
    tpsTitle: "our usage logs, p50 output tok/s",
    ttft: l.measured.p50_ttft_ms,
    ttftTitle: "our usage logs, p50 time to first token",
  }));
}

/** A plan published as messages per five-hour window: its value at the context, realistic rhythm, with the ceiling in the title. */
function messageRow(r: CatalogRow, ref: RefId, ctx: ContextId): ViewRow | null {
  const ml = r.message_limit;
  if (!ml || ml.model !== ref || r.price_month_usd === null) return null;
  const realistic = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.realistic);
  const ceiling = monthlyTokens(ml, CONTEXTS[ctx], WINDOWS_PER_DAY.ceiling);
  const usdVal = usdPerBOfTokens(r.price_month_usd, realistic);
  return {
    key: r.plan_id,
    label: r.label,
    fee: r.price_month_usd,
    capacity: (realistic / 1e9).toFixed(2) + "B/mo",
    capacityReason: "",
    usd: usdVal,
    usdTitle: "converted: " + ml.low.toLocaleString("en-US") + "-" + ml.high.toLocaleString("en-US") + " messages per 5h (midpoint) × 3 windows a day × 30 days × tokens per message at " + contextLabel(ctx) + " context; ceiling (4.8 windows a day) gives " + usdPerBOfTokens(r.price_month_usd, ceiling).toFixed(2) + " $/B",
    marker: "†",
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
    out.push({
      key: r.plan_id,
      label: r.label,
      fee: r.price_month_usd,
      capacity: usdVal === null ? null : (r.price_month_usd / usdVal).toFixed(2) + "B/mo",
      capacityReason: reason,
      usd: usdVal,
      usdTitle: usdVal === null ? reason : "estimate at a " + contextLabel(ctx) + "-token context: fee ÷ allowance × blended $/B for " + REF_NAMES[ref] + (band ? "; prices " + band : ""),
      marker: "",
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
      capacity: r.capacity === null ? naShort(r.capacityReason) : value(r.capacity),
      usd: r.usd === null ? naShort(r.usdTitle) : value(usd(r.usd) + r.marker, [], r.usdTitle),
      tps: r.tps === null ? naShort(r.tpsTitle || "no speed data") : value("~" + sig2(r.tps), [], r.tpsTitle),
      ttft: r.ttft === null ? naShort(r.ttftTitle || "no latency data") : value("~" + sig2(r.ttft) + " ms", [], r.ttftTitle),
    },
  }));
  // at most two lines: the view's own marks first, then the context or the measured note
  const lines: string[] = [];
  if (view === MEASURED) {
    if (data.some((r) => r.marker === "*")) lines.push(DERIVED_FOOTNOTE);
    lines.push("Measured $/B does not depend on the context size.");
  } else {
    lines.push("Prices assume a " + contextLabel(ctx) + "-token context");
    if (data.some((r) => r.marker === "†")) lines.push(CONVERTED_FOOTNOTE(ctx));
  }
  return { columns: SUMMARY_COLUMNS, rows, footnote: lines.join("\n"), basisLine: basisLine(ds, view) };
}
