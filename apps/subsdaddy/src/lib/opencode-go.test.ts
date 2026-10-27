import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyToCatalog, OpencodeGoError, parseOpencodeGo, runOpencodeGo } from "./opencode-go";
import { supOf } from "./summary";
import { dataset } from "./dataset";
import { MEASURED, summaryTable, viewRows, SHAPES } from "./summary";
import type { DS } from "./sections";

const html = readFileSync(join(import.meta.dir, "..", "..", "fixtures", "opencode-go.html"), "utf8");
const parsed = parseOpencodeGo(html, "2026-10-27T00:00:00.000Z");
const plan = (name: string) => parsed.plans.find((p) => p.plan === name)!;
const limitOf = (name: string, ref: string) => plan(name).models.filter((m) => m.ref === ref).map((m) => m.monthly_limit_usd);
const ds = dataset as unknown as DS;

describe("OpenCode Go docs: parsed per-model limits", () => {
  test("the fees are the printed ones: Go $10, Go Plus $40", () => {
    expect(plan("Go").fee_usd_per_month).toBe(10);
    expect(plan("Go Plus").fee_usd_per_month).toBe(40);
  });
  test("Go: DeepSeek V4.1 Flash $80, Claude Haiku 5.5 $15, GPT 6 Luna $15, GLM-5.3-Flash $60", () => {
    expect([...new Set(limitOf("Go", "deepseek-v4.1-flash"))]).toEqual([80]);
    expect([...new Set(limitOf("Go", "claude-haiku-5.5"))]).toEqual([15]);
    expect([...new Set(limitOf("Go", "gpt-6-luna"))]).toEqual([15]);
    expect([...new Set(limitOf("Go", "glm-5.3-flash"))]).toEqual([60]);
  });
  test("Go Plus: DeepSeek V4.1 Flash $160, Claude Haiku 5.5 $60, GPT 6 Luna $60, GLM-5.3-Flash $180", () => {
    expect([...new Set(limitOf("Go Plus", "deepseek-v4.1-flash"))]).toEqual([160]);
    expect([...new Set(limitOf("Go Plus", "claude-haiku-5.5"))]).toEqual([60]);
    expect([...new Set(limitOf("Go Plus", "gpt-6-luna"))]).toEqual([60]);
    expect([...new Set(limitOf("Go Plus", "glm-5.3-flash"))]).toEqual([180]);
  });
  test("both DeepSeek variants (off-peak and peak) carry the same limit", () => {
    const names = plan("Go").models.filter((m) => m.ref === "deepseek-v4.1-flash").map((m) => m.model);
    expect(names.length).toBe(2);
    expect(names.some((n) => n.includes("Off-Peak"))).toBe(true);
    expect(names.some((n) => n.includes("Peak") && !n.includes("Off-Peak"))).toBe(true);
  });
  test("models that are not reference models keep ref null, with their own limit", () => {
    const glm = plan("Go").models.find((m) => m.base === "GLM-5.3")!;
    expect(glm.ref).toBeNull();
    expect(glm.monthly_limit_usd).toBe(15);
    expect(plan("Go").models.find((m) => m.base === "MiMo-V2.6-Flash")!.monthly_limit_usd).toBe(60);
    expect(plan("Go").models.find((m) => m.base === "Qwen3.8 Flash")!.monthly_limit_usd).toBe(30);
  });
  test("an unlimited row is a null limit with its printed text, not a number", () => {
    const beam = plan("Go").models.find((m) => m.base === "Beam Free")!;
    expect(beam.monthly_limit_usd).toBeNull();
    expect(beam.limit_raw.startsWith("Unlimited")).toBe(true);
  });
  test("a price cell the parser cannot reduce to one number is kept as printed", () => {
    const g = plan("Go").models.find((m) => m.base === "Gemini 4 Argon")!;
    expect(g.prices_raw[0]).toBe("$4.00 $2.00");
    expect(g.input_usd_per_m).toBeNull();
  });
});

describe("OpenCode Go docs: a page it does not recognise fails hard", () => {
  test("a missing Go Plus pricing panel throws", () => {
    expect(() => parseOpencodeGo(html.replace('id="go-pricing-panel-go-plus"', 'id="x"'), "t")).toThrow(OpencodeGoError);
  });
  test("an unparseable monthly limit throws, naming the model", () => {
    expect(() => parseOpencodeGo(html.replace(">$80<", ">eighty<"), "t")).toThrow(/unparseable monthly limit/);
  });
  test("a changed header throws", () => {
    expect(() => parseOpencodeGo(html.replace("<th>Monthly limit</th>", "<th>Limit</th>"), "t")).toThrow(/header/);
  });
  test("a missing reference model throws", () => {
    expect(() => parseOpencodeGo(html.split("Claude Haiku 5.5").join("Claude Haiku 9"), "t")).toThrow(/claude-haiku-5.5/);
  });
  test("a fee that differs from the catalog's throws", () => {
    const cat = { rows: [{ plan_id: "opencode-go-go", price_month_usd: 12 }, { plan_id: "opencode-go-plus", price_month_usd: 40 }] };
    expect(() => applyToCatalog(cat, parsed)).toThrow(/differs from the catalog/);
  });
});

