import { ACCOUNT_TO_LANE, type LaneId } from "../data/schema";

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

/** Parse `psql -A -F'|'` output (no header) into lane-keyed rows. Account 3 never reaches here: the SQL filters it. */
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
