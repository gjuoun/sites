import type { dataset as DatasetValue } from "./dataset";
import { catalogDisplayRow, formatEstimate, formatUsdPerCredit, type CatalogRow } from "../data/catalog";
import { dsRanking, type DsLane, type DsModels } from "./ds-ranking";
import { fmtPrice } from "../data/peak-offpeak";
import type { RefPrice } from "../data/estimate";
import { REF_IDS, REF_NAMES, type RefId } from "../data/estimate";
import { flagCell, na, orCell, value, type BadgeKind, type Cell } from "./cells";
import { formatRange, orForModel } from "./or-stats";

export type DS = typeof DatasetValue;
export type Column = { key: string; label: string; width: string; numeric?: boolean; clip?: boolean };
export type Table = { columns: Column[]; rows: Array<{ key: string; cells: Record<string, Cell> }> };

export const usd = (v: number) => "$" + (v < 0.1 ? String(Number(v.toPrecision(3))) : v.toFixed(2));
export const money = (v: number) => "$" + v.toFixed(2);
const ms = (v: number) => Math.round(v).toLocaleString("en-US") + " ms";
const count = (n: number, noun: string) => n.toLocaleString("en-US") + " " + noun + (n === 1 ? "" : "s");

/** The display name of an OpenRouter model id, from data/models.json. The raw id is never the label. */
export function displayName(ds: DS, orId: string): string {
  const ref = ds.models.reference.find((r) => r.openrouter === orId);
  if (ref) return ref.name;
  const usage = ds.models.usage_models.find((u) => u.openrouter === orId);
  if (usage) return usage.name;
  return orId;
}

const orModelOf = (ds: DS, lane: string) => ds.models.models.find((m) => m.lane === lane)?.openrouter ?? null;
const refModelOf = (ds: DS, ref: RefId) => ds.models.reference.find((r) => r.ref === ref)?.openrouter ?? null;

/** Section A: the four measured plans, our own traffic, with OpenRouter's p50 for each plan's lane model. */
export function measuredTable(ds: DS): Table & { footnote: string } {
  const footIds = new Map<string, string>();
  const rows = ds.lanes.lanes.map((l) => {
    const orId = orModelOf(ds, l.lane);
    const or = orId ? orForModel(ds.benchmark, orId) : { summary: null, reason: "no OpenRouter model mapped to this plan" };
    if (orId) footIds.set(orId, displayName(ds, orId));

    const flags: BadgeKind[] = [];
    if (l.capacity.badge === "single_account_reading") flags.push("single_account_reading");
    if (l.capacity.confidence === "low") flags.push("low confidence");
    if (l.capacity.seeded) flags.push("seed");

    const usdCell =
      l.usd_per_b === null
        ? na(l.capacity.reason ?? "no capacity reading")
        : value(usd(l.usd_per_b), [l.usd_per_b_basis === "derived" ? "derived" : "measured"], l.usd_per_b_source);
    const capCell =
      l.capacity.tokens_per_week === null
        ? na(l.capacity.reason ?? "no capacity reading")
        : value((l.capacity.tokens_per_week / 1e9).toFixed(2) + "B/wk");
    let orCellValue: Cell;
    if (or.summary?.tps && orId) {
      const low = or.summary.low_confidence;
      orCellValue = orCell(
        formatRange(or.summary.tps),
        orId + " · " + count(or.summary.endpoints, "endpoint") + (low > 0 ? ", " + low.toLocaleString("en-US") + " low confidence" : "") + " · 30-minute window",
        displayName(ds, orId),
      );
    } else {
      orCellValue = na(or.reason ?? "no OpenRouter data");
    }
    return {
      key: l.lane,
      cells: {
        plan: value(l.label),
        fee: value(money(l.price_month_usd) + "/mo"),
        capacity: capCell,
        usd: usdCell,
        tps: l.measured.p50_output_tps === null ? na("no measured output speed for this plan") : value(Math.round(l.measured.p50_output_tps).toLocaleString("en-US"), ["measured"]),
        ttft: l.measured.p50_ttft_ms === null ? na("no measured time to first token for this plan") : value(ms(l.measured.p50_ttft_ms), ["measured"]),
        or: orCellValue,
        badges: flagCell(flags),
      },
    };
  });
  const footnote =
    "OR p50 reads each plan's lane model: " + [...footIds.entries()].map(([id, name]) => name + " (" + id + ")").join("; ") + ".";
  return {
    footnote,
    columns: [
      { key: "plan", label: "Plan", width: "24%" },
      { key: "fee", label: "Fee/mo", width: "10%", numeric: true },
      { key: "capacity", label: "Capacity", width: "8%", numeric: true },
      { key: "usd", label: "$/B", width: "8%", numeric: true },
      { key: "tps", label: "tok/s", width: "8%", numeric: true },
      { key: "ttft", label: "TTFT p50", width: "10%", numeric: true },
      { key: "or", label: "OR p50 tok/s", width: "16%", numeric: true },
      { key: "badges", label: "Badges", width: "16%" },
    ],
    rows,
  };
}

