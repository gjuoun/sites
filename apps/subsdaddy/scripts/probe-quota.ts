#!/usr/bin/env bun
/**
 * Resolves one quota reading per lane: {lane, window, used_pct, resets_at, source} or
 * {lane, unavailable, reason}. Every lane goes through codexbar. zai's key arrives in this
 * process's env from `opk get ZAI_API_KEY -- …` and is handed to codexbar as Z_AI_API_KEY,
 * only in the child env. Nothing is printed or written.
 */
import { spawnSync } from "node:child_process";
import { type QuotaReading, fromCodexbar, zaiEnvFor, zaiFromCodexbar } from "../src/lib/quota";

export type Resolved = QuotaReading;

const CODEXBAR: Record<string, string> = { cc: "commandcode", "go-1": "opencodego", qwen: "qwen-cloud", zai: "zai" };

export async function probeOne(lane: string): Promise<Resolved> {
  const provider = CODEXBAR[lane];
  if (!provider) {
    if (lane === "go-2") return { lane, unavailable: "no codexbar token account for opencodego (--all-accounts: 'No token accounts configured')" };
    return { lane, unavailable: "unknown lane" };
  }
  let env: Record<string, string | undefined> = process.env;
  if (lane === "zai") {
    const withKey = zaiEnvFor(process.env);
    if (!withKey) return { lane, unavailable: "ZAI_API_KEY not in env" };
    env = withKey;
  }
  const res = spawnSync("codexbar", ["usage", "--provider", provider, "--format", "json"], { encoding: "utf8", timeout: 30000, env });
  if (res.status !== 0 && !res.stdout) return { lane, unavailable: `codexbar_exit_${res.status}` };
  return lane === "zai" ? zaiFromCodexbar(lane, res.stdout) : fromCodexbar(lane, provider, res.stdout);
}

if (import.meta.main) {
  const lanes = ["cc", "go-1", "go-2", "zai", "qwen"];
  for (const l of lanes) console.log(JSON.stringify(await probeOne(l)));
}
