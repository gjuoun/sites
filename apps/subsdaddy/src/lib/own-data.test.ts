import { describe, expect, test } from "bun:test";
import { allowanceTitle, formatMs, formatShare, formatTokens, formatUsd, quotaLine, rankedLanes, unavailableReason, unavailableShort } from "./own-data";

describe("own-data formatting", () => {
  test("tokens read in B above a billion, M above a million, K below", () => {
    expect(formatTokens(1_691_901_988)).toBe("1.69B");
    expect(formatTokens(768_662_003)).toBe("769M");
    expect(formatTokens(12_345)).toBe("12K");
    expect(formatTokens(null)).toBe("N/A");
  });

  test("a share below a tenth of a percent says so, never 0.0%", () => {
    expect(formatShare(0.842)).toBe("84.2%");
    expect(formatShare(0.00034)).toBe("<0.1%");
    expect(formatShare(0)).toBe("0%");
    expect(formatShare(null)).toBe("N/A");
  });

  test("usd, ms and speed keep the site's one style", () => {
    expect(formatUsd(4.8343)).toBe("$4.83");
    expect(formatUsd(28.506)).toBe("$28.51");
    expect(formatUsd(null)).toBe("N/A");
    expect(formatMs(2404)).toBe("2,404 ms");
    expect(formatMs(null)).toBe("N/A");
  });

  test("the quota line names every window, and a lane with no reading says why", () => {
    const line = quotaLine({
      capacity: {
        window: "weekly",
        windows: [
          { window: "5h", used_pct: 0.777, resets_at: "2026-10-30T21:47:02Z" },
          { window: "weekly", used_pct: 77.51, resets_at: "2026-11-01T23:59:59Z" },
        ],
      },
    } as never);
    expect(line).toBe("5h 0.8% · weekly 77.5% · resets 2026-11-01 23:59Z");
    expect(unavailableReason([{ lane: "commandcode-goat", unavailable: "session expired", measured_at: "", source: "" }] as never, "commandcode-goat")).toBe("session expired");
    expect(unavailableReason([], "commandcode-goat")).toBe("no quota reading");
    expect(unavailableShort("Command Code session is invalid or expired. Sign in to commandcode.ai again.")).toBe("session expired, re-login needed");
    expect(unavailableShort("no quota reading")).toBe("no quota reading");
  });

  test("the allowance title names the published figure first and keeps the dashboard reading beside it", () => {
    const t = allowanceTitle({
      capacity: { allowance_published_usd: 80, allowance_vendor_usd: 70, allowance_vendor_used_usd: 35.02, allowance_derived_usd: 32.01, allowance_basis: "vendor_published" },
    } as never)!;
    expect(t).toContain("published allowance $80.00 per cycle (the headline)");
    expect(t).toContain("dashboard reading $35.02 of $70.00 used (kept for comparison)");
    expect(t).toContain("basis: vendor_published");
    expect(allowanceTitle({ capacity: { allowance_basis: null } } as never)).toBeNull();
  });

  test("lanes rank by $/B ascending, and a lane with no $/B comes last", () => {
    const lanes = [
      { lane: "a", usd_per_b: 6.24 },
      { lane: "b", usd_per_b: null },
      { lane: "c", usd_per_b: 4.83 },
    ];
    expect(rankedLanes(lanes).map((l) => l.lane)).toEqual(["c", "a", "b"]);
  });
});
