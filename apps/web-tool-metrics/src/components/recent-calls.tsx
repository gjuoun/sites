import { Badge } from "@gjuoun/bigface-shadcn-ui/components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-shadcn-ui/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@gjuoun/bigface-shadcn-ui/components/ui/table";
import {
	formatBytes,
	formatClock,
	formatMs,
	type MetricEvent,
} from "../lib/stats";

export function RecentCalls({ events }: { events: MetricEvent[] }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Recent calls</CardTitle>
			</CardHeader>
			<CardContent className="px-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Time</TableHead>
							<TableHead>Tool</TableHead>
							<TableHead>Provider</TableHead>
							<TableHead>Outcome</TableHead>
							<TableHead className="text-right">Latency</TableHead>
							<TableHead className="text-right">Payload</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{events.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-muted-foreground">
									Nothing recorded yet.
								</TableCell>
							</TableRow>
						) : (
							events.map((event) => (
								<TableRow
									key={`${event.ts}-${event.tool}-${event.provider}-${event.latencyMs}`}
								>
									<TableCell className="font-mono text-xs">
										{formatClock(event.ts)}
									</TableCell>
									<TableCell className="text-xs">{event.tool}</TableCell>
									<TableCell className="font-mono text-xs">
										{event.provider}
									</TableCell>
									<TableCell>
										<Badge
											variant={
												event.outcome === "ok" ? "secondary" : "destructive"
											}
										>
											{event.outcome === "ok"
												? (event.intent ?? "ok")
												: (event.error ?? "error")}
										</Badge>
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{formatMs(event.latencyMs)}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{event.results !== undefined
											? `${event.results} rows`
											: formatBytes(event.textBytes)}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
