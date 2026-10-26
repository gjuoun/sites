import { describe, expect, test } from "bun:test";
import { day, p50, parseClaudeLines, parseCodexLines, summarize } from "./official-logs";

// synthetic fixtures: shaped like the real logs, with no real ids, paths or text
const T0 = Date.parse("2026-10-25T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const codex = [
  { timestamp: iso(T0), type: "event_msg", payload: { type: "task_started" } },
  { timestamp: iso(T0 + 1000), type: "event_msg", payload: { type: "agent_message" } },
  { timestamp: iso(T0 + 5000), type: "event_msg", payload: { type: "token_count", info: { last_token_usage: { input_tokens: 1000, cached_input_tokens: 800, cache_write_input_tokens: 0, output_tokens: 200 } } } },
  { timestamp: iso(T0 + 6000), type: "event_msg", payload: { type: "task_complete" } },
].map((o) => JSON.stringify(o));

const claude = [
  { timestamp: iso(T0), type: "user" },
  { timestamp: iso(T0 + 4000), type: "assistant", message: { usage: { input_tokens: 10, cache_read_input_tokens: 500, cache_creation_input_tokens: 20, output_tokens: 100 } } },
  { timestamp: iso(T0 + 6000), type: "assistant", message: { usage: { input_tokens: 5, cache_read_input_tokens: 600, cache_creation_input_tokens: 0, output_tokens: 300 } } },
  { timestamp: iso(T0 + 8000), type: "attachment" },
].map((o) => JSON.stringify(o));

describe("Codex rollout parser", () => {
  test("uncached input is input minus cached input; cached input is read from cache", () => {
    const p = parseCodexLines(codex);
    expect(p.events).toHaveLength(1);
    expect(p.events[0]).toMatchObject({ input: 200, cache_read: 800, output: 200 });
  });

  test("a turn's speed is its output over the time from task start to completion", () => {
    const p = parseCodexLines(codex);
    expect(p.turns[0].durationMs).toBe(6000);
    expect(p.turns[0].ttftMs).toBe(1000);
    expect(p.turns[0].output).toBe(200);
  });

  test("a malformed or non-usage line is skipped, not counted", () => {
    const p = parseCodexLines(["not json", JSON.stringify({ type: "event_msg" }), ...codex]);
    expect(p.events).toHaveLength(1);
  });
});

describe("Claude Code session parser", () => {
  test("each assistant message contributes its usage; cache reads and writes stay separate", () => {
    const p = parseClaudeLines(claude);
    expect(p.events).toHaveLength(2);
    expect(p.events[0]).toMatchObject({ input: 10, cache_read: 500, cache_write: 20, output: 100 });
  });

  test("a message's duration is the gap from the previous record; TTFT is not inferred", () => {
    const p = parseClaudeLines(claude);
    expect(p.turns[0].durationMs).toBe(4000);
    expect(p.turns[0].ttftMs).toBeNull();
    expect(p.turns[1].durationMs).toBe(2000);
  });
});

describe("summaries", () => {
  test("totals and p50 speed count only events at or after the window start", () => {
    const p = parseClaudeLines(claude);
    const all = summarize(p, 0);
    expect(all.totals.calls).toBe(2);
    expect(all.speed).toEqual({ tps_p50: p50([100 / 4, 300 / 2])!, n: 2 });
    const late = summarize(p, T0 + 5000);
    expect(late.totals.calls).toBe(1);
    expect(late.speed).toEqual({ tps_p50: 300 / 2, n: 1 });
  });

  test("an empty window reports zero calls and no speed, not a made-up figure", () => {
    const s = summarize(parseClaudeLines(claude), Date.parse("2026-10-26T00:00:00Z"));
    expect(s.totals.calls).toBe(0);
    expect(s.speed).toBeNull();
  });

  test("p50 of an even and an odd sample", () => {
    expect(p50([3, 1, 2])).toBe(2);
    expect(p50([4, 1, 3, 2])).toBe(2.5);
    expect(p50([])).toBeNull();
  });

  test("the only date shown is a day, never a timestamp with a session", () => {
    expect(day(T0)).toBe("2026-10-25");
  });
});
