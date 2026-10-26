import { describe, expect, test } from "bun:test";
import { fromCodexbar, zaiEnvFor, zaiFromCodexbar } from "./quota";

// zai sample, shape as returned by codexbar's quota source (2026-10-26)
const ZAI = JSON.stringify([
  {
    usage: {
      secondary: { resetsAt: "2026-11-02T04:43:38Z", resetDescription: "1 week window", usedPercent: 1, windowMinutes: 10080 },
      primary: { resetsAt: "2026-10-26T16:01:19Z", resetDescription: "5-hour", usedPercent: 1, windowMinutes: 300 },
      tertiary: null,
      loginMethod: "max",
      updatedAt: "2026-10-26T13:02:11Z",
    },
    provider: "zai",
  },
]);

describe("zai via codexbar", () => {
  test("the weekly window is the capacity reading; the 5h window is not used", () => {
    const r = zaiFromCodexbar("zai-glm-max", ZAI);
    expect(r).toEqual({
      lane: "zai-glm-max",
      window: "weekly",
      window_minutes: 10080,
      used_pct: 1,
      resets_at: "2026-11-02T04:43:38Z",
      source: "codexbar quota reading",
      plan_level: "max",
    });
  });

  test("a codexbar error is an explicit reason, never a number", () => {
    const err = JSON.stringify([{ error: { message: "No available fetch strategy for zai." }, provider: "zai" }]);
    expect(zaiFromCodexbar("zai-glm-max", err)).toEqual({ lane: "zai-glm-max", unavailable: "No available fetch strategy for zai." });
  });

  test("a payload without a weekly window is unavailable", () => {
    const noWeek = JSON.stringify([{ usage: { primary: { usedPercent: 1, windowMinutes: 300, resetsAt: "2026-10-26T16:01:19Z" } } }]);
    expect(zaiFromCodexbar("zai-glm-max", noWeek)).toEqual({ lane: "zai-glm-max", unavailable: "no_weekly_or_monthly_window_for_zai" });
  });

  test("the key is handed to codexbar under its own name, and only when present", () => {
    expect(zaiEnvFor({ ZAI_API_KEY: "k-123", PATH: "/bin" })).toEqual({ ZAI_API_KEY: "k-123", PATH: "/bin", Z_AI_API_KEY: "k-123" });
    expect(zaiEnvFor({ PATH: "/bin" })).toBeNull();
  });

  test("the generic codexbar parser keeps its behaviour for the other plans", () => {
    const cc = JSON.stringify([{ usage: { secondary: { usedPercent: 100, windowMinutes: 10080, resetsAt: "2026-10-28T15:50:44Z" } } }]);
    expect(fromCodexbar("commandcode-goat", "commandcode", cc)).toMatchObject({ lane: "commandcode-goat", window: "weekly", used_pct: 100 });
  });
});
