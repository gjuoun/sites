#!/usr/bin/env bun
// The jun-hermes site is static: it is served exactly as written, with no build pipeline and no
// JavaScript. Two things can silently rot that, so this gate proves them instead of trusting review:
//
//   1. assets/bigface.css is a VENDORED copy of the Bigface theme package output. Byte-for-byte,
//      never hand-edited. Change the theme in its own package, then copy it here again.
//   2. the site stays colour-token-only, dark-only and script-free.
//
//   bun run scripts/check-tokens.mjs
//   -> TOKENS OK files=2 pages=6 theme=bigface mode=dark tokens=13
//   -> exit 1 with one line per problem otherwise.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const app = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const source = join(app, "../../packages/bigface-shadcn-ui/src/themes/bigface.css");
const vendoredPath = join(app, "assets/bigface.css");
const stylePath = join(app, "assets/style.css");
const logoPath = join(app, "assets/logo.svg");
const PAGES = ["index.html", "privacy.html", "terms.html", "terms-of-use.html", "404.html", "oauth2/callback.html"];
const COPY_HINT = "copy it again: cp packages/bigface-shadcn-ui/src/themes/bigface.css apps/jun-hermes/assets/bigface.css";

const problems = [];
const hexes = (text) => (text.match(/#[0-9a-fA-F]{6}/g) ?? []).map((h) => h.toLowerCase());

// 1. the vendored token table is the package output, byte for byte
let sourceText = "";
let vendored = "";
try {
  sourceText = readFileSync(source, "utf8");
} catch {
  problems.push("MISSING " + source + " (is the monorepo checkout complete?)");
}
try {
  vendored = readFileSync(vendoredPath, "utf8");
} catch {
  problems.push("MISSING " + vendoredPath + " — " + COPY_HINT);
}
if (sourceText && vendored && sourceText !== vendored) problems.push("STALE " + vendoredPath + " — " + COPY_HINT);

// the token names the vendored table declares (light block + dark block declare the same set)
const declared = new Set(vendored.match(/--theme-[A-Za-z]+/g) ?? []);
if (declared.size === 0) problems.push("EMPTY " + vendoredPath + " — no --theme-* declarations");

// 2. the site stylesheet holds no colours of its own and reads only declared tokens
let style = "";
try {
  style = readFileSync(stylePath, "utf8");
} catch {
  problems.push("MISSING " + stylePath);
}
const bare = style.replace(/\/\*[\s\S]*?\*\//g, "");
for (const m of bare.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(/g)) {
  problems.push("COLOUR " + stylePath + ": hand-written colour `" + m[0] + "` — use var(--theme-*) instead");
}
for (const m of bare.matchAll(/var\((--theme-[A-Za-z]+)\)/g)) {
  if (!declared.has(m[1])) problems.push("UNDECLARED " + stylePath + ": var(" + m[1] + ") is not in the vendored table");
}

// 3. every page declares the theme and the fixed mode, and loads the token table before its own sheet
let pages = 0;
for (const rel of PAGES) {
  const path = join(app, rel);
  let html = "";
  try {
    html = readFileSync(path, "utf8");
  } catch {
    problems.push("MISSING " + path);
    continue;
  }
  pages++;
  const tag = /<html\b[^>]*>/i.exec(html);
  if (!tag) { problems.push("NO-HTML-TAG " + rel); continue; }
  if (!/data-theme="bigface"/.test(tag[0])) problems.push("NO-THEME " + rel + ": <html> needs data-theme=" + JSON.stringify("bigface"));
  if (!/data-mode="dark"/.test(tag[0])) problems.push("NO-MODE " + rel + ": <html> needs data-mode=" + JSON.stringify("dark"));
  const tokens = /<link\b[^>]*href="([^"]*bigface\.css)"[^>]*>/.exec(html);
  const own = /<link\b[^>]*href="([^"]*style\.css)"[^>]*>/.exec(html);
  if (!tokens) problems.push("NO-TOKENS " + rel + ": no <link> to bigface.css");
  if (!own) problems.push("NO-STYLE " + rel + ": no <link> to style.css");
  if (tokens && own && html.indexOf(tokens[0]) > html.indexOf(own[0])) problems.push("LINK-ORDER " + rel + ": bigface.css must load before style.css");
}

// 4. zero JavaScript: the OAuth callback page owns the only script, and it is not a theme script
const scriptPages = PAGES.filter((rel) => /<script\b/i.test(readFileSync(join(app, rel), "utf8")));
const scripts = PAGES.reduce((n, rel) => n + (readFileSync(join(app, rel), "utf8").match(/<script\b/gi) ?? []).length, 0);
if (scripts !== 1 || scriptPages.join() !== "oauth2/callback.html") {
  problems.push("SCRIPTS expected exactly one <script> in oauth2/callback.html, found " + scripts + " in [" + scriptPages.join(", ") + "]");
}

// 5. the logo mark is drawn from the same palette, so a recolour cannot drift off it
let logo = "";
try {
  logo = readFileSync(logoPath, "utf8");
} catch {
  problems.push("MISSING " + logoPath);
}
const paletteHexes = new Set(hexes(vendored));
for (const h of hexes(logo)) {
  if (!paletteHexes.has(h)) problems.push("LOGO " + logoPath + ": " + h + " is not a Bigface palette value");
}

if (problems.length) {
  for (const p of problems) console.error("FAIL " + p);
  console.error("TOKENS FAILED problems=" + problems.length);
  process.exit(1);
}
console.log("TOKENS OK files=2 pages=" + pages + " theme=bigface mode=dark tokens=" + declared.size);