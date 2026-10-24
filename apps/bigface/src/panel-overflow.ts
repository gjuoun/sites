// Real layout measurement for the theme panels: serve the built site, drive a headless Chrome over
// CDP, and report every element that paints outside the panel it lives in.
//
// Why not a DOM library: happy-dom and jsdom have no layout engine, so getBoundingClientRect() is a
// zero rectangle there and an overflow assertion against it would pass on any markup. This runs the
// page the browser runs and reads real boxes.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface Overflow {
	theme: string;
	mode: string;
	tag: string;
	slot: string;
	className: string;
	left: number;
	right: number;
	top: number;
	bottom: number;
}

/** What one panel's demo card measures - the feel, as numbers. */
export interface PanelMetrics {
	theme: string;
	mode: string;
	cardHeight: number;
	cardPadding: number;
	cardRadius: string;
	titleSize: string;
	space: string;
	radius: string;
	duration: string;
	ease: string;
	hover: string;
	press: string;
	weight: string;
	/** Controls, as computed pixels: the theme radius has to reach these, not just the card. */
	claimRadius: number;
	claimHeight: number;
	badgeRadius: number;
	badgeHeight: number;
	chipRadius: number;
}

export interface Measurement {
	path: string;
	panels: number;
	offenders: Overflow[];
	/** Panels whose own content is wider than the box (scrollWidth > clientWidth). */
	clipped: {
		theme: string;
		mode: string;
		scrollWidth: number;
		clientWidth: number;
	}[];
	metrics: PanelMetrics[];
}

const CHROME_CANDIDATES = [
	process.env.CHROME_PATH,
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/Applications/Chromium.app/Contents/MacOS/Chromium",
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
];

/** A debugging port the OS has just confirmed free. A fixed or random range can answer from a stale listener. */
export async function freePort(): Promise<number> {
	const probe = Bun.serve({ port: 0, fetch: () => new Response("") });
	const port = probe.port;
	probe.stop(true);
	if (port === undefined) throw new Error("no free port for headless Chrome");
	return port;
}

export const findChrome = (): string | undefined =>
	CHROME_CANDIDATES.find((p) => p && existsSync(p));

/** The in-page script: compare every descendant box with its panel's box, in CSS pixels. */
const PROBE = `(() => {
  const panels = [...document.querySelectorAll('[data-slot="theme-scope"]')];
  const offenders = [];
  const clipped = [];
  for (const panel of panels) {
    const pr = panel.getBoundingClientRect();
    const at = { theme: panel.dataset.theme || "", mode: panel.dataset.mode || "" };
    if (panel.scrollWidth > panel.clientWidth + 1) {
      clipped.push({ ...at, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth });
    }
    for (const el of panel.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const over = {
        left: +(pr.left - r.left).toFixed(1),
        right: +(r.right - pr.right).toFixed(1),
        top: +(pr.top - r.top).toFixed(1),
        bottom: +(r.bottom - pr.bottom).toFixed(1),
      };
      if (Math.max(over.left, over.right, over.top, over.bottom) <= 0.5) continue;
      offenders.push({
        ...at,
        tag: el.tagName.toLowerCase(),
        slot: el.getAttribute("data-slot") || "",
        className: String(el.className).slice(0, 80),
        ...over,
      });
    }
  }
  const px = (panel, match, which, selector) => {
    const el = selector
      ? panel.querySelector(selector)
      : [...panel.querySelectorAll("button")].find((b) => match(b));
    if (!el) return 0;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return which === "radius"
      ? Math.round(Number.parseFloat(cs.borderTopLeftRadius))
      : Math.round(r.height);
  };
  const metrics = panels.map((panel) => {
    const card = panel.querySelector('[data-slot="card"]');
    const title = panel.querySelector('[data-slot="card-title"]');
    const cs = card ? getComputedStyle(card) : undefined;
    const ps = getComputedStyle(panel);
    return {
      theme: panel.dataset.theme || "",
      mode: panel.dataset.mode || "",
      cardHeight: card ? Math.round(card.getBoundingClientRect().height) : 0,
      cardPadding: cs ? Math.round(Number.parseFloat(cs.paddingTop)) : 0,
      cardRadius: cs ? cs.borderRadius : "",
      titleSize: title ? getComputedStyle(title).fontSize : "",
      space: ps.getPropertyValue("--theme-space").trim(),
      radius: ps.getPropertyValue("--theme-radius").trim(),
      duration: ps.getPropertyValue("--theme-duration").trim(),
      ease: ps.getPropertyValue("--theme-ease").trim(),
      hover: ps.getPropertyValue("--theme-hover").trim(),
      press: ps.getPropertyValue("--theme-press").trim(),
      weight: ps.getPropertyValue("--theme-weight").trim(),
      claimRadius: px(panel, (b) => ["Claim", "Get started"].includes(b.textContent?.trim() ?? ""), "radius"),
      claimHeight: px(panel, (b) => ["Claim", "Get started"].includes(b.textContent?.trim() ?? ""), "height"),
      badgeRadius: px(panel, null, "radius", "[data-slot=badge]"),
      badgeHeight: px(panel, null, "height", "[data-slot=badge]"),
      chipRadius: px(panel, null, "radius", "[data-slot=card] span"),
    };
  });
  return { panels: panels.length, offenders, clipped, metrics };
})()`;

