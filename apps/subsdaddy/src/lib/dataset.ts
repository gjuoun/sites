import benchmarkRaw from "../../data/benchmark.json";
import lanesRaw from "../../data/lanes.json";
import modelsRaw from "../../data/models.json";
import plansRaw from "../../data/plans.json";
import quotaRaw from "../../data/quota.json";
import usageRaw from "../../data/usage.json";
import catalogRaw from "../../data/catalog.json";
import officialRaw from "../../data/official.json";
import contextRaw from "../../data/context.json";
import { contextFileSchema } from "../data/context";
import { officialFileSchema } from "../data/official";
import { catalogDisplayRow, catalogFileSchema, type CatalogDisplay } from "../data/catalog";
import {
  benchmarkFileSchema,
  lanesFileSchema,
  modelsFileSchema,
  plansFileSchema,
  quotaFileSchema,
  usageFileSchema,
  type LaneRecord,
  type OrEndpoint,
} from "../data/schema";

// Every dataset file is parsed at the boundary: a malformed number fails the build, it never renders.
export const dataset = {
  lanes: lanesFileSchema.parse(lanesRaw),
  usage: usageFileSchema.parse(usageRaw),
  quota: quotaFileSchema.parse(quotaRaw),
  plans: plansFileSchema.parse(plansRaw),
  benchmark: benchmarkFileSchema.parse(benchmarkRaw),
  models: modelsFileSchema.parse(modelsRaw),
  catalog: catalogFileSchema.parse(catalogRaw),
  official: officialFileSchema.parse(officialRaw),
  context: contextFileSchema.parse(contextRaw),
};

/** Catalog rows for display only: published price and allowance, never ranked, never per-B. */
export function catalogRows(): CatalogDisplay[] {
  return dataset.catalog.rows
    .map(catalogDisplayRow)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "catalog" ? -1 : 1));
}

export function catalogWindowText(plan_id: string): string | null {
  const row = dataset.catalog.rows.find((r) => r.plan_id === plan_id);
  if (!row?.window_readings?.length) return null;
  return row.window_readings.map((w) => w.window + " " + w.used_pct + "%").join(" · ") + " (codexbar, " + row.window_readings[0].measured_at.slice(0, 16).replace("T", " ") + " UTC)";
}

export function laneById(id: string): LaneRecord | undefined {
  return dataset.lanes.lanes.find((l) => l.lane === id);
}

export function orModelFor(lane: string): string | undefined {
  return dataset.models.models.find((m) => m.lane === lane)?.openrouter;
}

/** OpenRouter endpoints for a model. Layer: OR only; never blended with the measured layer. */
export function orEndpointsFor(model: string): OrEndpoint[] {
  return dataset.benchmark.endpoints.filter((e) => e.model === model);
}

export function ranked(): LaneRecord[] {
  return dataset.lanes.lanes
    .filter((l) => l.usd_per_b !== null && !l.capacity.seeded)
    .sort((a, b) => (a.usd_per_b ?? 0) - (b.usd_per_b ?? 0));
}

export function excluded(): LaneRecord[] {
  return dataset.lanes.lanes.filter((l) => l.usd_per_b === null || l.capacity.seeded);
}

export const fmt = {
  num: (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "N/A" : v.toLocaleString("en-US", { maximumFractionDigits: digits })),
  usd: (v: number | null | undefined) => (v === null || v === undefined ? "N/A" : "$" + (Math.abs(v) < 0.1 && v !== 0 ? String(Number(v.toPrecision(3))) : v.toFixed(2))),
  pct: (v: number | null | undefined) => (v === null || v === undefined ? "N/A" : (v * 100).toFixed(1) + "%"),
  tokensWeek: (v: number | null | undefined) => (v === null || v === undefined ? "N/A" : (v / 1e9).toFixed(3) + "B/wk"),
};
