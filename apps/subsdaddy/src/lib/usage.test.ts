import { describe, expect, test } from "bun:test";
import { outputTps, parseUsageRows, percentile, usageSql } from "./usage";

describe("usage parsing", () => {
  test("maps accounts to lanes and drops nothing else", () => {
    const text = [
      "2|deepseek-v4.1-flash|100|0|900|50|0.001|2500|9000|2026-10-25T10:00:00Z",
      "9|deepseek-v4.1-flash|10|0|20|5|0|3000|4000|2026-10-25T10:01:00Z",
    ].join("\n");
    const rows = parseUsageRows(text);
    expect(rows.map((r) => r.lane)).toEqual(["go-1", "qwen"]);
    expect(rows[1].total_cost).toBe(0);
  });

  test("an unmapped account is an error, not a silent lane", () => {
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

describe("percentiles and speed", () => {
  test("nearest-rank percentile on a known sample", () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 90)).toBe(9);
    expect(percentile([], 50)).toBeNull();
  });

  test("output tps uses the generation phase, not the whole request", () => {
    // 200 tokens over (9000-1000) ms of generation = 25 tok/s
    expect(outputTps({ output: 200, first_token_ms: 1000, duration_ms: 9000 })).toBeCloseTo(25, 5);
    expect(outputTps({ output: 200, first_token_ms: null, duration_ms: 9000 })).toBeNull();
    expect(outputTps({ output: 200, first_token_ms: 9000, duration_ms: 9000 })).toBeNull();
  });
});
