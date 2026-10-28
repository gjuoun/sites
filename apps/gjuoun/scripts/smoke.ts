// Rendered-DOM smoke in the locally installed Chrome (puppeteer-core, no browser download).
// usage: bun run scripts/smoke.ts [url]   (no url: starts astro preview on 127.0.0.1:4321)
// The built output is also scanned for the phone number, which the public site never carries.
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

// The phone number in any form: separators, a country code, or none. It must not appear in the built output.
const PHONE_RE = /263\D{0,3}688\D{0,3}5574/;
async function phoneFailures(): Promise<string[]> {
	const out: string[] = [];
	let files = 0;
	for await (const rel of new Bun.Glob("**/*").scan({ cwd: dist })) {
		if (!/\.(?:html|xml|txt|css|js|json|svg)$/.test(rel)) continue;
		files++;
		if (PHONE_RE.test(await Bun.file(join(dist, rel)).text()))
			out.push(`${rel} contains the phone number`);
	}
	if (files === 0) out.push("no text files in dist to scan");
	return out;
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

interface ResumeFacts {
	headline: string;
	contact: string;
	entries: string[];
	skills: string;
}

type Facts = {
	navLabels: string[];
	activeLabels: string[];
	activeBg: string;
	h1: string;
	headings: string[];
	footerNotes: number;
	starterInMain: number;
	starterTags: number;
	lessonLists: string[][];
	lessonLinks: number;
	lessonNavLinks: number;
	buttonBgs: string[];
	cardCount: number;
	entryDisplays: string[];
	entryDates: string[];
	entryHeadings: string[];
	bulletCount: number;
	headline: string;
	contactHrefs: string[];
	contactText: string;
	bracketInMain: boolean;
	skillsText: string;
	resumeFacts: ResumeFacts;
	summaryLength: number;
	hasFullResumeLink: boolean;
	introParagraphs: number;
	introLength: number;
	introIndexLinks: string[];
	canonical: string;
	metaGaps: number[];
};
type Card = {
	top: number;
	left: number;
	height: number;
	bottom: number;
	footerBottom: number;
};
type Geometry = {
	lists: {
		ordinals: number[];
		texts: number[];
		kickers: number[];
		titles: number[];
	}[];
	footerGap: number;
	cards: Card[];
	gridDisplay: string;
	gridTracks: number;
};
// Nav order is Home, then the page sections in the order the home page flows them.
// The nav order follows the home page's own flow: Portfolio, then the lessons, then the resume.
const NAV_LABELS = ["Home", "Portfolio", "Posts", "Resume"];
const SECTIONS = ["Portfolio", "Posts", "Resume"];
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };
// Page bottom: the footer follows the last content at 3rem on every page.
const FOOTER_GAP = 48;
// The contact line sits at least 1.5rem below the headline above it.
const META_GAP_MIN = 24;
// The tailwind md breakpoint: two card columns at and above it, one below.
const GRID_MD = 768;
const PORTFOLIO_COUNT = 4;
// The resume's facts, in reverse-chronological order. Mistplay keeps both of its roles, newest first.
const EXPECT_ENTRIES = [
	"Senior Developer II, Mistplay",
	"Lead Software Developer, Mistplay",
	"Senior Developer, Curbie Cars",
	"Full-stack Developer, Affinio",
	"Software Engineer, IBM",
	"Dalhousie University",
];
const EXPECT_DATES = [
	"Aug 2024 – Present",
	"Feb 2024 – Aug 2024",
	"May 2021 – Feb 2022",
	"Jul 2020 – May 2021",
	"Jun 2019 – Oct 2019",
	"2014 – 2019",
];
const SECTION_NAV: Record<string, string> = {
	"/": "Home",
	"/projects/": "Portfolio",
	"/resume/": "Resume",
};
const FRAME_BG = "rgb(237, 237, 229)"; // --theme-frame, light mode
const PRIMARY_BG = "rgb(0, 176, 255)"; // --theme-primary, light mode
const pad2 = (n: number) => String(n).padStart(2, "0");
const sequential = (xs: string[]) => xs.every((x, i) => x === pad2(i + 1));

