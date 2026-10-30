import { describe, expect, test } from "bun:test";
import { groupByPlan, outputTps, parseUsageRows, percentile, rowsSince, summarizeLane, usageSql } from "./usage";

describe("usage parsing", () => {
  test("accounts map to plans; the metered flag marks the account the quota reading comes from", () => {
    const text = [
      "2|deepseek-v4.1-flash|100|0|900|50|0.001|2500|9000|2026-10-25T10:00:00Z",
      "9|deepseek-v4.1-flash|10|0|20|5|0|3000|4000|2026-10-25T10:01:00Z",
    ].join("\n");
    const rows = parseUsageRows(text);
    expect(rows.map((r) => r.lane)).toEqual(["opencode-go", "qwen-cloud-token"]);
    expect(rows.map((r) => r.metered)).toEqual([true, true]);
    expect(rows[1].total_cost).toBe(0);
  });

  test("two subscriptions of one plan merge into one plan bucket; only one of them is metered", () => {
    const text = [
      "2|deepseek-v4.1-flash|100|0|900|50|0.001|2500|9000|2026-10-25T10:00:00Z",
      "6|deepseek-v4.1-flash|40|0|60|20|0.0005|2600|8000|2026-10-25T10:02:00Z",
    ].join("\n");
    const rows = parseUsageRows(text);
    const grouped = groupByPlan(rows);
    expect(grouped.get("opencode-go")!.length).toBe(2);
    expect(grouped.get("commandcode-goat")!.length).toBe(0);
    expect(rows.map((r) => r.metered)).toEqual([true, false]);
  });

  test("an unmapped account is an error, not a silent plan", () => {
    expect(() => parseUsageRows("3|deepseek-flash|1|0|0|1|0|1|2|2026-10-25T00:00:00Z")).toThrow("unmapped account_id 3");
  });

  test("empty first_token_ms stays null rather than 0", () => {
    const rows = parseUsageRows("7|x|1|0|0|1|0.1||5000|2026-10-25T00:00:00Z");
    expect(rows[0].first_token_ms).toBeNull();
  });

  test("the SQL excludes account 3 and rejects a window outside 1..90 days", () => {
    const sql = usageSql(7);
    expect(sql).toContain("account_id IN (2,6,7,8,9)");
    expect(sql).not.toContain("3,");
    expect(() => usageSql(0)).toThrow();
    expect(() => usageSql(7.5)).toThrow();
  });
});

const ROWS = [
  "2|deepseek-v4.1-flash|100|0|900|50|0.25|2500|9000|2026-10-20T10:00:00Z",
  "2|deepseek-v4.1-flash|200|0|800|100|0.5|1500|5000|2026-10-29T10:00:00Z",
  "2|mimo-v2.6-flash|30|0|70|10|0|3000|4000|2026-10-30T09:00:00Z",
].join("\n");

describe("the recent window", () => {
  test("a row is inside the window from its instant onward, and only those rows are summed", () => {
    const rows = parseUsageRows(ROWS);
    const cut = Date.parse("2026-10-28T00:00:00Z");
    const recent = rowsSince(rows, cut);
    expect(recent.length).toBe(2);
    const lane = summarizeLane("opencode-go", recent, "2026-10-30T12:00:00Z", "test");
    expect(lane.rows).toBe(2);
    expect(lane.tokens.input).toBe(230);
    expect(lane.tokens.output).toBe(110);
    expect(lane.models.map((m) => m.upstream_model).sort()).toEqual(["deepseek-v4.1-flash", "mimo-v2.6-flash"]);
    expect(lane.cache_share).toBeCloseTo(870 / (230 + 870), 6);
  });

  test("an idle lane keeps rows 0 and null percentiles, never a zero", () => {
    const lane = summarizeLane("zai-glm-max", [], "2026-10-30T12:00:00Z", "test");
    expect(lane.rows).toBe(0);
    expect(lane.p50_ttft_ms).toBeNull();
    expect(lane.p50_output_tps).toBeNull();
    expect(lane.cache_share).toBeNull();
    expect(lane.models).toEqual([]);
  });
});

describe("percentiles and speed", () => {
  test("nearest-rank percentile on a known sample", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
  });

  test("output tps uses the generation phase, not the whole request", () => {
    expect(outputTps({ output: 200, first_token_ms: 1000, duration_ms: 9000 })).toBeCloseTo(25, 5);
    expect(outputTps({ output: 200, first_token_ms: null, duration_ms: 9000 })).toBeNull();
    expect(outputTps({ output: 200, first_token_ms: 9000, duration_ms: 9000 })).toBeNull();
  });
});
