import type { CatalogRow } from "../data/catalog";
import { averagePrice } from "../data/peak-offpeak";
import { blendedUsdPerB, cacheFor, pooledMix, type MeasuredMix, type RefPrice, type TokenTotals } from "../data/estimate";

/**
 * The DeepSeek value ranking: for each catalog plan that has a published dollar allowance and lists
 * DeepSeek V4.1 Flash, the est $/B of running the whole allowance on that model, agent shape, at two
 * price bases:
 *
 *   est_usd_per_b(price) = fee ÷ allowance_usd × blended_usd_per_b(price, plan mix)
 *   tokens per month (B) = fee ÷ est_usd_per_b
 *
 * QwenCloud basis: the QwenCloud peak/off-peak average for DeepSeek V4.1 Flash (14h peak, 10h off-peak).
 * OpenRouter basis: the OpenRouter list price for DeepSeek V4.1 Flash. A plan whose allowance is valued
 * in QwenCloud credits has no OpenRouter basis, because its pool is valued through qwen3.8-max, which has
 * no OpenRouter list price.
 * Plans are ranked by the QwenCloud basis, the only basis every ranked plan has. Plans with no dollar
 * allowance, or whose model list does not name DeepSeek V4.1 Flash, are listed with their reason and
 * are never ranked.
 */

export const DS_REF = "deepseek-v4.1-flash" as const;

export type DsModels = {
  reference: Array<{ ref: string; in_per_m: number; out_per_m: number; cache_per_m: number }>;
  usage_models: Array<{ upstream_model: string; peak_offpeak: null | { provider: string; ref: string | null; peak_usd_per_m: RefPrice; offpeak_usd_per_m: RefPrice } }>;
};
export type DsLane = { lane: string; tokens: TokenTotals };

export type DsEntry = {
  plan_id: string;
  label: string;
  fee_usd: number;
  allowance_usd: number;
  allowance_basis: string;
  mix_source: string;
  est_qw: number;
  est_list: number | null;
  list_reason: string | null;
  tokens_b_qw: number;
  tokens_b_list: number | null;
};
export type DsExcluded = { plan_id: string; label: string; reason: string };
export type DsRanking = { ranked: DsEntry[]; excluded: DsExcluded[]; qw_price: RefPrice; list_price: RefPrice; counts: { convertible: number; needs_anchor: number; excluded_status: number } };

export function qwenDsPrice(models: DsModels): RefPrice {
  const tier = models.usage_models.find((u) => u.upstream_model === DS_REF && u.peak_offpeak?.provider === "qwen-cloud")?.peak_offpeak;
  if (!tier) throw new Error("no QwenCloud peak/off-peak tier for " + DS_REF);
  return averagePrice({ peak: tier.peak_usd_per_m, offpeak: tier.offpeak_usd_per_m });
}

export function listDsPrice(models: DsModels): RefPrice {
  const ref = models.reference.find((r) => r.ref === DS_REF);
  if (!ref) throw new Error("no OpenRouter list price for " + DS_REF);
  return { in_per_m: ref.in_per_m, out_per_m: ref.out_per_m, cache_per_m: ref.cache_per_m };
}

export function dsRanking(rows: CatalogRow[], models: DsModels, lanes: DsLane[], derivedFrom: Map<string, string> = new Map()): DsRanking {
  const pooled = pooledMix(lanes.map((l) => ({ tokens: l.tokens })));
  const laneMix = new Map<string, MeasuredMix>(lanes.map((l) => [l.lane, pooledMix([{ tokens: l.tokens }])] as const));
  const qw = qwenDsPrice(models);
  const list = listDsPrice(models);
  const ranked: DsEntry[] = [];
  const excluded: DsExcluded[] = [];
  let convertible = 0;
  let needsAnchor = 0;
  let excludedStatus = 0;

  for (const row of rows) {
    if (row.status !== "catalog") { excludedStatus++; continue; }
    if (row.allowance.length === 0) {
      needsAnchor++;
      continue;
    }
    convertible++;
    if (row.price_month_usd === null) { excluded.push({ plan_id: row.plan_id, label: row.label, reason: "no USD fee published" }); continue; }
    if (!row.offered_models.includes(DS_REF)) {
      excluded.push({ plan_id: row.plan_id, label: row.label, reason: "DeepSeek V4.1 Flash is not on this plan's published model list" });
      continue;
    }
    const entry = row.allowance.find((a) => a.ref === DS_REF) ?? row.allowance.find((a) => a.ref === "*");
    if (!entry) { excluded.push({ plan_id: row.plan_id, label: row.label, reason: "no dollar allowance for DeepSeek V4.1 Flash" }); continue; }

    const mixLane = row.measured_lane ? (derivedFrom.get(row.measured_lane) ?? row.measured_lane) : null;
    const mix = mixLane ? (laneMix.get(mixLane) ?? pooled) : pooled;
    const mixSource = row.measured_lane ? "this plan's measured mix" : "pooled measured mix";
    const cache = cacheFor("agent", mix);
    const blendQw = blendedUsdPerB(qw, { output_share: mix.output_share, cache_share: cache });
    const estQw = (row.price_month_usd / entry.usd) * blendQw;

    // the QwenCloud pool is valued at QwenCloud prices; there is no OpenRouter value for it
    const pooledInQwen = row.credits_to_usd !== null && row.credits_to_usd.meaning === "usage_value";
    const blendList = blendedUsdPerB(list, { output_share: mix.output_share, cache_share: cache });
    const estList = pooledInQwen ? null : (row.price_month_usd / entry.usd) * blendList;

    ranked.push({
      plan_id: row.plan_id,
      label: row.label,
      fee_usd: row.price_month_usd,
      allowance_usd: entry.usd,
      allowance_basis: entry.basis,
      mix_source: mixSource,
      est_qw: estQw,
      est_list: estList,
      list_reason: estList === null ? "the pool is valued in QwenCloud credits; qwen3.8-max has no OpenRouter list price, so no list basis" : null,
      tokens_b_qw: row.price_month_usd / estQw,
      tokens_b_list: estList === null ? null : row.price_month_usd / estList,
    });
  }
  ranked.sort((a, b) => a.est_qw - b.est_qw);
  return { ranked, excluded, qw_price: qw, list_price: list, counts: { convertible, needs_anchor: needsAnchor, excluded_status: excludedStatus } };
}
