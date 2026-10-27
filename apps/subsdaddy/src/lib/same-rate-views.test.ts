import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { MEASURED, viewRows, summaryTable, type ViewId } from "./summary";
import { CONTEXT_IDS, type ContextId } from "../data/context";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const CC = "commandcode-goat-published";
const GO = "opencode-go-go";
const VIEWS: ViewId[] = [MEASURED, "deepseek-v4.1-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"];
/** The Measured view keys its rows by lane; the model views key them by plan. */
const keyOf = (view: ViewId, plan: string) => (view === MEASURED ? (plan === CC ? "commandcode-goat" : "opencode-go") : plan);

/** Every view and both contexts: the CommandCode and OpenCode Go rows where both are present. */
function pairs() {
  const out: Array<{ view: ViewId; ctx: ContextId; cc: ReturnType<typeof viewRows>[number]; go: ReturnType<typeof viewRows>[number] }> = [];
  for (const view of VIEWS) for (const ctx of CONTEXT_IDS) {
    const rows = viewRows(ds, view, ctx);
    const cc = rows.find((r) => r.key === keyOf(view, CC));
    const go = rows.find((r) => r.key === keyOf(view, GO));
    if (cc && go) out.push({ view, ctx, cc, go });
  }
  return out;
}

describe("CommandCode and OpenCode Go show the same $/B in every view and both contexts", () => {
  test("every view where both plans appear has equal $/B (difference no more than 0.01)", () => {
    const p = pairs();
    expect(p.length).toBeGreaterThanOrEqual(6);
    for (const x of p) {
      expect(x.cc.usd).not.toBeNull();
      expect(Math.abs(x.cc.usd! - x.go.usd!)).toBeLessThanOrEqual(0.01);
    }
  });

  test("and the same capacity in the model views, because the fee is the same (Measured keeps CommandCode's capacity N/A)", () => {
    for (const x of pairs()) if (x.view !== MEASURED) expect(x.cc.capacity).toBe(x.go.capacity);
  });

  test("the views are Measured, DeepSeek and GLM (CommandCode lists those models); Haiku and Luna do not list CommandCode", () => {
    const have = new Set(pairs().map((x) => x.view));
    expect(have.has(MEASURED)).toBe(true);
    expect(have.has("deepseek-v4.1-flash")).toBe(true);
    expect(have.has("glm-5.3-flash")).toBe(true);
    expect(have.has("claude-haiku-5.5")).toBe(false);
    expect(have.has("gpt-6-luna")).toBe(false);
  });

  test("every CommandCode row carries the * mark in its $/B; OpenCode Go's model rows do not", () => {
    for (const view of VIEWS) for (const ctx of CONTEXT_IDS) {
      const t = summaryTable(ds, view, ctx);
      const cc = t.rows.find((r) => r.key === keyOf(view, CC));
      const go = t.rows.find((r) => r.key === keyOf(view, GO));
      if (cc) expect(cc.cells.usd.text.endsWith("*")).toBe(true);
      if (go && view !== MEASURED) expect(go.cells.usd.text.endsWith("*")).toBe(false);
    }
  });
});
