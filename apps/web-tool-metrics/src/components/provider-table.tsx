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
import { formatMs, type StatsAggregate } from "../lib/stats";

export function ProviderTable({ stats }: { stats: StatsAggregate | null }) {
	const rows = Object.entries(stats?.byProvider ?? {}).sort(
		(a, b) => b[1].calls - a[1].calls,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-sm">Providers</CardTitle>
			</CardHeader>
			<CardContent className="px-0">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Provider</TableHead>
							<TableHead className="text-right">Calls</TableHead>
							<TableHead className="text-right">Err</TableHead>
							<TableHead className="text-right">p95</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-muted-foreground">
									No calls in this window.
								</TableCell>
							</TableRow>
						) : (
							rows.map(([name, value]) => (
								<TableRow key={name}>
									<TableCell className="font-mono text-xs">{name}</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{value.calls}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{value.errors}
									</TableCell>
									<TableCell className="text-right font-mono text-xs">
										{formatMs(value.p95Ms)}
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
