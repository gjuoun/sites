import { describe, expect, test } from "bun:test";
import { parseZaiQuota } from "./zai";

// shape as returned by GET https://api.z.ai/api/monitor/usage/quota/limit (2026-10-26 live read)
const OK = {
  code: 200,
  data: {
    level: "max",
    limits: [
      { type: "TIME_LIMIT", unit: 5, number: 1, usage: 4000, currentValue: 82, remaining: 3918, percentage: 2, nextResetTime: 1793928305998 },
      { type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 1, nextResetTime: 1793030479713 },
      { type: "TOKENS_LIMIT", unit: 6, number: 1, percentage: 1, nextResetTime: 1793594618999 },
    ],
  },
};

describe("zai quota parser", () => {
  test("reads the weekly token window and the plan level", () => {
    const r = parseZaiQuota(OK);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.used_pct).toBe(1);
    expect(r.window).toBe("weekly");
    expect(r.window_minutes).toBe(10080);
    expect(r.resets_at).toBe(new Date(1793594618999).toISOString());
    expect(r.plan_level).toBe("max");
  });

  test("the 5h token window and the MCP time limit are never used for the weekly reading", () => {
    const only5h = { code: 200, data: { level: "max", limits: [OK.data.limits[1]] } };
    expect(parseZaiQuota(only5h)).toEqual({ ok: false, unavailable: "no_weekly_tokens_limit" });
    const onlyTime = { code: 200, data: { level: "max", limits: [OK.data.limits[0]] } };
    expect(parseZaiQuota(onlyTime)).toEqual({ ok: false, unavailable: "no_weekly_tokens_limit" });
  });

  test("a non-numeric percentage is a reason, never a zero", () => {
    const bad = structuredClone(OK);
    (bad.data.limits[2] as { percentage: unknown }).percentage = "n/a";
    expect(parseZaiQuota(bad)).toEqual({ ok: false, unavailable: "percentage_not_numeric" });
  });

  test("a non-200 envelope or a missing reset time is a reason", () => {
    expect(parseZaiQuota({ code: 401, msg: "bad key" })).toEqual({ ok: false, unavailable: "api_code_401" });
    const noReset = structuredClone(OK);
    delete (noReset.data.limits[2] as { nextResetTime?: number }).nextResetTime;
    expect(parseZaiQuota(noReset)).toEqual({ ok: false, unavailable: "reset_time_missing" });
  });
});
