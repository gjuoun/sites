import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LayerBadge } from "@/components/layer-badge";
import { catalogRows, catalogWindowText, dataset, excluded, fmt, orEndpointsFor, orModelFor, ranked } from "@/lib/dataset";

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
          Subscription plans ranked by $/B token under each plan's own measured 7-day mix. Measured speed and OpenRouter
          speed are shown in separate columns and never combined.
        </p>
        <p className="text-sm text-muted-foreground">
          as of {dataset.lanes.measured_at} · usage window {dataset.usage.window_days}d · coverage from {dataset.usage.coverage_start}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Ranking — $/B (measured mix)</CardTitle>
          <CardDescription>Default key: monthly fee ÷ tokens the plan delivers, per billion tokens.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-testid="ranking">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
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
                  <TableRow key={l.lane} data-lane-row={l.lane} data-ranked="yes" data-basis={l.usd_per_b_basis ?? "none"}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Link to="/lane/$id" params={{ id: l.lane }} className="underline">
                        {l.label}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{fmt.usd(l.price_month_usd)}</TableCell>
                    <TableCell>
                      {l.capacity.tokens_per_week !== null ? (
                        <>
                          {fmt.tokensWeek(l.capacity.tokens_per_week)} <LayerBadge layer="window" />
                          {l.capacity.badge && <Badge variant="outline" data-badge={l.capacity.badge}>{l.capacity.badge}</Badge>}
                          {l.capacity.confidence === "low" && (
                            <Badge variant="secondary" data-confidence="low" title={l.capacity.confidence_reason ?? undefined}>
                              low confidence
                            </Badge>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">unavailable: {l.capacity.reason}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium" data-layer="measured">
                      {fmt.usd(l.usd_per_b)}{" "}
                      {l.usd_per_b_basis === "derived" && (
                        <Badge variant="outline" title={l.usd_per_b_source ?? undefined}>derived</Badge>
                      )}
                    </TableCell>
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

      <div className="relative left-1/2 w-[min(96vw,88rem)] -translate-x-1/2">
      <Card>
        <CardHeader>
          <CardTitle>Plans catalog — price, allowance and estimate</CardTitle>
          <CardDescription>
            Published prices and allowances. No local token measurement, so these plans are not ranked. The Est. $/B column is an estimate for the three reference models (see methodology); it is never ranked. On narrow screens the table scrolls sideways.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table data-catalog="rows">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[12rem]">Plan</TableHead>
                <TableHead className="min-w-[6rem] text-right">Fee / mo</TableHead>
                <TableHead className="min-w-[11rem]">Credits → $</TableHead>
                <TableHead className="min-w-[13rem]">Est. $/B</TableHead>
                <TableHead className="min-w-[16rem]">Allowance</TableHead>
                <TableHead className="min-w-[9rem]">CLI</TableHead>
                <TableHead className="min-w-[8rem]">Badges</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogRows().map((c) => {
                const windows = catalogWindowText(c.plan_id);
                return (
                  <TableRow key={c.plan_id} data-catalog-row={c.plan_id} data-status={c.status}>
                    <TableCell className="whitespace-normal break-words">{c.label}</TableCell>
                    <TableCell className="whitespace-normal break-words text-right">
                      {c.fee}
                      {c.price_note && <div className="max-w-[14rem] whitespace-normal break-words text-xs text-muted-foreground">{c.price_note}</div>}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <span className="font-medium">{c.credits_text}</span>
                      {c.credits_basis && (
                        <div className="max-w-[18rem] whitespace-normal break-words text-xs text-muted-foreground">{c.credits_basis}</div>
                      )}
                      {c.credits_text === "—" && c.allowance_model === "credits" && (
                        <div className="text-xs text-muted-foreground" data-credits="unverified">unverified</div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top" data-estimate={c.estimate_status}>
                      <span className="font-medium" title={c.estimate_basis ?? undefined}>{c.estimate_text}</span>
                      {c.estimate_status === "estimated" && <Badge variant="outline" className="ml-1" data-badge="estimated">estimated</Badge>}
                      {c.estimate_by_model && <div className="max-w-[16rem] whitespace-normal break-words text-xs text-muted-foreground">{c.estimate_by_model}</div>}
                      {c.estimate_reason && <div className="max-w-[16rem] whitespace-normal break-words text-xs text-muted-foreground">{c.estimate_reason}</div>}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words align-top">
                      <div className="font-medium">{c.allowance_model}</div>
                      {c.allowance_detail}
                      {windows && <div className="text-xs text-muted-foreground">{windows}</div>}
                      {c.reason && <div className="text-xs text-muted-foreground">excluded — {c.reason}</div>}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">{c.cli_compat}</TableCell>
                    <TableCell className="space-x-1 whitespace-normal">
                      <Badge variant="outline" data-badge="unmeasured">unmeasured</Badge>
                      <Badge variant="outline" data-source={c.source_badge}>{c.source_badge}</Badge>
                      {c.status === "excluded" && <Badge variant="secondary" data-status="excluded">excluded</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>

      {excludedLanes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Excluded from this ranking</CardTitle>
            <CardDescription>A plan without a capacity reading, or with only a seed allowance, is listed here with its reason.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table data-testid="excluded">
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {excludedLanes.map((l) => (
                  <TableRow key={l.lane} data-lane-row={l.lane} data-ranked="no">
                    <TableCell>
                      <Link to="/lane/$id" params={{ id: l.lane }} className="underline">
                        {l.label}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" data-reason="yes">excluded — {l.capacity.reason ?? "no capacity"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        <Link to="/methodology" className="underline">Methodology and limits</Link>
      </p>
    </main>
  );
}
