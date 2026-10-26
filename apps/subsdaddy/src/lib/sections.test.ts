import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { catalogTable, measuredTable, modelTable, modelTables, type DS } from "./sections";
import { wellFormed, type Cell } from "./cells";
import { REF_IDS } from "../data/estimate";

const ds = dataset as unknown as DS;
const allCells = (t: { rows: Array<{ cells: Record<string, Cell> }> }) => t.rows.flatMap((r) => Object.values(r.cells));

describe("section A: measured plans", () => {
  test("four measured plans, eight columns as the spec names them, every cell well-formed", () => {
    const t = measuredTable(ds);
    expect(t.rows.length).toBe(4);
    expect(t.columns.map((c) => c.label)).toEqual(["Plan", "Fee/mo", "Capacity", "$/B", "tok/s", "TTFT p50", "OR p50 tok/s", "Badges"]);
    for (const c of allCells(t)) expect(wellFormed(c)).toBe(true);
  });

  test("a missing OpenRouter value is N/A with its reason, never a dash or a zero", () => {
    const t = measuredTable(ds);
    for (const r of t.rows) {
      const or = r.cells.or;
      if (or.na) {
        expect(or.text).toBe("N/A");
        expect(or.reason).toBeTruthy();
      } else {
        expect(or.text).not.toBe("0");
      }
    }
  });
});

describe("regression: Section A shows each plan's own measured values", () => {
  test("every plan with a measured tok/s and TTFT shows them, not N/A (all four rows covered)", () => {
    const t = measuredTable(ds);
    expect(t.rows.length).toBe(4);
    for (const l of ds.lanes.lanes) {
      const row = t.rows.find((r) => r.key === l.lane)!;
      expect(l.measured.p50_output_tps).not.toBeNull();
      expect(l.measured.p50_ttft_ms).not.toBeNull();
      expect(row.cells.tps.na).toBe(false);
      expect(row.cells.ttft.na).toBe(false);
    }
  });

  test("a plan with no capacity reading and a derived dollar figure still shows its own speed", () => {
    const broken: DS = {
      ...ds,
      lanes: {
        ...ds.lanes,
        lanes: ds.lanes.lanes.map((l) => ({ ...l, usd_per_b: null, usd_per_b_basis: null, capacity: { ...l.capacity, tokens_per_week: null, reason: "window_saturated" } })),
      },
    };
    const t = measuredTable(broken);
    for (const r of t.rows) {
      expect(r.cells.usd.na).toBe(true);
      expect(r.cells.tps.na).toBe(false);
      expect(r.cells.ttft.na).toBe(false);
    }
  });

  test("the OpenRouter column has a value for every plan whose model is in the benchmark, and names the model it read", () => {
    const t = measuredTable(ds);
    for (const r of t.rows) {
      expect(r.cells.or.na).toBe(false);
      expect(r.cells.or.note).toMatch(/^model: /);
    }
    const cc = t.rows.find((r) => r.key === "commandcode-goat")!;
    expect(cc.cells.or.note).toBe("model: DeepSeek V4.1 Flash");
    const qwen = t.rows.find((r) => r.key === "qwen-cloud-token")!;
    expect(qwen.cells.or.note).toBe("model: deepseek/deepseek-v4.1-flash-1017");
  });
});

describe("section B: one table per reference model", () => {
  test("five model sections in the required order", () => {
    const tables = modelTables(ds);
    expect(tables.map((t) => t.ref)).toEqual(["deepseek-v4.1-flash", "gemini-3.8-flash", "claude-haiku-5.5", "gpt-6-luna", "glm-5.3-flash"]);
    expect(REF_IDS.length).toBe(5);
  });

  test("every model section names the single-model assumption at its top", () => {
    for (const t of modelTables(ds)) expect(t.table.subtitle).toContain("assumes the whole allowance is spent on");
  });

  test("the same plans appear in every model section, and every cell is well-formed", () => {
    const tables = modelTables(ds);
    const rowKeys = tables.map((t) => t.table.rows.map((r) => r.key).join(","));
    expect(new Set(rowKeys).size).toBe(1);
    for (const t of tables) for (const c of allCells(t.table)) expect(wellFormed(c)).toBe(true);
  });

  test("Gemini has no published OpenCode limit, so its estimate cell is N/A with that reason", () => {
    const gemini = modelTable(ds, "gemini-3.8-flash");
    const opencode = gemini.rows.find((r) => r.key === "opencode-go-go")!;
    expect(opencode.cells.est.na).toBe(true);
    expect(opencode.cells.est.reason).toContain("no published allowance");
  });

  test("when OpenRouter has no data for a model, its whole section is N/A with the reason, and no endpoint is invented", () => {
    const haikuOR = "anthropic/claude-haiku-5.5";
    const broken: DS = {
      ...ds,
      benchmark: {
        ...ds.benchmark,
        endpoints: ds.benchmark.endpoints.filter((e) => e.model !== haikuOR),
        models_status: ds.benchmark.models_status.map((s) => (s.model === haikuOR ? { ...s, status: "unavailable" as const, reason: "payload has no stats blocks", endpoints: 0 } : s)),
      },
    };
    const t = modelTable(broken, "claude-haiku-5.5");
    for (const r of t.rows) {
      expect(r.cells.tps.na).toBe(true);
      expect(r.cells.tps.reason).toBe("payload has no stats blocks");
      expect(r.cells.ttft.na).toBe(true);
    }
    // the estimate does not depend on OpenRouter speed, so it is still shown
    expect(t.rows.some((r) => !r.cells.est.na)).toBe(true);
  });
});

describe("catalog table", () => {
  test("every catalog row is listed, every cell well-formed, with the same column count as the spec", () => {
    const t = catalogTable(ds);
    expect(t.rows.length).toBe(ds.catalog.rows.length);
    for (const c of allCells(t)) expect(wellFormed(c)).toBe(true);
  });

  test("a credit plan with no conversion shows N/A, not an empty cell", () => {
    const t = catalogTable(ds);
    const qwen = t.rows.find((r) => r.key === "qwen-cloud-token-owner-10")!;
    expect(qwen.cells.credits.na).toBe(true);
    expect(qwen.cells.credits.reason).toBeTruthy();
  });
});
