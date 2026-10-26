import type { OrEndpoint } from "../data/schema";

/** Summaries of OpenRouter's per-endpoint p50 stats for one model. Missing data is null, never zero. */

export type Range = { min: number; max: number; median: number };

export type OrSummary = {
  endpoints: number;
  low_confidence: number;
  tps: Range | null;
  latency_ms: Range | null;
  window_minutes: number;
};

export type OrModelStatus = {
  model: string;
  status: "ok" | "unavailable";
  reason: string | null;
  endpoints: number;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function rangeOf(values: number[]): Range | null {
  const med = median(values);
  if (med === null) return null;
  return { min: Math.min(...values), max: Math.max(...values), median: med };
}

/** Summary over every endpoint of the model; endpoints below 1000 requests are counted as low confidence. */
export function summarizeOr(endpoints: OrEndpoint[]): OrSummary | null {
  if (endpoints.length === 0) return null;
  return {
    endpoints: endpoints.length,
    low_confidence: endpoints.filter((e) => e.confidence === "low_confidence").length,
    tps: rangeOf(endpoints.map((e) => e.p50_throughput)),
    latency_ms: rangeOf(endpoints.map((e) => e.p50_latency_ms)),
    window_minutes: Math.max(...endpoints.map((e) => e.window_minutes)),
  };
}

/** The OpenRouter view of one model: its summary, or the reason there is none. */
export function orForModel(
  file: { endpoints: OrEndpoint[]; models_status: OrModelStatus[] },
  model: string,
): { summary: OrSummary | null; reason: string | null } {
  const status = file.models_status.find((s) => s.model === model);
  if (!status) return { summary: null, reason: "not fetched from OpenRouter" };
  if (status.status === "unavailable") return { summary: null, reason: status.reason ?? "unavailable" };
  const summary = summarizeOr(file.endpoints.filter((e) => e.model === model));
  return { summary, reason: summary === null ? "no endpoints reported for this model" : null };
}

/** Compact range text: "24–249 (median 88)", or N/A when there is no range. */
export function formatRange(r: Range | null, digits = 0): string {
  if (r === null) return "N/A";
  const f = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: digits });
  return r.min === r.max ? f(r.median) : f(r.min) + "–" + f(r.max) + " (median " + f(r.median) + ")";
}
