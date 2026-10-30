import { beforeAll, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import lightPaletteJson from "@gjuoun/bigface-tokens/palette-light.json";
import { $ } from "bun";
import {
	findForeignInCss,
	findForeignInHtml,
	paletteHexes,
	ringOffsetOffenders,
} from "./color-guard.ts";
import type { Palette } from "./data/palette.ts";
import { contrastRatio, inkOn, palette } from "./data/palette.ts";
import { targets } from "./data/targets.ts";
import { findInklessBrightPlates } from "./ink-guard.ts";

// The site's build is the app's own `build` script now: this package IS the site, and the
// monorepo root has no site:build to delegate to.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");
const BASE = "";
const page = (rel: string) =>
	readFileSync(join(dist, rel, "index.html"), "utf8");

beforeAll(async () => {
	const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
	if (r.exitCode !== 0)
		throw new Error(`site build failed:\n${r.stderr.toString()}`);
}, 120_000);

test("one page per target plus home, palette and the business catalogue", () => {
	expect(existsSync(join(dist, "index.html"))).toBe(true);
	expect(existsSync(join(dist, "palette/index.html"))).toBe(true);
	expect(existsSync(join(dist, "ui/business/index.html"))).toBe(true);
	// 2026-10-30 (JW-329): the legacy workspace and the console showcase are retired; their content
	// lives on /ui/business/ (see the card's inventory). Sixteen pages ship.
	expect(existsSync(join(dist, "ui/index.html")), "legacy /ui/ is retired").toBe(false);
	expect(existsSync(join(dist, "ui/console/index.html")), "console showcase is retired").toBe(false);
	for (const t of targets)
		expect(existsSync(join(dist, "apps", t.id, "index.html")), t.id).toBe(true);
	const pages = readdirSync(dist, { recursive: true, encoding: "utf8" }).filter(
		(f) => f.endsWith("index.html"),
	);
	expect(pages.length).toBe(16);
});

test("every app page has install steps, a code block, and download links that point at real files", () => {
	for (const t of targets) {
		const html = page(`apps/${t.id}`);
		expect(html, t.id).toMatch(/<h2[^>]*>Install<\/h2>/);
		expect(html, t.id).toContain("<pre");
		const hrefs = [...html.matchAll(/href="([^"]+)" download/g)].map(
			(m) => m[1] as string,
		);
		expect(hrefs.length, t.id).toBeGreaterThanOrEqual(t.files.length);
		for (const h of hrefs) {
			expect(h.startsWith(`${BASE}/`), h).toBe(true);
			expect(existsSync(join(dist, h.slice(BASE.length))), h).toBe(true);
		}
	}
});

test("each page states how far it was checked", () => {
	for (const t of targets) {
		const html = page(`apps/${t.id}`);
		expect(html).toContain("What was checked");
		expect(html).toContain(
			{
				tool: "Checked with the tool",
				schema: "Checked against its schema",
				format: "Format-checked only",
			}[t.check.level],
		);
	}
});

test("pages use the palette: background, a syntax colour, and the original JetBrains source labels", () => {
	expect(page("")).toContain("#252925");
	const pal = page("palette");
	expect(pal).toContain("#00b0ff");
	expect(pal).toContain("DEFAULT_KEYWORD#FOREGROUND");
	// Neutral collapse (2026-10-25): the neutrals are derived from the background by one formula; the accents are the scheme's own.
	expect(pal).toContain("derived from the background");
	expect(pal).not.toContain("blended");
	expect(pal).toContain("byte-for-byte");
});

test("the VS Code .vsix is packaged into the site", () => {
	expect(existsSync(join(dist, "downloads/bigface-theme-0.1.0.vsix"))).toBe(
		true,
	);
});

test("internal links are root-absolute and name no project path", () => {
	for (const rel of ["", "palette", "apps/pi"]) {
		const html = page(rel);
		for (const m of html.matchAll(/href="(\/[^"]*)"/g)) {
			const href = m[1] as string;
			expect(href.startsWith("/"), href).toBe(true);
			expect(href.startsWith("/bigface-theme"), href).toBe(false);
			expect(href.startsWith("//"), href).toBe(false);
		}
	}
});

