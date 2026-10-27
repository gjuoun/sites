import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { catalogFileSchema } from "../data/catalog";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DERIVED_FOOTNOTE, MEASURED, basisLine, orWeighted, sig2, summaryTable, viewChips, viewRows, weightedMedian, type ViewId } from "./summary";
import type { DS } from "./sections";

const ds = dataset as unknown as DS;
const catalog = catalogFileSchema.parse(JSON.parse(readFileSync(join(import.meta.dir, "..", "..", "data", "catalog.json"), "utf8")));
const cellsOf = (view: ViewId) => summaryTable(ds, view).rows.map((r) => r.cells);

describe("switch: the three states the page can show", () => {
  test("Measured is the first chip, and the five chips are the offered models with rows, in order", () => {
    const chips = viewChips(ds);
    expect(chips.map((c) => c.id)).toEqual([MEASURED, "deepseek-v4.1-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"]);
    expect(chips.map((c) => c.label)).toEqual(["Measured (own traffic)", "DeepSeek V4.1 Flash", "Claude Haiku 5.5", "GPT-6 Luna", "GLM-5.3-Flash"]);
  });

  test("Gemini 3.8 Flash has no chip, because no plan offers it", () => {
    expect(viewChips(ds).some((c) => c.id === "gemini-3.8-flash")).toBe(false);
  });

  test("Measured rows are the four measured lanes; each chip's row count matches its rows", () => {
    expect(viewRows(ds, MEASURED).length).toBe(ds.lanes.lanes.length);
    for (const c of viewChips(ds)) expect(c.rows).toBe(viewRows(ds, c.id).length);
  });
});

describe("the one table: six columns and nothing else", () => {
  test("every view has exactly Plan, Fee/mo, Capacity, $/B, tok/s, TTFT p50", () => {
    for (const c of viewChips(ds)) {
      const t = summaryTable(ds, c.id);
      expect(t.columns.map((x) => x.label)).toEqual(["Plan", "Fee/mo", "Capacity", "$/B", "tok/s", "TTFT p50"]);
    }
  });

  test("no badges on the front page, in any view", () => {
    for (const c of viewChips(ds)) for (const row of cellsOf(c.id)) for (const cell of Object.values(row)) expect(cell.badges).toEqual([]);
  });
});

