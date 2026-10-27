import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { catalogFileSchema } from "../data/catalog";
import { thirdPartyFileSchema, monthlyUsd } from "../data/third-party";
import { summaryTable, viewRows, SHAPES, supOf } from "./summary";
import type { DS } from "./sections";

const APP_ROOT = join(import.meta.dir, "..", "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP_ROOT, "data", f), "utf8"));
const file = thirdPartyFileSchema.parse(read("third-party-allowances.json"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const ds = dataset as unknown as DS;
const row = (id: string) => catalog.rows.find((r) => r.plan_id === id)!;
const entry = (id: string) => file.entries.find((e) => e.plan_id === id)!;

describe("third-party weekly values: the sourced figure, the 30-day allowance (r45)", () => {
  const expected: Array<[string, number, number]> = [
    ["claude-code-pro", 157, 672.86],
    ["claude-code-max-5x", 940, 4028.57],
    ["claude-code-max-20x", 1351, 5790],
    ["codex-pro", 270, 1157.14],
    ["codex-pro-20x", 1340, 5742.86],
  ];
  for (const [id, weekly, monthly] of expected) {
    test(id + ": weekly $" + weekly + " gives $" + monthly.toFixed(2) + " per 30 days (±1%)", () => {
      expect(entry(id).weekly_usd).toBe(weekly);
      const a = row(id).allowance.find((x) => x.ref === "*")!;
      expect(Math.abs(a.usd - monthly) / monthly).toBeLessThan(0.01);
      expect(a.usd).toBe(monthlyUsd(weekly));
    });
  }
});

describe("the value rule: headline or lower bound, as each source states it", () => {
  test("Claude Pro is the wokey headline, and Max 20x is the median of its two sources (r56)", () => {
    expect(entry("claude-code-pro").value_rule).toBe("headline");
    expect(entry("claude-code-pro").publisher).toBe("wokey.ai");
    expect(entry("claude-code-max-20x").value_rule).toBe("median_of_sources");
    expect(entry("claude-code-max-20x").primary_weekly_usd).toBe(1602);
    expect(entry("claude-code-max-20x").weekly_usd).toBe(1351);
  });
  test("the promptster ranges take their low end, and Max 5x is the median of its three values (r56)", () => {
    expect(entry("claude-code-max-5x").value_rule).toBe("median_of_sources");
    expect(entry("claude-code-max-5x").primary_weekly_usd).toBe(entry("claude-code-max-5x").range_usd![0]);
    expect(entry("codex-pro").value_rule).toBe("lower_bound");
    expect(entry("codex-pro").weekly_usd).toBe(entry("codex-pro").range_usd![0]);
  });
  test("a lower-bound value must equal its range low end, and a projection can never be measured (schema)", () => {
    const bad = { ...file.entries[1], weekly_usd: 1000 };
    expect(thirdPartyFileSchema.safeParse({ ...file, entries: [bad] }).success).toBe(false);
    const fake = { ...file.entries[4], value_kind: "measured" };
    expect(thirdPartyFileSchema.safeParse({ ...file, entries: [fake] }).success).toBe(false);
  });
});

describe("markers and tooltips: t for measured, j for projected, the source domain and date in each tooltip", () => {
  test("Claude and Codex Pro 5x are measured (t); Codex Pro 20x is projected (j)", () => {
    expect(row("claude-code-pro").allowance[0].kind).toBe("third_party_measured");
    expect(row("codex-pro").allowance[0].kind).toBe("third_party_measured");
    expect(row("codex-pro-20x").allowance[0].kind).toBe("third_party_projected");
    expect(supOf("third_party_measured", false)).toBe("t");
    expect(supOf("third_party_projected", false)).toBe("j");
  });
  test("in the Haiku view each third-party row carries its marker", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const sup = (k: string) => (rows.find((r) => r.key === k)!.cells.allowance as { sup?: string }).sup;
    expect(sup("claude-code-pro")).toBe("t");
    expect(sup("claude-code-max-5x")).toBe("t");
    expect(sup("claude-code-max-20x")).toBe("t");
    const luna = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows;
    expect((luna.find((r) => r.key === "codex-pro-20x")!.cells.allowance as { sup?: string }).sup).toBe("j");
  });
  test("every third-party tooltip names the source domain, the publication date and the weekly API-equivalent", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    const cases: Array<[string, string, string]> = [["claude-code-pro", "wokey.ai", "2026-10-26"], ["claude-code-max-5x", "promptster.ai", "2026-10-06"], ["claude-code-max-20x", "wokey.ai", "2026-10-26"], ["codex-pro-20x", "finopsllm.com", "2026-10-10"]];
    const luna = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows;
    for (const [k, host, date] of cases) {
      const t = (k.startsWith("codex") ? luna : rows).find((r) => r.key === k)!.cells.allowance.title ?? "";
      expect(t).toContain(host);
      expect(t).toContain(date);
      expect(t).toContain("weekly API-equivalent");
    }
  });
  test("the Codex Pro 20x tooltip says projected, not measured", () => {
    const rows = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows;
    const t = rows.find((r) => r.key === "codex-pro-20x")!.cells.allowance.title ?? "";
    expect(t).toContain("projected by finopsllm.com, not measured");
  });
  test("the legend names t and j, and its lines name no plan", () => {
    const foot = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).footnote ?? "";
    const parts = foot.split(" · ");
    const legend = parts.filter((p) => p.startsWith("t third-party") || p.startsWith("j third-party"));
    expect(legend.length).toBe(2);
    for (const l of legend) expect(/Claude|Codex|Max|Pro/.test(l)).toBe(false);
  });
});

describe("Claude and Codex Pro now carry an allowance; the retired hours machinery is gone", () => {
  test("no Claude plan is N/A in the Haiku view: allowance, capacity and $/B are numbers", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    for (const k of ["claude-code-pro", "claude-code-max-5x", "claude-code-max-20x"]) {
      const r = rows.find((x) => x.key === k)!;
      expect(r.cells.allowance.na).toBe(false);
      expect(r.cells.capacity.na).toBe(false);
      expect(r.cells.usd.na).toBe(false);
    }
  });
  test("Codex Pro 5x in the Luna view is priced from its allowance: no hour cap, no capped suffix (r55)", () => {
    const v = viewRows(ds, "gpt-6-luna" as never, "short", SHAPES[0]).find((r) => r.key === "codex-pro")!;
    expect(v.usd).not.toBeNull();
    expect(v.capNote ?? null).toBeNull();
  });
});

describe("Codex Plus stays on the message table, and no third-party value is invented for it", () => {
  test("codex-plus has no dollar allowance and keeps its message limit", () => {
    const r = row("codex-plus");
    expect(r.allowance.length).toBe(0);
    expect(r.message_limit).not.toBeNull();
  });
  test("the file records that no measurement was found for Codex Plus", () => {
    expect(file.not_found.map((x) => x.plan_id)).toContain("codex-plus");
  });
});

describe("Max 20x in the Haiku view", () => {
  test("its allowance is $5790.00 per 30 days and its $/B is a positive number", () => {
    const r = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((x) => x.key === "claude-code-max-20x")!;
    expect(r.cells.allowance.text).toBe("$5790.00/30d");
    expect(Number(r.cells.usd.text.replace(/[^0-9.]/g, "")) > 0).toBe(true);
  });
});