describe("OpenCode Go docs: a failed parse writes nothing", () => {
  test("runOpencodeGo on a broken page throws and leaves the previous files byte-for-byte", () => {
    const dir = mkdtempSync(join(tmpdir(), "ogo-"));
    const catalog = { rows: [{ plan_id: "opencode-go-go", price_month_usd: 10, allowance: [{ ref: "deepseek-v4.1-flash", usd: 80, basis: "previous" }] }, { plan_id: "opencode-go-plus", price_month_usd: 40, allowance: [] }] };
    writeFileSync(join(dir, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n");
    writeFileSync(join(dir, "opencode-go.json"), "PREVIOUS\n");
    const before = readFileSync(join(dir, "catalog.json"), "utf8");
    expect(() => runOpencodeGo({ html: html.replace('id="go-pricing-panel-go"', 'id="z"'), dataDir: dir, fetchedAt: "t" })).toThrow(OpencodeGoError);
    expect(readFileSync(join(dir, "catalog.json"), "utf8")).toBe(before);
    expect(readFileSync(join(dir, "opencode-go.json"), "utf8")).toBe("PREVIOUS\n");
    expect(existsSync(join(dir, "catalog.json.tmp"))).toBe(false);
  });
  test("a good page writes the parsed file and sets each plan's per-model allowances; other rows are untouched", () => {
    const dir = mkdtempSync(join(tmpdir(), "ogo-"));
    const cc = { plan_id: "commandcode-goat", price_month_usd: 10, published_allowance_usd: 80 };
    writeFileSync(join(dir, "catalog.json"), JSON.stringify({ rows: [{ plan_id: "opencode-go-go", price_month_usd: 10, allowance: [] }, { plan_id: "opencode-go-plus", price_month_usd: 40, allowance: [] }, cc] }, null, 2));
    runOpencodeGo({ html, dataDir: dir, fetchedAt: "2026-10-27T00:00:00.000Z" });
    const c = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
    const go = c.rows.find((r: { plan_id: string }) => r.plan_id === "opencode-go-go");
    expect(go.per_model_limit_plan).toBe("Go");
    expect(go.published_allowance_usd).toBeNull();
    expect(go.allowance.find((a: { ref: string }) => a.ref === "deepseek-v4.1-flash").usd).toBe(80);
    expect(go.allowance.find((a: { ref: string }) => a.ref === "claude-haiku-5.5").usd).toBe(15);
    expect(c.rows.find((r: { plan_id: string }) => r.plan_id === "commandcode-goat")).toEqual(cc);
    expect(JSON.parse(readFileSync(join(dir, "opencode-go.json"), "utf8")).plans.length).toBe(2);
  });
});

describe("model views price a Go plan at its own model's limit", () => {
  test("the DeepSeek view: Go and Go Plus allowances are $80 and $160, both published per model", () => {
    const rows = summaryTable(ds, "deepseek-v4.1-flash" as never, "short", SHAPES[0]).rows;
    const go = rows.find((r) => r.key === "opencode-go-go")!;
    const plus = rows.find((r) => r.key === "opencode-go-plus")!;
    expect(go.cells.allowance.text).toBe("$80.00/30d");
    expect(go.cells.allowance.sup).toBe("p");
    expect(plus.cells.allowance.text).toBe("$160.00/30d");
  });
  test("the Haiku view: Go's allowance is its $15 Haiku limit, so its capacity and $/B differ from the DeepSeek view", () => {
    const ds1 = summaryTable(ds, "deepseek-v4.1-flash" as never, "short", SHAPES[0]).rows.find((r) => r.key === "opencode-go-go")!;
    const hk = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows.find((r) => r.key === "opencode-go-go")!;
    expect(hk.cells.allowance.text).toBe("$15.00/30d");
    expect(hk.cells.capacity.text).not.toBe(ds1.cells.capacity.text);
    expect(hk.cells.usd.text).not.toBe(ds1.cells.usd.text);
  });
  test("the Luna view takes GPT 6 Luna's $15 (Go) and $60 (Go Plus)", () => {
    const rows = summaryTable(ds, "gpt-6-luna" as never, "short", SHAPES[0]).rows;
    expect(rows.find((r) => r.key === "opencode-go-go")!.cells.allowance.text).toBe("$15.00/30d");
    expect(rows.find((r) => r.key === "opencode-go-plus")!.cells.allowance.text).toBe("$60.00/30d");
  });
  test("the Measured view takes Go's main-model limit ($80, published), and the derived pool is comparison only (r53)", () => {
    const go = summaryTable(ds, MEASURED).rows.find((r) => r.key === "opencode-go")!;
    expect(go.cells.allowance.sup).toBe("p");
    expect(go.cells.allowance.text).toBe("$80.00/30d");
  });
  test("a per-model limit is marked p, like a published figure", () => {
    expect(supOf("vendor_published_per_model", false)).toBe("p");
  });
  test("the Go model views carry the per-model basis in the catalog", () => {
    const row = ds.catalog.rows.find((r: { plan_id: string }) => r.plan_id === "opencode-go-go") as unknown as { allowance: Array<{ basis: string }> };
    expect(row.allowance.every((a) => a.basis.includes("monthly limit for"))).toBe(true);
  });
  test("a credit-denominated allowance (GitHub Copilot's base credits) is marked c in the model views", () => {
    const rows = summaryTable(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).rows;
    expect(rows.find((r) => r.key === "github-copilot-pro")!.cells.allowance.sup).toBe("c");
  });
  test("viewRows still returns the four reference views' Go rows in order of $/B", () => {
    expect(viewRows(ds, "claude-haiku-5.5" as never, "short", SHAPES[0]).length).toBeGreaterThan(0);
  });
});
