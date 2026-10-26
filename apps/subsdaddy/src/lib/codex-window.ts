/** Pure parse of codexbar's codex output into 5h and weekly readings. Missing data is a reason, never a zero. */

export type CodexWindow = { window: "5h" | "weekly"; used_pct: number; resets_at: string; measured_at: string; source: string };
export type CodexWindows = { ok: true; windows: CodexWindow[] } | { ok: false; unavailable: string };

const SOURCE = "codexbar usage --provider codex";

type Win = { usedPercent?: unknown; resetsAt?: unknown; windowMinutes?: unknown } | null | undefined;

export function codexWindowsFromCodexbar(json: string, measuredAt: string): CodexWindows {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, unavailable: "codexbar_non_json" };
  }
  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string }; usage?: Record<string, Win> } | undefined;
  if (entry?.error) return { ok: false, unavailable: entry.error.message ?? "codexbar_error" };
  const usage = entry?.usage ?? {};
  const pick = (minutes: number): Win =>
    [usage.primary, usage.secondary, usage.tertiary].find((w) => w && w.windowMinutes === minutes);
  const to = (w: Win, window: "5h" | "weekly"): CodexWindow | string => {
    if (!w) return window === "5h" ? "5h_window_missing" : "weekly_window_missing";
    if (typeof w.usedPercent !== "number" || !Number.isFinite(w.usedPercent)) return window + "_percent_not_numeric";
    if (typeof w.resetsAt !== "string") return window + "_reset_missing";
    return { window, used_pct: w.usedPercent, resets_at: w.resetsAt, measured_at: measuredAt, source: SOURCE };
  };
  const five = to(pick(300), "5h");
  const week = to(pick(10080), "weekly");
  if (typeof five === "string") return { ok: false, unavailable: five };
  if (typeof week === "string") return { ok: false, unavailable: week };
  return { ok: true, windows: [five, week] };
}
