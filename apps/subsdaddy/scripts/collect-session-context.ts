#!/usr/bin/env bun
/**
 * Read-only: the session-end context of the pi sessions in ~/.pi/agent/sessions (last 45 days).
 * For each session, the context at its end is the prompt of its last assistant call: input + cache read +
 * cache write. The script writes quantiles and a histogram to data/context.json. It never writes to the
 * sessions, and it prints and stores no session id, path, prompt or message content.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { contextFileSchema } from "../src/data/context";
import { quantile } from "../src/lib/quantile";

const APP = resolve(import.meta.dir, "..");
const ROOT = join(homedir(), ".pi", "agent", "sessions");
const DAYS = 45;
const now = Date.now();
const since = now - DAYS * 24 * 60 * 60 * 1000;

function jsonlUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonlUnder(p));
    else if (name.endsWith(".jsonl")) out.push(p);
  }
  return out;
}

/** The context at the end of one session: the prompt of its latest assistant call with usage in the window. */
function endContext(path: string): { ts: number; prompt: number } | null {
  let best: { ts: number; prompt: number } | null = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let o: Record<string, unknown>;
    try { o = JSON.parse(line); } catch { continue; }
    const m = o.message as Record<string, unknown> | undefined;
    if (!m || m.role !== "assistant") continue;
    const u = m.usage as Record<string, unknown> | undefined;
    if (!u) continue;
    const raw = m.timestamp ?? o.timestamp;
    const ts = typeof raw === "number" ? raw : Date.parse(String(raw ?? ""));
    if (!Number.isFinite(ts) || ts < since) continue;
    const prompt = (Number(u.input) || 0) + (Number(u.cacheRead) || 0) + (Number(u.cacheWrite) || 0);
    if (prompt <= 0) continue;
    if (!best || ts > best.ts) best = { ts, prompt };
  }
  return best;
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

const file = contextFileSchema.parse({
  window_days: DAYS,
  measured_at: new Date(now).toISOString(),
  source: "local pi session logs (read-only, aggregated): session-end prompt = input + cache read + cache write of the last assistant call",
  method: "quantiles by linear interpolation between order statistics (R-7); a session counts once, at its last call",
  sample_sessions: xs.length,
  quantiles,
  histogram,
});
writeFileSync(join(APP, "data", "context.json"), JSON.stringify(file, null, 2) + "\n");
console.log("context sessions=" + xs.length + " files=" + files.length + " p50=" + quantiles.p50 + " p75=" + quantiles.p75 + " p90=" + quantiles.p90 + " max=" + quantiles.max);
console.log("histogram " + histogram.map((h) => h.bucket + " " + h.sessions).join(" · "));
