import benchmarkRaw from "../../data/benchmark.json";
import lanesRaw from "../../data/lanes.json";
import modelsRaw from "../../data/models.json";
import plansRaw from "../../data/plans.json";
import quotaRaw from "../../data/quota.json";
import usageRaw from "../../data/usage.json";
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
};

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
  num: (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? "—" : v.toLocaleString("en-US", { maximumFractionDigits: digits })),
  usd: (v: number | null | undefined) => (v === null || v === undefined ? "—" : "$" + v.toFixed(2)),
  pct: (v: number | null | undefined) => (v === null || v === undefined ? "—" : (v * 100).toFixed(1) + "%"),
  tokensWeek: (v: number | null | undefined) => (v === null || v === undefined ? "—" : (v / 1e9).toFixed(3) + "B/wk"),
};
