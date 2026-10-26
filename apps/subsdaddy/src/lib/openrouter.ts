import { type OrEndpoint, orEndpointSchema } from "../data/schema";

/**
 * Parses the endpoint stats that the bare OpenRouter model page embeds in its
 * self.__next_f.push flight payload. This is an unofficial, server-rendered shape.
 * Each stats block belongs to an endpoint object that also carries provider_display_name and
 * quantization; the parser reads those from the enclosing object itself, never from a fixed
 * distance in the text. A row whose enclosing object cannot be read is stale, never zero.
 */

export function flightPayload(html: string): string {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(([\s\S]*?)\)<\/script>/g)];
  let out = "";
  for (const m of chunks) {
    try {
      const arr = JSON.parse(m[1]);
      if (Array.isArray(arr) && arr.length >= 2 && typeof arr[1] === "string") out += arr[1];
    } catch {
      // a chunk that is not JSON is skipped; the endpoint count check catches a shape change
    }
  }
  return out;
}

/** Balanced-brace scan starting at an opening brace; string-aware. Optionally bounded. */
export function objectAt(s: string, start: number, maxLength = Number.POSITIVE_INFINITY): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  const limit = Math.min(s.length, start + maxLength);
  for (let i = start; i < limit; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export type RawStats = {
  endpoint_id: string;
  p50_latency: number | null;
  p50_throughput: number | null;
  p90_throughput: number | null;
  request_count: number | null;
  window_minutes: number | null;
};

const ENCLOSING_SEARCH = 60_000;
const ENCLOSING_MAX_OBJECT = 40_000;

/**
 * The endpoint object that contains a stats block: the nearest enclosing object that has a
 * provider_display_name and parses as JSON. Returns null when there is none.
 */
export function enclosingEndpoint(s: string, statsStart: number, statsEnd: number): Record<string, unknown> | null {
  const floor = Math.max(0, statsStart - ENCLOSING_SEARCH);
  for (let p = statsStart - 1; p >= floor; p--) {
    if (s[p] !== "{") continue;
    const raw = objectAt(s, p, ENCLOSING_MAX_OBJECT);
    if (raw === null || p + raw.length < statsEnd) continue;
    if (!raw.includes('"provider_display_name"')) continue;
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      if (obj && typeof obj.provider_display_name === "string") return obj;
    } catch {
      // not a complete endpoint object; keep looking outward
    }
  }
  return null;
}

/** Every stats block with its own endpoint's provider name and quantization. */
export function extractEndpoints(
  html: string,
  model: string,
  measuredAt = "1970-01-01T00:00:00.000Z",
): { endpoints: OrEndpoint[]; blocks: number; stale: number } {
  const payload = flightPayload(html);
  const seen = new Set<string>();
  const endpoints: OrEndpoint[] = [];
  let blocks = 0;
  let stale = 0;
  for (const m of payload.matchAll(/"stats":\{/g)) {
    const start = (m.index ?? 0) + '"stats":'.length;
    const raw = objectAt(payload, start);
    if (!raw) continue;
    blocks++;
    const st = JSON.parse(raw) as RawStats;
    if (seen.has(st.endpoint_id)) continue; // the flight payload repeats records; one endpoint, one row
    seen.add(st.endpoint_id);

    const ep = enclosingEndpoint(payload, m.index ?? 0, start + raw.length);
    const name = ep && typeof ep.provider_display_name === "string" ? ep.provider_display_name : null;
    const quant = ep && typeof ep.quantization === "string" ? ep.quantization : "unknown";
    const { p50_latency: lat, p50_throughput: tput, request_count: reqs, window_minutes: win } = st;
    if (name === null || lat === null || tput === null || reqs === null || win === null) {
      stale++; // a missing stat or name marks the row stale and excludes it; it is never written as 0
      continue;
    }
    const parsed = orEndpointSchema.parse({
      model,
      provider_display_name: name,
      quantization: quant,
      p50_latency_ms: lat,
      p50_throughput: tput,
      p90_throughput: st.p90_throughput,
      request_count: reqs,
      window_minutes: win,
      confidence: reqs < 1000 ? "low_confidence" : "ok",
      measured_at: measuredAt,
      source: "openrouter.ai bare model page stats (unofficial)",
    });
    endpoints.push(parsed);
  }
  return { endpoints, blocks, stale };
}