describe("model view: only the plans that offer the model", () => {
  test("every row in a model view is a plan whose model list contains that model", () => {
    for (const ref of ["deepseek-v4.1-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"] as const) {
      for (const r of viewRows(ds, ref)) {
        const row = catalog.rows.find((x) => x.plan_id === r.key)!;
        expect(row.offered_models).toContain(ref);
      }
    }
  });

  test("Claude Haiku 5.5 lists the plans whose model list names it: two OpenCode plans and two Copilot plans with a value, three Claude Code plans as N/A", () => {
    const keys = viewRows(ds, "claude-haiku-5.5").map((r) => r.key).sort();
    expect(keys).toEqual(["claude-code-max-20x", "claude-code-max-5x", "claude-code-pro", "github-copilot-pro", "github-copilot-pro-plus", "opencode-go-go", "opencode-go-plus"]);
    const na = viewRows(ds, "claude-haiku-5.5").filter((r) => r.usd === null).map((r) => r.key).sort();
    expect(na).toEqual(["claude-code-max-20x", "claude-code-max-5x", "claude-code-pro"]);
  });

  test("CommandCode and QwenCloud do not list Haiku, so they are not rows in the Haiku view", () => {
    const keys = viewRows(ds, "claude-haiku-5.5").map((r) => r.key);
    expect(keys).not.toContain("commandcode-goat-published");
    expect(keys).not.toContain("qwen-cloud-token-owner-10");
  });

  test("GPT-6 Luna lists the OpenCode plans with a value and Codex Plus as a converted value; the Codex Pro and Go rows as N/A", () => {
    const rows = viewRows(ds, "gpt-6-luna");
    expect(rows.map((r) => r.key).sort()).toEqual(["codex-go", "codex-plus", "codex-pro", "codex-pro-20x", "github-copilot-pro", "github-copilot-pro-plus", "opencode-go-go", "opencode-go-plus"]);
    expect(rows.filter((r) => r.usd === null).map((r) => r.key).sort()).toEqual(["codex-go", "codex-pro", "codex-pro-20x"]);
  });

  test("an N/A official row names its reason in the title, and shows no value", () => {
    const t = summaryTable(ds, "claude-haiku-5.5");
    const row = t.rows.find((r) => r.key === "claude-code-pro")!;
    expect(row.cells.usd.na).toBe(true);
    expect(row.cells.usd.title).toContain("percentage-based limits");
    expect(row.cells.usd.text).toBe("N/A");
  });

  test("a model-view $/B title names the 100K context and the prompt band it used", () => {
    const t = summaryTable(ds, "claude-haiku-5.5");
    const oc = t.rows.find((r) => r.key === "opencode-go-go")!;
    expect(oc.cells.usd.title).toContain("≥100k ×5");
    expect(oc.cells.usd.title).toContain("100K-token context");
  });

  test("DeepSeek V4.1 Flash shows four rows, sorted by $/B ascending, first three CommandCode, OpenCode Go, OpenCode Go Plus", () => {
    const rows = viewRows(ds, "deepseek-v4.1-flash");
    expect(rows.length).toBe(4);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].usd!).toBeLessThanOrEqual(rows[i].usd!);
    expect(rows.slice(0, 3).map((r) => r.key)).toEqual(["commandcode-goat-published", "opencode-go-go", "opencode-go-plus"]);
  });

  test("the model view's Capacity is tokens per month the plan can run, fee over $/B", () => {
    const r = viewRows(ds, "deepseek-v4.1-flash")[0];
    expect(r.capacity).toMatch(/B\/mo$/);
    expect(parseFloat(r.capacity!)).toBeCloseTo(r.fee / r.usd!, 1);
  });

  test("a model with no plan gets no chip and no rows (Gemini)", () => {
    expect(viewRows(ds, "gemini-3.8-flash" as ViewId).length).toBe(0);
  });
});

describe("Measured view values", () => {
  test("the four measured rows carry a $/B, and the one lane with no capacity reading shows N/A capacity", () => {
    const rows = cellsOf(MEASURED);
    expect(rows.length).toBe(4);
    for (const r of rows) expect(r.usd.na).toBe(false);
    const cc = rows.find((r) => r.plan.text === "CommandCode - GOAT")!;
    expect(cc.capacity.na).toBe(true);
    expect(cc.capacity.text).toBe("N/A");
  });
});

describe("speeds: one value each, two significant figures, a leading tilde", () => {
  test("every tok/s and TTFT cell is a single tilde value, with no range", () => {
    for (const c of viewChips(ds)) for (const row of cellsOf(c.id)) {
      for (const k of ["tps", "ttft"] as const) {
        if (row[k].na) continue;
        expect(row[k].text).toMatch(/^~[\d,]+( ms)?$/);
        expect(row[k].text).not.toMatch(/[–-]|median/);
      }
    }
  });

  test("the N/A cells carry no visible reason line; the reason is in the title", () => {
    for (const c of viewChips(ds)) for (const row of cellsOf(c.id)) for (const cell of Object.values(row)) {
      if (cell.na) {
        expect(cell.reason).toBe("");
        expect(cell.title).toBeTruthy();
      }
    }
  });

  test("OpenRouter's speed is the request-weighted median over the model's endpoints, recomputed here", () => {
    const orId = ds.models.reference.find((r) => r.ref === "deepseek-v4.1-flash")!.openrouter!;
    const eps = ds.benchmark.endpoints.filter((e) => e.model === orId);
    const tps = weightedMedian(eps.filter((e) => e.p50_throughput !== null).map((e) => ({ value: e.p50_throughput as number, weight: e.request_count ?? 0 })));
    const ttft = weightedMedian(eps.filter((e) => e.p50_latency_ms !== null).map((e) => ({ value: e.p50_latency_ms as number, weight: e.request_count ?? 0 })));
    const w = orWeighted(ds, "deepseek-v4.1-flash");
    expect(w.tps).toBe(tps);
    expect(w.ttft).toBe(ttft);
    expect(w.title).toContain(orId);
  });

  test("sig2 keeps two significant figures and groups thousands", () => {
    expect(sig2(126)).toBe("130");
    expect(sig2(3700)).toBe("3,700");
    expect(sig2(520)).toBe("520");
    expect(sig2(7103)).toBe("7,100");
  });
});

