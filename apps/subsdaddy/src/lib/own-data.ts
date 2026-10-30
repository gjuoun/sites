/**
 * The site's own data: four lanes, their plans, their quota readings and their traffic. Nothing else
 * enters the page, so nothing else can leak onto it.
 */
import lanesRaw from "../../data/lanes.json";
import plansRaw from "../../data/plans.json";
import quotaRaw from "../../data/quota.json";
import usageRaw from "../../data/usage.json";
import { lanesFileSchema, plansFileSchema, quotaFileSchema, usageFileSchema } from "../data/schema";

export const dataset = {
  lanes: lanesFileSchema.parse(lanesRaw),
  plans: plansFileSchema.parse(plansRaw),
  quota: quotaFileSchema.parse(quotaRaw),
  usage: usageFileSchema.parse(usageRaw),
};

export type OwnDataset = typeof dataset;
export type LaneRecord = OwnDataset["lanes"]["lanes"][number];
export type QuotaObservation = OwnDataset["quota"]["observations"][number];
export type LaneModelRow = LaneRecord["models"][number];

export const NOTHING = "no traffic in the recent window, so there is no model to show";

/** A lane with no $/B is not dropped: it is listed after the ranked ones, with its reason. */
export function rankedLanes<T extends { usd_per_b: number | null }>(lanes: readonly T[]): T[] {
  return [...lanes].sort((a, b) => (a.usd_per_b ?? Infinity) - (b.usd_per_b ?? Infinity));
}

export function observationOf(ds: OwnDataset, lane: string): QuotaObservation | undefined {
  return ds.quota.observations.find((o) => o.lane === lane);
}

/** The codexbar reason a lane has no window, or the generic one when the observation is missing. */
export function unavailableReason(observations: readonly QuotaObservation[], lane: string): string {
  const o = observations.find((x) => x.lane === lane);
  if (!o) return "no quota reading";
  return "unavailable" in o && o.unavailable ? o.unavailable : "no quota reading";
}

/** A short visible reason for a missing quota reading; the provider's full sentence stays in the hover title. */
export function unavailableShort(reason: string): string {
  if (/session/i.test(reason)) return "session expired, re-login needed";
  if (/no quota reading/i.test(reason)) return "no quota reading";
  return reason.length > 28 ? "quota unreadable" : reason;
}

export function formatTokens(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e8) return Math.round(v / 1e6).toString() + "M";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return Math.round(v / 1e3).toString() + "K";
  return v.toLocaleString("en-US");
}

export function formatShare(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  if (v === 0) return "0%";
  if (v < 0.001) return "<0.1%";
  return (v * 100).toFixed(1) + "%";
}

export function formatUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  return "$" + (Math.abs(v) < 0.1 && v !== 0 ? String(Number(v.toPrecision(3))) : v.toFixed(2));
}

export function formatMs(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  return Math.round(v).toLocaleString("en-US") + " ms";
}

export function formatTps(v: number | null | undefined): string {
  if (v === null || v === undefined) return "N/A";
  return Math.round(v).toLocaleString("en-US");
}

/** "2026-11-01T23:59:59Z" → "2026-11-01 23:59Z": a reset time a reader can compare at a glance. */
export function formatReset(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] + " " + m[2] + "Z" : iso;
}

/** Every window the reading carries, then the reset of the binding one. */
export function quotaLine(lane: { capacity: { window: string | null; windows: ReadonlyArray<{ window: string; used_pct: number; resets_at: string }> } }): string {
  const { windows } = lane.capacity;
  if (windows.length === 0) return "no quota window";
  const binding = windows.find((w) => w.window === lane.capacity.window) ?? windows[windows.length - 1];
  return windows.map((w) => w.window + " " + w.used_pct.toFixed(1) + "%").join(" · ") + " · resets " + formatReset(binding.resets_at);
}

/** The lane's traffic line for the recent window. */
export function trafficLine(t: LaneRecord["traffic_7d"]): string {
  if (t.tokens === null) return t.reason ?? "no traffic in the recent window";
  const parts = [formatTokens(t.tokens) + " tokens", t.requests.toLocaleString("en-US") + " requests"];
  if (t.cache_share !== null) parts.push("cache " + (t.cache_share * 100).toFixed(1) + "%");
  parts.push(t.window_days + " days");
  return parts.join(" · ");
}

/** "$/B" with its basis, or the reason it is not published. */
export function usdPerB(lane: LaneRecord): { text: string; reason: string | null } {
  if (lane.usd_per_b === null) return { text: "N/A", reason: lane.usd_per_b_reason ?? lane.capacity.reason ?? "no measured $/B" };
  return { text: formatUsd(lane.usd_per_b), reason: null };
}

/** "$80/mo" for a published per-model limit, else the reason it is absent. */
export function limitCell(m: LaneModelRow): { text: string; reason: string | null } {
  if (m.limit_usd_month !== null) return { text: formatUsd(m.limit_usd_month) + "/mo", reason: null };
  // the plan-level sentence never needs to be in every row: the lane says it once, this cell says the fact
  return { text: "N/A", reason: m.limit_reason === "this plan publishes no per-model limit" ? "no per-model limit" : (m.limit_reason ?? "no published limit") };
}