test("every app page shows its one-line install command, and install.sh is published", () => {
	expect(existsSync(join(dist, "install.sh"))).toBe(true);
	const script = readFileSync(join(dist, "install.sh"), "utf8");
	expect(script.startsWith("#!/bin/sh")).toBe(true);
	for (const t of targets) {
		const html = page(`apps/${t.id}`);
		expect(html, t.id).toContain(`install.sh | sh -s -- ${t.id}`);
		expect(script, t.id).toContain(`install_${t.id}()`);
	}
	for (const t of targets)
		expect(page(`apps/${t.id}`), t.id).toContain(
			`install.sh | sh -s -- --uninstall ${t.id}`,
		);
	const home = page("");
	expect(home).toContain("install.sh | sh</code>");
	expect(home).toContain("install.sh | sh -s -- all");
	expect(home).toContain("install.sh | sh -s -- --uninstall all");
	expect(script).toContain("uninstall_ghostty()");
});

test("the Obsidian page shows a real screenshot that exists and matches its declared size", () => {
	const html = page("apps/obsidian");
	const m = html.match(/<img[^>]*src="([^"]+obsidian-preview\.png)"[^>]*>/);
	expect(m, "img tag").not.toBeNull();
	const src = (m as RegExpMatchArray)[1] as string;
	expect(src.startsWith(`${BASE}/img/`)).toBe(true);
	const file = join(dist, src.slice(BASE.length));
	expect(existsSync(file)).toBe(true);
	const buf = readFileSync(file);
	expect(buf.subarray(1, 4).toString()).toBe("PNG");
	const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
	expect(html).toContain(`width="${w}"`);
	expect(html).toContain(`height="${h}"`);
	expect(w).toBeGreaterThanOrEqual(1200);
	expect(buf.length).toBeLessThan(400 * 1024);
	expect(html).toMatch(/alt="Obsidian in reading view/);
});

test("every swatch prints an ink that actually contrasts on it", () => {
	// The label on a colour chip is chosen from the palette's own fg/bg, and the ratio it prints
	// must be readable text (WCAG AA for body copy) — lime with cream text was 1.2:1 before this.
	const check = (label: string, hexValue: string, floor: number) => {
		const { ratio } = inkOn(hexValue);
		// The badge must never overstate: it prints the best of the palette's two inks.
		const best = Math.max(
			contrastRatio(palette.colors.fg.hex, hexValue),
			contrastRatio(palette.colors.bg.hex, hexValue),
		);
		expect(
			ratio,
			`${label} ${hexValue} is not the best available ink`,
		).toBeCloseTo(Math.round(best * 10) / 10, 1);
		expect(ratio, `${label} ${hexValue}`).toBeGreaterThanOrEqual(floor);
	};
	// Accents are the eye-candy: AA body text on every one of them.
	for (const name of [
		"blue",
		"lightBlue",
		"paleBlue",
		"cyan",
		"green",
		"lime",
		"yellow",
		"burntOrange",
		"purple",
	]) {
		check(name, palette.colors[name].hex, 4.5);
	}
	// Neutrals only have to be legible, and fgDim genuinely tops out at 3.7:1 against both inks.
	for (const [name, color] of Object.entries(palette.colors))
		check(name, color.hex, 3);
	for (const [name, color] of Object.entries(palette.ansi))
		check(`ansi.${name}`, color.hex, 3);
});

// Bright plates are now utility classes, so the dark-ink rule is checked per element (ink-guard.ts):
// cream on lime swatches (1.2:1) and cream on the selected filter chip (1.7:1) both shipped once.
test("no element pairs a bright fill class with anything but the dark ink", () => {
	const offenders: string[] = [];
	for (const f of readdirSync(dist, {
		recursive: true,
		encoding: "utf8",
	}).filter((f) => f.endsWith("index.html")))
		for (const cls of findInklessBrightPlates(
			readFileSync(join(dist, f), "utf8"),
		))
			offenders.push(`${f}: ${cls}`);
	expect(offenders).toEqual([]);
});

