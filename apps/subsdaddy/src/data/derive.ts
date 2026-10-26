import type { TokenCounts } from "./schema";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** 365.25 / 12 / 7 — weeks per average month. */
export const WEEKS_PER_MONTH = 4.348;

export type Capacity =
  | { ok: true; tokens_per_week: number; coverage: number | null }
  | { ok: false; unavailable: string };

export function totalTokens(t: TokenCounts): number {
  return t.input + t.cache_creation + t.cache_read + t.output;
}

/**
 * Cache share over the prompt side of the bill: cache_read / (input + cache_creation + cache_read).
 * The historical report computed it over every token and produced shares above 1.
 */
export function cacheShare(t: TokenCounts): number | null {
  const prompt = t.input + t.cache_creation + t.cache_read;
  if (prompt <= 0) return null;
  const share = t.cache_read / prompt;
  return share >= 0 && share <= 1 ? share : null;
}

/**
 * Tokens already delivered in the current window, divided by how much of the
 * window the plan says has been consumed. Saturated and implausibly empty
 * windows are refused rather than extrapolated.
 */
export function capacityFromSnapshot(input: {
  tokens_in_window: number;
  used_pct: number | null | undefined;
  window_ms: number;
  coverage: number | null;
}): Capacity {
  const { tokens_in_window, used_pct, window_ms, coverage } = input;
  if (used_pct === null || used_pct === undefined) return { ok: false, unavailable: "used_pct_missing" };
  if (!(used_pct > 0)) return { ok: false, unavailable: "window_unused" };
  if (used_pct >= 100) return { ok: false, unavailable: "window_saturated" };
  if (coverage !== null && coverage < 0.95) return { ok: false, unavailable: "partial_window" };
  if (tokens_in_window <= 0) return { ok: false, unavailable: "no_tokens_in_window" };
  const windowTokens = tokens_in_window / (used_pct / 100);
  return { ok: true, tokens_per_week: windowTokens * (WEEK_MS / window_ms), coverage };
}

/** Two window readings at least an hour apart: tokens between them over the percentage delta. */
export function capacityFromDelta(input: {
  tokens_between: number;
  used_pct_before: number;
  used_pct_after: number;
  elapsed_ms: number;
}): Capacity {
  const delta = input.used_pct_after - input.used_pct_before;
  if (!(delta > 0)) return { ok: false, unavailable: "used_pct_did_not_advance" };
  if (input.elapsed_ms < 60 * 60 * 1000) return { ok: false, unavailable: "delta_window_too_short" };
  if (input.tokens_between <= 0) return { ok: false, unavailable: "no_tokens_between" };
  const windowTokens = input.tokens_between / (delta / 100);
  return { ok: true, tokens_per_week: windowTokens * (WEEK_MS / input.elapsed_ms), coverage: null };
}

/**
 * The ranking key: monthly fee over the tokens the lane actually delivers in a
 * month, expressed per billion tokens.
 */
export function usdB(price_month_usd: number, tokens_per_week: number): number | null {
  if (!(price_month_usd > 0) || !(tokens_per_week > 0)) return null;
  return (price_month_usd / (tokens_per_week * WEEKS_PER_MONTH)) * 1e9;
}

/**
 * Confidence of a capacity reading from the used percentage. Providers report whole percents, so a
 * reading near 0% carries roughly 1/used_pct relative error: below 10% it is flagged low.
 */
export function capacityConfidence(used_pct: number | null | undefined): { confidence: "low" | "normal"; reason: string | null } | null {
  if (used_pct === null || used_pct === undefined || !Number.isFinite(used_pct)) return null;
  if (used_pct < 10) {
    return { confidence: "low", reason: `used_pct ${used_pct} is an integer percent: error about 1/used_pct` };
  }
  return { confidence: "normal", reason: null };
}

export type PricedRow = {
  tokens: TokenCounts;
  total_cost: number;
};

export type PriceFit =
  | {
      ok: true;
      p_in: number;
      p_cache: number;
      p_out: number;
      residual: number;
      excluded: number;
      priced_rows: number;
    }
  | { ok: false; unavailable: string; excluded: number; priced_rows: number };

/**
 * Least squares fit of `total_cost = p_in·input + p_cache·cache + p_out·output`.
 * Rows priced at 0 (models the gateway has no price for) are excluded, never
 * treated as free capacity.
 */
