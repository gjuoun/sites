import type { dataset as DatasetValue } from "./dataset";
import { catalogDisplayRow, formatEstimate, formatUsdPerCredit, type CatalogRow } from "../data/catalog";
import { REF_IDS, REF_NAMES, type RefId } from "../data/estimate";
import { na, orCell, value, type Cell } from "./cells";
import { formatRange, orForModel } from "./or-stats";

export type DS = typeof DatasetValue;

export type Table = { columns: Array<{ key: string; label: string; width: string; numeric?: boolean }>; rows: Array<{ key: string; cells: Record<string, Cell> }> };

const usd = (v: number) => "$" + (v < 0.1 ? String(Number(v.toPrecision(3))) : v.toFixed(2));
const ms = (v: number) => Math.round(v).toLocaleString("en-US") + " ms";
const orModelOf = (ds: DS, lane: string) => ds.models.models.find((m) => m.lane === lane)?.openrouter ?? null;
const refModelOf = (ds: DS, ref: RefId) => ds.models.reference.find((r) => r.ref === ref)?.openrouter ?? null;

/** Section A: the four measured plans, our own traffic, with OpenRouter's p50 for the plan's lane model beside it. */
export function measuredTable(ds: DS): Table {
  const rows = ds.lanes.lanes.map((l) => {
    const orId = orModelOf(ds, l.lane);
    const or = orId ? orForModel(ds.benchmark, orId) : { summary: null, reason: "no OpenRouter model mapped to this plan" };
    const planBadges = [] as Cell["badges"];
    if (l.usd_per_b_basis === "derived") planBadges.push("derived");
    if (l.capacity.badge === "single_account_reading") planBadges.push("single account");
    if (l.capacity.confidence === "low") planBadges.push("low confidence");
    if (l.capacity.seeded) planBadges.push("seed");
    const usdCell =
      l.usd_per_b === null
        ? na(l.capacity.reason ?? "no capacity reading")
        : value(usd(l.usd_per_b), [l.usd_per_b_basis === "derived" ? "derived" : "measured"], l.usd_per_b_source);
    const capCell =
      l.capacity.tokens_per_week === null
        ? na(l.capacity.reason ?? "no capacity reading")
        : value((l.capacity.tokens_per_week / 1e9).toFixed(2) + "B/wk", l.capacity.window ? ["window"] : []);
    return {
      key: l.lane,
      cells: {
        plan: value(l.label),
        badges: planBadges.length > 0 ? value(planBadges.length + (planBadges.length === 1 ? " flag" : " flags"), planBadges) : value("none"),
        fee: value("$" + l.price_month_usd + "/mo"),
        capacity: capCell,
        usd: usdCell,
        tps:
          l.measured.p50_output_tps === null
            ? na("no measured output speed for this plan")
            : value(Math.round(l.measured.p50_output_tps).toLocaleString("en-US"), ["measured"]),
        ttft:
          l.measured.p50_ttft_ms === null
            ? na("no measured time to first token for this plan")
            : value(ms(l.measured.p50_ttft_ms), ["measured"]),
        or: or.summary?.tps
          ? orCell(formatRange(or.summary.tps), (orId ?? "") + " · " + or.summary.endpoints + " endpoints · 30-min window", (or.summary.low_confidence ?? 0) > 0)
          : na(or.reason ?? "no OpenRouter data"),
      },
    };
  });
  return {
    columns: [
      { key: "plan", label: "Plan", width: "17%" },
      { key: "fee", label: "Fee/mo", width: "8%", numeric: true },
      { key: "capacity", label: "Capacity", width: "10%", numeric: true },
      { key: "usd", label: "$/B", width: "10%", numeric: true },
      { key: "tps", label: "tok/s", width: "8%", numeric: true },
      { key: "ttft", label: "TTFT p50", width: "10%", numeric: true },
      { key: "or", label: "OR p50 tok/s", width: "15%", numeric: true },
      { key: "badges", label: "Badges", width: "10%" },
    ],
    rows,
  };
}

/** Catalog rows that have a model-level estimate or a USD credit pool: the plans the by-model tables show. */
export function byModelRows(ds: DS): CatalogRow[] {
  return ds.catalog.rows.filter((r) => r.estimate?.status === "estimated" || (r.allowance_model === "credits" && r.price_month_usd !== null));
}

