import { Button } from "@gjuoun/bigface-shadcn-ui/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type MetricEvent,
	type StatsAggregate,
	type StatsWindow,
	WINDOWS,
} from "../lib/stats";
import { KpiRow } from "./kpi-row";
import { ProviderTable } from "./provider-table";
import { RecentCalls } from "./recent-calls";
import { TrafficChart } from "./traffic-chart";

const POLL_MS = 2000;

export function Dashboard() {
	const [window, setWindow] = useState<StatsWindow>("1h");
	const [paused, setPaused] = useState(false);
	const [stats, setStats] = useState<StatsAggregate | null>(null);
	const [recent, setRecent] = useState<MetricEvent[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [updatedAt, setUpdatedAt] = useState<string | null>(null);
	const inFlight = useRef(false);

	const tick = useCallback(async () => {
		if (inFlight.current) return;
		inFlight.current = true;
		try {
			const [statsResponse, recentResponse] = await Promise.all([
				fetch(`/stats?window=${window}`),
				fetch("/recent?limit=50"),
			]);
			if (!statsResponse.ok || !recentResponse.ok) {
				throw new Error(
					`service answered ${statsResponse.status}/${recentResponse.status}`,
				);
			}
			setStats((await statsResponse.json()) as StatsAggregate);
			setRecent(
				((await recentResponse.json()) as { events: MetricEvent[] }).events,
			);
			setError(null);
			setUpdatedAt(new Date().toLocaleTimeString([], { hour12: false }));
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			inFlight.current = false;
		}
	}, [window]);

	useEffect(() => {
		if (paused) return;
		void tick();
		const id = setInterval(() => void tick(), POLL_MS);
		return () => clearInterval(id);
	}, [paused, tick]);

	return (
		<>
			<header className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-2xl font-semibold tracking-tight">Web tools</h1>
					<p className="text-xs text-muted-foreground">
						web.search / web.fetch ·{" "}
						{updatedAt ? `updated ${updatedAt}` : "waiting for data"}
					</p>
				</div>
				<div className="flex items-center gap-1">
					{WINDOWS.map((value) => (
						<Button
							key={value}
							size="sm"
							variant={value === window ? "default" : "ghost"}
							onClick={() => setWindow(value)}
						>
							{value}
						</Button>
					))}
					<Button
						size="sm"
						variant="outline"
						onClick={() => setPaused((value) => !value)}
					>
						{paused ? "Resume" : "Pause"}
					</Button>
				</div>
			</header>

			{error ? (
				<div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					service unreachable: {error}
				</div>
			) : null}

			<KpiRow stats={stats} />

			<div className="grid gap-3 lg:grid-cols-3">
				<TrafficChart stats={stats} window={window} />
				<ProviderTable stats={stats} />
			</div>

			<RecentCalls events={recent} />
		</>
	);
}