// Until shadcn is initialised there is no --primary token to pair.
const tailwindCss = join(siteDir, "src/styles/tailwind.css");
// The theme package ships shadcn's own structural theme (styles.css): semantic colour names, no
// values. If the site's palette reset ever runs after that import, the names vanish and a component
// silently loses its colours; the colour guard cannot see a missing rule, so pin the mapping here.
test("the built CSS keeps the library's theme names and drops Tailwind's default scale", () => {
	const css = readdirSync(join(dist, "_astro"))
		.filter((f) => f.endsWith(".css"))
		.map((f) => readFileSync(join(dist, "_astro", f), "utf8"))
		.join("\n");
	expect(css).toContain(".bg-primary{background-color:var(--primary)}");
	expect(css).toMatch(/\.font-code\{/);
	expect(css).not.toContain("--color-red-500");
	expect(css).not.toMatch(/\.bg-red-500\{/);
});

test.skipIf(!existsSync(tailwindCss))(
	"the shadcn primary token follows the theme's on-primary",
	() => {
		const css = readdirSync(join(dist, "_astro"))
			.filter((f) => f.endsWith(".css"))
			.map((f) => readFileSync(join(dist, "_astro", f), "utf8"))
			.join("\n");
		// 2026-10-27 ruling, now in the business package: the ink on the primary fill is each mode's
		// canvas colour, so the role reads --theme-bg (packages/bigface-business-ui/src/styles/styles.css).
		expect(css).toMatch(/--primary-foreground:\s*var\(--theme-bg\)/);
	},
);

// The theme system replaces the old static `<html class="dark">` with two attributes: a theme id and a
// mode. Both are what every dark: variant and every [data-theme] scope keys off, so the site must
// ship them on the root; a page that lost them would render with the fallback mapping only.
test("the page root carries the default theme and mode", () => {
	for (const rel of ["", "palette"]) {
		const html = readFileSync(join(dist, rel, "index.html"), "utf8");
		const tag = /<html\b[^>]*>/.exec(html)?.[0] ?? "";
		expect(tag, rel).toContain('data-theme="business"');
		expect(tag, rel).toContain('data-mode="dark"');
		expect(/class="[^"]*\bdark\b/.test(tag), rel).toBe(false);
	}
});

// The business page is the single-theme catalogue: one page root in the business theme and the default mode, all
// 63 components. The colour section is the only place a theme scope appears on the catalogue: light and dark are
// shown side by side there. The retired console showcase and the game theme are gone.
test("the business catalogue is one business theme with 63 components; the retired themes are offline", () => {
	const business = page("ui/business");
	expect(business).toContain('data-theme="business" data-mode="light"');
	const scopeAt = [...business.matchAll(/data-slot="theme-scope"/g)].map((m) => m.index ?? -1);
	expect(scopeAt.length, "the colour section shows light and dark scopes").toBeGreaterThan(0);
	const colourAt = business.indexOf('id="colour"');
	const firstComponent = business.indexOf('id="accordion"');
	expect(scopeAt.every((i) => i > colourAt && i < firstComponent), "scopes only inside the colour section").toBe(true);
	const typoAt = business.indexOf('id="typography"');
	expect(typoAt > colourAt && typoAt < firstComponent, "typography follows colour, before the components").toBe(true);
	// every component card carries the same three blocks; the eight categories wrap the 63 cards
	expect(business.split(">Variants<").length - 1, "a Variants block on every card").toBe(63);
	expect(business.split(">States<").length - 1, "a States block on every card").toBe(63);
	expect(business.split(">Examples<").length - 1, "an Examples block on every card").toBe(63);
	expect(business.split('id="cat-').length - 1, "eight categories").toBe(8);
	// the navigation: a sticky rail that links every section and component, and a select for narrow screens
	expect(business.split('aria-label="Catalogue sections"').length - 1, "one rail").toBe(1);
	expect(business.split('aria-label="Jump to a section"').length - 1, "one jump select").toBe(1);
	for (const id of ["colour", "typography", "accordion", "trace"]) expect(business, "rail links #" + id).toContain('href="#' + id + '"');
	expect([...business.matchAll(/data-demo="/g)], "63 demos").toHaveLength(63);
	for (const rel of ["", "palette", "ui/business"]) {
		expect(page(rel), "game on " + rel).not.toContain('data-theme="game"');
		expect(page(rel), "console on " + rel).not.toContain('data-theme="console"');
	}
	expect(existsSync(join(dist, "ui/theme/index.html")), "the gallery page is gone").toBe(false);
	expect(page("")).not.toContain("bigface-mode");
});

test("the site only ships colours that exist in the palette", () => {
	// Chrome included: the site uses the theme's own surfaces. Gradients interpolate between palette
	// stops, and translucent steps are palette colours with alpha. The scanner (color-guard.ts) knows
	// every CSS colour syntax — hex of any length, rgb(), oklch()/lab()/hsl()…, named colours — because
	// Tailwind/shadcn defaults ship oklch() and short hex that a #rrggbb regex never saw.
	// Both palettes ship: the dark one is the site's, the light one is what the light mode of every
	// theme resolves to. A colour in neither is still an offence.
	// Both palettes ship, plus the values the theme generator derives from them (a tint is two palette
	// colours mixed in OKLab — computed at generation time, so it reaches the CSS as a hex). Anything
	// else is still an offence; themes.test.ts proves each derived value is such a mix.
	// The derived values of both generators: the console package's mixes, and the business package's mixes and solved
	// plates (its themes.test.ts proves each business value is a palette colour, a mix, or a solved plate).
	const themeHexes = ["../../packages/bigface-business-ui/src/themes"].flatMap((dir) =>
		readdirSync(join(siteDir, dir), "utf8")
			.filter((f) => f.endsWith(".css"))
			.flatMap((f) =>
				[...readFileSync(join(siteDir, dir, f), "utf8").matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()),
			),
	);
	const known = new Set([
		...paletteHexes(palette),
		...paletteHexes(lightPaletteJson as unknown as Palette),
		...themeHexes,
	]);
	const htmlFiles = readdirSync(dist, {
		recursive: true,
		encoding: "utf8",
	}).filter((f) => f.endsWith("index.html"));
	expect(htmlFiles.length).toBeGreaterThanOrEqual(16);
	const offenders: string[] = [];
	for (const f of htmlFiles)
		for (const bad of findForeignInHtml(
			readFileSync(join(dist, f), "utf8"),
			known,
		))
			offenders.push(`${f}: ${bad}`);
	const cssFiles = readdirSync(join(dist, "_astro")).filter((f) =>
		f.endsWith(".css"),
	);
	for (const f of cssFiles) {
		const css = readFileSync(join(dist, "_astro", f), "utf8");
		for (const bad of findForeignInCss(css, known))
			offenders.push(`_astro/${f}: ${bad}`);
		// The ring-offset #fff default is only harmless while every ring-offset utility paints a
		// palette-mapped token (resizable.tsx ships ring-offset-background).
		expect(ringOffsetOffenders(css), f).toEqual([]);
	}
	expect(offenders).toEqual([]);
	// And the theme's own background really is the page background.
	expect(page("")).toContain("#252925");
});

test("the brand mark ships as a vector favicon, a touch icon and a 1200x630 social card", () => {
	const svg = readFileSync(join(dist, "favicon.svg"), "utf8");
	expect(svg).toContain("<svg");
	expect(svg).toContain('viewBox="0 0 512 512"');
	expect(svg).toContain("Bigface polar bear mark");

	for (const icon of ["favicon-32.png", "apple-touch-icon.png"]) {
		const buf = readFileSync(join(dist, icon));
		expect(buf.subarray(1, 4).toString(), icon).toBe("PNG");
	}

	const og = readFileSync(join(dist, "img/og.png"));
	expect(og.subarray(1, 4).toString()).toBe("PNG");
	expect(og.readUInt32BE(16)).toBe(1200);
	expect(og.readUInt32BE(20)).toBe(630);

	const home = page("");
	expect(home).toContain('rel="icon"');
	expect(home).toContain("img/bigface-avatar.svg");
	expect(home).toContain('property="og:image"');
	expect(home).toContain("img/og.png");
});

test("the business catalogue registers every component the theme package ships", () => {
	// Directory-driven: the page lists what the package's components/ui holds, so the catalogue
	// cannot fall behind the CLI. 63 = the registry's 64 (ui) items minus `form`, which ships no
	// files. The library is the theme package since the 2026-10-29 refactor.
	const html = page("ui/business");
	const files = readdirSync(
		join(siteDir, "../../packages/bigface-business-ui/src/components/ui"),
	).filter((f) => f.endsWith(".tsx"));
	expect(files.length).toBeGreaterThanOrEqual(63);
	for (const f of files) expect(html, f).toContain(`id="${f.replace(/\.tsx$/, "")}"`);
});

// The catalogue is an internal showcase, not a product page: no marketing chrome, noindex, and the
// home page never links to it. The legacy /ui/ workspace that carried the site header is retired.
test("the catalogue is unlisted and the home page does not link it", () => {
	const html = page("ui/business");
	expect(html, "site header").not.toContain('id="site-header"');
	expect(html, "site footer").not.toContain('aria-label="Footer"');
	expect(html, "noindex").toContain('name="robots" content="noindex"');

	const home = page("");
	expect(home, "home header").toContain('id="site-header"');
	expect(home, "home footer").toContain('aria-label="Footer"');
	expect(home, "no nav link to the catalogue").not.toContain('href="/ui/"');
});

test("app pages with a screenshot put it beside the instructions on desktop, stacked in DOM order", () => {
	for (const t of targets) {
		const html = page(`apps/${t.id}`);
		const wrapper = html.match(
			/<div data-layout="(split|stack)"(?: class="([^"]*)")?/,
		);
		expect(wrapper, t.id).not.toBeNull();
		const [, layout, cls = ""] = wrapper as RegExpMatchArray;
		if (!t.screenshot) {
			// no screenshot → no empty left column: the same order, no grid
			expect(layout, t.id).toBe("stack");
			expect(cls, t.id).not.toContain("lg:grid");
			continue;
		}
		expect(layout, t.id).toBe("split");
		// two columns only from lg (1024px), and the instructions column keeps at least 340px
		expect(cls, t.id).toContain("lg:grid");
		expect(cls, t.id).toContain(
			"lg:grid-cols-[minmax(340px,45fr)_minmax(0,55fr)]",
		);
		expect(cls, t.id).not.toMatch(/(^|\s)grid(\s|$)/);
		// desktop order is instructions on the left, media on the right (Jun picked E from the /ui/ mocks)
		// the class attribute wraps over lines in the built HTML, so read the text just before the slot
		const classesBefore = (slot: string) => {
			const at = html.indexOf(`data-split="${slot}"`);
			expect(at, `${t.id} ${slot}`).toBeGreaterThan(-1);
			return html.slice(Math.max(0, at - 400), at);
		};
		expect(classesBefore("media"), t.id).toContain("lg:order-2");
		expect(classesBefore("aside"), t.id).toContain("lg:order-1");
		// stacked order: media column (the screenshot and its caption) before install before download
		const start = html.indexOf('data-layout="split"');
		const media = html.indexOf('data-split="media"', start);
		const img = html.indexOf(`src="/${t.screenshot.file}"`, start);
		const caption = html.indexOf("<figcaption", start);
		const aside = html.indexOf('data-split="aside"', start);
		const install = html.indexOf('id="install"', start);
		const download = html.indexOf(">Download</h2>", start);
		expect(media, t.id).toBeGreaterThan(start);
		expect(
			[
				media < img,
				img < caption,
				caption < aside,
				aside < install,
				install < download,
			],
			t.id,
		).toEqual([true, true, true, true, true]);
	}
});

// QuBlack in the business showcase: three served Latin cuts of the pinned v1.2.0 release, each small, with url() sources
// only (no local() lookup, so the page never shows whichever QuBlack is installed on the reader's machine).
test("the business showcase serves QuBlack Sans and Mono from the site, as small Latin woff2 cuts, not from local()", () => {
	const files = ["QuBlackSans-Latin-VF.woff2", "QuBlackSans-Italic-Latin.woff2", "QuBlackMono-Latin-VF.woff2"];
	for (const f of files) {
		const path = join(siteDir, "public/fonts/qublack", f);
		expect(existsSync(path), f).toBe(true);
		expect(readFileSync(path).subarray(0, 4).toString("latin1"), f + " is woff2").toBe("wOF2");
		expect(readFileSync(path).length, f + " stays small").toBeLessThan(120_000);
	}
	const face = readFileSync(join(siteDir, "src/styles/qublack.css"), "utf8");
	expect(face.split("\n").filter((l) => l.trim().startsWith("src:") && l.includes("local(")), "no local() source").toEqual([]);
	expect(face.match(/font-display: swap/g)?.length, "swap on every face").toBe(3);
	expect(face).toContain('font-family: "QuBlack Sans"');
	expect(face).toContain('font-family: "QuBlack Mono"');
	expect(face).toContain("font-weight: 400 700");
	const biz = page("ui/business");
	expect(biz).toContain('href="/fonts/qublack/QuBlackSans-Latin-VF.woff2"');
	expect(biz, "no Google font in the showcase").not.toContain("fonts.googleapis");
});