/** Section B for one reference model: the same table style, with OpenRouter's numbers for that model. */
export function modelTable(ds: DS, ref: RefId): Table & { subtitle: string; orNote: string } {
  const orId = refModelOf(ds, ref);
  const or = orId ? orForModel(ds.benchmark, orId) : { summary: null, reason: "no OpenRouter id for this model" };
  const rows = byModelRows(ds).map((r) => {
    const v = r.estimate?.status === "estimated" ? r.estimate.values.find((x) => x.ref === ref && x.shape === "agent") : undefined;
    const estCell =
      v && v.usd_per_b !== null
        ? value(usd(v.usd_per_b), ["estimated"], "fee/allowance " + Number(v.fee_over_allowance?.toPrecision(3) ?? 0) + " × blended " + Number(v.blended_usd_per_b.toPrecision(3)) + " per B tokens")
        : na(v?.reason ?? r.estimate?.reason ?? "no estimate for this model");
    const basis =
      v && v.fee_over_allowance !== null
        ? value("fee/allowance " + Number(v.fee_over_allowance.toPrecision(3)) + " × blended " + Number(v.blended_usd_per_b.toPrecision(3)) + " per B tokens", [], r.estimate?.basis ?? null)
        : na(v?.reason ?? r.estimate?.reason ?? "no published allowance for this model in this plan", r.sources.some((s) => s.kind === "unverified") ? ["unverified"] : []);
    return {
      key: r.plan_id,
      cells: {
        plan: value(r.label, r.sources.some((s) => s.kind === "unverified") ? ["unverified"] : []),
        fee: r.price_month_usd !== null ? value("$" + r.price_month_usd + "/mo") : na("no USD fee published"),
        est: estCell,
        tps: or.summary?.tps
          ? orCell(formatRange(or.summary.tps), (orId ?? "") + " · " + or.summary.endpoints + " endpoints · 30-min window", (or.summary.low_confidence ?? 0) > 0)
          : na(or.reason ?? "no OpenRouter data"),
        ttft: or.summary?.latency_ms
          ? orCell(formatRange(or.summary.latency_ms) + " ms", "OpenRouter latency metric, p50, 30-min window", (or.summary.low_confidence ?? 0) > 0)
          : na(or.reason ?? "no OpenRouter data"),
        basis,
      },
    };
  });
  const subtitle = "This table assumes the whole allowance is spent on " + REF_NAMES[ref] + ". Other models are in their own tables.";
  const orNote = or.summary
    ? "OpenRouter " + orId + ": " + or.summary.endpoints + " endpoints, p50 over the last 30 minutes; " + or.summary.low_confidence + " under 1,000 requests."
    : "OpenRouter " + (orId ?? "") + ": N/A (" + (or.reason ?? "no data") + ").";
  return {
    subtitle,
    orNote,
    columns: [
      { key: "plan", label: "Plan", width: "20%" },
      { key: "fee", label: "Fee/mo", width: "9%", numeric: true },
      { key: "est", label: "Est. $/B", width: "12%", numeric: true },
      { key: "tps", label: "tok/s", width: "14%", numeric: true },
      { key: "ttft", label: "TTFT p50", width: "14%", numeric: true },
      { key: "basis", label: "Basis", width: "31%" },
    ],
    rows,
  };
}

/** Every reference model, in display order. */
export function modelTables(ds: DS) {
  return REF_IDS.map((ref) => ({ ref, name: REF_NAMES[ref], table: modelTable(ds, ref) }));
}

/** The catalog page: every catalog row, with its price, allowance, estimate range and status. */
export function catalogTable(ds: DS): Table {
  const rows = ds.catalog.rows.map((r) => {
    const d = catalogDisplayRow(r);
    const badges: Cell["badges"] = ["unmeasured"];
    if (d.status === "excluded") badges.push("excluded");
    if (d.source_badge === "unverified") badges.push("unverified");
    const est =
      r.estimate?.status === "estimated" && r.estimate.range_agent
        ? value(formatEstimate(r.estimate.range_agent[0]) + (r.estimate.range_agent[0] === r.estimate.range_agent[1] ? "" : " – " + formatEstimate(r.estimate.range_agent[1])), ["estimated"], r.estimate.basis)
        : na(r.estimate?.reason ?? "not estimated");
    return {
      key: r.plan_id,
      cells: {
        plan: value(r.label, badges),
        fee: r.price_month_usd !== null ? value("$" + r.price_month_usd + "/mo") : d.fee === "unverified" ? na("no verified USD price") : value(d.fee),
        credits: r.credits_to_usd ? value(formatUsdPerCredit(r.credits_to_usd.usd_per_credit), [], r.credits_to_usd.basis) : na(r.allowance_reason ?? "no credit conversion published"),
        allowance: r.allowance.length > 0 ? value(r.allowance_detail) : na(r.allowance_reason ?? "no published usage-dollar allowance"),
        est,
        cli: value(r.cli_compat),
      },
    };
  });
  return {
    columns: [
      { key: "plan", label: "Plan", width: "19%" },
      { key: "fee", label: "Fee/mo", width: "9%", numeric: true },
      { key: "credits", label: "Credits → $", width: "11%", numeric: true },
      { key: "allowance", label: "Allowance", width: "23%" },
      { key: "est", label: "Est. $/B (range)", width: "11%", numeric: true },
      { key: "cli", label: "CLI", width: "27%" },
    ],
    rows,
  };
}
