#!/usr/bin/env bun
// Serves the built site exactly as deployed and asks each registered URL for what the theme switch
// promises: a 200, a root that declares bigface+dark, and a stylesheet carrying the Bigface tokens.
//
//   bun run scripts/probe.mjs
//   -> PROBE OK n=8
//
// Port 4398 is pinned on purpose (a neighbouring round probes another app on 4399); if it is taken,
// this fails instead of quietly moving somewhere else.
import { join } from "node:path";

const DIST = join(new URL("..", import.meta.url).pathname.replace(/\/$/, ""), "dist");
const PORT = 4398;
const ROUTES = ["/", "/privacy.html", "/terms.html", "/terms-of-use.html", "/404.html", "/oauth2/callback", "/healthz.json", "/assets/bigface.css"];

function fileFor(pathname) {
  if (pathname === "/") return "index.html";
  if (pathname === "/oauth2/callback" || pathname === "/oauth2/callback/") return "oauth2/callback.html";
  return pathname.replace(/^\//, "");
}

let server;
try {
  server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const p = fileFor(new URL(req.url).pathname);
      const f = Bun.file(join(DIST, p));
      if (await f.exists()) return new Response(f);
      return new Response(Bun.file(join(DIST, "404.html")), { status: 404 });
    },
  });
} catch (e) {
  console.error("EADDRINUSE :" + PORT + " — stop the other server on this port (" + (e instanceof Error ? e.message : String(e)) + ")");
  process.exit(1);
}

const problems = [];
let checked = 0;
try {
  for (const route of ROUTES) {
    const res = await fetch(server.url + route);
    const body = await res.text();
    checked++;
    if (res.status !== 200) problems.push(route + " -> " + res.status);
    if (route.endsWith(".css")) {
      if (!body.includes("--theme-bg: #252925")) problems.push(route + " is missing the dark --theme-bg token");
    } else if (route.endsWith(".html") || route === "/" || route === "/oauth2/callback") {
      if (!body.includes('data-theme="bigface"')) problems.push(route + " is missing data-theme=" + JSON.stringify("bigface"));
      if (!body.includes('data-mode="dark"')) problems.push(route + " is missing data-mode=" + JSON.stringify("dark"));
    }
    console.log("PROBE OK " + res.status + " " + route);
  }
} finally {
  server.stop(true);
}

if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.error("PROBE FAILED problems=" + problems.length);
  process.exit(1);
}
console.log("PROBE OK n=" + checked);