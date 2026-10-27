// Collect OpenCode Go's per-model monthly limits from its own docs page. A failed fetch or parse exits 1 and writes nothing.
import { join } from "node:path";
import { OPENCODE_GO_URL, runOpencodeGo } from "../src/lib/opencode-go";

const dataDir = join(import.meta.dir, "..", "data");
let html: string;
try {
  const res = await fetch(OPENCODE_GO_URL, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error("HTTP " + res.status);
  html = await res.text();
} catch (e) {
  console.log("collect:opencode-go FAILED: fetch " + OPENCODE_GO_URL + ": " + (e as Error).message + "; previous data/opencode-go.json and catalog kept");
  process.exit(1);
}
try {
  const s = runOpencodeGo({ html, dataDir, fetchedAt: new Date().toISOString() });
  console.log("collect:opencode-go ok plans=" + s.plans + " models=" + s.models + " per_model_limits=" + s.refs);
} catch (e) {
  console.log("collect:opencode-go FAILED: " + (e as Error).message + "; previous data/opencode-go.json and catalog kept");
  process.exit(1);
}
