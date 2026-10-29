// Byte budget over dist/: HTML per page, CSS per file, inline plus the _astro js pages load, and zero
// off-origin script, link, img, or font requests. The origin comes from astro.config.mjs.
// Only _astro js that a page references counts: @astrojs/react builds React's client bundle even when no
// component hydrates, and a file no page loads costs a visitor nothing.
import { join } from "node:path";

export const LIMITS = {
	// 41 KB: the site's styling is utilities in the markup (no site stylesheet), and the stock components carry their
	// own dark: classes; home measured 41598 B (2026-10-29, was 32393 B with site.css).
	htmlBytes: 41 * 1024,
	// 48 KB: Tailwind with preflight, the typography plugin (about 14 KB) for page content, and the stock theme
	// components; measured 48978 B (2026-10-29).
	cssBytes: 48 * 1024,
	jsBytes: 4 * 1024,
} as const;

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g;
const SCRIPT_SRC = /<script[^>]*\ssrc="([^"]+)"/g;
const LINK_HREF = /<link[^>]*\shref="([^"]+)"/g;
const IMG_SRC = /<img[^>]*\ssrc="([^"]+)"/g;
const CSS_URL = /url\(\s*["']?(https?:\/\/[^"')\s]+)/g;

export function inlineScriptBytes(html: string): number {
	let bytes = 0;
	for (const m of html.matchAll(INLINE_SCRIPT))
		bytes += new TextEncoder().encode(m[1] ?? "").length;
	return bytes;
}

/** Hrefs and srcs that point at another origin. Only script, link, and img count; CSS url() counts too. */
export function offOriginRequests(html: string, origin: string): string[] {
	const out: string[] = [];
	for (const re of [SCRIPT_SRC, LINK_HREF, IMG_SRC]) {
		for (const m of html.matchAll(re)) {
			if (/^https?:/i.test(m[1] ?? "") && !(m[1] ?? "").startsWith(origin))
				out.push(m[1] ?? "");
		}
	}
	return out;
}

/**
 * The _astro js files a browser can load: named in any page (script src, modulepreload, island urls), plus
 * every chunk those files import, transitively. `js` maps file name to contents.
 */
export function loadedScripts(
	htmls: string[],
	js: Record<string, string>,
): string[] {
	const names = Object.keys(js);
	const loaded = new Set(
		names.filter((n) => htmls.some((h) => h.includes(`/_astro/${n}`))),
	);
	for (let grew = true; grew; ) {
		grew = false;
		for (const n of names)
			if (
				!loaded.has(n) &&
				[...loaded].some((l) => (js[l] ?? "").includes(n))
			) {
				loaded.add(n);
				grew = true;
			}
	}
	return [...loaded];
}

export function offOriginCssRequests(css: string): string[] {
	return [...css.matchAll(CSS_URL)].map((m) => m[1] ?? "");
}

if (import.meta.main) {
	const root = join(import.meta.dir, "..");
	const dist = join(root, "dist");
	const config = await Bun.file(join(root, "astro.config.mjs")).text();
	const origin = /site:\s*"([^"]+)"/.exec(config)?.[1] ?? "";
	if (origin === "") throw new Error("astro.config.mjs has no site");

	let maxHtml = 0;
	let maxHtmlFile = "";
	let cssMax = 0;
	let jsAstro = 0;
	let jsInlineMax = 0;
	let third = 0;
	const problems: string[] = [];

	const files: Record<string, string> = {};
	for await (const rel of new Bun.Glob("*.js").scan({
		cwd: join(dist, "_astro"),
	}))
		files[rel] = await Bun.file(join(dist, "_astro", rel)).text();
	const pages: Record<string, string> = {};
	for await (const rel of new Bun.Glob("**/*.html").scan({ cwd: dist }))
		pages[rel] = await Bun.file(join(dist, rel)).text();
	for (const name of loadedScripts(Object.values(pages), files))
		jsAstro += new TextEncoder().encode(files[name] ?? "").length;
	for (const [rel, html] of Object.entries(pages)) {
		const size = new TextEncoder().encode(html).length;
		if (size > maxHtml) {
			maxHtml = size;
			maxHtmlFile = rel;
		}
		if (size > LIMITS.htmlBytes)
			problems.push(`${rel} is ${size} B (limit ${LIMITS.htmlBytes})`);
		jsInlineMax = Math.max(jsInlineMax, inlineScriptBytes(html));
		const off = offOriginRequests(html, origin);
		third += off.length;
		for (const u of off) problems.push(`${rel} off-origin request ${u}`);
	}
	for await (const rel of new Bun.Glob("**/*.css").scan({ cwd: dist })) {
		const css = await Bun.file(join(dist, rel)).text();
		const size = new TextEncoder().encode(css).length;
		cssMax = Math.max(cssMax, size);
		if (size > LIMITS.cssBytes)
			problems.push(`${rel} is ${size} B (limit ${LIMITS.cssBytes})`);
		const off = offOriginCssRequests(css);
		third += off.length;
		for (const u of off) problems.push(`${rel} off-origin url() ${u}`);
	}
	const js = jsAstro + jsInlineMax;
	if (js > LIMITS.jsBytes)
		problems.push(`inline + _astro js is ${js} B (limit ${LIMITS.jsBytes})`);

	if (problems.length > 0) {
		for (const p of problems) console.error(`BUDGET ${p}`);
		console.error(
			`budget failed max_html=${maxHtml} js=${js} third_party_requests=${third}`,
		);
		process.exit(1);
	}
	console.log(
		`budget ok max_html=${maxHtml} js=${js} third_party_requests=${third}`,
	);
	console.log(
		`budget detail: max_html_file=${maxHtmlFile} max_css=${cssMax} astro_js=${jsAstro} inline_js_max=${jsInlineMax}`,
	);
}
