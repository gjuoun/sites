/**
 * Direct read of the z.ai coding-plan quota. codexbar has no zai strategy, but the monitor
 * endpoint answers with the same key the coding plan uses. The key is taken from the process
 * environment only (injected by `opk get ZAI_API_KEY -- …`), is never written to disk, and is
 * never included in an error message.
 */

export const ZAI_QUOTA_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
export const WEEK_MINUTES = 10080;

export type ZaiReading =
  | {
      ok: true;
      used_pct: number;
      window: "weekly";
      window_minutes: number;
      resets_at: string;
      plan_level: string | null;
    }
  | { ok: false; unavailable: string };

type Limit = {
  type?: unknown;
  unit?: unknown;
  number?: unknown;
  percentage?: unknown;
  nextResetTime?: unknown;
};

/** Pure: validates the envelope and extracts the weekly token window. Never returns a number it cannot justify. */
export function parseZaiQuota(body: unknown): ZaiReading {
  const env = body as { code?: unknown; msg?: unknown; data?: { level?: unknown; limits?: unknown } } | null;
  if (!env || typeof env !== "object") return { ok: false, unavailable: "body_not_object" };
  if (env.code !== 200) return { ok: false, unavailable: `api_code_${String(env.code)}` };
  const limits = env.data?.limits;
  if (!Array.isArray(limits)) return { ok: false, unavailable: "limits_missing" };

  // the weekly window is TOKENS_LIMIT unit=6 number=1; unit=3 number=5 is the 5h burst window (stored by convention, not used)
  const weekly = (limits as Limit[]).find(
    (l) => l && l.type === "TOKENS_LIMIT" && l.unit === 6 && l.number === 1,
  );
  if (!weekly) return { ok: false, unavailable: "no_weekly_tokens_limit" };
  if (typeof weekly.percentage !== "number" || !Number.isFinite(weekly.percentage) || weekly.percentage < 0 || weekly.percentage > 100) {
    return { ok: false, unavailable: "percentage_not_numeric" };
  }
  if (typeof weekly.nextResetTime !== "number" || !Number.isFinite(weekly.nextResetTime)) {
    return { ok: false, unavailable: "reset_time_missing" };
  }
  const level = typeof env.data?.level === "string" ? env.data.level : null;
  return {
    ok: true,
    used_pct: weekly.percentage,
    window: "weekly",
    window_minutes: WEEK_MINUTES,
    resets_at: new Date(weekly.nextResetTime).toISOString(),
    plan_level: level,
  };
}

/** Reads the key from the environment only. Missing key → explicit reason, no request is made. */
export async function fetchZaiQuota(env: Record<string, string | undefined> = process.env): Promise<ZaiReading> {
  const key = env.ZAI_API_KEY;
  if (!key) return { ok: false, unavailable: "ZAI_API_KEY not in env" };
  let res: Response;
  try {
    res = await fetch(ZAI_QUOTA_URL, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "error";
    return { ok: false, unavailable: `request_failed_${name}` };
  }
  if (!res.ok) return { ok: false, unavailable: `http_${res.status}` };
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { ok: false, unavailable: "body_not_json" };
  }
  return parseZaiQuota(body);
}