// Read on first load, before any toggle: the DOM facts that contractFailures checks.
const readFacts = (): Facts => {
	const txt = (el: Element | null) => (el?.textContent ?? "").trim();
	const main = document.querySelector<HTMLElement>("main");
	const navLinks = [
		...document.querySelectorAll<HTMLAnchorElement>("header nav a"),
	];
	const active = navLinks.filter((a) => a.hasAttribute("aria-current"));
	const skillsHeading = [...(main?.querySelectorAll("h2, h3") ?? [])].find(
		(h) => txt(h) === "Skills",
	);
	const contact = main?.querySelector(".contact");
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
		starterTags: document.querySelectorAll("main .starter-tag").length,
		lessonLists: [...document.querySelectorAll("main ol.lesson-list")].map(
			(ol) => [...ol.children].map((li) => txt(li.querySelector(".ordinal"))),
		),
		lessonLinks: document.querySelectorAll("main ol.lesson-list li a").length,
		lessonNavLinks: document.querySelectorAll("nav.lesson-nav a").length,
		buttonBgs: [...document.querySelectorAll("main [data-slot='button']")].map(
			(a) => getComputedStyle(a).backgroundColor,
		),
		cardCount: document.querySelectorAll("main [data-slot='card']").length,
		entryDisplays: [...document.querySelectorAll("main li.entry")].map(
			(li) => getComputedStyle(li).display,
		),
		entryDates: [...document.querySelectorAll("main time.entry-date")].map(
			(t) => txt(t),
		),
		entryHeadings: [...document.querySelectorAll("main li.entry")].map((li) =>
			txt(li.querySelector("h3, h4")),
		),
		bulletCount: document.querySelectorAll("main ul.bullets > li").length,
		headline: txt(document.querySelector("main p.headline")),
		contactHrefs: [...(contact?.querySelectorAll("a") ?? [])].map(
			(a) => a.getAttribute("href") ?? "",
		),
		contactText: txt(contact ?? null),
		bracketInMain: /\[/.test(main?.textContent ?? ""),
		skillsText: txt(skillsHeading?.nextElementSibling ?? null),
		summaryLength: txt(
			document.querySelector("main p.headline")?.nextElementSibling
				?.nextElementSibling ?? null,
		).length,
		hasFullResumeLink: [...document.querySelectorAll("main a")].some(
			(a) => (a.getAttribute("href") ?? "") === "/resume/",
		),
		introParagraphs: document.querySelectorAll("main .intro p").length,
		introLength: (
			document.querySelector("main .intro")?.textContent ?? ""
		).trim().length,
		introIndexLinks: [...document.querySelectorAll("main .intro-index a")].map(
			(a) => a.getAttribute("href") ?? "",
		),
		// Everything the resume says, as text: the home page and /resume/ must carry the same facts.
		resumeFacts: {
			headline: txt(document.querySelector("main p.headline")),
			contact: txt(contact ?? null),
			entries: [...document.querySelectorAll("main li.entry")].map((li) =>
				txt(li),
			),
			skills: txt(skillsHeading?.nextElementSibling ?? null),
		},
		canonical:
			document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
			"",
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
		if (f.headings.join("|") !== "Introduction|Portfolio|Posts")
			bad(`home sections ${f.headings.join("|")}`);
		// The contact line lives on /resume/ now, so the home page has no meta gap to measure.
		if (f.metaGaps.length !== 0)
			bad(`home still has a resume meta line: ${JSON.stringify(f.metaGaps)}`);
		if (!lists.some((l) => l.length >= 3 && sequential(l)))
			bad("home has no numbered lesson list with 3+ ordinals");
	}
	if (route === "/") {
		// The home page opens with an introduction and carries no resume of its own: the resume lives on /resume/.
		if (f.entryHeadings.length !== 0)
			bad(`home shows resume entries: ${f.entryHeadings.join(" | ")}`);
		if (f.headline !== "")
			bad(`home still shows a resume headline: ${f.headline}`);
		// One paragraph, on purpose: the intro states who he is and what the site holds, and stops.
		if (f.introParagraphs !== 1)
			bad(`home intro paragraphs ${f.introParagraphs}, want exactly 1`);
		if (f.introLength < 200)
			bad(`home intro too short: ${f.introLength} chars`);
		if (
			!f.introIndexLinks.includes("/posts/") ||
			!f.introIndexLinks.includes("/resume/")
		)
			bad(`home intro index links ${f.introIndexLinks.join("|")}`);
	}
	if (route === "/resume/") {
		// All four employers and all five positions, with their dates, in order.
		if (f.entryHeadings.join("|") !== EXPECT_ENTRIES.join("|"))
			bad(`resume entries ${f.entryHeadings.join(" | ")}`);
		if (f.entryDates.join("|") !== EXPECT_DATES.join("|"))
			bad(`resume dates ${f.entryDates.join(" | ")}`);
		if (
			f.entryDisplays.length !== 6 ||
			f.entryDisplays.some((d) => d !== "grid")
		)
			bad(`resume entries not grid: ${JSON.stringify(f.entryDisplays)}`);
		if (f.bulletCount !== 14) bad(`resume bullets ${f.bulletCount}, want 14`);
		if (f.headline !== "Senior Software Engineer")
			bad(`headline is ${f.headline}`);
		for (const want of [
			"mailto:gjuoun@gmail.com",
			"https://github.com/gjuoun",
			"https://linkedin.com/in/gjuoun",
		])
			if (!f.contactHrefs.includes(want)) bad(`contact line lacks ${want}`);
		if (!f.contactText.includes("Montreal, Canada"))
			bad("contact line lacks Montreal, Canada");
		if (f.metaGaps.length !== 1 || f.metaGaps[0] < META_GAP_MIN)
			bad(
				`contact line gap ${JSON.stringify(f.metaGaps)}, want >= ${META_GAP_MIN}`,
			);
		if (!f.skillsText.includes("React") || !f.skillsText.includes("Db2"))
			bad(`skills line ${f.skillsText}`);
		if (f.starterTags !== 0)
			bad(`starter tags on the resume: ${f.starterTags}`);
	}
	if (route === "/" || route === "/projects/") {
		if (f.cardCount !== PORTFOLIO_COUNT)
			bad(`portfolio cards ${f.cardCount}, want ${PORTFOLIO_COUNT}`);
		if (f.buttonBgs.filter((b) => b === PRIMARY_BG).length < 3)
			bad(`visit buttons not on theme primary: ${JSON.stringify(f.buttonBgs)}`);
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
	}
	if (route === "/" || route === "/resume/" || route === "/projects/") {
		if (f.bracketInMain) bad("bracketed placeholder text in main");
	}
	return out;
}

