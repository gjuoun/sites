import { describe, expect, test } from "bun:test";
import { analyzeWindow, bindingWindow, type UsageRow, type WindowReading } from "./allowance";
import { capDetailOf } from "../lib/summary";
import { dataset } from "../lib/dataset";
import type { RefPrice } from "./estimate";

const PRICE: RefPrice = { in_per_m: 1, out_per_m: 5, cache_per_m: 0.1, cache_write_per_m: null, overrides: [] };
const lookup = () => PRICE;
const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const DAY = 86_400_000;

/** Usage rows every hour over the last `days` days, the same shape in both tests. */
function rowsOver(days: number, from = NOW - days * DAY): UsageRow[] {
  const out: UsageRow[] = [];
  for (let t = from; t <= NOW; t += 3_600_000) out.push({ ms: t, model: "m", input: 1000, cache_creation: 0, cache_read: 9000, output: 100 });
  return out;
}

const reading = (window: "5h" | "weekly" | "monthly", minutes: number, used: number): WindowReading => ({
  window, window_minutes: minutes, used_pct: used,
  resets_at: new Date(NOW + minutes * 60_000 - minutes * 60_000 + minutes * 60_000).toISOString(),
  measured_at: new Date(NOW).toISOString(),
});

/** A window that started `ageDays` ago: its span is [NOW - ageDays, NOW]. The monthly span here is 30 days; the reading started 8 days ago. */
function window(name: "weekly" | "monthly", lengthDays: number, ageDays: number, used: number): WindowReading {
  const start = NOW - ageDays * DAY;
  return { window: name, window_minutes: lengthDays * 1440, used_pct: used, resets_at: new Date(start + lengthDays * DAY).toISOString(), measured_at: new Date(NOW).toISOString() };
}

describe("a window is a binding candidate only with coverage of 95% or more (r51)", () => {
  test("a monthly window whose lane log starts 6 days into its 8-day span has coverage below 0.95 and is partial", () => {
    const w = window("monthly", 30, 8, 70);
    const a = analyzeWindow(w, rowsOver(2), lookup, NOW - 2 * DAY, 30 * 1440);
    expect(a.coverage).toBeLessThan(0.95);
    expect(a.status).toBe("partial");
    expect(a.allowance_usd_cycle).toBeNull();
  });
  test("a partial window never binds, even when its allowance would be the tighter one", () => {
    const weekly = analyzeWindow(window("weekly", 7, 2, 40), rowsOver(2), lookup, NOW - 2 * DAY, 30 * 1440);
    const monthly = analyzeWindow(window("monthly", 30, 8, 70), rowsOver(2), lookup, NOW - 2 * DAY, 30 * 1440);
    expect(weekly.status).toBe("usable");
    expect(monthly.status).toBe("partial");
    expect(bindingWindow([monthly, weekly])!.window).toBe("weekly");
  });
  test("the same monthly window with its full log is covered (coverage 1) and binds", () => {
    const full = analyzeWindow(window("monthly", 30, 8, 70), rowsOver(8), lookup, NOW - 8 * DAY, 30 * 1440);
    expect(full.coverage).toBeGreaterThanOrEqual(0.95);
    expect(bindingWindow([full])!.window).toBe("monthly");
  });
  test("when every window is partial there is no binding window: the lane holds or is N/A, not recomputed", () => {
    const a = analyzeWindow(window("monthly", 30, 8, 70), rowsOver(2), lookup, NOW - 2 * DAY, 30 * 1440);
    const b = analyzeWindow(window("weekly", 7, 7.5, 60), rowsOver(1), lookup, NOW - 1 * DAY, 30 * 1440);
    expect(a.status).toBe("partial");
    expect(b.coverage).toBeLessThan(0.95);
    expect(bindingWindow([a, b])).toBeNull();
  });
});

describe("the tooltip names the binding window and the partial windows (r51)", () => {
  const ds = dataset as unknown as { lanes: { lanes: Array<{ lane: string; capacity: any }> } };
  test("the Measured tooltip for OpenCode Go names its binding window", () => {
    const go = ds.lanes.lanes.find((l) => l.lane === "opencode-go")!;
    const lines = capDetailOf(go as never);
    expect(lines.some((x) => x.startsWith("binding: " + go.capacity.window + " window"))).toBe(true);
  });
  test("a partial window appears in the tooltip with its coverage, so the exclusion is visible (r52: checked on a synthetic window)", () => {
    const partial = { window: "monthly", used_pct: 70, status: "partial", coverage: 0.24, cost_usd: 1, tokens: 1e9, unpriced_share: 0, allowance_usd_cycle: null, confidence: "normal", elapsed_hours: 1, unpriced_models: [] };
    const lines = capDetailOf({ capacity: { windows: [partial], tokens_per_cycle: null, top_models: [], confidence: "normal", window: null, cycle_days: 30 } } as never);
    expect(lines.some((x) => x.includes("partial coverage 24% of span (excluded from binding)"))).toBe(true);
  });
  test("the shipped Go monthly window is no longer partial after the 31-day export (r52)", () => {
    const go = ds.lanes.lanes.find((l) => l.lane === "opencode-go")!;
    const monthly = go.capacity.windows.find((w: any) => w.window === "monthly");
    if (!monthly) throw new Error("no monthly window recorded");
    expect(monthly.coverage).toBeGreaterThan(0.95);
    expect(monthly.status).not.toBe("partial");
  });
});
