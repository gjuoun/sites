/**
 * Pure quota parsing shared by every lane. codexbar is the only source for quota readings;
 * zai is read through it too, with its key handed over under codexbar's own variable name.
 */

export type QuotaWindow = "5h" | "weekly" | "monthly";
export type VendorPoolReading = { used_usd: number; total_usd: number; source: string };
export type CodexbarWindowReading = { window: QuotaWindow; window_minutes: number; used_pct: number; resets_at: string; source: string };
export type QuotaReading =
  | {
      lane: string;
      window: QuotaWindow;
      window_minutes: number;
      used_pct: number;
      resets_at: string;
      source: string;
      plan_level?: string | null;
      credits_used?: number | null;
      credits_total?: number | null;
      windows?: CodexbarWindowReading[];
      vendor_pool?: VendorPoolReading | null;
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

/** Credits consumed and the pool size from codexbar's reset description, e.g. "14,041.65 / 25,500 credits used". */
export function creditsFromCodexbar(json: string): { credits_used: number; credits_total: number } | null {
  try {
    const entry = (JSON.parse(json) as Array<{ usage?: { primary?: { resetDescription?: unknown } } }>)[0];
    const text = typeof entry?.usage?.primary?.resetDescription === "string" ? entry.usage.primary.resetDescription : "";
    const m = /([\d,]+(?:\.\d+)?)\s*\/\s*([\d,]+(?:\.\d+)?)\s*credits used/i.exec(text);
    if (!m) return null;
    return { credits_used: Number(m[1].replace(/,/g, "")), credits_total: Number(m[2].replace(/,/g, "")) };
  } catch {
    return null;
  }
}

/** The child env that gives codexbar its key: ZAI_API_KEY (from opk) is copied to Z_AI_API_KEY. Null when the key is absent. */
export function zaiEnvFor(env: Record<string, string | undefined>): Record<string, string | undefined> | null {
  const key = env.ZAI_API_KEY;
  if (!key) return null;
  return { ...env, Z_AI_API_KEY: key };
}

/** The window length names codexbar uses; any other length is not a window this site reads. */
export function labelOfMinutes(minutes: number): QuotaWindow | null {
  return minutes === 300 ? "5h" : minutes === 10080 ? "weekly" : minutes === 43200 ? "monthly" : null;
}

/**
 * Every window the codexbar reading carries that has a reset time: used percent, length and reset.
 * Account identity and any other field are dropped here and never reach the data files.
 */
export function windowsFromCodexbar(json: string): CodexbarWindowReading[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as { usage?: Record<string, unknown> } | undefined;
  const usage = entry?.usage ?? {};
  const out: CodexbarWindowReading[] = [];
  for (const slot of ["primary", "secondary", "tertiary"]) {
    const w = usage[slot] as CodexbarWindow;
    if (!w || typeof w.usedPercent !== "number" || typeof w.windowMinutes !== "number" || typeof w.resetsAt !== "string") continue;
    const label = labelOfMinutes(w.windowMinutes);
    if (label === null) continue;
    out.push({ window: label, window_minutes: w.windowMinutes, used_pct: w.usedPercent, resets_at: w.resetsAt, source: "codexbar quota reading" });
  }
  return out;
}

/**
 * The vendor-reported usage pool, when codexbar states one: a USD provider cost with a positive limit, or the
 * plan line "… · $X of $Y". Only the numbers and their source are kept. Null when codexbar states none.
 */
export function vendorPoolFromCodexbar(json: string): VendorPoolReading | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const entry = (Array.isArray(parsed) ? parsed[0] : parsed) as { usage?: Record<string, unknown> } | undefined;
  const usage = entry?.usage ?? {};
  const pc = usage.providerCost as { limit?: unknown; used?: unknown; currencyCode?: unknown } | undefined;
  if (pc && typeof pc.limit === "number" && pc.limit > 0 && typeof pc.used === "number" && pc.currencyCode === "USD") {
    return { used_usd: pc.used, total_usd: pc.limit, source: "codexbar providerCost" };
  }
  const line = usage.loginMethod;
  if (typeof line === "string") {
    const m = /\$([\d.,]+)\s+of\s+\$([\d.,]+)/i.exec(line);
    if (m) return { used_usd: Number(m[1].replace(/,/g, "")), total_usd: Number(m[2].replace(/,/g, "")), source: "codexbar plan line" };
  }
  return null;
}
