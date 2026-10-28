import { describe, expect, test } from "bun:test";
import { pooledMix, type TokenTotals } from "../data/estimate";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "./dataset";
import { catalogFileSchema } from "../data/catalog";
import { summaryTable, viewRows, SHAPES } from "./summary";
import { modelsFileSchema } from "../data/schema";
import type { DS } from "./sections";

const APP_ROOT = join(import.meta.dir, "..", "..");

const DATA = join(import.meta.dir, "..", "..", "data");
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const catalog = catalogFileSchema.parse(read("catalog.json"));
const models = modelsFileSchema.parse(read("models.json"));
const ds = dataset as unknown as DS;

describe("Copilot: a dollar allowance from base credits", () => {
  test("Pro is 1,000 base credits at $0.01: a $10 allowance; Pro+ is 3,900 credits: $39", () => {
    const pro = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!;
    const pp = catalog.rows.find((r) => r.plan_id === "github-copilot-pro-plus")!;
    expect(pro.allowance[0]!.usd).toBeCloseTo(1000 * 0.01, 9);
    expect(pp.allowance[0]!.usd).toBeCloseTo(3900 * 0.01, 9);
    expect(pro.allowance_model).toBe("usd_usage");
  });

  test("Copilot lists Claude Haiku 5.5 and GPT-6 Luna, and its estimate is fee over allowance times the blend", () => {
    const pro = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!;
    expect(pro.offered_models).toEqual(["claude-haiku-5.5", "gpt-6-luna"]);
    expect(pro.estimate?.status).toBe("estimated");
    for (const v of pro.estimate!.values) if (v.usd_per_b !== null) expect(v.fee_over_allowance).toBeCloseTo(1, 9);
  });

  test("the Copilot figure is the list-price blend itself, because $10 buys $10 of usage", () => {
    const v = catalog.rows.find((r) => r.plan_id === "github-copilot-pro")!.estimate!.values.find((x) => x.ref === "gpt-6-luna" && x.shape === "agent")!;
    expect(v.usd_per_b).toBeCloseTo(v.blended_usd_per_b, 6);
  });
});

describe("Codex: messages per window converted to tokens", () => {
  test("Plus on GPT-6 Luna, at the lower bound, is a converted row with a dagger, not a dollar allowance", () => {
    const plus = catalog.rows.find((r) => r.plan_id === "codex-plus")!;
    expect(plus.allowance).toEqual([]);
    expect(plus.message_limit).toMatchObject({ model: "gpt-6-luna", low: 350, high: 3000, window_hours: 5 });
    const row = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === "codex-plus")!;
    expect(row.marker).toBe("†");
    expect(row.capacity).toBe("3.16B/mo");
    expect(row.usd).toBeCloseTo(20 / (350 * 3 * 30 * 100462 / 1e9), 6);
  });

  test("at the 350K standard the same Plus row is 11.04B/mo and its $/B is lower", () => {
    const short = viewRows(ds, "gpt-6-luna", "short").find((r) => r.key === "codex-plus")!;
    const long = viewRows(ds, "gpt-6-luna", "long").find((r) => r.key === "codex-plus")!;
    expect(long.capacity).toBe("11.04B/mo");
    expect(long.usd!).toBeLessThan(short.usd!);
  });

  test("the Codex footnote on the Luna view is the second line, and the view has at most four lines (r55: the cap line is gone)", () => {
    const t = summaryTable(ds, "gpt-6-luna", "short");
    const lines = (t.footnote ?? "").split("\n");
    expect(lines.length).toBe(4);
    expect(lines[1]).toBe("† converted from vendor message limits at 100K context per message");
  });

  test("Codex Pro rows keep their third-party allowance (t, j), with capacity and $/B N/A (r59)", () => {
    const rows = viewRows(ds, "gpt-6-luna", "short");
    for (const id of ["codex-pro", "codex-pro-20x"]) {
      const row = rows.find((r) => r.key === id)!;
      expect(row.allowance).not.toBeNull();
      expect(row.usd).toBeNull();
      expect(row.capacity).toBeNull();
    }
    expect(rows.find((r) => r.key === "codex-pro")!.allowance!.sup).toBe("t");
    expect(rows.find((r) => r.key === "codex-pro-20x")!.allowance!.sup).toBe("j");
  });
});
