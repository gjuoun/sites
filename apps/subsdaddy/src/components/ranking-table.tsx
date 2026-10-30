import { UnifiedTable } from "./unified-table";
import { na, value } from "@/lib/cells";
import { formatMs, formatTps, formatTokens, formatUsd, unavailableReason, type LaneRecord, type QuotaObservation } from "@/lib/own-data";

/** The four lanes, cheapest measured $/B first. A lane with no $/B keeps its row, with the reason. */
export function RankingTable({ lanes, observations }: { lanes: readonly LaneRecord[]; observations: readonly QuotaObservation[] }) {
  const rows = lanes.map((l) => {
    const binding = l.capacity.windows.find((w) => w.window === l.capacity.window);
    return {
      key: l.lane,
      cells: {
        plan: value(l.label),
        fee: value(formatUsd(l.price_month_usd) + "/mo"),
        window: binding
          ? value(binding.window + " " + binding.used_pct.toFixed(1) + "%", [], "resets " + binding.resets_at)
          : na(unavailableReason(observations, l.lane)),
        usd: l.usd_per_b === null ? na(l.usd_per_b_reason ?? l.capacity.reason ?? "no measured $/B") : value(formatUsd(l.usd_per_b), [l.usd_per_b_basis === "derived" ? "derived" : "measured"]),
        tokens: l.traffic_7d.tokens === null ? na(l.traffic_7d.reason ?? "no traffic in the recent window") : value(formatTokens(l.traffic_7d.tokens)),
        tps: l.traffic_7d.p50_output_tps === null ? na("no measured output speed") : value(formatTps(l.traffic_7d.p50_output_tps), ["measured"]),
        ttft: l.traffic_7d.p50_ttft_ms === null ? na("no measured time to first token") : value(formatMs(l.traffic_7d.p50_ttft_ms), ["measured"]),
      },
    };
  });
  return (
    <UnifiedTable
      testId="lanes"
      columns={[
        { key: "plan", label: "Lane", width: "27%" },
        { key: "fee", label: "Fee/mo", width: "10%", numeric: true },
        { key: "window", label: "Quota window", width: "17%", numeric: true },
        { key: "usd", label: "$/B", width: "10%", numeric: true },
        { key: "tokens", label: "Tokens 7d", width: "12%", numeric: true },
        { key: "tps", label: "tok/s", width: "9%", numeric: true },
        { key: "ttft", label: "TTFT p50", width: "15%", numeric: true },
      ]}
      rows={rows}
    />
  );
}
