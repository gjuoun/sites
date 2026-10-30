import { ACCOUNT_TO_LANE, LANES, QUOTA_METERED_ACCOUNTS, type LaneId, type TokenCounts } from "../data/schema";
import { cacheShare } from "../data/derive";

/** Read-only SQL. The statement is fixed in code; only the window length is parameterized, and it is validated. */
export function usageSql(days: number): string {
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("days must be an integer in 1..90");
  const accounts = Object.keys(ACCOUNT_TO_LANE).join(",");
  return [
    "SELECT account_id, upstream_model, input_tokens, cache_creation_tokens, cache_read_tokens,",
    "       output_tokens, COALESCE(total_cost,0) AS total_cost, first_token_ms, duration_ms,",
    "       to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') AS created_at_utc",
    "FROM usage_logs",
    `WHERE account_id IN (${accounts})`,
    `  AND created_at > now() - interval '${days} days'`,
    "ORDER BY created_at",
    ";",
  ].join("\n");
}

export type UsageRow = {
  lane: LaneId;
  metered: boolean;
  upstream_model: string;
  input: number;
  cache_creation: number;
  cache_read: number;
  output: number;
  total_cost: number;
  first_token_ms: number | null;
  duration_ms: number | null;
  created_at_utc: string;
};

/** Parse `psql -t -A -F'|'` output into plan-keyed rows. Account 3 never reaches here: the SQL filters it. */
export function parseUsageRows(text: string): UsageRow[] {
  const out: UsageRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("(")) continue;
    const f = line.split("|");
    if (f.length !== 10) throw new Error(`usage row has ${f.length} fields, expected 10`);
    const account = Number(f[0]);
    const lane = ACCOUNT_TO_LANE[account];
    if (!lane) throw new Error(`unmapped account_id ${account}`);
    const num = (s: string) => (s === "" ? null : Number(s));
    out.push({
      lane,
      metered: QUOTA_METERED_ACCOUNTS.has(account),
      upstream_model: f[1],
      input: Number(f[2]),
      cache_creation: Number(f[3]),
      cache_read: Number(f[4]),
      output: Number(f[5]),
      total_cost: Number(f[6]),
      first_token_ms: num(f[7]),
      duration_ms: num(f[8]),
      created_at_utc: f[9],
    });
  }
  return out;
}

/** Every plan id is present, even with no rows; accounts of one plan land in the same bucket. */
export function groupByPlan(rows: UsageRow[]): Map<LaneId, UsageRow[]> {
  const map = new Map<LaneId, UsageRow[]>(LANES.map((l) => [l, []]));
  for (const r of rows) map.get(r.lane)!.push(r);
  return map;
}

/** The rows at or after one instant: the recent slice is cut from the same pull as the full window. */
export function rowsSince(rows: UsageRow[], fromMs: number): UsageRow[] {
  return rows.filter((r) => Date.parse(r.created_at_utc) >= fromMs);
}

export type ModelSummary = {
  upstream_model: string;
  rows: number;
  tokens: TokenCounts;
  cost_usd: number;
  p50_ttft_ms: number | null;
  p90_ttft_ms: number | null;
  p50_output_tps: number | null;
  measured_at: string;
  source: string;
};

export type LaneSummary = {
  lane: LaneId;
  rows: number;
  tokens: TokenCounts;
  cache_share: number | null;
  p50_ttft_ms: number | null;
  p90_ttft_ms: number | null;
  p50_output_tps: number | null;
  models: ModelSummary[];
  measured_at: string;
  source: string;
};

/** One lane's roll-up over whatever rows it is given: the full window and the recent slice share this code. */
export function summarizeLane(lane: LaneId, rows: UsageRow[], measuredAt: string, source: string): LaneSummary {
  const sum = (f: (r: UsageRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const tokens: TokenCounts = {
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
      source,
    };
  });
  return {
    lane,
    rows: rows.length,
    tokens,
    cache_share: rows.length === 0 ? null : cacheShare(tokens),
    p50_ttft_ms: percentile(ttft, 50),
    p90_ttft_ms: percentile(ttft, 90),
    p50_output_tps: percentile(tps, 50),
    models: rows.length === 0 ? [] : models,
    measured_at: measuredAt,
    source,
  };
}

/** Nearest-rank percentile; null on an empty sample. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

/** Output tokens per second over the generation phase only: output / (duration - first_token). */
export function outputTps(row: Pick<UsageRow, "output" | "first_token_ms" | "duration_ms">): number | null {
  if (row.first_token_ms === null || row.duration_ms === null) return null;
  const gen = row.duration_ms - row.first_token_ms;
  if (gen <= 0 || row.output <= 0) return null;
  return row.output / (gen / 1000);
}
