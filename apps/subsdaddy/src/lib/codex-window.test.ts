import { describe, expect, test } from "bun:test";
import { codexWindowsFromCodexbar } from "./codex-window";

const OK = JSON.stringify([
  {
    source: "oauth",
    usage: {
      primary: { usedPercent: 0, windowMinutes: 300, resetsAt: "2026-10-26T21:31:04Z" },
      secondary: { usedPercent: 0, windowMinutes: 10080, resetsAt: "2026-11-02T16:31:04Z" },
      loginMethod: "plus",
    },
  },
]);

describe("codex window readings", () => {
  test("5h and weekly windows are read; a 0% reading is kept as a reading, not dropped", () => {
    const r = codexWindowsFromCodexbar(OK, "2026-10-26T16:00:00Z");
    expect(r).toEqual({
      ok: true,
      windows: [
        { window: "5h", used_pct: 0, resets_at: "2026-10-26T21:31:04Z", measured_at: "2026-10-26T16:00:00Z", source: "codexbar usage --provider codex" },
        { window: "weekly", used_pct: 0, resets_at: "2026-11-02T16:31:04Z", measured_at: "2026-10-26T16:00:00Z", source: "codexbar usage --provider codex" },
      ],
    });
  });

  test("a missing window is an explicit reason, never a zero", () => {
    const noWeekly = JSON.stringify([{ usage: { primary: { usedPercent: 3, windowMinutes: 300, resetsAt: "2026-10-26T21:31:04Z" } } }]);
    expect(codexWindowsFromCodexbar(noWeekly, "2026-10-26T16:00:00Z")).toEqual({ ok: false, unavailable: "weekly_window_missing" });
  });

  test("a codexbar error or non-JSON output is an explicit reason", () => {
    const err = JSON.stringify([{ error: { message: "No credentials" } }]);
    expect(codexWindowsFromCodexbar(err, "2026-10-26T16:00:00Z")).toEqual({ ok: false, unavailable: "No credentials" });
    expect(codexWindowsFromCodexbar("not json", "2026-10-26T16:00:00Z")).toEqual({ ok: false, unavailable: "codexbar_non_json" });
  });
});
