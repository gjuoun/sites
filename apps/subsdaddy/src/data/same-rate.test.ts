import { describe, expect, test } from "bun:test";
import { applySameRate, SAME_RATE_SOURCE } from "./same-rate";
import type { CatalogRow } from "./catalog";

const est = (usd: number) => ({ status: "estimated", reason: null, basis: "peer basis", values: [
  { ref: "deepseek-v4.1-flash", shape: "agent", usd_per_b: usd, reason: null, fee_over_allowance: 0.125, blended_usd_per_b: usd * 8, measured_at: "2026-10-26T00:00:00Z", source: "s" },
  { ref: "claude-haiku-5.5", shape: "agent", usd_per_b: usd * 10, reason: null, fee_over_allowance: 0.6, blended_usd_per_b: 1, measured_at: "2026-10-26T00:00:00Z", source: "s" },
], range_agent: [usd, usd * 10], measured_at: "2026-10-26T00:00:00Z", source: "s", derived_from: null });
const peer = { plan_id: "peer", label: "Peer", measured_lane: "peer-lane", offered_models: ["deepseek-v4.1-flash", "claude-haiku-5.5"], price_month_usd: 10, measured_at: "2026-10-26T00:00:00Z", estimate: est(6.93) } as unknown as CatalogRow;
const plan = { plan_id: "plan", label: "Plan", measured_lane: "own-lane", offered_models: ["deepseek-v4.1-flash"], price_month_usd: 10, measured_at: "2026-10-26T00:00:00Z", estimate: est(1.74) } as unknown as CatalogRow;

describe("same-rate derivation", () => {
  test("a derived lane takes the peer's $/B for each model the plan offers, and says where it came from", () => {
    const rows = applySameRate([{ ...plan }, peer], [{ lane: "own-lane", usd_per_b_basis: "derived", usd_per_b_derived_from: "peer-lane" }, { lane: "peer-lane", usd_per_b_basis: "measured" }]);
    const p = rows[0].estimate!;
    expect(p.derived_from).toBe("peer");
    expect(p.values.map((v) => v.ref)).toEqual(["deepseek-v4.1-flash"]);
    expect(p.values[0].usd_per_b).toBe(6.93);
    expect(p.basis).toContain("same rate as Peer");
    expect(p.source).toBe(SAME_RATE_SOURCE);
  });

  test("a measured lane keeps the plan's own estimate: the rule switches off by itself", () => {
    const rows = applySameRate([{ ...plan }, peer], [{ lane: "own-lane", usd_per_b_basis: "measured" }, { lane: "peer-lane", usd_per_b_basis: "measured" }]);
    expect(rows[0].estimate!.values[0].usd_per_b).toBe(1.74);
    expect(rows[0].estimate!.derived_from ?? null).toBeNull();
  });

  test("a derived lane whose peer has no estimate is unavailable, with the reason", () => {
    const bare = { ...peer, estimate: { ...est(6.93), status: "unavailable", values: [], range_agent: null, reason: "x", basis: null } } as unknown as CatalogRow;
    const rows = applySameRate([{ ...plan }, bare], [{ lane: "own-lane", usd_per_b_basis: "derived", usd_per_b_derived_from: "peer-lane" }]);
    expect(rows[0].estimate!.status).toBe("unavailable");
    expect(rows[0].estimate!.reason).toContain("has no estimate");
  });
});
