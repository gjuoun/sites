/**
 * Read-only parsers for the local logs of the official subscription clients: Codex CLI rollouts and
 * Claude Code sessions. They turn JSONL lines into numbers only: token counts, call counts, and
 * per-turn speed. Session ids, paths, prompts and account details are read past and never returned.
 */

export type UsageEvent = { ts: number; input: number; cache_read: number; cache_write: number; output: number };
export type Turn = { ts: number; output: number; durationMs: number | null; ttftMs: number | null };
export type Parsed = { events: UsageEvent[]; turns: Turn[] };
export type Totals = { calls: number; input: number; cache_read: number; cache_write: number; output: number };

const MAX_TURN_MS = 10 * 60_000;

function parseLine(line: string): Record<string, unknown> | null {
  try {
    const o = JSON.parse(line) as unknown;
    return o && typeof o === "object" ? (o as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const at = (o: Record<string, unknown>) => (typeof o.timestamp === "string" ? Date.parse(o.timestamp) : NaN);

/** Codex rollout: token_count events carry the last call's usage; task_started/task_complete bound a turn. */
export function parseCodexLines(lines: string[]): Parsed {
  const events: UsageEvent[] = [];
  const turns: Turn[] = [];
  let start: number | null = null;
  let firstText: number | null = null;
  let turnOutput = 0;
  for (const line of lines) {
    const o = parseLine(line);
    if (!o || Number.isNaN(at(o))) continue;
    const ts = at(o);
    const p = (o.payload ?? {}) as Record<string, unknown>;
    if (o.type !== "event_msg") continue;
    if (p.type === "task_started") {
      start = ts;
      firstText = null;
      turnOutput = 0;
    } else if (p.type === "agent_message" && firstText === null && start !== null) {
      firstText = ts;
    } else if (p.type === "token_count") {
      const last = ((p.info ?? {}) as Record<string, unknown>).last_token_usage as Record<string, unknown> | undefined;
      if (!last) continue;
      const cached = num(last.cached_input_tokens);
      const e = { ts, input: Math.max(0, num(last.input_tokens) - cached), cache_read: cached, cache_write: num(last.cache_write_input_tokens), output: num(last.output_tokens) };
      events.push(e);
      turnOutput += e.output;
    } else if (p.type === "task_complete" && start !== null) {
      const dur = ts - start;
      turns.push({ ts, output: turnOutput, durationMs: dur > 0 && dur <= MAX_TURN_MS ? dur : null, ttftMs: firstText !== null ? firstText - start : null });
      start = null;
    }
  }
  return { events, turns };
}

/** Claude Code session: assistant records carry message.usage; the time from the previous record is the message's duration. */
export function parseClaudeLines(lines: string[]): Parsed {
  const events: UsageEvent[] = [];
  const turns: Turn[] = [];
  let prev: number | null = null;
  for (const line of lines) {
    const o = parseLine(line);
    if (!o || Number.isNaN(at(o))) continue;
    const ts = at(o);
    if (o.type === "assistant" && o.message && typeof o.message === "object") {
      const u = (o.message as Record<string, unknown>).usage as Record<string, unknown> | undefined;
      if (u) {
        events.push({ ts, input: num(u.input_tokens), cache_read: num(u.cache_read_input_tokens), cache_write: num(u.cache_creation_input_tokens), output: num(u.output_tokens) });
        const dur = prev !== null ? ts - prev : NaN;
        turns.push({ ts, output: num(u.output_tokens), durationMs: dur > 0 && dur <= MAX_TURN_MS ? dur : null, ttftMs: null });
      }
    }
    prev = ts;
  }
  return { events, turns };
}

export function p50(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Totals of the events at or after sinceMs, and the p50 output speed of the turns in the same window. */
export function summarize(parsed: Parsed, sinceMs: number) {
  const ev = parsed.events.filter((e) => e.ts >= sinceMs);
  const totals: Totals = ev.reduce(
    (a, e) => ({ calls: a.calls + 1, input: a.input + e.input, cache_read: a.cache_read + e.cache_read, cache_write: a.cache_write + e.cache_write, output: a.output + e.output }),
    { calls: 0, input: 0, cache_read: 0, cache_write: 0, output: 0 },
  );
  const tps = parsed.turns
    .filter((t) => t.ts >= sinceMs && t.durationMs !== null && t.output > 0)
    .map((t) => t.output / (t.durationMs! / 1000));
  const days = parsed.events.map((e) => e.ts);
  return {
    totals,
    speed: tps.length > 0 ? { tps_p50: p50(tps)!, n: tps.length } : null,
    first_ts: days.length ? Math.min(...days) : null,
    last_ts: days.length ? Math.max(...days) : null,
  };
}

/** Day of a timestamp as YYYY-MM-DD: the only date the site shows from these logs. */
export const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
