import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@gjuoun/bigface-business-ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@gjuoun/bigface-business-ui/components/ui/table";
import { LayerBadge } from "@/components/layer-badge";
import { dataset, fmt, laneById, orEndpointsFor, orModelFor } from "@/lib/dataset";

export const Route = createFileRoute("/lane/$id")({
  loader: ({ params }) => {
    const lane = laneById(params.id);
    if (!lane) throw new Error("unknown lane: " + params.id);
    return { lane };
  },
  component: LanePage,
});

function LanePage() {
  const { lane } = Route.useLoaderData();
  const usage = dataset.usage.lanes.find((u) => u.lane === lane.lane)!;
  const quota = dataset.quota.observations.find((o) => o.lane === lane.lane);
  const model = orModelFor(lane.lane);
  const eps = model ? orEndpointsFor(model) : [];
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <Link to="/" className="underline">← ranking</Link>
      <h1 className="text-2xl font-semibold">{lane.label}</h1>

      <Card>
        <CardHeader><CardTitle>Capacity</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Method: <code>{lane.capacity.method}</code> {lane.capacity.window && <LayerBadge layer="window" />} {lane.capacity.seeded && <LayerBadge layer="seed" />}</p>
          <p>Tokens per cycle: {lane.capacity.tokens_per_cycle === null ? "N/A" : (lane.capacity.tokens_per_cycle / 1e9).toFixed(2) + "B per " + lane.capacity.cycle_days + " days"} {lane.capacity.badge && <Badge variant="outline">{lane.capacity.badge}</Badge>}</p>
          <p data-basis={lane.usd_per_b_basis ?? "none"}>$/B: {fmt.usd(lane.usd_per_b)} {lane.usd_per_b_basis === "derived" ? <Badge variant="outline" title={lane.usd_per_b_source ?? undefined}>derived</Badge> : null}{lane.usd_per_b_basis === "derived" ? `: ${lane.usd_per_b_source}` : ""}</p>
          <p>Log coverage of window: {fmt.pct(lane.capacity.coverage)}</p>
          {lane.capacity.confidence === "low" && (
            <p data-confidence="low">
              <Badge variant="secondary">low confidence</Badge> {lane.capacity.confidence_reason}
            </p>
          )}
          <p>Reason: {lane.capacity.reason ?? "N/A"}</p>
          <p>Quota reading: {quota && "used_pct" in quota ? `${quota.used_pct.toFixed(2)}% (${quota.window}, resets ${quota.resets_at})` : quota && "unavailable" in quota ? `unavailable: ${quota.unavailable}` : "N/A"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Measured usage (usage_logs, {dataset.usage.window_days}d)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" data-layer="measured">rows {fmt.num(usage.rows)} · cache share {fmt.pct(usage.cache_share)} · p50 TTFT {fmt.num(usage.p50_ttft_ms)} ms · p90 TTFT {fmt.num(usage.p90_ttft_ms)} ms · p50 out tok/s {fmt.num(usage.p50_output_tps)} <LayerBadge layer="measured" /></p>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Upstream model</TableHead><TableHead className="text-right">Rows</TableHead><TableHead className="text-right">Cost (list USD)</TableHead><TableHead className="text-right">p50 TTFT</TableHead><TableHead className="text-right">p50 tok/s</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {usage.models.map((m) => (
                <TableRow key={m.upstream_model}>
                  <TableCell>{m.upstream_model}</TableCell>
                  <TableCell className="text-right">{fmt.num(m.rows)}</TableCell>
                  <TableCell className="text-right">{fmt.usd(m.cost_usd)}</TableCell>
                  <TableCell className="text-right">{fmt.num(m.p50_ttft_ms)} ms</TableCell>
                  <TableCell className="text-right">{fmt.num(m.p50_output_tps)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Price vector and shape presets</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>Flags: {lane.flags.length ? lane.flags.join(", ") : "N/A"}</p>
          <ul className="list-disc pl-5">
            {lane.presets.map((p) => (
              <li key={p.shape}>
                {p.shape}: {"usd_per_b" in p ? `${fmt.usd(p.usd_per_b)} per B` : `unavailable: ${p.unavailable}`}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>OpenRouter benchmark ({model ?? "no mapping"})</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">Separate layer: OpenRouter's own 30-minute stats, never combined with the measured numbers above.</p>
          <Table data-testid="or-endpoints">
            <TableHeader>
              <TableRow><TableHead>Provider</TableHead><TableHead>Quant</TableHead><TableHead className="text-right">p50 tok/s</TableHead><TableHead className="text-right">p50 latency</TableHead><TableHead className="text-right">Requests</TableHead><TableHead>Confidence</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {eps.map((e) => (
                <TableRow key={e.provider_display_name + e.quantization + e.request_count} data-or-row>
                  <TableCell>{e.provider_display_name}</TableCell>
                  <TableCell>{e.quantization}</TableCell>
                  <TableCell className="text-right" data-layer="or">{fmt.num(e.p50_throughput)} <LayerBadge layer="or" /></TableCell>
                  <TableCell className="text-right">{fmt.num(e.p50_latency_ms)} ms</TableCell>
                  <TableCell className="text-right">{fmt.num(e.request_count)}</TableCell>
                  <TableCell>{e.confidence}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Sources: {lane.source} · plan price: {lane.price_badge} ({lane.price_month_usd} USD/mo) · measured at {lane.measured_at}</p>
    </main>
  );
}
