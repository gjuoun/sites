import type { OrEndpoint } from "../data/schema";
import { extractEndpoints } from "./openrouter";

/**
 * The status of one model on one collector run (r57). A run never fails as a whole because one model did not parse:
 *   - ok: endpoints with usable throughput were read;
 *   - stats_unavailable: the page parsed, and every endpoint reported zero throughput, so there is no speed. Nothing is written as 0;
 *   - kept_previous: the page could not be fetched or parsed this run, and an earlier trusted snapshot of this model exists. It is kept, dated;
 *   - unavailable: the page could not be read and there is no trusted snapshot to keep.
 */
export type ModelStatus = "ok" | "unavailable" | "stats_unavailable" | "kept_previous";

/** The previous run's record of this model, read from data/benchmark.json before it is overwritten. */
export type PreviousModel = { status: string; endpoints: OrEndpoint[]; measured_at: string } | null;

export type ModelOutcome = {
  status: ModelStatus;
  endpoints: OrEndpoint[];
  reason: string | null;
  skipped_zero_tput: number;
  /** The endpoints skipped for zero or missing throughput, by provider and field (r57). */
  skipped: Array<{ provider: string; field: string }>;
  stale: number;
  /** For kept_previous: the instant of the snapshot that is kept. Otherwise null. */
  kept_from: string | null;
};

const TRUSTED = new Set(["ok", "kept_previous"]);

export function outcomeForModel(input: {
  slug: string;
  html: string | null;
  fetchError: string | null;
  measuredAt: string;
  previous: PreviousModel;
}): ModelOutcome {
  let failure: string | null = input.fetchError;
  let parsed: ReturnType<typeof extractEndpoints> | null = null;
  if (failure === null && input.html !== null) {
    try {
      const out = extractEndpoints(input.html, input.slug, input.measuredAt);
      if (out.blocks === 0) failure = "payload has no stats blocks (page shape changed or no stats published)";
      else if (out.endpoints.length === 0 && out.skipped_zero_tput === 0) failure = "every stats row is stale (required fields missing)";
      else parsed = out;
    } catch (e) {
      failure = "payload did not parse: " + (e instanceof Error ? e.name : "error");
    }
  } else if (failure === null) {
    failure = "no page";
  }

  if (parsed !== null) {
    if (parsed.endpoints.length === 0) {
      return { status: "stats_unavailable", endpoints: [], reason: "every endpoint reported zero throughput (skipped_zero_tput=" + parsed.skipped_zero_tput + "); no speed is published", skipped_zero_tput: parsed.skipped_zero_tput, skipped: parsed.skipped, stale: parsed.stale, kept_from: null };
    }
    return { status: "ok", endpoints: parsed.endpoints, reason: null, skipped_zero_tput: parsed.skipped_zero_tput, skipped: parsed.skipped, stale: parsed.stale, kept_from: null };
  }

  const prev = input.previous;
  if (prev && TRUSTED.has(prev.status)) {
    const date = prev.measured_at.slice(0, 10);
    return { status: "kept_previous", endpoints: prev.endpoints, reason: "kept previous snapshot (" + date + "): " + failure, skipped_zero_tput: 0, skipped: [], stale: 0, kept_from: prev.measured_at };
  }
  return { status: "unavailable", endpoints: [], reason: failure, skipped_zero_tput: 0, skipped: [], stale: 0, kept_from: null };
}
