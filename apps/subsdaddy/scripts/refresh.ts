#!/usr/bin/env bun
/**
 * One-command refresh: collect → quota → derive → openrouter → build → verify:site → verify:all.
 * Every stage echoes one line; the chain stops at the first non-zero exit; the full log goes to
 * /tmp/jun/subsdaddy/refresh.log. The run start is exported so the freshness gate can compare it.
 */
import { mkdirSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const logDir = "/tmp/jun/subsdaddy";
const logPath = join(logDir, "refresh.log");
mkdirSync(logDir, { recursive: true });
const started = new Date().toISOString();
writeFileSync(logPath, `refresh start ${started}\n`);
process.env.SUBSDADDY_REFRESH_START = started;

const stages: Array<[string, string[]]> = [
  ["collect:usage", ["bun", "run", "scripts/collect-usage.ts"]],
  ["collect:catalog", ["bun", "run", "scripts/collect-catalog.ts"]],
  ["estimate:catalog", ["bun", "run", "scripts/estimate-catalog.ts"]],
  // the probe stage gets ZAI_API_KEY from 1Password into the child env only; nothing is written to disk
  ["probe:quota", ["opk", "get", "ZAI_API_KEY", "--", "bun", "run", "scripts/collect-quota.ts"]],
  ["build:dataset", ["bun", "run", "scripts/build-dataset.ts"]],
  ["collect:openrouter", ["bun", "run", "scripts/collect-openrouter.ts"]],
  ["build", ["bun", "run", "build"]],
  ["verify:site", ["bun", "run", "scripts/verify-site.ts"]],
  ["verify:data", ["bun", "run", "scripts/verify-data.ts"]],
  ["verify:public", ["bun", "run", "scripts/verify-public.ts"]],
];

for (const [name, cmd] of stages) {
  const res = spawnSync(cmd[0], cmd.slice(1), { cwd: APP, encoding: "utf8", env: process.env });
  const out = (res.stdout ?? "") + (res.stderr ?? "");
  appendFileSync(logPath, `\n=== ${name} exit=${res.status} ===\n${out}`);
  const lastLine = out.trim().split("\n").filter(Boolean).at(-1) ?? "";
  if (res.status !== 0) {
    console.log(`refresh: FAILED at ${name} exit=${res.status} last=${lastLine} log=${logPath}`);
    process.exit(res.status ?? 1);
  }
  console.log(`${name.padEnd(18)} ok  ${lastLine}`);
}
const finished = new Date().toISOString();
const lanes = JSON.parse(readFileSync(join(APP, "data", "lanes.json"), "utf8")).lanes.length;
console.log(`refresh: ok lanes=${lanes} started=${started} finished=${finished}`);
