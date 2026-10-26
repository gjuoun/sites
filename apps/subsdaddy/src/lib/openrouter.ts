import { type OrEndpoint, orEndpointSchema } from "../data/schema";

/**
 * Parses the endpoint stats that the bare OpenRouter model page embeds in its
 * self.__next_f.push flight payload. This is an unofficial, server-rendered shape:
 * the parser extracts what it can, validates every row, and never invents a value.
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

/** Balanced-brace scan starting at an opening brace; string-aware. */
export function objectAt(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
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

/** Every stats block with the provider name and quantization written just before it in the same record. */
export function extractEndpoints(html: string, model: string): { endpoints: OrEndpoint[]; blocks: number; stale: number } {
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

    const before = payload.slice(Math.max(0, (m.index ?? 0) - 3000), m.index ?? 0);
    const name = lastCapture(before, /"provider_display_name":"([^"]+)"/g);
    const quant = lastCapture(before, /"quantization":"([^"]+)"/g);
    const { p50_latency: lat, p50_throughput: tput, request_count: reqs, window_minutes: win } = st;
    if (name === null || lat === null || tput === null || reqs === null || win === null) {
      stale++; // a missing stat marks the row stale and excludes it; it is never written as 0
      continue;
    }
    const parsed = orEndpointSchema.parse({
      model,
      provider_display_name: name,
      quantization: quant ?? "unknown",
      p50_latency_ms: lat,
      p50_throughput: tput,
      p90_throughput: st.p90_throughput,
      request_count: reqs,
      window_minutes: win,
      confidence: reqs < 1000 ? "low_confidence" : "ok",
    });
    endpoints.push(parsed);
  }
  return { endpoints, blocks, stale };
}

function lastCapture(s: string, re: RegExp): string | null {
  let last: string | null = null;
  for (const m of s.matchAll(re)) last = m[1];
  return last;
}
