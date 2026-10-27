import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { ALL_SHAPES, SHAPES, MEASURED, summaryTable, viewChips, viewRows, BRING_YOUR_OWN } from "./summary";
import { CONTEXT_IDS } from "../data/context";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const usage = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "usage.json"), "utf8"));

describe("Allowance: the seventh column", () => {
  test("the columns are Plan, Fee/mo, Allowance, Capacity, $/B, tok/s, TTFT p50 in every view", () => {
    for (const c of viewChips(ds)) {
      expect(summaryTable(ds, c.id).columns.map((x) => x.label)).toEqual(["Plan", "Fee/mo", "Allowance", "Capacity", "$/B", "tok/s", "TTFT p50"]);
    }
  });

  test("every row that has a $/B has a non-empty Allowance, with a source marker from p, r, d or c", () => {
    for (const c of viewChips(ds)) for (const ctx of CONTEXT_IDS) for (const s of SHAPES) {
      for (const r of summaryTable(ds, c.id, ctx, s).rows) {
        const u = r.cells.usd;
        if (u.na) continue;
        const a = r.cells.allowance;
        expect(a.na).toBe(false);
        expect(["p", "r", "d", "c"]).toContain((a as { sup?: string }).sup ?? "");
      }
    }
  });

  test("the marker follows the recorded basis: vendor_published p, derived d, credit value c", () => {
    const want = new Map<string, string>();
    for (const l of ds.lanes.lanes) {
      const b = l.capacity.allowance_basis;
      const credit = ds.catalog.rows.find((r: any) => r.measured_lane === l.lane)?.credits_to_usd;
      want.set(l.lane, b === "vendor_published" ? "p" : b === "derived" ? (credit ? "c" : "d") : b === "vendor_reported" ? "r" : "?");
    }
    for (const r of summaryTable(ds, MEASURED).rows) {
      expect((r.cells.allowance as { sup?: string }).sup).toBe(want.get(r.key));
    }
  });

  test("the tooltip names every source of a lane's allowance: published, dashboard pool, derived", () => {
    const cc = ds.lanes.lanes.find((l) => l.lane === "commandcode-goat")!.capacity;
    const t = summaryTable(ds, MEASURED).rows.find((r) => r.key === "commandcode-goat")!.cells.allowance.title ?? "";
    expect(t).toContain("published $" + cc.allowance_published_usd!.toFixed(2));
    expect(t).toContain("dashboard pool $" + cc.allowance_vendor_usd!.toFixed(2));
    expect(t).toContain("derived $" + cc.allowance_derived_usd!.toFixed(2));
  });

  test("the footnote names the four sources, each with an example", () => {
    const t = summaryTable(ds, MEASURED).footnote ?? "";
    for (const k of ["p published (", "r vendor reading (", "d derived from quota windows (", "c credit value ("]) expect(t).toContain(k);
  });
});

describe("Measured: the cache share is in the tooltip and matches usage.json", () => {
  test("each lane's $/B tooltip carries cache read % equal to usage.json cache_share within 0.001", () => {
    for (const l of ds.lanes.lanes) {
      const row = summaryTable(ds, MEASURED).rows.find((r) => r.key === l.lane)!;
      const m = (row.cells.usd.title ?? "").match(/cache read ([\d.]+)% of prompt/);
      expect(m).not.toBeNull();
      const u = usage.lanes.find((x: { lane: string }) => x.lane === l.lane);
      expect(Math.abs(Number(m![1]) / 100 - u.cache_share)).toBeLessThan(0.001);
    }
  });

  test("the capacity line under each lane shows the same cache share", () => {
    for (const r of summaryTable(ds, MEASURED).rows) expect(r.cells.capacity.note ?? "").toMatch(/cache [\d.]+%/);
  });
});

describe("CommandCode and OpenCode Go: equal under every shape and context", () => {
  test("with their published $80 pools the two $/B are equal in every shape and both contexts", () => {
    for (const ctx of CONTEXT_IDS) for (const s of SHAPES) {
      const rows = viewRows(ds, "deepseek-v4.1-flash" as never, ctx, s);
      const cc = rows.find((r) => r.key.startsWith("commandcode"))!;
      const go = rows.find((r) => r.key === "opencode-go-go")!;
      expect(cc.usd).not.toBeNull();
      expect(Math.abs(cc.usd! - go.usd!)).toBeLessThan(1e-9);
      expect(go.allowance!.usd).toBe(80);
      expect(go.allowance!.sup).toBe("p");
    }
  });
});

describe("the collector's shape is data, not UI", () => {
  test("custom is in the data, disabled, with no shares", () => {
    const c = ALL_SHAPES.find((s) => s.id === "custom")!;
    expect(c.enabled).toBe(false);
    expect(c.cache_read_share_of_prompt).toBeNull();
    expect(c.source).toBe("local collector — not yet released");
  });
  test("the Shape switch offers the three enabled shapes and never custom", () => {
    expect(SHAPES.map((s) => s.id)).toEqual(["cache_heavy", "agent", "cold"]);
  });
  test("every view carries the bring-your-own line", () => {
    for (const c of viewChips(ds)) expect((summaryTable(ds, c.id).footnote ?? "").split("\n")).toContain(BRING_YOUR_OWN);
  });
});
