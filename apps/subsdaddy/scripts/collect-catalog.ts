#!/usr/bin/env bun
/**
 * Refreshes the window readings of catalog rows that have a provider (today: codex). Only the
 * codexbar percent windows are written; no price, no token capacity. A failed read keeps the
 * previous readings and records the reason in reading_error, never a zero.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { catalogFileSchema } from "../src/data/catalog";
import { codexWindowsFromCodexbar } from "../src/lib/codex-window";

const APP = resolve(import.meta.dir, "..");
const path = join(APP, "data", "catalog.json");
const file = catalogFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
const now = new Date().toISOString();

const CODEXBAR: Record<string, string> = { codex: "codex" };
for (const row of file.rows) {
  if (!row.provider || !CODEXBAR[row.provider]) continue;
  const res = spawnSync("codexbar", ["usage", "--provider", CODEXBAR[row.provider], "--format", "json"], { encoding: "utf8", timeout: 30000 });
  const out = codexWindowsFromCodexbar(res.stdout ?? "", now);
  if (out.ok) {
    row.window_readings = out.windows;
    row.reading_error = null;
    console.log(`${row.plan_id} windows=${out.windows.map((w) => w.window + ":" + w.used_pct + "%").join(" ")}`);
  } else {
    row.reading_error = out.unavailable;
    console.log(`${row.plan_id} unavailable: ${out.unavailable} (previous readings kept)`);
  }
}
file.measured_at = now;
writeFileSync(path, JSON.stringify(catalogFileSchema.parse(file), null, 2) + "\n");
