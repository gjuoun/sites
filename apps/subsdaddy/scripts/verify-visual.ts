#!/usr/bin/env bun
/**
 * Visual gate: serve the prerendered dist and run the shared clipping checker at 1440px, primary mode.
 *
 * The shared checker fails when a value element clips, or when a description clips without a title.
 * This site's rule is stricter: no cell may show an ellipsis at all, so a clipped description fails
 * here too. Both pages are checked; the verdict and the counts are printed for the record.
 *
 *   bun run scripts/verify-visual.ts
 *   SUBSDADDY_OVERFLOW_CHECK=/path/to/check-overflow.mjs to point at another copy
 */
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const DIST = join(APP, "dist", "client");
const CHECKER =
  process.env.SUBSDADDY_OVERFLOW_CHECK ??
  join(process.env.HOME ?? "", ".hermes/profiles/admin/skills/software-development/subsdaddy-development/scripts/check-overflow.mjs");
const WIDTH = "1440";
const ROUTES = ["/", "/methodology/"];

if (!existsSync(join(DIST, "index.html"))) {
  console.error("verify-visual: no build at " + DIST + "; run build first");
  process.exit(2);
}
if (!existsSync(CHECKER)) {
  console.error("verify-visual: clipping checker not found at " + CHECKER + " (set SUBSDADDY_OVERFLOW_CHECK)");
  process.exit(2);
}

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const p = decodeURIComponent(new URL(req.url).pathname);
    let f = join(DIST, p);
    if (existsSync(f) && statSync(f).isDirectory()) {
      if (!p.endsWith("/")) return Response.redirect(p + "/", 301);
      f = join(f, "index.html");
    }
    return existsSync(f) ? new Response(Bun.file(f)) : new Response("not found", { status: 404 });
  },
});

const problems: string[] = [];
try {
  for (const route of ROUTES) {
    const url = "http://127.0.0.1:" + server.port + route;
    // async spawn on purpose: a blocking spawn would freeze the Bun server this process is also running
    const proc = Bun.spawn(["node", CHECKER, url, WIDTH, "primary"], { stdout: "pipe", stderr: "pipe" });
    const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    await proc.exited;
    if (!out.trim() && err.trim()) problems.push(route + ": checker failed: " + err.trim().split("\n")[0].slice(0, 200));
    let parsed: { verdict?: string; primary_clipped?: number; description_clipped?: number; description_without_title?: number } = {};
    try {
      parsed = JSON.parse(out);
    } catch {
      problems.push(route + ": checker printed no JSON (" + out.slice(0, 120) + ")");
      continue;
    }
    const primary = parsed.primary_clipped ?? -1;
    const description = parsed.description_clipped ?? -1;
    console.log("visual " + route.padEnd(14) + " width=" + WIDTH + " verdict=" + parsed.verdict + " primary_clipped=" + primary + " description_clipped=" + description);
    if (parsed.verdict !== "PASS") problems.push(route + ": checker verdict " + parsed.verdict);
    if (description !== 0) problems.push(route + ": " + description + " description(s) still clip (no ellipsis is allowed)");
  }
} finally {
  server.stop(true);
}

console.log("visual problems=" + problems.length);
if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  process.exit(1);
}
