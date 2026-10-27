// Rendered-DOM smoke in the locally installed Chrome (puppeteer-core, no browser download).
// usage: bun run scripts/smoke.ts [url]   (no url: starts astro preview on 127.0.0.1:4321)
import { existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer, { type Browser } from "puppeteer-core";

const appRoot = join(import.meta.dir, "..");
const dist = join(appRoot, "dist");
const chromePath =
	process.env.CHROME_PATH ??
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const LIGHT_BODY = "rgb(47, 51, 47)";
const DARK_BODY = "rgb(232, 233, 225)";
const MODE_KEY = "bigface-mode";

if (!existsSync(chromePath)) {
	console.error(
		`smoke: Chrome not found at ${chromePath}; set CHROME_PATH to a real binary`,
	);
	process.exit(2);
}

async function routesFromDist(): Promise<string[]> {
	const routes: string[] = [];
	for await (const rel of new Bun.Glob("**/*.html").scan({ cwd: dist })) {
		routes.push(
			rel === "index.html"
				? "/"
				: rel.endsWith("/index.html")
					? `/${rel.slice(0, -"index.html".length)}`
					: `/${rel}`,
		);
	}
	return routes.sort();
}

async function waitForServer(base: string): Promise<void> {
	for (let i = 0; i < 100; i++) {
		try {
			const res = await fetch(base);
			if (res.ok) return;
		} catch {}
		await Bun.sleep(100);
	}
	throw new Error(`preview did not answer at ${base}`);
}

const argUrl = process.argv[2];
const base = argUrl ?? "http://127.0.0.1:4321";
const preview = argUrl
	? null
	: Bun.spawn(
			["bun", "x", "astro", "preview", "--host", "127.0.0.1", "--port", "4321"],
			{
				cwd: appRoot,
				stdout: "ignore",
				stderr: "ignore",
			},
		);

type Facts = {
	navLabels: string[];
	activeLabels: string[];
	activeBg: string;
	h1: string;
	headings: string[];
	footerNotes: number;
	starterInMain: number;
	lessonLists: string[][];
	lessonLinks: number;
	lessonNavLinks: number;
	buttonBgs: string[];
	entryDisplays: string[];
	entryDates: string[];
	headline: string;
	hrefs: string[];
	starterTags: number;
	placeholders: number;
	canonical: string;
	starterInHeadings: number;
	starterLabels: number;
	bullets: string[];
	metaGaps: number[];
};
type Geometry = {
	lists: {
		ordinals: number[];
		texts: number[];
		kickers: number[];
		titles: number[];
	}[];
	footerGap: number;
};
// Nav order is Home, then the page sections in the order the home page flows them.
const NAV_LABELS = ["Home", "Portfolio", "Resume", "Posts"];
const SECTIONS = ["Portfolio", "Resume", "Posts"];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
// Page bottom: the footer follows the last content at 3rem on every page.
const FOOTER_GAP = 48;
// Meta lines (home resume summary, resume contact) sit at least 1.5rem below the block above.
const META_GAP_MIN = 24;
const PAST_TENSE = /^(Built|Integrated|Applied) /;
const SECTION_NAV: Record<string, string> = {
	"/": "Home",
	"/projects/": "Portfolio",
	"/resume/": "Resume",
};
const FRAME_BG = "rgb(237, 237, 229)"; // --theme-frame, light mode
const PRIMARY_BG = "rgb(0, 176, 255)"; // --theme-primary, light mode
const DATE_RE =
	/^(?:[A-Z][a-z]{2}|\[Mon\]) \d{4} – (?:Present|(?:[A-Z][a-z]{2}|\[Mon\]) \d{4})$/;
const pad2 = (n: number) => String(n).padStart(2, "0");
const sequential = (xs: string[]) => xs.every((x, i) => x === pad2(i + 1));

// Read on first load, before any toggle: the DOM facts that contractFailures checks.
const readFacts = (): Facts => {
	const txt = (el: Element | null) => (el?.textContent ?? "").trim();
	const navLinks = [
		...document.querySelectorAll<HTMLAnchorElement>("header nav a"),
	];
	const active = navLinks.filter((a) => a.hasAttribute("aria-current"));
	return {
		navLabels: navLinks.map((a) => txt(a)),
		activeLabels: active.map((a) => txt(a)),
		activeBg: active[0] ? getComputedStyle(active[0]).backgroundColor : "",
		h1: txt(document.querySelector("main h1")),
		headings: [...document.querySelectorAll("main h2")].map((h) => txt(h)),
		footerNotes: document.querySelectorAll("footer .starter-note").length,
		starterInMain: document.querySelectorAll(
			"main .starter-note, main .starter",
		).length,
		lessonLists: [...document.querySelectorAll("main ol.lesson-list")].map(
			(ol) => [...ol.children].map((li) => txt(li.querySelector(".ordinal"))),
		),
		lessonLinks: document.querySelectorAll("main ol.lesson-list li a").length,
		lessonNavLinks: document.querySelectorAll("nav.lesson-nav a").length,
		buttonBgs: [...document.querySelectorAll("main a.button")].map(
			(a) => getComputedStyle(a).backgroundColor,
		),
		entryDisplays: [...document.querySelectorAll("li.entry")].map(
			(li) => getComputedStyle(li).display,
		),
		entryDates: [...document.querySelectorAll("time.entry-date")].map((t) =>
			txt(t),
		),
		headline: txt(document.querySelector("p.headline")),
		hrefs: [...document.querySelectorAll<HTMLAnchorElement>("main a")].map(
			(a) => a.href,
		),
		starterTags: document.querySelectorAll("main .starter-tag").length,
		placeholders: document.querySelectorAll("main .placeholder").length,
		canonical:
			document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
			"",
		starterInHeadings: document.querySelectorAll("main h3 .starter-tag").length,
		starterLabels: document.querySelectorAll("main .starter-label").length,
		bullets: [...document.querySelectorAll("main ul.bullets > li")].map((li) =>
			txt(li),
		),
		metaGaps: [
			...document.querySelectorAll<HTMLElement>(
				"main .meta-line, main .contact",
			),
		].map((el) => {
			const prev = el.previousElementSibling;
			return prev
				? Math.round(
						el.getBoundingClientRect().top -
							prev.getBoundingClientRect().bottom,
					)
				: -1;
		}),
	};
};

// The content contract: one line per violated expectation, prefixed with the route.
function contractFailures(route: string, f: Facts): string[] {
	const out: string[] = [];
	const bad = (msg: string) => out.push(`${route} ${msg}`);
	if (f.navLabels.join("|") !== NAV_LABELS.join("|"))
		bad(`nav labels ${f.navLabels.join("|")}`);
	const navSections = f.navLabels.filter((l) => SECTIONS.includes(l));
	if (navSections.join("|") !== SECTIONS.join("|"))
		bad(
			`nav section order ${navSections.join("|")}, want ${SECTIONS.join("|")}`,
		);
	if (f.starterInMain !== 0)
		bad(`starter copy inside main: ${f.starterInMain}`);
	const wantNav = route.startsWith("/posts/") ? "Posts" : SECTION_NAV[route];
	if (wantNav) {
		if (f.activeLabels.join("|") !== wantNav)
			bad(`active nav ${f.activeLabels.join("|") || "none"}, want ${wantNav}`);
		if (f.activeBg !== FRAME_BG)
			bad(`active nav background ${f.activeBg}, want ${FRAME_BG}`);
	} else if (f.activeLabels.length !== 0) {
		bad("active nav on a page with no section");
	}
	const wantNote = route === "/resume/" || route === "/404.html" ? 0 : 1;
	if (f.footerNotes !== wantNote)
		bad(`footer starter note ${f.footerNotes}, want ${wantNote}`);
	const lists = f.lessonLists;
	if (route === "/") {
		if (f.headings.join("|") !== "Portfolio|Resume|Posts")
			bad(`home sections ${f.headings.join("|")}`);
		if (f.metaGaps.length !== 1 || f.metaGaps[0] < META_GAP_MIN)
			bad(
				`home meta line gap ${JSON.stringify(f.metaGaps)}, want >= ${META_GAP_MIN}`,
			);
		if (!lists.some((l) => l.length >= 3 && sequential(l)))
			bad("home has no numbered lesson list with 3+ ordinals");
	}
	if (route === "/posts/" || route === "/posts/effect-one-function/") {
		if (lists.length !== 1 || lists[0].length !== 6 || !sequential(lists[0]))
			bad(`lesson list ${JSON.stringify(lists)}, want one list 01..06`);
		if (f.lessonLinks !== 6) bad(`lesson links ${f.lessonLinks}, want 6`);
	}
	if (
		route.startsWith("/posts/") &&
		route !== "/posts/" &&
		f.lessonNavLinks < 1
	)
		bad("lesson navigation missing");
	if (route === "/projects/") {
		if (f.h1 !== "Portfolio") bad(`projects h1 is ${f.h1}, want Portfolio`);
		if (f.buttonBgs.filter((b) => b === PRIMARY_BG).length < 3)
			bad(`visit buttons not on theme primary: ${JSON.stringify(f.buttonBgs)}`);
	}
	if (route === "/resume/") {
		if (
			f.entryDisplays.length !== 5 ||
			f.entryDisplays.some((d) => d !== "grid")
		)
			bad(`resume entries not grid: ${JSON.stringify(f.entryDisplays)}`);
		if (
			f.entryDates.length !== 5 ||
			!f.entryDates.every((d) => DATE_RE.test(d))
		)
			bad(`resume dates: ${JSON.stringify(f.entryDates)}`);
		if (f.headline.includes("Mistplay"))
			bad(`headline repeats Mistplay: ${f.headline}`);
		if (!f.hrefs.includes("https://github.com/gjuoun"))
			bad("contact line lacks GitHub");
		const origin = f.canonical ? new URL("/", f.canonical).href : "";
		if (!origin || !f.hrefs.includes(origin))
			bad(`contact line lacks the canonical site URL ${origin}`);
		if (f.starterTags !== 2 || f.starterInHeadings !== 2)
			bad(
				`want one starter tag per role with bullets, got ${f.starterTags} (in headings ${f.starterInHeadings})`,
			);
		if (f.starterLabels !== 0) bad("inline starter label still present");
		const real = f.bullets.filter((b) => !b.startsWith("["));
		if (real.length < 3 || !real.every((b) => PAST_TENSE.test(b)))
			bad(
				`resume bullets are not past-tense action phrases: ${JSON.stringify(f.bullets)}`,
			);
		if (f.metaGaps.length !== 1 || f.metaGaps[0] < META_GAP_MIN)
			bad(
				`contact line gap ${JSON.stringify(f.metaGaps)}, want >= ${META_GAP_MIN}`,
			);
		if (f.placeholders < 2)
			bad(`missing facts not marked as placeholders: ${f.placeholders}`);
	}
	return out;
}

// Geometry at one viewport: lesson rows (ordinal, label, title) and the footer distance from the last content.
const readGeometry = (): Geometry => {
	const x = (els: Element[]) =>
		els.map((el) => Math.round(el.getBoundingClientRect().left * 10) / 10);
	const lists = [
		...document.querySelectorAll<HTMLElement>("main ol.lesson-list"),
	].map((ol) => ({
		ordinals: x([...ol.querySelectorAll(":scope > li > .ordinal")]),
		texts: x([...ol.querySelectorAll(":scope > li > div")]),
		kickers: x([...ol.querySelectorAll(".kicker")]),
		titles: x([...ol.querySelectorAll(":scope > li > div > a")]),
	}));
	const main = document.querySelector("main");
	const footer = document.querySelector("footer");
	const bottoms = [...(main?.children ?? [])].map(
		(c) => c.getBoundingClientRect().bottom,
	);
	const footerGap =
		footer && bottoms.length > 0
			? Math.round(footer.getBoundingClientRect().top - Math.max(...bottoms))
			: -1;
	return { lists, footerGap };
};

// Every numbered list on a page shares one ordinal x; labels and titles share one x, the text column.
function geometryFailures(route: string, width: number, g: Geometry): string[] {
	const out: string[] = [];
	const bad = (msg: string) => out.push(`${route} @${width} ${msg}`);
	const ordinals = new Set(g.lists.flatMap((l) => l.ordinals));
	if (ordinals.size > 1)
		bad(`ordinal left edges differ: ${[...ordinals].join(",")}`);
	for (const list of g.lists) {
		const text = new Set([...list.texts, ...list.kickers, ...list.titles]);
		if (text.size > 1)
			bad(`label/title left edges differ: ${[...text].join(",")}`);
	}
	if (Math.abs(g.footerGap - FOOTER_GAP) > 1)
		bad(`footer ${g.footerGap}px below the last content, want ${FOOTER_GAP}`);
	return out;
}

const failures: string[] = [];
const expect = (ok: boolean, message: string) => {
	if (!ok) failures.push(message);
};

let browser: Browser | undefined;
let consoleErrors = 0;
let routeCount = 0;
let toggleTrail = "";
const lessonCounts: string[] = [];

try {
	await waitForServer(base);
	browser = await puppeteer.launch({
		executablePath: chromePath,
		headless: true,
		args: ["--no-sandbox", "--disable-dev-shm-usage"],
	});

	for (const route of await routesFromDist()) {
		routeCount++;
		const context = await browser.createBrowserContext();
		const page = await context.newPage();
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				consoleErrors++;
				failures.push(`console error on ${route}: ${msg.text()}`);
			}
		});
		page.on("pageerror", (err: unknown) => {
			consoleErrors++;
			failures.push(
				`page error on ${route}: ${err instanceof Error ? err.message : String(err)}`,
			);
		});
		await page.setViewport(DESKTOP);
		const response = await page.goto(new URL(route, base).href, {
			waitUntil: "load",
		});
		expect(response?.status() === 200, `${route} status ${response?.status()}`);

		const shape = await page.evaluate(() => {
			const first = document.querySelector<HTMLElement>(
				'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			return {
				mains: document.querySelectorAll("main#main").length,
				firstIsSkip: first?.getAttribute("href") === "#main",
				lang: document.documentElement.lang,
				theme: document.documentElement.dataset.theme,
				mode: document.documentElement.dataset.mode,
				body: getComputedStyle(document.body).color,
			};
		});
		expect(shape.mains === 1, `${route} main#main count ${shape.mains}`);
		expect(shape.firstIsSkip, `${route} first focusable is not the skip link`);
		expect(shape.lang === "en", `${route} html lang ${shape.lang}`);
		expect(
			shape.theme === "business" && shape.mode === "light",
			`${route} theme/mode ${shape.theme}/${shape.mode} on first load`,
		);
		expect(
			shape.body === LIGHT_BODY,
			`${route} light body colour ${shape.body}`,
		);

		const facts = await page.evaluate(readFacts);
		failures.push(...contractFailures(route, facts));
		failures.push(
			...geometryFailures(
				route,
				DESKTOP.width,
				await page.evaluate(readGeometry),
			),
		);
		if (route === "/" || route === "/posts/")
			lessonCounts.push(
				`${route}=${facts.lessonLists.map((l) => l.length).join("+")}`,
			);
		if (route === "/") {
			await page.click("#theme-toggle");
			const dark = await page.evaluate(
				(key) => ({
					mode: document.documentElement.dataset.mode,
					stored: localStorage.getItem(key),
					body: getComputedStyle(document.body).color,
				}),
				MODE_KEY,
			);
			expect(
				dark.mode === "dark" && dark.stored === "dark",
				`toggle to dark: mode ${dark.mode} stored ${dark.stored}`,
			);
			expect(dark.body === DARK_BODY, `dark body colour ${dark.body}`);
			await page.reload({ waitUntil: "load" });
			const kept = await page.evaluate(
				() => document.documentElement.dataset.mode,
			);
			expect(kept === "dark", `dark not kept after reload: ${kept}`);
			await page.click("#theme-toggle");
			const back = await page.evaluate(
				(key) => ({
					mode: document.documentElement.dataset.mode,
					stored: localStorage.getItem(key),
				}),
				MODE_KEY,
			);
			expect(
				back.mode === "light" && back.stored === "light",
				`toggle back to light: ${back.mode} / ${back.stored}`,
			);
			toggleTrail = "light>dark>light";
		}
		// The mobile layout: same nav order, same geometry.
		await page.setViewport(MOBILE);
		await Bun.sleep(100);
		const mobileNav = (await page.evaluate(readFacts)).navLabels;
		if (mobileNav.join("|") !== NAV_LABELS.join("|"))
			failures.push(
				`${route} @${MOBILE.width} nav order ${mobileNav.join("|")}`,
			);
		failures.push(
			...geometryFailures(
				route,
				MOBILE.width,
				await page.evaluate(readGeometry),
			),
		);
		await context.close();
	}
} finally {
	await browser?.close();
	preview?.kill();
}

if (failures.length > 0) {
	for (const line of failures) console.error(`FAIL  ${line}`);
	console.error(
		`smoke failed routes=${routeCount} console_errors=${consoleErrors}`,
	);
	process.exit(1);
}
console.log(
	`smoke ok routes=${routeCount} toggle=${toggleTrail} console_errors=${consoleErrors} lessons ${lessonCounts.join(" ")}`,
);