/** Catalog rows that have a model-level estimate or a USD credit pool: the plans the by-model tables show. */
export function byModelRows(ds: DS): CatalogRow[] {
  return ds.catalog.rows.filter((r) => r.estimate?.status === "estimated" || (r.allowance_model === "credits" && r.price_month_usd !== null));
}

/** The vs-measured comparison: est against the plan's own measured $/B, as a signed percent. */
export function vsMeasuredText(est: number, measured: number): string {
  const pct = (est / measured - 1) * 100;
  return (pct >= 0 ? "+" : "−") + Math.round(Math.abs(pct)).toLocaleString("en-US") + "%";
}

/** The plan's own measured $/B, or the reason there is none. A derived figure is not a measurement. */
function measuredFor(ds: DS, row: CatalogRow): { value: number | null; reason: string } {
  if (!row.measured_lane) return { value: null, reason: "this plan has no measured $/B of its own" };
  const lane = ds.lanes.lanes.find((l) => l.lane === row.measured_lane);
  if (!lane) return { value: null, reason: "no lane measurement for this plan" };
  if (lane.usd_per_b === null) return { value: null, reason: "no measured $/B: " + (lane.capacity.reason ?? "capacity unavailable") };
  if (lane.usd_per_b_basis !== "measured") return { value: null, reason: "its $/B is derived from another plan, not measured" };
  return { value: lane.usd_per_b, reason: "" };
}

/** Section B for one reference model: only the plans that offer the model; the same table style; OpenRouter's numbers for the model. */
export function modelTable(ds: DS, ref: RefId): Table & { subtitle: string; orNote: string; tierNote: string | null } {
  const orId = refModelOf(ds, ref);
  const or = orId ? orForModel(ds.benchmark, orId) : { summary: null, reason: "no OpenRouter id for this model" };
  const speedNote = or.summary ? count(or.summary.endpoints, "endpoint") + (or.summary.low_confidence > 0 ? ", " + or.summary.low_confidence.toLocaleString("en-US") + " low confidence" : "") : null;
  const rows = byModelRows(ds)
    .filter((r) => r.offered_models.includes(ref))
    .map((r) => {
      const v = r.estimate?.status === "estimated" ? r.estimate.values.find((x) => x.ref === ref && x.shape === "agent") : undefined;
      const estCell =
        v && v.usd_per_b !== null
          ? value(usd(v.usd_per_b), ["estimated"], "fee/allowance " + Number(v.fee_over_allowance?.toPrecision(3) ?? 0) + " × blended " + Number(v.blended_usd_per_b.toPrecision(3)) + " per B tokens")
          : na(v?.reason ?? r.estimate?.reason ?? "no estimate for this model");
      const m = measuredFor(ds, r);
      const vs =
        v && v.usd_per_b !== null && m.value !== null
          ? value(vsMeasuredText(v.usd_per_b, m.value), [], "est " + usd(v.usd_per_b) + " prices the whole allowance at this model's list cost; measured " + usd(m.value) + " is fee over all tokens this plan delivered in our mixed traffic, so the gap is mostly model mix", "est " + usd(v.usd_per_b) + " vs measured " + usd(m.value))
          : na(m.value === null ? m.reason : v?.reason ?? r.estimate?.reason ?? "no estimate for this model");
      const basis =
        v && v.fee_over_allowance !== null
          ? value("fee/allowance " + Number(v.fee_over_allowance.toPrecision(3)) + " × blended " + Number(v.blended_usd_per_b.toPrecision(3)) + " per B tokens", [], r.estimate?.basis ?? null)
          : na(v?.reason ?? r.estimate?.reason ?? "no published allowance for this model in this plan");
      const unverified: BadgeKind[] = r.sources.some((s) => s.kind === "unverified") ? ["unverified"] : [];
      const speed = (formatted: string | null, reason: string | null) =>
        formatted !== null && orId ? orCell(formatted, orId + " · " + (speedNote ?? "N/A") + " · 30-minute window", null) : na(reason ?? "no OpenRouter data");
      return {
        key: r.plan_id,
        cells: {
          plan: value(r.label, unverified),
          fee: r.price_month_usd !== null ? value(money(r.price_month_usd) + "/mo") : na("no USD fee published"),
          est: estCell,
          vs,
          tps: speed(or.summary?.tps ? formatRange(or.summary.tps) : null, or.reason),
          ttft: or.summary?.latency_ms && orId
            ? orCell(Math.round(or.summary.latency_ms.median).toLocaleString("en-US") + " ms", orId + " · TTFT p50 median across endpoints · " + (speedNote ?? "N/A") + " · 30-minute window", formatRange(or.summary.latency_ms) + " ms range")
            : na(or.reason ?? "no OpenRouter data"),
          basis,
        },
      };
    });
  const subtitle = "This table assumes the whole allowance is spent on " + ds.models.reference.find((x) => x.ref === ref)!.name + ". Other models are in their own tables.";
  const orNote = or.summary
    ? "OpenRouter " + orId + ": " + count(or.summary.endpoints, "endpoint") + ", p50 over the last 30 minutes."
    : "OpenRouter " + (orId ?? "") + ": N/A (" + (or.reason ?? "no data") + ").";
  const tierNote = (() => {
    const parts = byModelRows(ds)
      .filter((r) => r.offered_models.includes(ref) && r.estimate?.basis?.includes("; prices: "))
      .map((r) => r.label + ": " + r.estimate!.basis!.split("; prices: ")[1].replace(/\.$/, ""));
    return parts.length > 0 ? "Official tiers used for this plan's price: " + parts.join("; ") + "." : null;
  })();
  return {
    subtitle,
    orNote,
    tierNote,
    columns: [
      { key: "plan", label: "Plan", width: "21%" },
      { key: "fee", label: "Fee/mo", width: "10%", numeric: true },
      { key: "est", label: "Est. $/B", width: "9%", numeric: true },
      { key: "vs", label: "vs measured", width: "11%", numeric: true },
      { key: "tps", label: "tok/s", width: "16%", numeric: true },
      { key: "ttft", label: "TTFT p50", width: "19%", numeric: true },
      { key: "basis", label: "Basis", width: "14%", clip: true },
    ],
    rows,
  };
}