describe("weighted median", () => {
  test("half the weight at or below the value", () => {
    expect(weightedMedian([{ value: 1, weight: 1 }, { value: 2, weight: 1 }, { value: 3, weight: 1 }])).toBe(2);
  });

  test("one heavy endpoint decides the median", () => {
    expect(weightedMedian([{ value: 100, weight: 1 }, { value: 200, weight: 10 }])).toBe(200);
  });

  test("no weight gives no median, never zero", () => {
    expect(weightedMedian([])).toBeNull();
    expect(weightedMedian([{ value: 5, weight: 0 }])).toBeNull();
  });
});

describe("derived $/B is marked, and only derived $/B", () => {
  const derivedLanes = ds.lanes.lanes.filter((l) => l.usd_per_b_basis === "derived").map((l) => l.label);

  test("the derived Measured row carries the star; no other Measured row does", () => {
    const rows = summaryTable(ds, MEASURED).rows;
    for (const r of rows) {
      const isDerived = derivedLanes.includes(r.cells.plan.text);
      expect(r.cells.usd.text.endsWith("*")).toBe(isDerived);
    }
    expect(derivedLanes.length).toBeGreaterThan(0);
  });

  test("the footnote is the one derived line, and it appears only when a row is derived", () => {
    expect(summaryTable(ds, MEASURED).footnote).toContain(DERIVED_FOOTNOTE);
    expect(DERIVED_FOOTNOTE.startsWith("* derived from the same-rate peer plan")).toBe(true);
  });

  test("model views have no derived $/B except CommandCode, whose window is saturated; a context footnote", () => {
    for (const ref of ["deepseek-v4.1-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"] as const) {
      const t = summaryTable(ds, ref);
      expect(t.footnote).toContain("token context");
      for (const r of t.rows) expect(r.cells.usd.text.endsWith("*")).toBe(r.key === "commandcode-goat-published");
    }
  });

  test("the stars sit on the value, not in the plan label", () => {
    for (const r of summaryTable(ds, MEASURED).rows) expect(r.cells.plan.text.endsWith("*")).toBe(false);
  });
});

describe("speed basis line, one line under the switch", () => {
  test("Measured reads ours, from usage logs", () => {
    expect(basisLine(ds, MEASURED)).toBe("ours, from usage logs");
  });

  test("a model view names the OpenRouter model it read, with the 30-minute window, and no sample sizes", () => {
    const line = basisLine(ds, "deepseek-v4.1-flash");
    expect(line).toBe("tok/s and TTFT are OpenRouter p50 weighted by request volume for deepseek/deepseek-v4.1-flash (30-minute window)");
    expect(line).not.toMatch(/endpoint|request_count|\d+ requests/);
  });
});

describe("weighting: the heavy endpoint decides, not the middle one", () => {
  test("a weighted median is neither the unweighted median nor the best endpoint", () => {
    const pts = [{ value: 10, weight: 1 }, { value: 20, weight: 1 }, { value: 30, weight: 98 }];
    expect(weightedMedian(pts)).toBe(30);
    expect(weightedMedian(pts)).not.toBe(20);
  });
});
