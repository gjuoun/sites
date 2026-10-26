import { describe, expect, test } from "bun:test";
import { dataset } from "./dataset";
import { catalogTable, measuredTable, modelTable, modelTables, type DS } from "./sections";
import { wellFormed, type Cell } from "./cells";
import { REF_IDS, REF_NAMES } from "../data/estimate";
import { BADGE_KINDS, BADGE_VARIANT } from "./cells";

const ds = dataset as unknown as DS;
/** An OpenRouter model id: a known vendor, a slash, then the model. "fee/allowance" is not one. */
const RAW_ID = /\b(deepseek|google|anthropic|openai|z-ai|qwen)\/[a-z0-9.-]+/;
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

describe("badges and names", () => {
  test("the site uses three badge variants, and every badge kind maps to one of them", () => {
    expect(new Set(Object.values(BADGE_VARIANT))).toEqual(new Set(["source", "confidence", "status"]));
    for (const k of BADGE_KINDS) expect(["source", "confidence", "status"]).toContain(BADGE_VARIANT[k]);
  });

  test("Section A's badges column names each flag and is blank when there are none; it never shows a count", () => {
    const t = measuredTable(ds);
    for (const r of t.rows) {
      const c = r.cells.badges;
      expect(c.flags).toBe(true);
      expect(c.text).toBe("");
      for (const b of c.badges) expect(BADGE_KINDS).toContain(b);
      expect(c.badges.some((b) => /flag/.test(b))).toBe(false);
    }
    const cc = t.rows.find((r) => r.key === "commandcode-goat")!;
    expect(cc.cells.badges.badges).toEqual([]);
    expect(cc.cells.capacity.reason).toContain("window_saturated");
    const opencode = t.rows.find((r) => r.key === "opencode-go")!;
    expect(opencode.cells.badges.badges).toContain("single_account_reading");
  });

  test("display names are the ones in data/models.json, and the reference names match the estimate names", () => {
    for (const r of ds.models.reference) expect(r.name).toBe(REF_NAMES[r.ref as keyof typeof REF_NAMES]);
  });

  test("no visible cell shows a raw model id: ids with a slash are never cell text or secondary text", () => {
    const tables = [measuredTable(ds), catalogTable(ds), ...modelTables(ds).map((m) => m.table)];
    for (const t of tables) for (const c of allCells(t)) {
      expect(RAW_ID.test(c.text)).toBe(false);
      expect(RAW_ID.test(c.note ?? "")).toBe(false);
    }
  });

  test("a speed cell carries one OR marker and no second badge", () => {
    for (const m of modelTables(ds)) for (const r of m.table.rows) {
      for (const k of ["tps", "ttft"] as const) {
        const c = r.cells[k];
        if (!c.na) expect(c.badges).toEqual(["OR p50"]);
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
      expect(r.cells.or.note).toBeTruthy();
    }
    const cc = t.rows.find((r) => r.key === "commandcode-goat")!;
    expect(cc.cells.or.note).toBe("DeepSeek V4.1 Flash");
    const qwen = t.rows.find((r) => r.key === "qwen-cloud-token")!;
    expect(qwen.cells.or.note).toBe("DeepSeek V4.1 Flash (1017)");
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
