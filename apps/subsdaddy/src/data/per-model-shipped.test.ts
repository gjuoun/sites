import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "../lib/dataset";
import { capDetailOf, supOf } from "../lib/summary";
import type { DS } from "../lib/sections";

const APP_ROOT = join(import.meta.dir, "..", "..");
const REPO_ROOT = join(APP_ROOT, "..", "..");
const read = (f: string) => JSON.parse(readFileSync(join(APP_ROOT, "data", f), "utf8"));
const allowance = read("allowance.json");
const lanes = read("lanes.json");
const go = allowance.lanes.find((l: { lane: string }) => l.lane === "opencode-go");
const goRec = lanes.lanes.find((l: { lane: string }) => l.lane === "opencode-go");
const ds = dataset as unknown as DS;

describe("OpenCode Go's Measured allowance is the official main-model limit (r53)", () => {
  test("DeepSeek V4.1 Flash carries at least 70% of the monthly window's tokens", () => {
    const pm = go.per_model;
    expect(pm).toBeTruthy();
    expect(pm.rule).toBe("single_model");
    expect(pm.main_model).toBe("deepseek-v4.1-flash");
    const share = pm.parts.find((p: { model: string }) => p.model === "deepseek-v4.1-flash").share;
    expect(share).toBeGreaterThanOrEqual(0.7);
  });
  test("the allowance is the page's DeepSeek limit ($80), with basis vendor_published_per_model", () => {
    expect(go.allowance_usd_per_cycle).toBe(80);
    expect(go.allowance_basis).toBe("vendor_published_per_model");
    expect(supOf(go.allowance_basis, false)).toBe("p");
  });
  test("the derived figure from quota windows is kept for comparison, and is not the allowance", () => {
    expect(go.per_model.derived_usd).not.toBe(go.allowance_usd_per_cycle);
    expect(go.per_model.derived_usd).toBeGreaterThan(0);
  });
  test("$/B is fee over the tokens the $80 buys at the measured blend, and lands in $4.0-5.5", () => {
    const fee = 10;
    const blendPerB = go.per_model.blend_usd_per_b;
    const expected = fee / (80 / blendPerB);
    expect(Math.abs(goRec.usd_per_b - expected) / expected).toBeLessThan(1e-6);
    expect(goRec.usd_per_b).toBeGreaterThanOrEqual(4.0);
    expect(goRec.usd_per_b).toBeLessThanOrEqual(5.5);
  });
  test("the hover panel says which model sets the allowance, its share, and that the derived figure is comparison only", () => {
    const lines = capDetailOf(ds.lanes.lanes.find((l) => l.lane === "opencode-go") as never);
    expect(lines.some((l) => l.includes("per-model limit: main model DeepSeek V4.1 Flash"))).toBe(true);
    expect(lines.some((l) => l.includes("DeepSeek V4.1 Flash 88% of tokens (limit $80)"))).toBe(true);
    expect(lines.some((l) => l.startsWith("comparison only, not used for $/B: derived from quota windows $"))).toBe(true);
  });
});

describe("the raw usage export is not tracked by git (r53)", () => {
  test("no raw usage file is in the index, and the app ignores them", () => {
    const tracked = execFileSync("git", ["ls-files", "apps/subsdaddy/data/raw/usage"], { cwd: REPO_ROOT, encoding: "utf8" }).trim().split("\n").filter(Boolean);
    expect(tracked.filter((f) => f.endsWith(".json"))).toEqual([]);
    const ignored = execFileSync("git", ["check-ignore", "apps/subsdaddy/data/raw/usage/2026-10-27.json"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
    expect(ignored.length).toBeGreaterThan(0);
  });
});
