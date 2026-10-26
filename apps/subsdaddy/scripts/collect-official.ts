#!/usr/bin/env bun
/**
 * Reads the local Codex and Claude Code logs, read-only, and writes data/official.json with aggregates
 * only: token counts, call counts, per-turn p50 speed and day bounds. Nothing else from a log is kept:
 * no session ids, paths, prompts or account details. The window percentages come from codexbar; its
 * account fields are never copied.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { officialFileSchema } from "../src/data/official";
import { day, parseClaudeLines, parseCodexLines, summarize } from "../src/lib/official-logs";

const APP = resolve(import.meta.dir, "..");
const WEEK = 7 * 24 * 60 * 60 * 1000;
const now = Date.now();
const measuredAt = new Date(now).toISOString();
const since = now - WEEK;

function files(dir: string, keep: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p, keep));
    else if (keep(name)) out.push(p);
  }
  return out;
}

function readLines(paths: string[]): string[] {
  return paths.flatMap((p) => readFileSync(p, "utf8").split("\n"));
}

/** codexbar's window readings: percentages and reset times only. */
function codexbarWindows(provider: string): { five_hour_pct: number | null; weekly_pct: number | null; resets_at: string | null; updated_at: string | null } | null {
  const res = spawnSync("codexbar", ["usage", "--provider", provider, "--format", "json"], { encoding: "utf8", timeout: 30000 });
  if (!res.stdout) return null;
  try {
    const entry = (JSON.parse(res.stdout) as Array<{ usage?: Record<string, unknown> }>)[0];
    const u = (entry?.usage ?? {}) as Record<string, { usedPercent?: unknown; windowMinutes?: unknown; resetsAt?: unknown } | null>;
    const pick = (minutes: number) => [u.primary, u.secondary, u.tertiary].find((w) => w && w.windowMinutes === minutes);
    const five = pick(300);
    const week = pick(10080);
    const pct = (w: { usedPercent?: unknown } | undefined | null) => (w && typeof w.usedPercent === "number" ? w.usedPercent : null);
    return {
      five_hour_pct: pct(five),
      weekly_pct: pct(week),
      resets_at: typeof week?.resetsAt === "string" ? week.resetsAt : null,
      updated_at: typeof (u as Record<string, unknown>).updatedAt === "string" ? ((u as Record<string, unknown>).updatedAt as string) : null,
    };
  } catch {
    return null;
  }
}

const codexFiles = files(join(homedir(), ".codex", "sessions"), (n) => n.startsWith("rollout-") && n.endsWith(".jsonl"));
const claudeFiles = files(join(homedir(), ".claude", "projects"), (n) => n.endsWith(".jsonl"));
const codex = summarize(parseCodexLines(readLines(codexFiles)), since);
const codexAll = summarize(parseCodexLines(readLines(codexFiles)), 0);
const claude = summarize(parseClaudeLines(readLines(claudeFiles)), since);
const claudeAll = summarize(parseClaudeLines(readLines(claudeFiles)), 0);

const codexWin = codexbarWindows("codex");
const claudeWin = codexbarWindows("claude");
const sevenDayReason = (all: { last_ts: number | null }) =>
  all.last_ts === null ? "no session logs found" : "no session in the last 7 days (last session day " + day(all.last_ts) + ")";

const providers = [
  {
    provider: "codex" as const,
    plan: "OpenAI Codex - Plus",
    fee_usd: null,
    fee_claimed_usd: 20,
    fee_status: "unverified" as const,
    fee_reason: "$20/mo is claimed in the brief and not read from a confirmed source",
    window:
      codexWin && (codexWin.five_hour_pct !== null || codexWin.weekly_pct !== null)
        ? { five_hour_pct: codexWin.five_hour_pct, weekly_pct: codexWin.weekly_pct, resets_at: codexWin.resets_at }
        : null,
    window_reason: codexWin ? (codexWin.five_hour_pct === null && codexWin.weekly_pct === null ? "codexbar returned no 5h or weekly window for codex" : null) : "codexbar did not answer for codex",
    tokens_7d: { ...codex.totals },
    speed_7d: codex.speed,
    speed_reason: codex.speed ? null : "no completed turn in the last 7 days",
    ttft_reason: "the rollout logs one first-message time per turn, not a first-token time; TTFT is not measured",
    all_time: {
      ...codexAll.totals,
      first_day: codexAll.first_ts !== null ? day(codexAll.first_ts) : null,
      last_day: codexAll.last_ts !== null ? day(codexAll.last_ts) : null,
      speed: codexAll.speed,
    },
    measured_at: measuredAt,
    source: "local ~/.codex session rollouts (read-only, aggregated); codexbar windows",
  },
  {
    provider: "claude-code" as const,
    plan: "Claude Code - tier not readable",
    fee_usd: null,
    fee_claimed_usd: null,
    fee_status: "unverified" as const,
    fee_reason: "tier not readable: the session logs carry no plan field, and codexbar returns no plan window",
    window:
      claudeWin && (claudeWin.five_hour_pct !== null || claudeWin.weekly_pct !== null)
        ? { five_hour_pct: claudeWin.five_hour_pct, weekly_pct: claudeWin.weekly_pct, resets_at: claudeWin.resets_at }
        : null,
    window_reason: "codexbar returned no 5h or weekly window for claude (web source, no plan window)",
    tokens_7d: { ...claude.totals },
    speed_7d: claude.speed,
    speed_reason: claude.speed ? null : "no assistant message in the last 7 days",
    ttft_reason: "the session logs carry no first-token time; TTFT is not measured",
    all_time: {
      ...claudeAll.totals,
      first_day: claudeAll.first_ts !== null ? day(claudeAll.first_ts) : null,
      last_day: claudeAll.last_ts !== null ? day(claudeAll.last_ts) : null,
      speed: claudeAll.speed,
    },
    measured_at: measuredAt,
    source: "local ~/.claude session logs (read-only, aggregated)",
  },
];

// the reason for an empty 7-day window names the last day that has a session, never an id or path
const withReasons = providers.map((p, i) => {
  const all = i === 0 ? codexAll : claudeAll;
  return p.tokens_7d.calls === 0 ? { ...p, speed_reason: sevenDayReason(all) + "; speed not measured in the window" } : p;
});

const file = officialFileSchema.parse({
  window_days: 7,
  measured_at: measuredAt,
  source: "local Codex and Claude Code session logs, read-only, aggregated; codexbar windows",
  providers: withReasons,
});
writeFileSync(join(APP, "data", "official.json"), JSON.stringify(file, null, 2) + "\n");
for (const p of file.providers) console.log(p.provider + " calls7d=" + p.tokens_7d.calls + " tokens7d=" + (p.tokens_7d.input + p.tokens_7d.cache_read + p.tokens_7d.cache_write + p.tokens_7d.output) + " allTimeCalls=" + p.all_time.calls + " lastDay=" + p.all_time.last_day);
console.log("official providers=" + file.providers.length + " files codex=" + codexFiles.length + " claude=" + claudeFiles.length);
