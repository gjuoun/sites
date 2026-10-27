import { describe, expect, test } from "bun:test";
import { capDetailOf, smallTokens, smallUsd } from "./summary";

describe("hover panel figures never print a zero for a small amount (r48)", () => {
  test("a sub-cent dollar amount is under a cent, not $0.00", () => {
    expect(smallUsd(0.004)).toBe("under $0.01");
    expect(smallUsd(0.5)).toBe("$0.50");
    expect(smallUsd(0)).toBe("$0.00");
  });
  test("a token count that would round to 0.00B is shown in millions", () => {
    expect(smallTokens(300_000)).toBe("0.3M");
    expect(smallTokens(2_000_000_000)).toBe("2.00B");
  });
});

describe("a held lane says so in its capacity tooltip (r48)", () => {
  const held = {
    windows: [],
    window: "weekly",
    tokens_per_cycle: 2_063_779_400,
    cycle_days: 7,
    cycle_billed: false,
    fee_basis: "annual fee prorated to the cycle (365 days)",
    allowance_published_usd: null,
    allowance_vendor_usd: null,
    allowance_vendor_reason: null,
    allowance_derived_usd: 106.66,
    unpriced_share: 0,
    confidence: "low",
    top_models: [],
    low_coverage: false,
    stale: {
      read_at: "2026-10-20T04:00:00.000Z",
      published_on: "2026-10-20",
      current_windows: [
        { window: "5h", used_pct: 1, measured_at: "2026-10-27T05:57:00.000Z", source: "codexbar quota reading" },
        { window: "weekly", used_pct: 1, measured_at: "2026-10-27T05:57:00.000Z", source: "codexbar quota reading" },
      ],
      reason: "all windows under 2% used; capacity held at the last stable reading",
    },
  } as never;
  test("the hover panel carries the last stable reading date and the current window readings", () => {
    const lines = capDetailOf({ capacity: held } as never);
    expect(lines).toContain("last stable reading 2026-10-20; current windows read 1% / 1%; capacity held, not recomputed from the current reading");
  });
  test("a held lane states its held allowance and the figure the current reading gives", () => {
    const lines = capDetailOf({ capacity: { ...(held as object), allowance_usd_per_cycle: 106.66, allowance_derived_usd: 107.29 } } as never);
    expect(lines).toContain("allowance held at $106.66 per cycle (last stable reading); the current reading gives $107.29");
  });
  test("a lane without a stale record carries no such line", () => {
    const fresh = { ...(held as object), stale: null } as never;
    const lines = capDetailOf({ capacity: fresh } as never);
    expect(lines.some((l) => l.includes("last stable reading"))).toBe(false);
  });
});
