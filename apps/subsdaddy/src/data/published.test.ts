import { describe, expect, test } from "bun:test";
import { resolvePublished, nextSnapshot, staleSentence, isTrusted, type Stable, type WindowUse } from "./published";

const STORED: Stable = {
  read_at: "2026-10-20T04:00:00.000Z",
  measured_at: "2026-10-20T04:00:00.000Z",
  source: "test",
  published_on: "2026-10-20",
  binding_window: "weekly",
  cycle_days: 7,
  fee_per_cycle_usd: 12.89,
  tokens_per_cycle: 1_500_000_000,
  allowance_usd_per_cycle: 100,
  allowance_basis: "derived",
  usd_per_b_measured: 8.6,
  windows: [{ window: "5h", used_pct: 9, measured_at: "2026-10-20T04:00:00.000Z", source: "test" }, { window: "weekly", used_pct: 14, measured_at: "2026-10-20T04:00:00.000Z", source: "test" }],
};

/** A candidate the current reading would give: different from the stored one, as a jittering low reading would make it. */
const candidateAt = (pct: number): Stable => ({
  ...STORED,
  read_at: "2026-10-27T05:57:00.000Z",
  measured_at: "2026-10-27T05:57:00.000Z",
  source: "test",
  published_on: "2026-10-27",
  tokens_per_cycle: 1_500_000_000 * (1 / (pct / 100)),
  usd_per_b_measured: 8.6 * (pct / 100),
  windows: [{ window: "5h", used_pct: pct, measured_at: "2026-10-27T05:57:00.000Z", source: "test" }, { window: "weekly", used_pct: pct, measured_at: "2026-10-27T05:57:00.000Z", source: "test" }],
});

const at = "2026-10-27T05:57:00.000Z";
const low = (a: number, b: number): WindowUse[] => [{ window: "5h", used_pct: a, measured_at: at, source: "test" }, { window: "weekly", used_pct: b, measured_at: at, source: "test" }];

describe("a lane with low-signal windows holds its last stable reading (r48)", () => {
  test("stale: all windows under 2% use the stored reading, and the current windows are reported beside it", () => {
    const res = resolvePublished({ windows: low(1, 1), candidate: candidateAt(1), snapshot: STORED });
    expect(res.mode).toBe("stale");
    if (res.mode !== "stale") throw new Error("expected stale");
    expect(res.stable).toBe(STORED);
    expect(res.current).toEqual(low(1, 1));
  });

  test("the snapshot is not overwritten by a low-signal build: the stored reading comes back unchanged", () => {
    const res = resolvePublished({ windows: low(1, 1), candidate: candidateAt(1), snapshot: STORED });
    const next = nextSnapshot(STORED, res);
    expect(next).toBe(STORED);
    expect(next!.read_at).toBe("2026-10-20T04:00:00.000Z");
    const again = nextSnapshot(next, resolvePublished({ windows: low(1.2, 1.1), candidate: candidateAt(1.2), snapshot: next }));
    expect(again).toBe(STORED);
  });

  test("fresh: a window above 2% recomputes from the reading and replaces the stored one", () => {
    const fresh = candidateAt(6);
    const res = resolvePublished({ windows: low(1, 6), candidate: fresh, snapshot: STORED });
    expect(res.mode).toBe("fresh");
    expect(nextSnapshot(STORED, res)).toBe(fresh);
  });

  test("first run with no stored reading and all windows low is N/A, with the reason", () => {
    const res = resolvePublished({ windows: low(1, 1), candidate: candidateAt(1), snapshot: null });
    expect(res.mode).toBe("unavailable");
    if (res.mode !== "unavailable") throw new Error("expected unavailable");
    expect(res.reason).toContain("N/A until a window passes 2% used");
    expect(nextSnapshot(null, res)).toBeNull();
  });

  test("a window above 2% with no usable allowance is N/A, never a held value", () => {
    const res = resolvePublished({ windows: low(1, 6), candidate: null, snapshot: STORED });
    expect(res.mode).toBe("unavailable");
  });
});

describe("stability: two refreshes at readings near 1% publish the same $/B (r48)", () => {
  test("the published $/B at 1.0% and 1.2% used is identical (held, so within 1%)", () => {
    const a = resolvePublished({ windows: low(1.0, 1.0), candidate: candidateAt(1.0), snapshot: STORED });
    const b = resolvePublished({ windows: low(1.2, 1.2), candidate: candidateAt(1.2), snapshot: STORED });
    const usdA = a.mode === "stale" ? a.stable.usd_per_b_measured : NaN;
    const usdB = b.mode === "stale" ? b.stable.usd_per_b_measured : NaN;
    expect(Math.abs(usdA - usdB) / usdA).toBeLessThan(0.01);
    expect(usdA).toBe(usdB);
  });
  test("the candidates themselves differ by about 20%, which is why the lane holds rather than recomputes", () => {
    expect(Math.abs(candidateAt(1.0).usd_per_b_measured - candidateAt(1.2).usd_per_b_measured) / candidateAt(1.0).usd_per_b_measured).toBeGreaterThan(0.15);
  });
});

describe("threshold and sentence", () => {
  test("exactly 2% is low signal; 2.1% is trusted", () => {
    expect(isTrusted(low(2, 2))).toBe(false);
    expect(isTrusted(low(2.1, 2))).toBe(true);
  });
  test("the tooltip sentence names the stable reading date and the current windows", () => {
    expect(staleSentence("2026-10-20T04:00:00.000Z", low(1, 1))).toBe("last stable reading 2026-10-20; current windows read 1% / 1%");
  });
});