/** Every reference model, in display order. A model no plan here offers has no table; the page says so. */
export function modelTables(ds: DS) {
  return REF_IDS.map((ref) => ({ ref, name: ds.models.reference.find((x) => x.ref === ref)!.name, table: modelTable(ds, ref) }));
}

/** Section C: the official subscriptions, from their local logs. Aggregates only. */
export function officialTable(ds: DS): Table {
  const tokensOf = (t: { input: number; cache_read: number; cache_write: number; output: number }) => t.input + t.cache_read + t.cache_write + t.output;
  const rows = ds.official.providers.map((p) => {
    const total = tokensOf(p.tokens_7d);
    const allTotal = tokensOf(p.all_time);
    const windowCell = p.window
      ? value(
          "5h " + (p.window.five_hour_pct === null ? "N/A" : p.window.five_hour_pct + "%") + " · weekly " + (p.window.weekly_pct === null ? "N/A" : p.window.weekly_pct + "%"),
          [],
          "codexbar window reading; resets " + (p.window.resets_at ?? "N/A"),
        )
      : na(p.window_reason ?? "no window reading");
    const tokensCell =
      p.tokens_7d.calls === 0
        ? value("0 tokens", [], "no session in the last 7 days", "0 calls · last session " + (p.all_time.last_day ?? "N/A"))
        : value(total.toLocaleString("en-US") + " tokens", [], null, p.tokens_7d.calls.toLocaleString("en-US") + " calls");
    const feeCell =
      p.fee_usd !== null
        ? value(money(p.fee_usd) + "/mo")
        : value("unverified", [], p.fee_reason, p.fee_claimed_usd !== null ? money(p.fee_claimed_usd) + " claimed" : "tier not readable");
    const perB =
      p.fee_usd !== null && total > 0
        ? value(usd(p.fee_usd / (total / 1e9)))
        : na(p.fee_usd === null ? "fee not confirmed, so no $/B" : "no tokens in the last 7 days");
    const basis = value(
      "all time: " + p.all_time.calls.toLocaleString("en-US") + " calls, " + allTotal.toLocaleString("en-US") + " tokens" +
        (p.all_time.speed ? ", p50 " + Math.round(p.all_time.speed.tps_p50) + " tok/s over " + p.all_time.speed.n + " turns" : "") +
        (p.all_time.first_day ? ", " + p.all_time.first_day + " to " + p.all_time.last_day : ""),
      [],
      "in " + p.all_time.input.toLocaleString("en-US") + " · cached " + p.all_time.cache_read.toLocaleString("en-US") + " · out " + p.all_time.output.toLocaleString("en-US") + " · source: " + p.source,
    );
    return {
      key: p.provider,
      cells: {
        plan: value(p.plan),
        fee: feeCell,
        perB,
        window: windowCell,
        tokens: tokensCell,
        tps: p.speed_7d ? value(Math.round(p.speed_7d.tps_p50).toLocaleString("en-US"), [], null, "p50 over " + p.speed_7d.n + " turns") : na(p.speed_reason ?? "no speed in the last 7 days"),
        ttft: na(p.ttft_reason),
        basis,
      },
    };
  });
  return {
    columns: [
      { key: "plan", label: "Plan", width: "18%" },
      { key: "fee", label: "Fee/mo", width: "11%", numeric: true },
      { key: "perB", label: "$/B", width: "9%", numeric: true },
      { key: "window", label: "Window %", width: "14%", numeric: true },
      { key: "tokens", label: "Tokens 7d", width: "15%", numeric: true },
      { key: "tps", label: "tok/s", width: "10%", numeric: true },
      { key: "ttft", label: "TTFT p50", width: "10%", numeric: true },
      { key: "basis", label: "Basis", width: "13%", clip: true },
    ],
    rows,
  };
}

