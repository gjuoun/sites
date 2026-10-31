// Responses and formatters shared by the dashboard islands.

export type StatsWindow = "1h" | "24h" | "7d";

export interface StatsAggregate {
	window: StatsWindow;
	calls: number;
	ok: number;
	errors: number;
	successRate: number;
	p50Ms: number | null;
	p95Ms: number | null;
	costUsd: number;
	escalationRate: number;
	byProvider: Record<
		string,
		{ calls: number; errors: number; p95Ms: number | null }
	>;
	byTool: { search: number; fetch: number };
	byOutcome: Record<string, number>;
	series: { at: string; calls: number; errors: number }[];
}

export interface MetricEvent {
	ts: string;
	tool: "search" | "fetch";
	intent?: string;
	provider: string;
	outcome: "ok" | "error";
	attempted: number;
	latencyMs: number;
	results?: number;
	textBytes?: number;
	costUsd?: number;
	error?: string;
}

export const WINDOWS: StatsWindow[] = ["1h", "24h", "7d"];

export function formatMs(ms: number | null): string {
	if (ms === null) return "—";
	return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function formatUsd(value: number): string {
	if (value === 0) return "$0";
	if (value < 0.01) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined) return "—";
	if (bytes < 1024) return `${bytes} B`;
	return `${(bytes / 1024).toFixed(1)} kB`;
}

export function formatClock(iso: string): string {
	return new Date(iso).toLocaleTimeString([], { hour12: false });
}

/** Bucket label: clock for 1h, date + hour otherwise. */
export function formatBucket(iso: string, window: StatsWindow): string {
	const date = new Date(iso);
	if (window === "1h") {
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		});
	}
	return date.toLocaleString([], {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		hour12: false,
	});
}
