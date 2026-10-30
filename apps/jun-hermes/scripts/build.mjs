// Copy the files that ship into dist/.
//
// This site has no build: it is four pages of hand-written HTML plus an OAuth redirect endpoint,
// served exactly as written. The list is explicit rather than a glob so a stray local file can
// never end up published — this is the Google OAuth verification surface, where /privacy, /terms
// and /oauth2/callback are registered URLs.
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

const files = [
  "index.html",
  "privacy.html",
  "terms.html",
  "terms-of-use.html",
  "404.html",
  "oauth2/callback.html",
  "assets/logo.svg",
  "assets/bigface.css",
  "assets/style.css",
  "healthz.json",
  "robots.txt",
  "sitemap.xml",
  ".nojekyll",
];

await rm(dist, { recursive: true, force: true });
for (const f of files) {
  const to = join(dist, f);
  await cp(join(root, f), to, { recursive: true });
}

console.log(`jun-hermes: ${files.length} files → dist/`);
