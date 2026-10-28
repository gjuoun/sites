import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeWindow, type UsageRow, type WindowReading } from "./allowance";
import { usageSql } from "../lib/usage";
import type { RefPrice } from "./estimate";

const PRICE: RefPrice = { in_per_m: 1, out_per_m: 5, cache_per_m: 0.1, cache_write_per_m: null, overrides: [] };
const lookup = () => PRICE;
const NOW = Date.parse("2026-10-27T12:00:00.000Z");
const DAY = 86_400_000;
const APP_ROOT = join(import.meta.dir, "..", "..");

function rowsBetween(from: number, to: number): UsageRow[] {
  const out: UsageRow[] = [];
  for (let t = from; t <= to; t += 3_600_000) out.push({ ms: t, model: "m", input: 1000, cache_creation: 0, cache_read: 9000, output: 100 });
  return out;
}

/** A monthly window that started ageDays ago and has run until now. */
function monthly(ageDays: number, used: number): WindowReading {
  const start = NOW - ageDays * DAY;
  return { window: "monthly", window_minutes: 30 * 1440, used_pct: used, resets_at: new Date(start + 30 * DAY).toISOString(), measured_at: new Date(NOW).toISOString() };
}

describe("coverage is the reach of the export, not the first row of a lane (r52)", () => {
  test("an idle stretch with no rows is zero usage: a window whose export reaches its start has coverage 1", () => {
    const rows = [...rowsBetween(NOW - 8 * DAY, NOW - 6 * DAY), ...rowsBetween(NOW - 1 * DAY, NOW)];
    const a = analyzeWindow(monthly(8, 60), rows, lookup, NOW - 8 * DAY, 30 * 1440);
    expect(a.coverage).toBeGreaterThanOrEqual(0.95);
    expect(a.status).not.toBe("partial");
  });
  test("a window older than the export's reach is partial, however many rows the lane has", () => {
    const rows = rowsBetween(NOW - 2 * DAY, NOW);
    const a = analyzeWindow(monthly(8, 60), rows, lookup, NOW - 2 * DAY, 30 * 1440);
    expect(a.coverage).toBeLessThan(0.95);
    expect(a.status).toBe("partial");
  });
  test("the collector asks for 31 days, and the query has no row limit", () => {
    const sql = usageSql(31);
    expect(sql).toContain("interval '31 days'");
    expect(sql).not.toMatch(/LIMIT/i);
    const collector = readFileSync(join(APP_ROOT, "scripts", "collect-usage.ts"), "utf8");
    expect(collector).toContain("|| 31;");
  });
});

// The raw export is harvested locally and gitignored, so a clean checkout (CI) has no file to read.
// The suite skips there instead of failing: the assertions describe the shipped data, which only a
// machine holding that export can check.
const exportDir = join(APP_ROOT, "data", "raw", "usage");
const latestExport = existsSync(exportDir)
  ? readdirSync(exportDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .at(-1)
  : undefined;
const describeExport = latestExport ? describe : describe.skip;

describeExport("the shipped export reaches back past every quota window it is used for (r52)", () => {
  const dir = exportDir;
  const latest = latestExport;
  const file = latest ? JSON.parse(readFileSync(join(dir, latest), "utf8")) : null;
  const quota = JSON.parse(readFileSync(join(APP_ROOT, "data", "quota.json"), "utf8"));
  test("the latest raw export records its start, and that start is 31 days before it was taken", () => {
    expect(file).not.toBeNull();
    expect(typeof file.export_start).toBe("string");
    const days = (Date.parse(file.measured_at) - Date.parse(file.export_start)) / DAY;
    expect(Math.round(days)).toBe(31);
  });
  test("every monthly window in the quota reading starts after the export's start", () => {
    for (const o of quota.observations) for (const w of o.windows ?? []) { // an unavailable reading has no windows (r59)
      if (w.window !== "monthly") continue;
      const start = Date.parse(w.resets_at) - w.window_minutes * 60_000;
      expect(Date.parse(file.export_start) <= start).toBe(true);
    }
  });
  test("OpenCode Go's monthly window has coverage above 0.95 on the shipped data", () => {
    const allowance = JSON.parse(readFileSync(join(APP_ROOT, "data", "allowance.json"), "utf8"));
    const go = allowance.lanes.find((l: { lane: string }) => l.lane === "opencode-go");
    const monthlyW = go.windows.find((w: { window: string }) => w.window === "monthly");
    expect(monthlyW.coverage).toBeGreaterThan(0.95);
  });
});
