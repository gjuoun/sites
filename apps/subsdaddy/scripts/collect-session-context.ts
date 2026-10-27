#!/usr/bin/env bun
/**
 * Read-only: the session-end context and the throughput of the pi sessions in ~/.pi/agent/sessions.
 *
 * Context (45 days): for each session, the context at its end is the prompt of its last assistant call:
 * input + cache read + cache write.
 *
 * Throughput (30 days): tokens per active hour. A session's active time is the sum of the gaps between its
 * consecutive messages, each gap counted only up to a 5-minute idle cap. A session counts when it has at least
 * 9 active minutes and at least one assistant call with usage. Tokens are all four classes (input, output,
 * cache read, cache write), so the figure prices with the same mix as the blend.
 *
 * The script writes quantiles, a histogram and the throughput quantiles to data/context.json. It never writes
 * to the sessions, and it prints and stores no session id, path, prompt or message content.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { contextFileSchema } from "../src/data/context";
import { quantile } from "../src/lib/quantile";

const APP = resolve(import.meta.dir, "..");
const ROOT = join(homedir(), ".pi", "agent", "sessions");
const DAYS = 45;
const THROUGHPUT_DAYS = 30;
const IDLE_CAP_MS = 5 * 60_000;
const MIN_ACTIVE_MS = 9 * 60_000;
const now = Date.now();
const since = now - DAYS * 24 * 60 * 60 * 1000;
const tpSince = now - THROUGHPUT_DAYS * 24 * 60 * 60 * 1000;

type Msg = { role?: string; timestamp?: unknown; usage?: Record<string, unknown> };

function jsonlUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonlUnder(p));
    else if (name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

function timeOf(raw: unknown): number {
  return typeof raw === "number" ? raw : Date.parse(String(raw ?? ""));
}

/** The context at the end of one session: the prompt of its latest assistant call with usage in the window. */
function endContext(path: string): { ts: number; prompt: number } | null {
  let best: { ts: number; prompt: number } | null = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message as Msg | undefined;
    if (!m || m.role !== "assistant") continue;
    const u = m.usage;
    if (!u) continue;
    const ts = timeOf(m.timestamp ?? o.timestamp);
    if (!Number.isFinite(ts) || ts < since) continue;
    const prompt = (Number(u.input) || 0) + (Number(u.cacheRead) || 0) + (Number(u.cacheWrite) || 0);
    if (prompt <= 0) continue;
    if (!best || ts > best.ts) best = { ts, prompt };
  }
  return best;
}

/** One session's tokens (all four classes) and its active time in the throughput window; null if it has no usage. */
function throughputOf(path: string): { tokens: number; active: number } | null {
  const stamps: number[] = [];
  let tokens = 0;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message as Msg | undefined;
    const ts = timeOf(m?.timestamp ?? o.timestamp);
    if (!Number.isFinite(ts) || ts < tpSince) continue;
    stamps.push(ts);
    const u = m?.usage;
    if (m?.role === "assistant" && u) {
      tokens += (Number(u.input) || 0) + (Number(u.output) || 0) + (Number(u.cacheRead) || 0) + (Number(u.cacheWrite) || 0);
    }
  }
  if (stamps.length < 2 || tokens <= 0) return null;
  stamps.sort((a, b) => a - b);
  let active = 0;
  for (let i = 1; i < stamps.length; i++) {
    const gap = stamps[i] - stamps[i - 1];
    if (gap <= IDLE_CAP_MS) active += gap;
  }
  return { tokens, active };
}

const BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: "0-20k", min: 0, max: 20_000 },
  { label: "20-50k", min: 20_000, max: 50_000 },
  { label: "50-100k", min: 50_000, max: 100_000 },
  { label: "100-200k", min: 100_000, max: 200_000 },
  { label: "200k+", min: 200_000, max: Infinity },
];

const files = jsonlUnder(ROOT);
const ends = files.map(endContext).filter((x): x is { ts: number; prompt: number } => x !== null);
const xs = ends.map((e) => e.prompt).sort((a, b) => a - b);
if (xs.length === 0) throw new Error("no sessions with usage in the last " + DAYS + " days");
const round = (v: number) => Math.round(v);
const quantiles = { p50: round(quantile(xs, 0.5)), p75: round(quantile(xs, 0.75)), p90: round(quantile(xs, 0.9)), max: xs[xs.length - 1] };
const histogram = BUCKETS.map((b) => ({ bucket: b.label, sessions: xs.filter((x) => x >= b.min && x < b.max).length }));

const tp = files.map(throughputOf).filter((x): x is { tokens: number; active: number } => x !== null && x.active >= MIN_ACTIVE_MS);
const perHour = tp.map((x) => x.tokens / (x.active / 3_600_000)).sort((a, b) => a - b);
if (perHour.length === 0) throw new Error("no sessions with 9 active minutes in the last " + THROUGHPUT_DAYS + " days");
const tokensPerHour = { p25: round(quantile(perHour, 0.25)), p50: round(quantile(perHour, 0.5)), p75: round(quantile(perHour, 0.75)) };

const file = contextFileSchema.parse({
  window_days: DAYS,
  measured_at: new Date(now).toISOString(),
  source: "local pi session logs (read-only, aggregated): session-end prompt = input + cache read + cache write of the last assistant call",
  method: "quantiles by linear interpolation between order statistics (R-7); a session counts once, at its last call",
  sample_sessions: xs.length,
  quantiles,
  histogram,
  throughput: {
    window_days: THROUGHPUT_DAYS,
    source: "local pi session logs (read-only, aggregated): all four token classes of every assistant call, per session",
    method: "active time = sum of gaps between a session's consecutive messages, each gap capped at 5 minutes; sessions with at least 9 active minutes count; tokens per active hour per session; quantiles by R-7",
    idle_cap_minutes: 5,
    min_active_minutes: 9,
    sample_sessions: perHour.length,
    tokens_per_active_hour: tokensPerHour,
  },
});
writeFileSync(join(APP, "data", "context.json"), JSON.stringify(file, null, 2) + "\n");
console.log("context sessions=" + xs.length + " files=" + files.length + " p50=" + quantiles.p50 + " p75=" + quantiles.p75 + " p90=" + quantiles.p90 + " max=" + quantiles.max);
console.log("histogram " + histogram.map((h) => h.bucket + " " + h.sessions).join(" · "));
console.log("throughput sessions=" + perHour.length + " tokens_per_active_hour p25=" + tokensPerHour.p25 + " p50=" + tokensPerHour.p50 + " p75=" + tokensPerHour.p75);
