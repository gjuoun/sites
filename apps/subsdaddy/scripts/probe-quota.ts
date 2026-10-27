#!/usr/bin/env bun
/**
 * Resolves one quota reading per plan: {lane, window, used_pct, resets_at, source} or
 * {lane, unavailable, reason}. Every plan goes through codexbar. zai's key arrives in this
 * process's env from `opk get ZAI_API_KEY -- …` and is handed to codexbar as Z_AI_API_KEY,
 * only in the child env. Nothing is printed or written.
 */
import { spawnSync } from "node:child_process";
import { LANES, type LaneId } from "../src/data/schema";
import { type QuotaReading, creditsFromCodexbar, fromCodexbar, vendorPoolFromCodexbar, windowsFromCodexbar, zaiEnvFor, zaiFromCodexbar } from "../src/lib/quota";

export type Resolved = QuotaReading;

/** Plan -> codexbar provider. OpenCode Go's reading comes from its one readable account. */
const CODEXBAR: Record<LaneId, string> = {
  "commandcode-goat": "commandcode",
  "opencode-go": "opencodego",
  "zai-glm-max": "zai",
  "qwen-cloud-token": "qwen-cloud",
};

export async function probeOne(lane: LaneId): Promise<Resolved> {
  const provider = CODEXBAR[lane];
  let env: Record<string, string | undefined> = process.env;
  if (lane === "zai-glm-max") {
    const withKey = zaiEnvFor(process.env);
    if (!withKey) return { lane, unavailable: "ZAI_API_KEY not in env" };
    env = withKey;
  }
  const res = spawnSync("codexbar", ["usage", "--provider", provider, "--format", "json"], { encoding: "utf8", timeout: 30000, env });
  if (res.status !== 0 && !res.stdout) return { lane, unavailable: `codexbar_exit_${res.status}` };
  const base = lane === "zai-glm-max" ? zaiFromCodexbar(lane, res.stdout) : fromCodexbar(lane, provider, res.stdout);
  const windows = windowsFromCodexbar(res.stdout);
  // QwenCloud is a credit pool: record the credits consumed and the pool size from the same reading
  if (lane === "qwen-cloud-token" && "used_pct" in base) {
    const c = creditsFromCodexbar(res.stdout);
    return { ...base, credits_used: c?.credits_used ?? null, credits_total: c?.credits_total ?? null, windows, vendor_pool: vendorPoolFromCodexbar(res.stdout) };
  }
  return "used_pct" in base ? { ...base, windows, vendor_pool: vendorPoolFromCodexbar(res.stdout) } : base;
}

if (import.meta.main) {
  for (const l of LANES) console.log(JSON.stringify(await probeOne(l)));
}