// Geometry at one viewport: lesson rows, the footer distance, and the portfolio card grid.
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
	const cardEls = [
		...document.querySelectorAll<HTMLElement>("main [data-slot='card']"),
	];
	const grid = cardEls[0]?.parentElement?.parentElement;
	const cards = cardEls.map((card) => {
		const r = card.getBoundingClientRect();
		const footerEl = card.querySelector<HTMLElement>(
			"[data-slot='card-footer']",
		);
		return {
			top: Math.round(r.top),
			left: Math.round(r.left),
			height: Math.round(r.height * 10) / 10,
			bottom: r.bottom,
			footerBottom: footerEl ? footerEl.getBoundingClientRect().bottom : -1,
		};
	});
	const gridStyle = grid ? getComputedStyle(grid) : null;
	return {
		lists,
		footerGap,
		cards,
		gridDisplay: gridStyle?.display ?? "",
		gridTracks: gridStyle
			? gridStyle.gridTemplateColumns.split(" ").filter(Boolean).length
			: 0,
	};
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
	if (route === "/" || route === "/projects/") {
		const wantTracks = width >= GRID_MD ? 2 : 1;
		if (g.cards.length !== PORTFOLIO_COUNT)
			bad(`card grid holds ${g.cards.length} cards, want ${PORTFOLIO_COUNT}`);
		if (g.gridDisplay !== "grid")
			bad(`card container display ${g.gridDisplay}, want grid`);
		if (g.gridTracks !== wantTracks)
			bad(`card grid has ${g.gridTracks} columns, want ${wantTracks}`);
		const rows = new Map<number, Card[]>();
		for (const c of g.cards) rows.set(c.top, [...(rows.get(c.top) ?? []), c]);
		for (const row of rows.values()) {
			const heights = row.map((c) => c.height);
			if (Math.max(...heights) - Math.min(...heights) > 1)
				bad(`card row heights differ: ${heights.join(",")}`);
		}
		for (const c of g.cards)
			if (Math.abs(c.footerBottom - c.bottom) > 1)
				bad(
					`card actions not pinned to the bottom (${(c.bottom - c.footerBottom).toFixed(1)}px)`,
				);
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
let focusTrail = "";
let motionTrail = "";
const lessonCounts: string[] = [];
const resumeSnapshots = new Map<string, ResumeFacts>();

try {
	failures.push(...(await phoneFailures()));
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
		if (route === "/" || route === "/resume/")
			resumeSnapshots.set(route, facts.resumeFacts);
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
		if (route === "/projects/") {
			// Keyboard: Tab to the first Visit link; its focus ring must be a visible solid outline.
			let onVisit = false;
			for (let i = 0; i < 40 && !onVisit; i++) {
				await page.keyboard.press("Tab");
				onVisit = await page.evaluate(
					() =>
						document.activeElement?.getAttribute("data-slot") === "button" &&
						document.activeElement?.textContent === "Visit",
				);
			}
			const ring = await page.evaluate(() => {
				const el = document.activeElement as HTMLElement | null;
				if (!el) return null;
				const cs = getComputedStyle(el);
				return {
					focusVisible: el.matches(":focus-visible"),
					outline: cs.outlineStyle,
					outlineWidth: parseFloat(cs.outlineWidth),
					boxShadow: cs.boxShadow,
				};
			});
			expect(onVisit, `${route} could not Tab to a Visit link`);
			expect(
				ring?.focusVisible === true &&
					ring.outline === "solid" &&
					ring.outlineWidth >= 2,
				`${route} Visit link focus ring not visible: ${JSON.stringify(ring)}`,
			);
			focusTrail = ring
				? `focus=${ring.outline}/${ring.outlineWidth}px`
				: "focus=none";
			// Reduced motion: the stock button's transition is off.
			await page.emulateMediaFeatures([
				{ name: "prefers-reduced-motion", value: "reduce" },
			]);
			const duration = await page.evaluate(
				() =>
					getComputedStyle(
						document.querySelector("main [data-slot='button']") as Element,
					).transitionDuration,
			);
			expect(
				parseFloat(duration) === 0,
				`${route} button transition under reduced motion: ${duration}`,
			);
			motionTrail = `motion=${duration}`;
			await page.emulateMediaFeatures([
				{ name: "prefers-reduced-motion", value: "no-preference" },
			]);
		}
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
		// The toggle is a control, not a banner: compact, and sharing the nav's row.
		const head = await page.evaluate(() => {
			const r = (el: Element | null) =>
				el ? el.getBoundingClientRect() : null;
			const t = r(document.querySelector("#theme-toggle"));
			const n = r(document.querySelector(".site-header nav"));
			const h = r(document.querySelector(".site-header"));
			return t && n && h
				? {
						tw: Math.round(t.width),
						th: Math.round(t.height),
						drift: Math.round(Math.abs(t.top - n.top)),
						hh: Math.round(h.height),
						tsize: Number.parseFloat(
							getComputedStyle(
								document.querySelector("#theme-toggle") as Element,
							).fontSize,
						),
					}
				: null;
		});
		if (!head) failures.push(`${route} @${MOBILE.width} header not measurable`);
		else {
			if (head.tw > 96)
				failures.push(`${route} @${MOBILE.width} toggle width ${head.tw} > 96`);
			if (head.th > 32)
				failures.push(
					`${route} @${MOBILE.width} toggle height ${head.th} > 32`,
				);
			if (head.drift > 8)
				failures.push(
					`${route} @${MOBILE.width} toggle drops below the nav row by ${head.drift}px`,
				);
			if (head.hh > 64)
				failures.push(
					`${route} @${MOBILE.width} header height ${head.hh} > 64`,
				);
			if (head.tsize > 14)
				failures.push(
					`${route} @${MOBILE.width} toggle font ${head.tsize}px > 14px`,
				);
		}
		failures.push(
			...geometryFailures(
				route,
				MOBILE.width,
				await page.evaluate(readGeometry),
			),
		);
		await context.close();
	}
	// The resume lives on /resume/ only: the home page must not repeat any of its history.
	const home = resumeSnapshots.get("/") as ResumeFacts | undefined;
	const resume = resumeSnapshots.get("/resume/");
	expect(
		home !== undefined && resume !== undefined,
		"resume facts missing on / or /resume/",
	);
	expect(
		home!.entries.length === 0 && home!.headline === "",
		`home repeats resume facts: ${JSON.stringify(home)}`,
	);
	expect(
		resume!.headline === "Senior Software Engineer" &&
			resume!.entries.length === 6,
		`/resume/ is not the full page: ${resume!.headline} / ${resume!.entries.length} entries`,
	);
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
	`smoke ok routes=${routeCount} toggle=${toggleTrail} ${focusTrail} ${motionTrail} console_errors=${consoleErrors} lessons ${lessonCounts.join(" ")} cards=${PORTFOLIO_COUNT}x2 phone=absent`,
);
