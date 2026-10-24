// Real layout measurement for the theme panels: serve the built site, drive a headless Chrome over
// CDP, and report every element that paints outside the panel it lives in.
//
// Why not a DOM library: happy-dom and jsdom have no layout engine, so getBoundingClientRect() is a
// zero rectangle there and an overflow assertion against it would pass on any markup. This runs the
// page the browser runs and reads real boxes.
import { existsSync, mkdtempSync, rmSync } from "node:fs";
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
 * Measure one built page. path is the URL path ("/ui/theme/"); distDir is served at the root, the way
 * the static deploy serves it. Throws when no Chrome is installed.
 */
export async function measurePanelOverflow(
	distDir: string,
	path = "/ui/theme/",
	width = 1440,
): Promise<Measurement> {
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
	const port = 9222 + Math.floor(Math.random() * 500);
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
			expression: PROBE,
			returnByValue: true,
		})) as {
			result: {
				value: {
					panels: number;
					offenders: Overflow[];
					clipped: Measurement["clipped"];
					metrics: PanelMetrics[];
				};
			};
		};
		return { path, ...out.result.value } as Measurement;
	} finally {
		cdp?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