type Cdp = {
	send: (method: string, params?: unknown) => Promise<unknown>;
	close: () => void;
};

const connect = (url: string): Promise<Cdp> =>
	new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		let id = 0;
		const pending = new Map<
			number,
			{ resolve: (v: unknown) => void; reject: (e: Error) => void }
		>();
		ws.addEventListener("message", (event) => {
			const msg = JSON.parse(String(event.data)) as {
				id?: number;
				result?: unknown;
				error?: { message: string };
			};
			if (msg.id === undefined) return;
			const slot = pending.get(msg.id);
			if (!slot) return;
			pending.delete(msg.id);
			if (msg.error) slot.reject(new Error(msg.error.message));
			else slot.resolve(msg.result);
		});
		ws.addEventListener("error", () => reject(new Error("cdp socket error")));
		ws.addEventListener("open", () =>
			resolve({
				send: (method, params) =>
					new Promise((res, rej) => {
						const n = ++id;
						pending.set(n, { resolve: res, reject: rej });
						ws.send(JSON.stringify({ id: n, method, params }));
					}),
				close: () => ws.close(),
			}),
		);
	});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Measure one built page. path is the URL path ("/ui/console/"); distDir is served at the root, the way
 * the static deploy serves it. Throws when no Chrome is installed.
 */
