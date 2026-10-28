#!/usr/bin/env bun
/**
 * Read-only: the session-end context and the throughput of the pi sessions in ~/.pi/agent/sessions.
 *
 * Context (45 days): for each session, the context at its end is the prompt of its last assistant call:
 * input + cache read + cache write.
 *
 * Throughput (30 days), per session-hour: a session-hour is one pi session with at least one assistant call with usage
 * inside one clock hour (UTC). Its tokens are the four classes of those calls. The aggregate tokens per session-hour is
 * all tokens divided by the number of session-hours. Concurrency is the number of distinct sessions in each clock hour
 * that has any usage. Nothing is read from the sessions' text.
 *
 * The script writes quantiles, a histogram and the throughput to data/context.json. It never writes to the sessions, and
 * it prints and stores no session id, path, prompt or message content.
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

/** Per clock hour of one session: the tokens of its assistant calls with usage (four classes). */
function hoursOf(path: string, into: Map<number, number>): void {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message as Msg | undefined;
    const u = m?.usage;
    if (m?.role !== "assistant" || !u) continue;
    const ts = timeOf(m.timestamp ?? o.timestamp);
    if (!Number.isFinite(ts) || ts < tpSince) continue;
    const tokens = (Number(u.input) || 0) + (Number(u.output) || 0) + (Number(u.cacheRead) || 0) + (Number(u.cacheWrite) || 0);
    if (tokens <= 0) continue;
    const hour = Math.floor(ts / 3_600_000);
    into.set(hour, (into.get(hour) ?? 0) + tokens);
  }
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

// throughput per session-hour (r55): one entry per (session, clock hour) with usage
const sessionHours: number[] = [];
const concurrency = new Map<number, number>();
for (const f of files) {
  const perHour = new Map<number, number>();
  hoursOf(f, perHour);
  for (const [hour, tokens] of perHour) {
    sessionHours.push(tokens);
    concurrency.set(hour, (concurrency.get(hour) ?? 0) + 1);
  }
}
if (sessionHours.length === 0) throw new Error("no session-hours with usage in the last " + THROUGHPUT_DAYS + " days");
sessionHours.sort((a, b) => a - b);
const totalTokens = sessionHours.reduce((a, b) => a + b, 0);
const conc = [...concurrency.values()].sort((a, b) => a - b);
const mb = (v: number) => Math.round(v);

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
    source: "local pi session logs (read-only, aggregated): all four token classes of every assistant call, per session and clock hour (UTC)",
    method: "session-hour = one session with usage in one clock hour; aggregate = all tokens / session-hours; median, mean and p90 are over session-hours (R-7); concurrency = distinct sessions per clock hour that has usage",
    active_hours: concurrency.size,
    session_hours: sessionHours.length,
    tokens: totalTokens,
    tokens_per_session_hour: {
      aggregate: mb(totalTokens / sessionHours.length),
      median: mb(quantile(sessionHours, 0.5)),
      mean: mb(totalTokens / sessionHours.length),
      p90: mb(quantile(sessionHours, 0.9)),
    },
    concurrency: { median: quantile(conc, 0.5), p90: quantile(conc, 0.9), max: conc[conc.length - 1] },
    sample_sessions: files.length,
  },
});
writeFileSync(join(APP, "data", "context.json"), JSON.stringify(file, null, 2) + "\n");
console.log("context sessions=" + xs.length + " files=" + files.length + " p50=" + quantiles.p50 + " p75=" + quantiles.p75 + " p90=" + quantiles.p90 + " max=" + quantiles.max);
console.log("histogram " + histogram.map((h) => h.bucket + " " + h.sessions).join(" · "));
console.log("throughput active_hours=" + concurrency.size + " session_hours=" + sessionHours.length + " tokens_per_session_hour aggregate=" + file.throughput.tokens_per_session_hour.aggregate + " median=" + file.throughput.tokens_per_session_hour.median + " p90=" + file.throughput.tokens_per_session_hour.p90 + " concurrency median=" + file.throughput.concurrency.median + " p90=" + file.throughput.concurrency.p90 + " max=" + file.throughput.concurrency.max);
