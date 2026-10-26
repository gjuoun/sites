/**
 * Pure quota parsing shared by every lane. codexbar is the only source for quota readings;
 * zai is read through it too, with its key handed over under codexbar's own variable name.
 */

export type QuotaWindow = "5h" | "weekly" | "monthly";
export type QuotaReading =
  | {
      lane: string;
      window: QuotaWindow;
      window_minutes: number;
      used_pct: number;
      resets_at: string;
      source: string;
      plan_level?: string | null;
    }
  | { lane: string; unavailable: string };

type CodexbarWindow = { usedPercent?: number; resetsAt?: string; windowMinutes?: number } | null | undefined;

const LABEL = (w: number): QuotaWindow => (w === 300 ? "5h" : w === 10080 ? "weekly" : "monthly");

/** The capacity window is the weekly one when present, else the monthly one. The 5h window is never a capacity reading. */
export function fromCodexbar(lane: string, provider: string, json: string): QuotaReading {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { lane, unavailable: "codexbar_non_json" };
  }
  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as { error?: { message?: string }; usage?: Record<string, unknown> };
  if (entry?.error) return { lane, unavailable: entry.error.message ?? "codexbar_error" };
  const usage = entry?.usage ?? {};
  const candidates = ["secondary", "tertiary", "primary"]
    .map((k) => usage[k] as CodexbarWindow)
    .filter((w): w is { usedPercent: number; resetsAt: string; windowMinutes: number } =>
      !!w && typeof w.usedPercent === "number" && typeof w.resetsAt === "string" && typeof w.windowMinutes === "number",
    );
  const pick = candidates.find((w) => w.windowMinutes === 10080) ?? candidates.find((w) => w.windowMinutes === 43200);
  if (!pick) return { lane, unavailable: `no_weekly_or_monthly_window_for_${provider}` };
  return {
    lane,
    window: LABEL(pick.windowMinutes),
    window_minutes: pick.windowMinutes,
    used_pct: pick.usedPercent,
    resets_at: pick.resetsAt,
    source: "codexbar quota reading",
  };
}

/** zai: same codexbar path; the plan level comes from codexbar's loginMethod (e.g. "max"). */
export function zaiFromCodexbar(lane: string, json: string): QuotaReading {
  const base = fromCodexbar(lane, "zai", json);
  if ("unavailable" in base) return base;
  let level: string | null = null;
  try {
    const entry = (JSON.parse(json) as Array<{ usage?: { loginMethod?: unknown } }>)[0];
    level = typeof entry?.usage?.loginMethod === "string" ? entry.usage.loginMethod : null;
  } catch {
    level = null;
  }
  return { ...base, plan_level: level };
}

/** The child env that gives codexbar its key: ZAI_API_KEY (from opk) is copied to Z_AI_API_KEY. Null when the key is absent. */
export function zaiEnvFor(env: Record<string, string | undefined>): Record<string, string | undefined> | null {
  const key = env.ZAI_API_KEY;
  if (!key) return null;
  return { ...env, Z_AI_API_KEY: key };
}
