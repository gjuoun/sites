import { Badge } from "./unified-table";
import { UnifiedTable } from "./unified-table";
import type { BadgeKind } from "@/lib/cells";
import { na, value } from "@/lib/cells";
import { NOTHING, allowanceTitle, formatMs, formatReset, formatShare, formatTokens, formatTps, formatUsd, limitCell, quotaLine, trafficLine, unavailableReason, usdPerB, type LaneRecord, type QuotaObservation } from "@/lib/own-data";

/** One lane: its plan, its current quota state, its 7-day traffic, its speed, and the models that carried it. */
export function LaneBlock({ lane, observations }: { lane: LaneRecord; observations: readonly QuotaObservation[] }) {
  const badges: BadgeKind[] = [];
  if (lane.capacity.badge === "single_account_reading") badges.push("single_account_reading");
  if (lane.capacity.confidence === "low") badges.push("low confidence");
  if (lane.capacity.stale) badges.push("stale reading");

  const hasWindow = lane.capacity.windows.length > 0;
  const usd = usdPerB(lane);
  const capacity =
    lane.capacity.tokens_per_cycle === null
      ? "no readable quota window"
      : formatTokens(lane.capacity.tokens_per_cycle) + " per " + lane.capacity.cycle_days + "d · " + (lane.capacity.window ?? "?") + " window" +
        (lane.capacity.allowance_published_usd !== null && lane.capacity.allowance_published_usd !== undefined ? " · published " + formatUsd(lane.capacity.allowance_published_usd) : "");
  const capacityTitle = allowanceTitle(lane);
  const speed =
    lane.traffic_7d.p50_output_tps === null || lane.traffic_7d.p50_ttft_ms === null
      ? "no measured speed in the recent window"
      : formatTps(lane.traffic_7d.p50_output_tps) + " tok/s p50 · " + formatMs(lane.traffic_7d.p50_ttft_ms) + " TTFT p50 · " + formatMs(lane.traffic_7d.p90_ttft_ms) + " p90";

  const modelRows = lane.models.map((m) => {
    const limit = limitCell(m);
    return {
      key: m.upstream_model,
      cells: {
        model: value(m.label),
        share: value(formatShare(m.share_7d)),
        tokens: value(formatTokens(m.tokens_7d)),
        requests: value(m.rows_7d.toLocaleString("en-US")),
        cache: m.cache_share_7d === null ? na("no prompt tokens in this model's traffic") : value((m.cache_share_7d * 100).toFixed(1) + "%"),
        ttft: m.p50_ttft_ms === null ? na(m.upstream_model === "__other__" ? "pooled" : "no TTFT for this row") : value(formatMs(m.p50_ttft_ms)),
        tps: m.p50_output_tps === null ? na(m.upstream_model === "__other__" ? "pooled" : "no speed for this row") : value(formatTps(m.p50_output_tps)),
        limit: limit.reason === null ? value(limit.text) : na(limit.reason),
      },
    };
  });

  return (
    <section data-lane={lane.lane} className="space-y-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-xl font-semibold">{lane.label}</h2>
        <span className="tabular-nums text-sm">{formatUsd(lane.price_month_usd)}/mo</span>
      </div>

      {badges.length > 0 && <div className="flex flex-wrap gap-1">{badges.map((b) => <Badge key={b} kind={b} />)}</div>}

      <p className="text-sm" data-status={hasWindow ? "quota" : "unavailable"}>
        {hasWindow ? quotaLine(lane) : "quota unavailable: " + unavailableReason(observations, lane.lane)}
      </p>

      <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Capacity</dt>
          <dd data-allowance={lane.capacity.allowance_basis ?? "none"} title={capacityTitle ?? undefined}>{capacity}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">$/B</dt>
          <dd data-usd={lane.usd_per_b_basis ?? "none"} title={capacityTitle ?? undefined}>{usd.reason === null ? usd.text : "N/A: " + usd.reason}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Traffic, last {lane.traffic_7d.window_days} days</dt>
          <dd>{trafficLine(lane.traffic_7d)}</dd>
        </div>
        <div className="flex justify-between gap-4 sm:block">
          <dt className="text-muted-foreground">Speed</dt>
          <dd>{speed}</dd>
        </div>
      </dl>

      {lane.capacity.stale && (
        <p className="text-xs text-muted-foreground">capacity held from the last stable reading of {formatReset(lane.capacity.stale.read_at)}: {lane.capacity.stale.reason}</p>
      )}

      {modelRows.length === 0 ? (
        <p className="text-sm" data-status="no-models">{NOTHING}</p>
      ) : (
        <UnifiedTable
          testId={"models-" + lane.lane}
          columns={[
            { key: "model", label: "Model", width: "24%", wrap: true },
            { key: "share", label: "Share", width: "8%", numeric: true },
            { key: "tokens", label: "Tokens 7d", width: "10%", numeric: true },
            { key: "requests", label: "Requests", width: "9%", numeric: true },
            { key: "cache", label: "Cache", width: "8%", numeric: true },
            { key: "ttft", label: "TTFT p50", width: "11%", numeric: true },
            { key: "tps", label: "tok/s", width: "8%", numeric: true },
            { key: "limit", label: "Monthly limit", width: "22%", numeric: true },
          ]}
          rows={modelRows}
        />
      )}
    </section>
  );
}
