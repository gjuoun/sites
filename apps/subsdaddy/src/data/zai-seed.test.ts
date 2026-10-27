import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataset } from "../lib/dataset";
import { summaryTable, MEASURED } from "../lib/summary";
import { resolvePublished, nextSnapshot, snapshotFileSchema, type WindowUse } from "./published";
import type { DS } from "../lib/sections";

const APP_ROOT = join(import.meta.dir, "..", "..");
const REPO_ROOT = join(APP_ROOT, "..", "..");
const SEED_COMMIT = "8779751";
const snap = snapshotFileSchema.parse(JSON.parse(readFileSync(join(APP_ROOT, "data", "published-snapshot.json"), "utf8")));
const seed = snap.lanes["zai-glm-max"];
const ds = dataset as unknown as DS;

/** The Z.ai value as build 8779751 computed it, read from git at test time. Nothing here is typed by hand. */
function gitZai(): { usd_per_b: number; windows: WindowUse[] } {
  const text = execFileSync("git", ["show", SEED_COMMIT + ":apps/subsdaddy/data/lanes.json"], { cwd: REPO_ROOT, encoding: "utf8" });
  const z = JSON.parse(text).lanes.find((l: { lane: string }) => l.lane === "zai-glm-max");
  return { usd_per_b: z.usd_per_b, windows: z.capacity.windows.map((w: { window: string; used_pct: number; measured_at: string }) => ({ window: w.window, used_pct: w.used_pct, measured_at: w.measured_at, source: "codexbar quota reading" })) };
}

describe("Z.ai is seeded from build 8779751 (r49)", () => {
  test("the snapshot carries the seed mark and names its commit", () => {
    expect(seed).toBeDefined();
    expect(seed!.seed).toBe(true);
    expect(seed!.seed_source).toContain(SEED_COMMIT);
    expect(seed!.seed_source).toContain("never read above 2% used");
  });
  test("the seeded $/B equals the value build 8779751 computed, to 1e-9", () => {
    expect(Math.abs(seed!.usd_per_b_measured - gitZai().usd_per_b)).toBeLessThan(1e-9);
  });
  test("the seeded windows are the ones that build read", () => {
    expect(seed!.windows.map((w) => w.used_pct)).toEqual(gitZai().windows.map((w) => w.used_pct));
  });
  test("the rebuilt lane publishes the same $/B as the seed", () => {
    const lanes = JSON.parse(readFileSync(join(APP_ROOT, "data", "lanes.json"), "utf8")).lanes;
    const z = lanes.find((l: { lane: string }) => l.lane === "zai-glm-max");
    expect(Math.abs(z.usd_per_b - seed!.usd_per_b_measured)).toBeLessThan(1e-9);
  });
});

describe("the seed is on the Measured board, not N/A (r49)", () => {
  test("the Z.ai row shows a $/B and the stale reading badge", () => {
    const row = summaryTable(ds, MEASURED).rows.find((r) => r.key === "zai-glm-max")!;
    expect(row.cells.usd.na).toBe(false);
    expect(row.cells.usd.text).toBe("$6.24");
    expect(row.cells.capacity.badges).toContain("stale reading");
  });
  test("the $/B tooltip says it is seeded and that no window has exceeded 2% used", () => {
    const row = summaryTable(ds, MEASURED).rows.find((r) => r.key === "zai-glm-max")!;
    expect(row.cells.usd.title ?? "").toContain("seeded from the last computed reading; no window has exceeded 2% used");
    expect(row.cells.usd.title ?? "").toMatch(/last stable reading 2026-10-27; current windows read [\d.]+%/);
  });
});

describe("a low-signal build never overwrites the seed (r49)", () => {
  test("a build with all windows at or under 2% returns the seed unchanged, whatever the new candidate", () => {
    const low: WindowUse[] = [{ window: "5h", used_pct: 1.2, measured_at: "2026-10-28T00:00:00.000Z", source: "t" }, { window: "weekly", used_pct: 1.1, measured_at: "2026-10-28T00:00:00.000Z", source: "t" }];
    const other = { ...seed!, read_at: "2026-10-28T00:00:00.000Z", usd_per_b_measured: seed!.usd_per_b_measured * 1.2, seed: undefined, seed_source: undefined };
    const res = resolvePublished({ windows: low, candidate: other as never, snapshot: seed! as never });
    expect(res.mode).toBe("stale");
    expect(nextSnapshot(seed! as never, res)).toBe(seed! as never);
  });
  test("a window above 2% replaces the seed and drops the seed mark", () => {
    const up: WindowUse[] = [{ window: "5h", used_pct: 6, measured_at: "2026-10-28T00:00:00.000Z", source: "t" }, { window: "weekly", used_pct: 1, measured_at: "2026-10-28T00:00:00.000Z", source: "t" }];
    const fresh = { ...seed!, read_at: "2026-10-28T00:00:00.000Z", seed: undefined, seed_source: undefined, usd_per_b_measured: 9.9 };
    const res = resolvePublished({ windows: up, candidate: fresh as never, snapshot: seed! as never });
    expect(res.mode).toBe("fresh");
    const next = nextSnapshot(seed! as never, res)!;
    expect(next.seed).toBeUndefined();
  });
});