async function runProbe<T>(
	distDir: string,
	path: string,
	width: number,
	expression: string,
): Promise<T> {
	const chrome = findChrome();
	if (!chrome)
		throw new Error(
			"no Chrome found - set CHROME_PATH to run the layout measurement",
		);
	const server = Bun.serve({
		port: 0,
		fetch: async (req) => {
			const url = new URL(req.url);
			let file = join(distDir, decodeURIComponent(url.pathname));
			if (url.pathname.endsWith("/")) file = join(file, "index.html");
			const f = Bun.file(file);
			return (await f.exists())
				? new Response(f)
				: new Response("not found", { status: 404 });
		},
	});
	const profile = mkdtempSync(join(tmpdir(), "bf-chrome-"));
	const port = await freePort();
	const proc = Bun.spawn(
		[
			chrome,
			"--headless=new",
			"--disable-gpu",
			"--no-first-run",
			"--no-default-browser-check",
			"--hide-scrollbars",
			"--window-size=1440,1200",
			"--user-data-dir=" + profile,
			"--remote-debugging-port=" + port,
			"about:blank",
		],
		{ stdout: "ignore", stderr: "ignore" },
	);
	let cdp: Cdp | undefined;
	try {
		let target: { webSocketDebuggerUrl: string } | undefined;
		for (let i = 0; i < 80 && !target; i++) {
			await sleep(150);
			try {
				const list = (await (
					await fetch("http://127.0.0.1:" + port + "/json/list")
				).json()) as {
					type: string;
					webSocketDebuggerUrl: string;
				}[];
				target = list.find((t) => t.type === "page");
			} catch {
				/* chrome still starting */
			}
		}
		if (!target)
			throw new Error("headless Chrome did not expose a debugging target");
		cdp = await connect(target.webSocketDebuggerUrl);
		await cdp.send("Page.enable");
		await cdp.send("Runtime.enable");
		// A narrow viewport is where a min-content width really bites: measure the same page at both.
		await cdp.send("Emulation.setDeviceMetricsOverride", {
			width,
			height: 1200,
			deviceScaleFactor: 1,
			mobile: width < 600,
		});
		await cdp.send("Page.navigate", {
			url: "http://127.0.0.1:" + server.port + path,
		});
		for (let i = 0; i < 100; i++) {
			await sleep(150);
			const r = (await cdp.send("Runtime.evaluate", {
				expression: "document.readyState",
				returnByValue: true,
			})) as { result: { value: string } };
			if (r.result.value === "complete") break;
		}
		await cdp.send("Runtime.evaluate", {
			expression:
				"new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
			awaitPromise: true,
		});
		const out = (await cdp.send("Runtime.evaluate", {
			expression,
			returnByValue: true,
		})) as { result: { value: T } };
		return out.result.value;
	} finally {
		cdp?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}

/** Geometry, containment and feel metrics for one built page. */
export async function measurePanelOverflow(
	distDir: string,
	path = "/ui/console/",
	width = 1440,
): Promise<Measurement> {
	const m = await runProbe<Omit<Measurement, "path">>(distDir, path, width, PROBE);
	return { path, ...m };
}

/**
 * The colour audit: every painted colour inside a panel must be a resolved --theme-* value or a native
 * palette hex. Anything else is an ad-hoc colour that escaped the sync pipeline.
 */
export interface ColourOffender {
	theme: string;
	mode: string;
	color: string;
	prop: string;
	tag: string;
	slot: string;
	className: string;
	count: number;
}

export interface ColourAudit {
	/** checked: how many painted colour values the audit read in this panel. A zero means it read nothing. */
	panels: { theme: string; mode: string; checked: number; offenders: ColourOffender[] }[];
}

const COLOUR_PROBE = `(() => {
  const PALETTES = __PALETTE__; // { dark: [...], light: [...] }
  // Memoised: a catalogue has thousands of elements but only a few dozen distinct colours.
  const keyCache = new Map();
  const rgbKey = (value) => {
    if (!keyCache.has(value)) keyCache.set(value, rgbKeyUncached(value));
    return keyCache.get(value);
  };
  const rgbKeyUncached = (value) => {
    const probe = document.createElement("span");
    probe.style.color = value;
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    const m = /rgba?\\(([^)]+)\\)/.exec(c);
    if (!m) return "";
    const parts = m[1].split(",").map((n) => Number.parseFloat(n));
    if (parts.length < 3 || parts.slice(0, 3).some((n) => Number.isNaN(n))) return "";
    return parts.slice(0, 3).map((n) => String(Math.round(n))).join(",");
  };
  const dark = new Set(PALETTES.dark.map(rgbKey));
  const light = new Set(PALETTES.light.map(rgbKey));
  const darkOnly = new Set([...dark].filter((c) => !light.has(c)));
  const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor", "textDecorationColor", "caretColor"];
  const panels = [];
  // The body is audited too, outside the theme scopes: a scope is the one place a palette value is painted on
  // purpose (a mode-scoped swatch), and each scope is audited in its own mode. Nothing is skipped on the page.
  const scopes = [...document.querySelectorAll('[data-slot="theme-scope"]')];
  for (const panel of [document.body, ...scopes]) {
    const inBody = panel === document.body;
    const mode = (inBody ? document.documentElement.dataset.mode : panel.dataset.mode) === "light" ? "light" : "dark";
    const leaks = new Map();
    let checked = 0;
    for (const el of [panel, ...panel.querySelectorAll("*")]) {
      if (inBody && el.closest('[data-slot="theme-scope"]')) continue;
      for (const prop of props) {
        const key = rgbKey(getComputedStyle(el)[prop]);
        if (!key || key === "0,0,0") continue;
        checked++;
        const isWhite = key === "255,255,255";
        const isDarkOnly = mode === "light" && darkOnly.has(key);
        if (!isWhite && !isDarkOnly) continue;
        const slot = key + "|" + prop + "|" + (el.getAttribute("data-slot") || el.tagName.toLowerCase());
        if (!leaks.has(slot)) {
          leaks.set(slot, { theme: panel.dataset.theme || "", mode, color: "rgb(" + key + ")", prop, tag: el.tagName.toLowerCase(), slot: el.getAttribute("data-slot") || "", className: String(el.className || "").slice(0, 70), count: 0 });
        }
        leaks.get(slot).count++;
      }
    }
    panels.push({ theme: panel.dataset.theme || "", mode, checked, offenders: [...leaks.values()].sort((a, b) => b.count - a.count) });
  }
  return { panels };
})()`;

const paletteFile = (distDir: string, file: string) =>
	join(distDir, "../../../packages/bigface-tokens/palette", file);

/**
 * The colour audit for Jun's rule: in a light panel no colour may be a value that exists only in the dark
 * palette (that is a --bf-* leak from the site's inline dark variables), and no element may paint pure
 * white. Both are what the synced palettes forbid; everything else must resolve from --theme-*.
 */
export async function measurePanelColours(
	distDir: string,
	path = "/ui/console/",
	width = 1440,
	mode?: "light" | "dark",
	fg?: "toned" | "native",
): Promise<ColourAudit> {
	const hexesOf = (file: string) =>
		Object.values(
			(JSON.parse(readFileSync(paletteFile(distDir, file), "utf8")) as {
				colors: Record<string, { hex: string }>;
			}).colors,
		).map((c) => c.hex.toLowerCase());
	const probe = COLOUR_PROBE.replace(
		"__PALETTE__",
		JSON.stringify({ dark: hexesOf("bigface.json"), light: hexesOf("bigface-light.json") }),
	);
	const setMode = mode ? "document.documentElement.dataset.mode = \"" + mode + "\"; " : "";
	const setFg = fg ? "document.documentElement.dataset.fg = \"" + fg + "\"; " : "";
	return runProbe<ColourAudit>(distDir, path, width, setMode + setFg + probe);
}

/** How far the page scrolls sideways, in a given mode, at a given width. Zero means nothing escapes the viewport. */
export async function measureCatalogLayout(
	distDir: string,
	path: string,
	width: number,
	mode: "light" | "dark",
): Promise<{ hScroll: number }> {
	return runProbe<{ hScroll: number }>(
		distDir,
		path,
		width,
		"document.documentElement.dataset.mode = \"" + mode + "\"; (() => ({ hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }))()",
	);
}
