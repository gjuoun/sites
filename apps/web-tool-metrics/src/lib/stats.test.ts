import { describe, expect, it } from "bun:test";
import {
	formatBucket,
	formatBytes,
	formatMs,
	formatPercent,
	formatUsd,
} from "./stats.ts";

describe("formatters", () => {
	it("renders latency in the unit that fits", () => {
		expect(formatMs(null)).toBe("—");
		expect(formatMs(120)).toBe("120 ms");
		expect(formatMs(1500)).toBe("1.5 s");
	});

	it("keeps sub-cent costs visible", () => {
		expect(formatUsd(0)).toBe("$0");
		expect(formatUsd(0.00075)).toBe("$0.0008");
		expect(formatUsd(12.5)).toBe("$12.50");
	});

	it("formats percentages, bytes and buckets", () => {
		expect(formatPercent(2 / 3)).toBe("66.7%");
		expect(formatBytes(undefined)).toBe("—");
		expect(formatBytes(900)).toBe("900 B");
		expect(formatBytes(2048)).toBe("2.0 kB");
		expect(formatBucket("2026-10-31T11:30:00.000Z", "1h")).toMatch(
			/\d{2}:\d{2}/,
		);
		expect(formatBucket("2026-10-31T11:30:00.000Z", "24h")).toMatch(
			/\d{2}\/\d{2}/,
		);
	});
});
