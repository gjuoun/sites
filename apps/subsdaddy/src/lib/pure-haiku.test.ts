import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { summaryTable, viewRows, SHAPES, MEASURED, MEASURED_MIX_FOOTNOTE } from "./summary";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const file = JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "third-party-allowances.json"), "utf8"));
const anchorOf = (id: string) => file.entries.find((e: { plan_id: string }) => e.plan_id === id).token_anchor;
const capB = (id: string) => (anchorOf(id).weekly_tokens_total * 30 / 7) / 1e9;
const FEE: Record<string, number> = { "claude-code-pro": 20, "claude-code-max-5x": 100, "claude-code-max-20x": 200 };
const CLAUDE = ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"];

describe("Claude capacity is the measured token anchor, the same in every view (r59)", () => {
  test("the Haiku view shows each Claude plan at anchor x 30/7, whatever the shape and context", () => {
    for (const id of CLAUDE) {
      const seen = new Set<string>();
      for (const ctx of ["short", "long"] as const) for (const s of SHAPES) {
        const row = summaryTable(ds, "claude-haiku-5.5" as never, ctx, s).rows.find((r) => r.key === id)!;
        seen.add(row.cells.capacity.text);
      }
      expect(seen.size).toBe(1);
      expect([...seen][0]).toBe(capB(id).toFixed(2) + "B/30d");
    }
  });
  test("$/B is fee over that measured capacity, and is the same under every shape and context", () => {
    for (const id of CLAUDE) {
      const seen = new Set<string>();
      for (const ctx of ["short", "long"] as const) for (const s of SHAPES) {
        const row = viewRows(ds, "claude-haiku-5.5" as never, ctx, s).find((r) => r.key === id)!;
        seen.add(row.usd!.toFixed(9));
      }
      expect(seen.size).toBe(1);
      expect(Number([...seen][0])).toBeCloseTo(FEE[id] / capB(id), 6);
    }
  });
  test("the Max 5x $/B is about 4.47, the Max 20x about 22.4 and the Pro about 33.1 (from the anchors)", () => {
    const v = (id: string) => viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).find((r) => r.key === id)!.usd!;
    expect(v("claude-code-max-5x")).toBeCloseTo(4.47, 1);
    expect(v("claude-code-max-20x")).toBeCloseTo(22.4, 1);
    expect(v("claude-code-pro")).toBeCloseTo(33.1, 1);
  });
  test("no Claude row is N/A: the anchors are present for all three", () => {
    for (const r of summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows) {
      if (!r.key.startsWith("claude-code")) continue;
      expect(r.cells.capacity.na).toBe(false);
      expect(r.cells.usd.na).toBe(false);
    }
  });
});

describe("the tooltip shows the value multiple and says the mix is not comparable (r59)", () => {
  const cap = (id: string) => summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === id)!.cells.capacity;
  test("each Claude capacity cell carries the measured-mix suffix and the three required lines", () => {
    for (const id of CLAUDE) {
      const c = cap(id);
      expect(c.note).toBe("@measured mix");
      expect(c.title ?? "").toContain("capacity: " + capB(id).toFixed(2) + "B tokens/30d, measured on a real account");
      expect(c.title ?? "").toContain("value: ");
      expect(c.title ?? "").toContain("not comparable across plans");
    }
  });
  test("the value multiples are weekly API value over the monthly fee: Max 5x 17.2x, Max 20x 8.0x, Pro 7.8x", () => {
    expect(cap("claude-code-max-5x").title ?? "").toContain("value: 17.2×");
    expect(cap("claude-code-max-20x").title ?? "").toContain("value: 8.0×");
    expect(cap("claude-code-pro").title ?? "").toContain("value: 7.8×");
  });
  test("the tooltip also states the displayed allowance's multiple, so the two figures can be reconciled", () => {
    expect(cap("claude-code-max-5x").title ?? "").toContain("allowance shown: 9.4×");
    expect(cap("claude-code-max-20x").title ?? "").toContain("allowance shown: 6.8×");
  });
  test("the 5x anchor is at the cap; the 20x and Pro anchors are average traffic, and the tooltip says so", () => {
    expect(cap("claude-code-max-5x").title ?? "").toContain("measurement: at the weekly limit, one account");
    expect(cap("claude-code-max-20x").title ?? "").toContain("average weekly traffic, not a cap reading");
    expect(cap("claude-code-pro").title ?? "").toContain("average weekly traffic, not a cap reading");
  });
  test("the Haiku footnote carries the measured-mix line; the Measured view does not", () => {
    expect(summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).footnote ?? "").toContain(MEASURED_MIX_FOOTNOTE);
    expect(summaryTable(ds, MEASURED).footnote ?? "").not.toContain(MEASURED_MIX_FOOTNOTE);
  });
});

describe("Codex has no token anchor, so capacity and $/B are N/A with the source's reason (r59)", () => {
  test("Codex Pro 5x and Pro 20x: capacity and $/B N/A, reason names the missing token count; allowance kept", () => {
    const rows = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]);
    for (const id of ["codex-pro", "codex-pro-20x"]) {
      const v = rows.find((r) => r.key === id)!;
      expect(v.capacity).toBeNull();
      expect(v.usd).toBeNull();
      expect(v.capacityReason).toContain("no token count published by the source");
      expect(v.allowance).not.toBeNull();
    }
  });
  test("no cell in any Claude or Codex row contains @sonnet or @luna", () => {
    for (const ctx of ["short", "long"] as const) for (const s of SHAPES) for (const ref of ["claude-haiku-5.5", "gpt-6-luna"] as const) {
      for (const row of summaryTable(ds, ref as never, ctx, s).rows) for (const c of Object.values(row.cells)) {
        expect(c.text).not.toMatch(/@sonnet|@luna/i);
        expect(c.note ?? "").not.toMatch(/@sonnet|@luna|sonnet mix/i);
      }
    }
  });
});
