#!/usr/bin/env bun
/**
 * Read-only usage collector. Runs one fixed SELECT on the gateway's postgres and writes
 * lane-keyed rows (no account ids) to data/raw/usage/<date>.json and per-lane sums to
 * data/usage.json — the full window plus a recent slice cut from the same pull.
 * Refuses to write when the window is empty.
 *
 *   bun run scripts/collect-usage.ts [--days 31] [--recent 7]
 *   SUBSDADDY_PSQL overrides the transport (default: ssh qinglong → podman exec psql).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANES, type LaneId, type UsageFile, usageFileSchema } from "../src/data/schema";
import { parseUsageRows, rowsSince, summarizeLane, usageSql, type UsageRow } from "../src/lib/usage";

const APP = resolve(import.meta.dir, "..");
// 31 days: the longest quota window is monthly, so the export must reach back past the start of every window (r52)
const argOf = (name: string, fallback: number) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 31;
const recentDays = argOf("--recent", 7);
if (!Number.isInteger(recentDays) || recentDays < 1 || recentDays >= days) throw new Error("--recent must be an integer in 1..days-1");
const measuredAt = new Date().toISOString();
const SOURCE = "sub2api usage_logs (read-only SELECT via podman exec psql)";

const psql = process.env.SUBSDADDY_PSQL ?? "ssh qinglong \"podman exec -i sub2api-postgres psql -U sub2api -d sub2api -t -A -F '|'\"";

async function run(sql: string): Promise<string> {
  const proc = Bun.spawn(["bash", "-lc", psql], { stdin: new Blob([sql]), stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) throw new Error(`psql exited ${code}: ${err.trim().slice(0, 300)}`);
  return out;
}

/** Every plan id is present in both windows, even with no rows. */
function windowOf(laneRows: Map<LaneId, UsageRow[]>) {
  const all = LANES.flatMap((l) => laneRows.get(l)!);
  const times = all.map((r) => r.created_at_utc).sort();
  return {
    window_days: days,
    coverage_start: times[0] + "",
    coverage_end: times[times.length - 1] + "",
    export_start: new Date(Date.parse(measuredAt) - days * 86_400_000).toISOString(),
    lanes: LANES.map((l) => summarizeLane(l, laneRows.get(l)!, measuredAt, SOURCE)),
    measured_at: measuredAt,
    source: SOURCE,
  };
}

const raw = await run(usageSql(days));
const rows = parseUsageRows(raw);
if (rows.length === 0) {
  console.error("collect-usage: window returned 0 rows; refusing to write");
  process.exit(3);
}

const byLane = (subset: UsageRow[]) => {
  const map = new Map<LaneId, UsageRow[]>(LANES.map((l) => [l, []]));
  for (const r of subset) map.get(r.lane)!.push(r);
  return map;
};

const full = windowOf(byLane(rows));
const recentRows = rowsSince(rows, Date.parse(measuredAt) - recentDays * 86_400_000);
const recentLaneRows = byLane(recentRows);
const recentTimes = recentRows.map((r) => r.created_at_utc).sort();
const recent = {
  window_days: recentDays,
  coverage_start: recentTimes[0] ?? measuredAt,
  coverage_end: recentTimes[recentTimes.length - 1] ?? measuredAt,
  export_start: new Date(Date.parse(measuredAt) - recentDays * 86_400_000).toISOString(),
  lanes: LANES.map((l) => summarizeLane(l, recentLaneRows.get(l)!, measuredAt, SOURCE)),
  measured_at: measuredAt,
  source: SOURCE,
};

const usage: UsageFile = usageFileSchema.parse({ ...full, recent });

const dataDir = join(APP, "data");
mkdirSync(join(dataDir, "raw", "usage"), { recursive: true });
const day = measuredAt.slice(0, 10);
// raw rows: lane ids only, no account ids
writeFileSync(
  join(dataDir, "raw", "usage", `${day}.json`),
  JSON.stringify({ measured_at: measuredAt, source: SOURCE, export_start: full.export_start, rows: rows.map(({ lane, ...r }) => ({ lane, ...r })) }),
);
writeFileSync(join(dataDir, "usage.json"), JSON.stringify(usage, null, 2) + "\n");

const total = (t: { input: number; cache_creation: number; cache_read: number; output: number }) => t.input + t.cache_creation + t.cache_read + t.output;
for (const l of usage.lanes) {
  const r = usage.recent.lanes.find((x) => x.lane === l.lane)!;
  const share = l.cache_share === null ? "null" : l.cache_share.toFixed(3);
  console.log(`${l.lane.padEnd(18)} rows=${l.rows} cache_share=${share} p50_ttft_ms=${l.p50_ttft_ms} n=${l.rows} r7d=${r.rows} t7d=${total(r.tokens)}`);
}
console.log(`lanes=${usage.lanes.length} window_days=${days} rows=${rows.length} recent_days=${recentDays} recent_rows=${recentRows.length} coverage=${usage.coverage_start}..${usage.coverage_end}`);
