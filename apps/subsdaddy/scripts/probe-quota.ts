#!/usr/bin/env bun
/**
 * Resolves one quota source per lane and prints one line each:
 *   {lane, window, used_pct, resets_at, source}  or  {lane, unavailable, reason}
 * Reads only: codexbar (cached provider sessions). Never prints cookies, tokens or keys.
 */
import { spawnSync } from "node:child_process";

export type Resolved =
  | { lane: string; window: "5h" | "weekly" | "monthly"; window_minutes: number; used_pct: number; resets_at: string; source: string }
  | { lane: string; unavailable: string };

const CODEXBAR: Record<string, string> = { cc: "commandcode", "go-1": "opencodego", qwen: "qwen-cloud" };
const LABEL = (w: number): "5h" | "weekly" | "monthly" => (w === 300 ? "5h" : w === 10080 ? "weekly" : "monthly");

export function fromCodexbar(lane: string, provider: string, json: string): Resolved {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { lane, unavailable: "codexbar_non_json" };
  }
  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string }; usage?: Record<string, unknown> };
  if (entry?.error) return { lane, unavailable: entry.error.message ?? "codexbar_error" };
  const usage = entry?.usage ?? {};
  // capacity is taken from the weekly window when present; the monthly window is used for qwen (monthly-only)
  const candidates = ["secondary", "tertiary", "primary"]
    .map((k) => usage[k] as { usedPercent?: number; resetsAt?: string; windowMinutes?: number } | null | undefined)
    .filter((w): w is { usedPercent: number; resetsAt: string; windowMinutes: number } =>
      !!w && typeof w.usedPercent === "number" && typeof w.resetsAt === "string" && typeof w.windowMinutes === "number",
    );
  const pick = candidates.find((w) => w.windowMinutes === 10080) ?? candidates.find((w) => w.windowMinutes === 43200);
  if (!pick) return { lane, unavailable: `no_weekly_or_monthly_window_for_${provider}` };
  return {
    lane,
    window: LABEL(pick.windowMinutes),
    window_minutes: pick.windowMinutes,
    used_pct: pick.usedPercent,
    resets_at: pick.resetsAt,
    source: `codexbar usage --provider ${provider}`,
  };
}

export function probeOne(lane: string): Resolved {
  const provider = CODEXBAR[lane];
  if (!provider) {
    if (lane === "go-2") return { lane, unavailable: "no codexbar token account for opencodego (--all-accounts: 'No token accounts configured')" };
    return { lane, unavailable: "no codexbar strategy for zai ('No available fetch strategy for zai.')" };
  }
  const res = spawnSync("codexbar", ["usage", "--provider", provider, "--format", "json"], { encoding: "utf8", timeout: 30000 });
  if (res.status !== 0 && !res.stdout) return { lane, unavailable: `codexbar_exit_${res.status}` };
  return fromCodexbar(lane, provider, res.stdout);
}

if (import.meta.main) {
  const lanes = ["cc", "go-1", "go-2", "zai", "qwen"];
  for (const l of lanes) console.log(JSON.stringify(probeOne(l)));
}
