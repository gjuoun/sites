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

const failures: string[] = [];
const expect = (ok: boolean, message: string) => {
	if (!ok) failures.push(message);
};

let browser: Browser | undefined;
let consoleErrors = 0;
let routeCount = 0;
let toggleTrail = "";

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
	`smoke ok routes=${routeCount} toggle=${toggleTrail} console_errors=${consoleErrors}`,
);
