import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { DERIVED_FOOTNOTE, MEASURED, cacheShare, summaryTable, viewRows, type ViewId } from "./summary";
import { CONTEXT_IDS, type ContextId } from "../data/context";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const CC = "commandcode-goat-published";
const GO = "opencode-go-go";
const CC_LANE = "commandcode-goat";
const GO_LANE = "opencode-go";
const VIEWS: ViewId[] = [MEASURED, "deepseek-v4.1-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"];
/** Both plans appear in these model views: CommandCode lists DeepSeek and GLM only. */
const BOTH_IN: ViewId[] = ["deepseek-v4.1-flash", "glm-5.3-flash"];
const pct = (s: number) => Math.round(s * 100);
const keyOf = (view: ViewId, plan: string) => (view === MEASURED ? (plan === CC ? CC_LANE : GO_LANE) : plan);
const rowOf = (view: ViewId, ctx: ContextId, plan: string) => viewRows(ds, view, ctx).find((r) => r.key === keyOf(view, plan));

describe("Measured view: CommandCode carries OpenCode Go's derived $/B", () => {
  test("equal $/B in both contexts, because the Measured figure does not depend on the context", () => {
    for (const ctx of CONTEXT_IDS) {
      const cc = rowOf(MEASURED, ctx, CC)!;
      const go = rowOf(MEASURED, ctx, GO)!;
      expect(Math.abs(cc.usd! - go.usd!)).toBeLessThanOrEqual(0.01);
    }
  });

  test("CommandCode is starred, OpenCode Go is not, and CommandCode's capacity stays N/A", () => {
    const cc = rowOf(MEASURED, "short", CC)!;
    expect(cc.marker).toBe("*");
    expect(rowOf(MEASURED, "short", GO)!.marker).toBe("");
    expect(cc.capacity).toBeNull();
  });
});

describe("model views: each plan on its own traffic shape", () => {
  test("where both appear, CommandCode is cheaper per billion tokens than OpenCode Go, in both contexts", () => {
    for (const view of BOTH_IN) for (const ctx of CONTEXT_IDS) {
      expect(rowOf(view, ctx, CC)!.usd!).toBeLessThan(rowOf(view, ctx, GO)!.usd!);
    }
  });

  test("and CommandCode's cache-read share is higher than OpenCode Go's: the direction the $/B gap follows", () => {
    expect(cacheShare(ds, CC_LANE).share).toBeGreaterThan(cacheShare(ds, GO_LANE).share);
  });

  test("so CommandCode buys more tokens from the same $80 allowance: its capacity is above OpenCode Go's", () => {
    for (const view of BOTH_IN) {
      const cc = parseFloat(rowOf(view, "short", CC)!.capacity!);
      const go = parseFloat(rowOf(view, "short", GO)!.capacity!);
      expect(cc).toBeGreaterThan(go);
    }
  });

  test("CommandCode's model rows carry the * (its window is saturated); OpenCode Go's model rows do not", () => {
    for (const view of BOTH_IN) for (const ctx of CONTEXT_IDS) {
      expect(rowOf(view, ctx, CC)!.marker).toBe("*");
      expect(rowOf(view, ctx, GO)!.marker).toBe("");
    }
  });

  test("the Haiku and Luna views do not list CommandCode, so there is no pair to compare there", () => {
    expect(rowOf("claude-haiku-5.5", "short", CC)).toBeUndefined();
    expect(rowOf("gpt-6-luna", "short", CC)).toBeUndefined();
  });
});

describe("tooltips show the traffic shape the $/B came from", () => {
  test("every CommandCode $/B cell names its own cache-read share, in every view", () => {
    for (const view of VIEWS) for (const ctx of CONTEXT_IDS) {
      const row = rowOf(view, ctx, CC);
      if (!row) continue;
      expect(row.usdTitle).toContain("cache read " + pct(cacheShare(ds, CC_LANE).share) + "% of prompt tokens");
    }
  });

  test("OpenCode Go's model tooltip names its own, lower share", () => {
    expect(rowOf("deepseek-v4.1-flash", "short", GO)!.usdTitle).toContain("cache read " + pct(cacheShare(ds, GO_LANE).share) + "% of prompt tokens");
  });
});

describe("footnotes: at most two lines in every view and context", () => {
  test("no view has more than two footnote lines", () => {
    for (const view of VIEWS) for (const ctx of CONTEXT_IDS) {
      const lines = (summaryTable(ds, view, ctx).footnote ?? "").split("\n");
      expect(lines.length).toBeLessThanOrEqual(2);
    }
  });

  test("the views where CommandCode is starred carry the derived line; Haiku does not", () => {
    expect(summaryTable(ds, MEASURED).footnote).toContain(DERIVED_FOOTNOTE);
    for (const view of BOTH_IN) expect(summaryTable(ds, view, "short").footnote).toContain(DERIVED_FOOTNOTE);
    expect(summaryTable(ds, "claude-haiku-5.5", "short").footnote).not.toContain(DERIVED_FOOTNOTE);
  });
});
