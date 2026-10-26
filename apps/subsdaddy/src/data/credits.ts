/**
 * Measured usage value of one credit, for a credit pool (QwenCloud).
 *
 * The window is the quota window itself: it ends at the reading and starts one window-length before the
 * reset. Every row in that window is priced at its own model's price for the plan, using its own token
 * split (input, cache write, cache read, output). Where the official page gives peak and off-peak bands,
 * the price is their hour-weighted average (14h peak, 10h off-peak); otherwise it is the list price. Nothing
 * is assumed:
 *
 *   usage_usd          = Σ over rows of their list cost at the row's model's list price
 *   usd_per_credit     = usage_usd ÷ credits_used (from the same reading)
 *
 * If any row has no list price, or the usage log does not reach the window start, there is no value
 * and the result is unavailable with the reason. Rows are never dropped, zeroed or assumed.
 */

export type CreditRow = {
  created_ms: number;
  model: string;
  input: number;
  cache_creation: number;
  cache_read: number;
  output: number;
};

/** USD per one million tokens. null means the model has no unambiguous list price. */
export type ListPrice = { in_per_m: number; out_per_m: number; cache_per_m: number } | null;

export type CreditChainInput = {
  credits_used: number | null;
  window_start_ms: number;
  window_end_ms: number;
  coverage_start_ms: number;
  rows: CreditRow[];
  prices: Record<string, ListPrice | undefined>;
  /** Names the price source in the basis sentence. Defaults to the OpenRouter list price. */
  price_basis?: string;
};

export type CreditChainResult =
  | {
      ok: true;
      usd_per_credit: number;
      usage_usd: number;
      tokens: number;
      tokens_per_credit: number;
      rows: number;
      models: Array<{ model: string; rows: number; tokens: number; usage_usd: number }>;
      basis: string;
    }
  | { ok: false; unavailable: string };

const fmt = (v: number) => Number(v.toPrecision(3)).toString();
const grouped = (v: number) => Math.round(v).toLocaleString("en-US");

export function creditUsageValue(input: CreditChainInput): CreditChainResult {
  if (input.credits_used === null || !Number.isFinite(input.credits_used) || input.credits_used <= 0) {
    return { ok: false, unavailable: "credits_used_missing" };
  }
  if (input.coverage_start_ms > input.window_start_ms) {
    return { ok: false, unavailable: "partial_window: usage log starts after the window start" };
  }
  const inWindow = input.rows.filter((r) => r.created_ms >= input.window_start_ms && r.created_ms <= input.window_end_ms);
  if (inWindow.length === 0) return { ok: false, unavailable: "no_usage_in_window" };

  const unpriced = new Map<string, number>();
  for (const r of inWindow) {
    const p = input.prices[r.model];
    if (!p) unpriced.set(r.model, (unpriced.get(r.model) ?? 0) + 1);
    if (p && r.cache_creation > 0) {
      // OpenRouter lists no cache-write price for these models; a cache write cannot be priced
      unpriced.set(r.model + " (cache writes)", (unpriced.get(r.model + " (cache writes)") ?? 0) + 1);
    }
  }
  if (unpriced.size > 0) {
    const list = [...unpriced.entries()].map(([m, n]) => m + " (" + n + " rows)").join(", ");
    // measured lower bound: the priced rows alone are worth at least this much, since unpriced usage adds value >= 0
    const pricedRows = inWindow.filter((r) => input.prices[r.model] && r.cache_creation === 0);
    const pricedUsage = pricedRows.reduce((a, r) => {
      const p = input.prices[r.model]!;
      return a + (r.input * p.in_per_m + r.cache_read * p.cache_per_m + r.output * p.out_per_m) / 1e6;
    }, 0);
    const allTokens = inWindow.reduce((a, r) => a + r.input + r.cache_creation + r.cache_read + r.output, 0);
    const unpricedTokens = inWindow.filter((r) => !input.prices[r.model]).reduce((a, r) => a + r.input + r.cache_creation + r.cache_read + r.output, 0);
    const share = allTokens > 0 ? (100 * unpricedTokens) / allTokens : 0;
    return {
      ok: false,
      unavailable:
        "no unambiguous list price: " + list + " (" + share.toFixed(1) + "% of window tokens); priced rows alone give at least $" +
        fmt(pricedUsage / input.credits_used) + " usage value per credit (lower bound)",
    };
  }

  const byModel = new Map<string, { rows: number; tokens: number; usage_usd: number }>();
  let usage = 0;
  let tokens = 0;
  for (const r of inWindow) {
    const p = input.prices[r.model]!;
    const cost = ((r.input * p.in_per_m) + (r.cache_read * p.cache_per_m) + (r.output * p.out_per_m)) / 1e6;
    const t = r.input + r.cache_creation + r.cache_read + r.output;
    usage += cost;
    tokens += t;
    const m = byModel.get(r.model) ?? { rows: 0, tokens: 0, usage_usd: 0 };
    m.rows += 1;
    m.tokens += t;
    m.usage_usd += cost;
    byModel.set(r.model, m);
  }
  const usd_per_credit = usage / input.credits_used;
  const tokens_per_credit = tokens / input.credits_used;
  const models = [...byModel.entries()].map(([model, v]) => ({ model, ...v }));
  const parts = models.map((m) => m.model + " " + grouped(m.tokens) + " tokens ($" + fmt(m.usage_usd) + ")").join("; ");
  const basis =
    "window " + new Date(input.window_start_ms).toISOString().slice(0, 16) + "Z to " + new Date(input.window_end_ms).toISOString().slice(0, 16) + "Z: " +
    grouped(tokens) + " tokens over " + inWindow.length + " rows (" + parts + "), priced at " + (input.price_basis ?? "OpenRouter list") + " = $" + fmt(usage) +
    " of usage; ÷ " + input.credits_used.toLocaleString("en-US") + " credits used (codexbar reading) = $" + fmt(usd_per_credit) +
    " usage value per credit; " + fmt(tokens_per_credit) + " tokens per credit.";
  return { ok: true, usd_per_credit, usage_usd: usage, tokens, tokens_per_credit, rows: inWindow.length, models, basis };
}

/** Compact decimal for small values: 0.000392 stays 0.000392, never 0.000. */
export function formatSmall(v: number): string {
  return fmt(v);
}
