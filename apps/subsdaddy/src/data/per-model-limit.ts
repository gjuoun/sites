/**
 * A plan whose monthly limit is set per model (OpenCode Go and Go Plus, r53). A model's usage counts against its own
 * limit, so the plan's allowance depends on which models carry the tokens:
 *   - a main model with at least PER_MODEL_MAIN_SHARE of the window's tokens: the allowance is that model's limit
 *     (basis vendor_published_per_model);
 *   - otherwise: the limits of every model, weighted by its share of tokens (basis vendor_published_weighted), when every
 *     model carries a published limit;
 *   - otherwise unavailable, with the reason.
 * The derived figure from quota windows is kept beside it for comparison only; it does not set $/B.
 */
export const PER_MODEL_MAIN_SHARE = 0.7;

/** The usage model id on the lane, mapped to the model name on the official page (data/opencode-go.json). */
export const UPSTREAM_TO_PAGE_MODEL: Record<string, string> = {
  "deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
  "mimo-v2.6-flash": "MiMo-V2.6-Flash",
};

export type ModelTokens = { model: string; tokens: number; limit_usd: number | null };
export type ModelPart = { model: string; share: number; limit_usd: number | null };
export type PerModelRule =
  | { rule: "single_model"; main_model: string; usd: number; parts: ModelPart[] }
  | { rule: "weighted"; usd: number; parts: ModelPart[] }
  | { rule: "unavailable"; reason: string; parts: ModelPart[] };

export function perModelAllowance(models: ModelTokens[]): PerModelRule {
  const total = models.reduce((a, m) => a + m.tokens, 0);
  if (total <= 0) return { rule: "unavailable", reason: "no tokens in the window", parts: [] };
  const parts: ModelPart[] = models
    .map((m) => ({ model: m.model, share: m.tokens / total, limit_usd: m.limit_usd }))
    .sort((a, b) => b.share - a.share);
  const top = parts[0];
  if (top.share >= PER_MODEL_MAIN_SHARE) {
    if (top.limit_usd === null) {
      return { rule: "unavailable", reason: top.model + " carries " + Math.round(top.share * 100) + "% of tokens and the page publishes no monthly limit for it", parts };
    }
    return { rule: "single_model", main_model: top.model, usd: top.limit_usd, parts };
  }
  const missing = parts.find((p) => p.limit_usd === null);
  if (missing) {
    return { rule: "unavailable", reason: "no model carries " + Math.round(PER_MODEL_MAIN_SHARE * 100) + "% of tokens, and " + missing.model + " (" + Math.round(missing.share * 100) + "%) has no published limit", parts };
  }
  const usd = parts.reduce((a, p) => a + p.share * (p.limit_usd as number), 0);
  return { rule: "weighted", usd, parts };
}

export type PageDoc = { plans: Array<{ plan: string; models: Array<{ base: string; monthly_limit_usd: number | null }> }> };

/** The monthly limit of each page model in one plan. Peak and off-peak rows of a model must agree, or the page is refused. */
export function pageLimitsFor(doc: PageDoc, plan: string): Map<string, number> {
  const p = doc.plans.find((x) => x.plan === plan);
  if (!p) throw new Error("no plan " + plan + " on the official page");
  const out = new Map<string, number>();
  for (const m of p.models) {
    if (m.monthly_limit_usd === null) continue;
    const seen = out.get(m.base);
    if (seen !== undefined && seen !== m.monthly_limit_usd) throw new Error(plan + ": rows for " + m.base + " disagree (" + seen + " vs " + m.monthly_limit_usd + ")");
    out.set(m.base, m.monthly_limit_usd);
  }
  return out;
}

/** The limit of a usage model: its page name, then the page's limit for that name; null when it has none. */
export function limitOfUpstream(model: string, limits: Map<string, number>): number | null {
  const page = UPSTREAM_TO_PAGE_MODEL[model];
  if (!page) return null;
  return limits.get(page) ?? null;
}
