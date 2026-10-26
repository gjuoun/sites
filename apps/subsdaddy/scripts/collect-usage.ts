#!/usr/bin/env bun
/**
 * Read-only usage collector. Runs one fixed SELECT on the gateway's postgres and writes
 * lane-keyed rows (no account ids) to data/raw/usage/<date>.json and per-lane sums to
 * data/usage.json. Refuses to write when the window is empty.
 *
 *   bun run scripts/collect-usage.ts [--days 7]
 *   SUBSDADDY_PSQL overrides the transport (default: ssh qinglong → podman exec psql).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANES, type LaneId, type UsageFile, usageFileSchema } from "../src/data/schema";
import { cacheShare } from "../src/data/derive";
import { parseUsageRows, percentile, outputTps, usageSql, type UsageRow } from "../src/lib/usage";

const APP = resolve(import.meta.dir, "..");
const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 7;
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

function laneSummary(lane: LaneId, rows: UsageRow[]) {
  const sum = (f: (r: UsageRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const tokens = {
    input: sum((r) => r.input),
    cache_creation: sum((r) => r.cache_creation),
    cache_read: sum((r) => r.cache_read),
    output: sum((r) => r.output),
  };
  const ttft = rows.map((r) => r.first_token_ms).filter((v): v is number => v !== null);
  const tps = rows.map(outputTps).filter((v): v is number => v !== null);
  const models = [...new Set(rows.map((r) => r.upstream_model))].sort().map((m) => {
    const mr = rows.filter((r) => r.upstream_model === m);
    const mt = mr.map((r) => r.first_token_ms).filter((v): v is number => v !== null);
    const mp = mr.map(outputTps).filter((v): v is number => v !== null);
    return {
      upstream_model: m,
      rows: mr.length,
      tokens: {
        input: mr.reduce((a, r) => a + r.input, 0),
        cache_creation: mr.reduce((a, r) => a + r.cache_creation, 0),
        cache_read: mr.reduce((a, r) => a + r.cache_read, 0),
        output: mr.reduce((a, r) => a + r.output, 0),
      },
      cost_usd: mr.reduce((a, r) => a + r.total_cost, 0),
      p50_ttft_ms: percentile(mt, 50),
      p90_ttft_ms: percentile(mt, 90),
      p50_output_tps: percentile(mp, 50),
      measured_at: measuredAt,
      source: SOURCE,
    };
  });
  return {
    lane,
    rows: rows.length,
    tokens,
    cache_share: cacheShare(tokens),
    p50_ttft_ms: percentile(ttft, 50),
    p90_ttft_ms: percentile(ttft, 90),
    p50_output_tps: percentile(tps, 50),
    models,
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

const byLane = new Map<LaneId, UsageRow[]>(LANES.map((l) => [l, []]));
for (const r of rows) byLane.get(r.lane)!.push(r);

const times = rows.map((r) => r.created_at_utc).sort();
const usage: UsageFile = usageFileSchema.parse({
  window_days: days,
  coverage_start: times[0] + "",
  coverage_end: times[times.length - 1] + "",
  lanes: LANES.map((l) => laneSummary(l, byLane.get(l)!)),
  measured_at: measuredAt,
  source: SOURCE,
});

const dataDir = join(APP, "data");
mkdirSync(join(dataDir, "raw", "usage"), { recursive: true });
const day = measuredAt.slice(0, 10);
// raw rows: lane ids only, no account ids
writeFileSync(
  join(dataDir, "raw", "usage", `${day}.json`),
  JSON.stringify({ measured_at: measuredAt, source: SOURCE, rows: rows.map(({ lane, ...r }) => ({ lane, ...r })) }),
);
writeFileSync(join(dataDir, "usage.json"), JSON.stringify(usage, null, 2) + "\n");

for (const l of usage.lanes) {
  const share = l.cache_share === null ? "null" : l.cache_share.toFixed(3);
  console.log(`${l.lane.padEnd(6)} rows=${l.rows} cache_share=${share} p50_ttft_ms=${l.p50_ttft_ms} n=${l.rows}`);
}
console.log(`lanes=${usage.lanes.length} window_days=${days} rows=${rows.length} coverage=${usage.coverage_start}..${usage.coverage_end}`);
