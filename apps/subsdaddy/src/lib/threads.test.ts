import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { formatThreads, threadsOf, physicsOf, summaryTable, SUMMARY_COLUMNS, THREAD_WEEK_HOURS, SHAPES } from "./summary";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const heavy = ds.context.throughput.tokens_per_active_hour.p50;

describe("Threads: the formula (r54)", () => {
  test("a capacity of exactly one week at the burn rate is one thread", () => {
    const tokens30d = heavy * THREAD_WEEK_HOURS * 30 / 7;
    expect(threadsOf(tokens30d, heavy)).toBeCloseTo(1, 9);
  });
  test("a 7-day cycle gives the brief's formula: capacity per cycle / cycle days x 7, over one thread's weekly tokens", () => {
    const tokensPerCycle = 2.06e9;
    const cycleDays = 7;
    const tokens30d = tokensPerCycle * 30 / cycleDays;
    const brief = (tokensPerCycle / cycleDays * 7) / (heavy * 168);
    expect(threadsOf(tokens30d, heavy)).toBeCloseTo(brief, 9);
  });
  test("a 30-day cycle gives the same answer as a 7-day cycle of the same weekly tokens", () => {
    const weekly = 1e9;
    expect(threadsOf(weekly * 30 / 7, heavy)).toBeCloseTo(threadsOf(weekly * 4 * 30 / 28, heavy)!, 9);
  });
  test("no capacity or no burn rate gives no thread count", () => {
    expect(threadsOf(null, heavy)).toBeNull();
    expect(threadsOf(1e9, 0)).toBeNull();
  });
});

describe("Threads: display (r54)", () => {
  test("one decimal", () => {
    expect(formatThreads(7.73)).toBe("7.7");
    expect(formatThreads(1)).toBe("1.0");
  });
  test("below a tenth reads <0.1, never 0.0", () => {
    expect(formatThreads(0.04)).toBe("<0.1");
    expect(formatThreads(0)).toBe("<0.1");
    expect(formatThreads(0.1)).toBe("0.1");
  });
  test("no capacity reads N/A", () => {
    expect(formatThreads(null)).toBe("N/A");
  });
  test("a Codex row with no capacity in the Luna view shows N/A, with the reason in its title", () => {
    const row = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows.find((r) => r.key === "codex-go")!;
    expect(row.cells.threads.na).toBe(true);
    expect(row.cells.threads.text).toBe("N/A");
  });
  test("every shown value is N/A, <0.1, or one decimal", () => {
    for (const ref of ["claude-haiku-5.5", "gpt-6-luna", "deepseek-v4.1-flash"] as const) {
      for (const r of summaryTable(ds, ref as never, "short", SHAPES[0]).rows) {
        expect(r.cells.threads.text).toMatch(/^(N\/A|<0\.1|\d+\.\d)$/);
      }
    }
    for (const r of summaryTable(ds, "measured" as never).rows) expect(r.cells.threads.text).toMatch(/^(N\/A|<0\.1|\d+\.\d)$/);
  });
});

describe("Threads: the label and the tooltip say it is derived (r54)", () => {
  test("the column header carries est", () => {
    expect(SUMMARY_COLUMNS.find((c) => c.key === "threads")!.label).toBe("Threads est");
  });
  test("every Threads cell with a value names the formula, the burn rate, the inputs, and that it is not a vendor figure", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    for (const r of rows) {
      const t = r.cells.threads;
      if (t.na) continue;
      expect(t.title ?? "").toContain("derived: capacity per week ÷ (" + (heavy / 1e6).toFixed(1) + "M tokens per active hour × 168 h).");
      expect(t.title ?? "").toContain("Not a vendor figure.");
    }
  });
  test("the Claude rows in the Haiku view are at the hour ceiling, so each reads one thread (r54)", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    for (const k of ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"]) {
      expect(rows.find((r) => r.key === k)!.cells.threads.text).toBe("1.0");
    }
  });
});

describe("Threads: N/A rows carry no capacity into the thread count (r54)", () => {
  test("physicsOf clears tokens30d, so a row it marks N/A cannot report a thread count", () => {
    const over = { tokens30d: heavy * 730 * 3, key: "x", label: "x", fee: 1, capacity: "9B/mo", capacityReason: "", capDetail: null, capNote: null, capTitle: null, allowance: null, allowanceReason: "", usd: 1, usdTitle: "", marker: "", tps: null, tpsTitle: "", ttft: null, ttftTitle: "" } as never;
    const out = physicsOf(over, ds);
    expect(out.capacity).toBeNull();
    expect(out.tokens30d).toBeNull();
  });
});

describe("Threads: the columns fit the front page (r54)", () => {
  test("the eight column widths sum to 100%", () => {
    const sum = SUMMARY_COLUMNS.reduce((a, c) => a + parseInt(c.width, 10), 0);
    expect(SUMMARY_COLUMNS.length).toBe(8);
    expect(sum).toBe(100);
  });
});