/** A native-currency price: the amount is the value; the rest of the sentence is the secondary line, in full in title. */
const nativeFee = (text: string): Cell => {
  const m = /^([A-Z]{3} [\d.,]+)(.*)$/.exec(text);
  return m ? value(m[1], [], text, m[2].trim() || null) : value(text, [], text);
};

/** The catalog page: every catalog row, with its price, allowance, estimate range, and status flags. */
export function catalogTable(ds: DS): Table {
  const rows = ds.catalog.rows.map((r) => {
    const d = catalogDisplayRow(r);
    // every catalog row is unmeasured by definition; the page says so, so no row repeats it
    const flags: BadgeKind[] = [];
    if (d.status === "excluded") flags.push("excluded");
    if (d.source_badge === "unverified") flags.push("unverified");
    const est =
      r.estimate?.status === "estimated" && r.estimate.range_agent
        ? value(formatEstimate(r.estimate.range_agent[0]) + (r.estimate.range_agent[0] === r.estimate.range_agent[1] ? "" : " – " + formatEstimate(r.estimate.range_agent[1])), ["estimated"], r.estimate.basis)
        : na(r.estimate?.reason ?? "not estimated");
    return {
      key: r.plan_id,
      cells: {
        plan: value(r.label),
        fee: r.price_month_usd !== null ? value(money(r.price_month_usd) + "/mo") : d.fee === "unverified" ? na("no verified USD price") : nativeFee(d.fee),
        credits: r.credits_to_usd ? value(formatUsdPerCredit(r.credits_to_usd.usd_per_credit), [], r.credits_to_usd.basis) : na(r.allowance_reason ?? "no credit conversion published"),
        allowance: r.allowance.length > 0 ? value(r.allowance_detail, [], r.allowance_detail) : na(r.allowance_reason ?? "no published usage-dollar allowance"),
        est,
        cli: value(r.cli_compat, [], r.cli_compat),
        badges: flagCell(flags),
      },
    };
  });
  return {
    columns: [
      { key: "plan", label: "Plan", width: "28%" },
      { key: "fee", label: "Fee/mo", width: "10%", numeric: true },
      { key: "credits", label: "Credits → $", width: "14%", numeric: true },
      { key: "allowance", label: "Allowance", width: "10%", clip: true },
      { key: "est", label: "Est. $/B (range)", width: "11%", numeric: true },
      { key: "cli", label: "CLI", width: "9%", clip: true },
      { key: "badges", label: "Badges", width: "18%" },
    ],
    rows,
  };
}