export function fitPriceVector(rows: PricedRow[]): PriceFit {
  const priced = rows.filter((r) => r.total_cost > 0);
  const excluded = rows.length - priced.length;
  if (priced.length < 6) return { ok: false, unavailable: "too_few_priced_rows", excluded, priced_rows: priced.length };

  const a: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const b = [0, 0, 0];
  for (const r of priced) {
    const x = [r.tokens.input + r.tokens.cache_creation, r.tokens.cache_read, r.tokens.output];
    for (let i = 0; i < 3; i++) {
      b[i] += x[i] * r.total_cost;
      for (let j = 0; j < 3; j++) a[i][j] += x[i] * x[j];
    }
  }
  const solved = solve3(a, b);
  if (!solved) return { ok: false, unavailable: "singular_normal_equations", excluded, priced_rows: priced.length };
  const [p_in, p_cache, p_out] = solved;
  if (p_in < 0 || p_cache < 0 || p_out < 0) {
    return { ok: false, unavailable: "negative_price", excluded, priced_rows: priced.length };
  }

  let sumAbs = 0;
  let sumActual = 0;
  for (const r of priced) {
    const predicted =
      p_in * (r.tokens.input + r.tokens.cache_creation) + p_cache * r.tokens.cache_read + p_out * r.tokens.output;
    sumAbs += Math.abs(r.total_cost - predicted);
    sumActual += r.total_cost;
  }
  const residual = sumActual > 0 ? sumAbs / sumActual : 1;
  return { ok: true, p_in, p_cache, p_out, residual, excluded, priced_rows: priced.length };
}

function solve3(a: number[][], b: number[]): [number, number, number] | null {
  const m = a.map((row, i) => [...row, b[i]]);
  // singularity is judged relative to the matrix scale, not as an absolute epsilon
  const scale = Math.max(...a.flat().map(Math.abs));
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    if (Math.abs(m[pivot][col]) < 1e-9 * scale) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const p = m[col][col];
    for (let c = col; c < 4; c++) m[col][c] /= p;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r][col];
      if (f === 0) continue;
      for (let c = col; c < 4; c++) m[r][c] -= f * m[col][c];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

export type Shape = "interactive" | "agent" | "cache_heavy";
export const SHAPES: Shape[] = ["interactive", "agent", "cache_heavy"];

/** Fixed cache shares for the two ends; `agent` is the pooled mix of the measured lanes. */
export function mixShares(rows: PricedRow[]): { interactive: number; agent: number | null; cache_heavy: number } {
  const pooled = rows
    .reduce(
      (acc, r) => {
        const prompt = r.tokens.input + r.tokens.cache_creation + r.tokens.cache_read;
        acc.read += r.tokens.cache_read;
        acc.prompt += prompt;
        return acc;
      },
      { read: 0, prompt: 0 },
    );
  return {
    interactive: 0,
    agent: pooled.prompt > 0 ? pooled.read / pooled.prompt : null,
    cache_heavy: 0.94,
  };
}

/**
 * A preset is only emitted when the lane has both a price vector and a
 * capacity-derived dollar figure to check the plan allowance against.
 */
export function presetsFor(input: {
  fit: PriceFit;
  capacity_usd: number | null;
  plan_price_month_usd: number;
  agent_share: number | null;
  capacity_tokens_per_week: number | null;
}): Array<{ shape: Shape; usd_per_b?: number; unavailable?: string }> {
  const { fit, capacity_usd, plan_price_month_usd, agent_share, capacity_tokens_per_week } = input;
  const out: Array<{ shape: Shape; usd_per_b?: number; unavailable?: string }> = [];
  const base = (shape: Shape, share: number | null): { shape: Shape; usd_per_b?: number; unavailable?: string } => {
    if (!fit.ok) return { shape, unavailable: fit.unavailable };
    if (share === null) return { shape, unavailable: "share_unavailable" };
    if (capacity_tokens_per_week === null) return { shape, unavailable: "capacity_unavailable" };
    // cost of one billion tokens at this cache share, using the fitted vector
    const cache = share;
    const fresh = 1 - cache;
    const perToken = fit.p_in * fresh + fit.p_cache * cache;
    const perB = perToken * 1e9;
    if (!(perB > 0)) return { shape, unavailable: "non_positive_price" };
    return { shape, usd_per_b: perB };
  };
  if (capacity_usd === null) {
    return SHAPES.map((shape) => ({ shape, unavailable: "capacity_usd_unavailable" }));
  }
  if (capacity_usd > plan_price_month_usd * 1.2 || capacity_usd < plan_price_month_usd * 0.8) {
    return SHAPES.map((shape) => ({ shape, unavailable: "capacity_conflict" }));
  }
  out.push(base("interactive", 0));
  out.push(base("agent", agent_share));
  out.push(base("cache_heavy", 0.94));
  return out;
}

/**
 * Share of the elapsed part of a quota window that the usage log covers.
 * The log must start at or before the window start for the coverage to be full.
 */
export function elapsedCoverage(input: { coverage_start_ms: number; window_start_ms: number; now_ms: number }): number {
  const elapsed = input.now_ms - input.window_start_ms;
  if (!(elapsed > 0)) return 0;
  const covered = input.now_ms - Math.max(input.coverage_start_ms, input.window_start_ms);
  return Math.max(0, Math.min(1, covered / elapsed));
}

/** Share of the quota window that the usage log actually covers. */
export function windowCoverage(input: { coverage_start_ms: number; now_ms: number; window_ms: number }): number {
  const covered = input.now_ms - input.coverage_start_ms;
  if (!(input.window_ms > 0)) return 0;
  const ratio = covered / input.window_ms;
  return Math.max(0, Math.min(1, ratio));
}
