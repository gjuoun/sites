import type { CatalogRow } from "./catalog";

/**
 * Same-rate derivation (owner ruling, 2026-10-26). A plan whose own lane has no measured $/B takes its peer's:
 * the peer is the lane it is derived from (lanes.json usd_per_b_derived_from). Its model estimates are copied, for
 * the models the plan offers, so every view gives the same $/B and the same capacity for both plans.
 * The rule has no plan names in it. When the plan's own window resets and its lane is measured, the lane is no
 * longer derived and the rule stops applying; the plan's own estimate is used again.
 */
export const SAME_RATE_SOURCE = "same-rate derivation (owner decision 2026-10-26)";

export type LaneDerivation = { lane: string; usd_per_b_basis: string | null; usd_per_b_derived_from?: string | null };

export function applySameRate(rows: CatalogRow[], lanes: LaneDerivation[]): CatalogRow[] {
  const byLane = new Map<string, CatalogRow>();
  for (const r of rows) if (r.measured_lane) byLane.set(r.measured_lane, r);
  for (const row of rows) {
    const lane = lanes.find((l) => l.lane === row.measured_lane);
    const peerLane = lane && lane.usd_per_b_basis === "derived" ? (lane.usd_per_b_derived_from ?? null) : null;
    if (!peerLane) continue; // measured, or no lane: the plan keeps its own estimate
    const peer = byLane.get(peerLane);
    if (!peer || !peer.estimate || peer.estimate.status !== "estimated") {
      row.estimate = { status: "unavailable", reason: "same-rate peer " + peerLane + " has no estimate", basis: null, values: [], range_agent: null, measured_at: row.measured_at, source: SAME_RATE_SOURCE, derived_from: null };
      continue;
    }
    const offered = new Set(row.offered_models);
    const values = peer.estimate.values.filter((v) => offered.has(v.ref));
    const agent = values.filter((v) => v.shape === "agent" && v.usd_per_b !== null).map((v) => v.usd_per_b as number);
    if (agent.length === 0) {
      row.estimate = { status: "unavailable", reason: "same-rate peer " + peer.label + " has no value for the models this plan offers", basis: null, values: [], range_agent: null, measured_at: row.measured_at, source: SAME_RATE_SOURCE, derived_from: null };
      continue;
    }
    row.estimate = {
      status: "estimated",
      reason: null,
      basis: "same rate as " + peer.label + ": fee $" + row.price_month_usd + "/mo over the same usage-dollar allowance, so the same price per billion tokens and the same capacity as its same-rate peer (" + SAME_RATE_SOURCE + "); replaced by its own measurement when its window resets",
      values,
      range_agent: [Math.min(...agent), Math.max(...agent)],
      measured_at: peer.estimate.measured_at,
      source: SAME_RATE_SOURCE,
      derived_from: peer.plan_id,
    };
  }
  return rows;
}