/** The DeepSeek value ranking: the convertible plans that list DeepSeek V4.1 Flash, sorted by the QwenCloud-basis est $/B. */
export function dsRankingTable(ds: DS): Table & { subtitle: string; excludedLines: string[] } {
  const k = dsRanking(ds.catalog.rows as CatalogRow[], ds.models as unknown as DsModels, ds.usage.lanes as unknown as DsLane[]);
  const price = (p: RefPrice) => "$" + fmtPrice(p.in_per_m) + " / $" + fmtPrice(p.out_per_m) + " / $" + fmtPrice(p.cache_per_m) + " per M";
  const rows = k.ranked.map((e) => ({
    key: e.plan_id,
    cells: {
      plan: value(e.label),
      fee: value(money(e.fee_usd) + "/mo"),
      allowance: value(money(e.allowance_usd), [], e.allowance_basis),
      estQw: value(usd(e.est_qw), [], "QwenCloud average prices for DeepSeek V4.1 Flash"),
      estList: e.est_list === null ? na(e.list_reason ?? "no OpenRouter list basis") : value(usd(e.est_list), [], "OpenRouter list price for DeepSeek V4.1 Flash"),
      tokens: value(e.tokens_b_qw.toFixed(2) + "B", [], "QwenCloud basis; list basis: " + (e.tokens_b_list === null ? "N/A" : e.tokens_b_list.toFixed(2) + "B") + " tokens per month"),
      basis: value("agent shape, " + e.mix_source, [], e.allowance_basis),
    },
  }));
  return {
    subtitle: "Est. $/B of running the whole allowance on DeepSeek V4.1 Flash, agent shape (the plan's own measured mix where it has one). QwenCloud basis: " + price(k.qw_price) + ". OpenRouter basis: " + price(k.list_price) + ". Sorted by the QwenCloud basis.",
    columns: [
      { key: "plan", label: "Plan", width: "27%" },
      { key: "fee", label: "Fee/mo", width: "9%", numeric: true },
      { key: "allowance", label: "Allowance ($ of usage)", width: "11%", numeric: true },
      { key: "estQw", label: "Est. $/B · QwenCloud", width: "12%", numeric: true },
      { key: "estList", label: "Est. $/B · OpenRouter", width: "12%", numeric: true },
      { key: "tokens", label: "DeepSeek tokens/mo", width: "12%", numeric: true },
      { key: "basis", label: "Basis", width: "16%", clip: true },
    ],
    rows,
    excludedLines: [
      "Not ranked, convertible: " + k.excluded.map((x) => x.label + " (" + x.reason + ")").join("; ") + ".",
      "Not ranked, no dollar allowance: " + k.counts.needs_anchor + " plans. Each shows its price and the anchor needed; none gets a $/B.",
    ],
  };
}

/** The standard context: the distribution of session-end contexts in the pi sample. */
export function contextDistributionTable(ds: DS): Table {
  const total = ds.context.histogram.reduce((a, h) => a + h.sessions, 0);
  return {
    columns: [
      { key: "bucket", label: "Session-end context", width: "40%" },
      { key: "sessions", label: "Sessions", width: "30%", numeric: true },
      { key: "share", label: "Share", width: "30%", numeric: true },
    ],
    rows: ds.context.histogram.map((h) => ({
      key: h.bucket,
      cells: { bucket: value(h.bucket), sessions: value(h.sessions.toLocaleString("en-US")), share: value(((100 * h.sessions) / total).toFixed(1) + "%") },
    })),
  };
}

/** $/B of each estimated plan and reference model at the 100K standard, the 350K standard and the p75 sensitivity point. */
export function contextCompareTable(ds: DS): Table {
  const p75 = Math.round(ds.context.quantiles.p75 / 1000) + "K";
  const cell = (v: number | null | undefined, title: string): Cell => (v === null || v === undefined ? na("no estimate at this context") : value(usd(v), [], title));
  const rows: Array<{ key: string; cells: Record<string, Cell> }> = [];
  for (const r of ds.catalog.rows) {
    const est = r.estimate;
    if (r.status !== "catalog" || !est || est.status !== "estimated") continue;
    for (const ref of REF_IDS) {
      const v = est.values.find((x) => x.ref === ref && x.shape === "agent");
      if (!v || v.usd_per_b === null) continue;
      rows.push({
        key: r.plan_id + "|" + ref,
        cells: {
          plan: value(r.label),
          model: value(REF_NAMES[ref]),
          short: cell(v.usd_per_b, v.band_short ?? ""),
          long: cell(v.usd_per_b_long, v.band_long ?? ""),
          p75: cell(v.usd_per_b_p75, v.band_p75 ?? ""),
        },
      });
    }
  }
  return {
    columns: [
      { key: "plan", label: "Plan", width: "34%" },
      { key: "model", label: "Model", width: "22%" },
      { key: "short", label: "$/B at 100K", width: "14%", numeric: true },
      { key: "long", label: "$/B at 350K", width: "14%", numeric: true },
      { key: "p75", label: "$/B at p75 " + p75, width: "16%", numeric: true },
    ],
    rows,
  };
}
