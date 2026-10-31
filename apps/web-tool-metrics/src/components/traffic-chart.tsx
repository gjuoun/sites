import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-shadcn-ui/components/ui/card";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	formatBucket,
	type StatsAggregate,
	type StatsWindow,
} from "../lib/stats";

export function TrafficChart({
	stats,
	window,
}: {
	stats: StatsAggregate | null;
	window: StatsWindow;
}) {
	const data = (stats?.series ?? []).map((point) => ({
		at: formatBucket(point.at, window),
		calls: point.calls,
		errors: point.errors,
	}));

	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle className="text-sm">Traffic</CardTitle>
			</CardHeader>
			<CardContent className="h-64">
				<ResponsiveContainer width="100%" height="100%">
					<AreaChart
						data={data}
						margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
					>
						<CartesianGrid
							stroke="var(--border)"
							strokeDasharray="3 3"
							vertical={false}
						/>
						<XAxis
							dataKey="at"
							tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
							stroke="var(--border)"
							minTickGap={24}
						/>
						<YAxis
							allowDecimals={false}
							tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
							stroke="var(--border)"
						/>
						<Tooltip
							contentStyle={{
								background: "var(--card)",
								border: "1px solid var(--border)",
								borderRadius: 8,
								color: "var(--card-foreground)",
								fontSize: 12,
							}}
						/>
						<Area
							type="monotone"
							dataKey="calls"
							name="calls"
							stroke="var(--chart-1)"
							fill="var(--chart-1)"
							fillOpacity={0.18}
							strokeWidth={2}
						/>
						<Area
							type="monotone"
							dataKey="errors"
							name="errors"
							stroke="var(--destructive)"
							fill="var(--destructive)"
							fillOpacity={0.18}
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
