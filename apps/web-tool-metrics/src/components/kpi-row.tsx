import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-shadcn-ui/components/ui/card";
import {
	formatMs,
	formatPercent,
	formatUsd,
	type StatsAggregate,
} from "../lib/stats";

function Kpi({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint: string;
}) {
	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle className="text-xs font-medium text-muted-foreground">
					{label}
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-1">
				<span className="font-mono text-2xl leading-none">{value}</span>
				<span className="text-xs text-muted-foreground">{hint}</span>
			</CardContent>
		</Card>
	);
}

export function KpiRow({ stats }: { stats: StatsAggregate | null }) {
	return (
		<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
			<Kpi
				label="Calls"
				value={stats ? String(stats.calls) : "—"}
				hint={
					stats
						? `${stats.byTool.search} search · ${stats.byTool.fetch} fetch`
						: "waiting for data"
				}
			/>
			<Kpi
				label="Success"
				value={stats ? formatPercent(stats.successRate) : "—"}
				hint={stats ? `${stats.errors} failed` : "—"}
			/>
			<Kpi
				label="p50"
				value={formatMs(stats?.p50Ms ?? null)}
				hint="service latency"
			/>
			<Kpi
				label="p95"
				value={formatMs(stats?.p95Ms ?? null)}
				hint="nearest rank"
			/>
			<Kpi
				label="Cost"
				value={formatUsd(stats?.costUsd ?? 0)}
				hint="provider-reported"
			/>
			<Kpi
				label="Fallback"
				value={stats ? formatPercent(stats.escalationRate) : "—"}
				hint="calls that tried >1 provider"
			/>
		</div>
	);
}
