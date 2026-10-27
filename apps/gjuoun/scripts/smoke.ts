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
};
const NAV_LABELS = ["Home", "Portfolio", "Posts", "Resume"];
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
	};
};

// The content contract: one line per violated expectation, prefixed with the route.
function contractFailures(route: string, f: Facts): string[] {
	const out: string[] = [];
	const bad = (msg: string) => out.push(`${route} ${msg}`);
	if (f.navLabels.join("|") !== NAV_LABELS.join("|"))
		bad(`nav labels ${f.navLabels.join("|")}`);
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
		if (!f.hrefs.includes("https://jun.qqntt.com/"))
			bad("contact line lacks site URL");
		if (f.starterTags < 2) bad(`starter bullets not marked: ${f.starterTags}`);
		if (f.placeholders < 2)
			bad(`missing facts not marked as placeholders: ${f.placeholders}`);
	}
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
