import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayerBadge } from "@/components/layer-badge";
import { dataset, excluded, fmt, orEndpointsFor, orModelFor, ranked } from "@/lib/dataset";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const rankedLanes = ranked();
  const excludedLanes = excluded();
  return (
    <main className="mx-auto max-w-6xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">subsdaddy</h1>
        <p className="text-muted-foreground">
          Subscription lanes ranked by $/B token under each lane's own measured 7-day mix. Measured speed and OpenRouter
          speed are shown in separate columns and never combined.
        </p>
        <p className="text-sm text-muted-foreground">
          as of {dataset.lanes.measured_at} · usage window {dataset.usage.window_days}d · coverage from {dataset.usage.coverage_start}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ranking — $/B (measured mix)</CardTitle>
          <CardDescription>Default key: monthly fee ÷ tokens the lane delivers, per billion tokens.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="ranking">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Lane</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Fee / mo</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">$/B</TableHead>
                <TableHead className="text-right">Measured tok/s</TableHead>
                <TableHead className="text-right">Measured TTFT p50</TableHead>
                <TableHead className="text-right">OR p50 tok/s (range)</TableHead>
                <TableHead>Badges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankedLanes.map((l, i) => {
                const model = orModelFor(l.lane);
                const eps = model ? orEndpointsFor(model) : [];
                const tps = eps.map((e) => e.p50_throughput);
                return (
                  <TableRow key={l.lane} data-lane-row={l.lane} data-ranked="yes">
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Link to="/lane/$id" params={{ id: l.lane }} className="underline">
                        {l.lane}
                      </Link>
                    </TableCell>
                    <TableCell>{l.label}</TableCell>
                    <TableCell className="text-right">{fmt.usd(l.price_month_usd)}</TableCell>
                    <TableCell>
                      {fmt.tokensWeek(l.capacity.tokens_per_week)} <LayerBadge layer="window" />
                      {l.capacity.confidence === "low" && (
                        <Badge variant="secondary" data-confidence="low" title={l.capacity.confidence_reason ?? undefined}>
                          low confidence
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium" data-layer="measured">{fmt.usd(l.usd_per_b)}</TableCell>
                    <TableCell className="text-right" data-layer="measured">
                      {fmt.num(l.measured.p50_output_tps, 0)} <LayerBadge layer="measured" />
                    </TableCell>
                    <TableCell className="text-right" data-layer="measured">{fmt.num(l.measured.p50_ttft_ms, 0)} ms</TableCell>
                    <TableCell className="text-right" data-layer="or">
                      {tps.length ? fmt.num(Math.min(...tps), 0) + "–" + fmt.num(Math.max(...tps), 0) : "—"} <LayerBadge layer="or" />
                    </TableCell>
                    <TableCell>
                      <LayerBadge layer="plan" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excluded from this ranking</CardTitle>
          <CardDescription>A lane without a capacity reading, or with only a seed allowance, is listed here with its reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table data-testid="excluded">
            <TableHeader>
              <TableRow>
                <TableHead>Lane</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {excludedLanes.map((l) => (
                <TableRow key={l.lane} data-lane-row={l.lane} data-ranked="no">
                  <TableCell>
                    <Link to="/lane/$id" params={{ id: l.lane }} className="underline">
                      {l.lane}
                    </Link>
                  </TableCell>
                  <TableCell>{l.label}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" data-reason="yes">excluded — {l.capacity.reason ?? "no capacity"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link to="/methodology" className="underline">Methodology and limits</Link>
      </p>
    </main>
  );
}
