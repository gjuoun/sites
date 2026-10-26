#!/usr/bin/env bun
/**
 * Appends one timestamped quota observation per lane to data/raw/quota/<date>.json (history,
 * never overwritten) and rewrites data/quota.json with the latest reading per lane.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { LANES, quotaFileSchema, type QuotaObservationOrGap } from "../src/data/schema";
import { probeOne, type Resolved } from "./probe-quota";

const APP = resolve(import.meta.dir, "..");
const dataDir = join(APP, "data");
const measuredAt = new Date().toISOString();
const day = measuredAt.slice(0, 10);

const resolved: Resolved[] = await Promise.all(LANES.map((l) => probeOne(l)));

const observations: QuotaObservationOrGap[] = resolved.map((r) =>
  "unavailable" in r
    ? { lane: r.lane as QuotaObservationOrGap["lane"], unavailable: r.unavailable, measured_at: measuredAt, source: "codexbar usage" }
    : { ...r, lane: r.lane as QuotaObservationOrGap["lane"], measured_at: measuredAt } as QuotaObservationOrGap,
);

mkdirSync(join(dataDir, "raw", "quota"), { recursive: true });
const rawPath = join(dataDir, "raw", "quota", `${day}.json`);
const history = existsSync(rawPath) ? quotaFileSchema.parse(JSON.parse(readFileSync(rawPath, "utf8"))).observations : [];
writeFileSync(
  rawPath,
  JSON.stringify(quotaFileSchema.parse({ observations: [...history, ...observations], measured_at: measuredAt, source: "codexbar usage (probe-quota)" }), null, 2) + "\n",
);

writeFileSync(
  join(dataDir, "quota.json"),
  JSON.stringify(quotaFileSchema.parse({ observations, measured_at: measuredAt, source: "codexbar usage (probe-quota)" }), null, 2) + "\n",
);

for (const o of observations) {
  if ("unavailable" in o) console.log(`${o.lane.padEnd(6)} unavailable: ${o.unavailable}`);
  else console.log(`${o.lane.padEnd(6)} ${o.window} used_pct=${o.used_pct.toFixed(2)} resets_at=${o.resets_at}`);
}
