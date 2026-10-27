import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { formatThreads, threadsOf, summaryTable, SUMMARY_COLUMNS, THREAD_WEEK_HOURS, THREAD_OCCUPANCY, SHAPES } from "./summary";
import type { DS } from "./sections";

const APP_ROOT = join(import.meta.dir, "..", "..");
const ds = dataset as unknown as DS;
const tp = ds.context.throughput;
const perSessionHour = tp.tokens_per_session_hour.aggregate;

describe("Threads: the formula uses the measured tokens per session-hour (r55)", () => {
  test("a capacity of exactly one thread-week (session-hour tokens x 168 h x 25%) is one thread", () => {
    const tokens30d = perSessionHour * THREAD_WEEK_HOURS * THREAD_OCCUPANCY * 30 / 7;
    expect(threadsOf(tokens30d, perSessionHour)).toBeCloseTo(1, 9);
  });
  test("the brief's formula: capacity per cycle / cycle days x 7, over tokens per session-hour x 168 x 0.25", () => {
    const tokensPerCycle = 2.06e9;
    const cycleDays = 7;
    const tokens30d = tokensPerCycle * 30 / cycleDays;
    const brief = (tokensPerCycle / cycleDays * 7) / (perSessionHour * 168 * 0.25);
    expect(threadsOf(tokens30d, perSessionHour)).toBeCloseTo(brief, 9);
  });
  test("a 30-day cycle and a 7-day cycle with the same weekly tokens give the same thread count", () => {
    const weekly = 1e9;
    expect(threadsOf(weekly * 30 / 7, perSessionHour)).toBeCloseTo(threadsOf(weekly * 4 * 30 / 28, perSessionHour)!, 9);
  });
  test("no capacity or no measured rate gives no thread count", () => {
    expect(threadsOf(null, perSessionHour)).toBeNull();
    expect(threadsOf(1e9, 0)).toBeNull();
  });
  test("the occupancy is the stated 25% assumption", () => {
    expect(THREAD_OCCUPANCY).toBe(0.25);
  });
});

describe("Threads: display (r54, unchanged)", () => {
  test("one decimal; below a tenth reads <0.1, never 0.0; no capacity reads N/A", () => {
    expect(formatThreads(7.73)).toBe("7.7");
    expect(formatThreads(1)).toBe("1.0");
    expect(formatThreads(0.04)).toBe("<0.1");
    expect(formatThreads(0)).toBe("<0.1");
    expect(formatThreads(null)).toBe("N/A");
  });
  test("a Codex row with no capacity in the Luna view shows N/A", () => {
    const row = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows.find((r) => r.key === "codex-go")!;
    expect(row.cells.threads.na).toBe(true);
    expect(row.cells.threads.text).toBe("N/A");
  });
  test("every shown value is N/A, <0.1, or one decimal", () => {
    for (const ref of ["claude-haiku-5.5", "gpt-6-luna", "deepseek-v4.1-flash"] as const) {
      for (const r of summaryTable(ds, ref as never, "short", SHAPES[0]).rows) expect(r.cells.threads.text).toMatch(/^(N\/A|<0\.1|\d+\.\d)$/);
    }
    for (const r of summaryTable(ds, "measured" as never).rows) expect(r.cells.threads.text).toMatch(/^(N\/A|<0\.1|\d+\.\d)$/);
  });
  test("the Claude threads grow with the allowance: Max 20x > Max 5x > Pro, in the Haiku view", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const v = (k: string) => parseFloat(rows.find((r) => r.key === k)!.cells.threads.text);
    expect(v("claude-code-max-20x")).toBeGreaterThan(v("claude-code-max-5x"));
    expect(v("claude-code-max-5x")).toBeGreaterThan(v("claude-code-pro"));
  });
});

describe("Threads: the constant is read from context.json, and the tooltip names its three inputs (r55)", () => {
  test("the column header carries est", () => {
    expect(SUMMARY_COLUMNS.find((c) => c.key === "threads")!.label).toBe("Threads est");
  });
  test("the tooltip's first line is the measured tokens per session-hour, the session-hour count and the token total", () => {
    const t = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows[0].cells.threads.title ?? "";
    const first = t.split("\n")[0];
    expect(first).toBe((perSessionHour / 1e6).toFixed(1) + "M tokens per session-hour (measured: " + tp.session_hours.toLocaleString("en-US") + " session-hours, " + (tp.tokens / 1e9).toFixed(1) + "B tokens)");
  });
  test("the tooltip's second and third lines are the 168-hour and 25% occupancy assumption, and not a vendor metric", () => {
    const t = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows[0].cells.threads.title ?? "";
    const lines = t.split("\n");
    expect(lines[1]).toBe("× 168 h × 25% occupancy assumption");
    expect(lines[2]).toBe("Not a vendor metric");
  });
  test("the constant is not typed in source: the summary reads context.json, and no source file types the old 46M figure", () => {
    const text = readFileSync(join(APP_ROOT, "src/lib/summary.ts"), "utf8");
    expect(text).toContain("const tp = ds.context.throughput;");
    expect(text).toContain("tp.tokens_per_session_hour.aggregate");
    expect(text).not.toMatch(/46[.,]\d*M|46224649|46_224_649|tokens_per_active_hour/);
  });
  test("the concurrency sample is in context.json: median, p90 and max, with the session-hour count", () => {
    expect(tp.concurrency.median).toBeGreaterThan(0);
    expect(tp.concurrency.p90).toBeGreaterThanOrEqual(tp.concurrency.median);
    expect(tp.concurrency.max).toBeGreaterThanOrEqual(tp.concurrency.p90);
    expect(tp.session_hours).toBeGreaterThan(0);
    expect(tp.active_hours).toBeGreaterThan(0);
  });
});

describe("Capacity no longer carries the hour-cap suffix (r55)", () => {
  test("the phrase capped by hours appears in no source file", () => {
    for (const f of ["src/lib/summary.ts", "src/routes/methodology.tsx"]) {
      expect(readFileSync(join(APP_ROOT, f), "utf8")).not.toContain("capped by hours");
    }
  });
});

describe("the columns fit the front page (r54)", () => {
  test("the eight column widths sum to 100%", () => {
    const sum = SUMMARY_COLUMNS.reduce((a, c) => a + parseInt(c.width, 10), 0);
    expect(SUMMARY_COLUMNS.length).toBe(8);
    expect(sum).toBe(100);
  });
});
