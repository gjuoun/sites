// The Button glow variant, driven in headless Chrome with real pointer events: the halo's computed box-shadow in each
// colour mode, the stock default button beside it (no halo), one real click on the glow example, and the halo's measured
// contrast against the canvas. Same scaffolding as catalog-toggles.ts; the page is read the way a reader sees it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export const GLOW_SEL = '[data-demo="button"] [data-glow-example]';
export const PLAIN_SEL = '[data-demo="button"] [data-slot="button"][data-variant="default"]';

export interface GlowReading {
	canvas: string;
	halo: string;
	haloRgb: [number, number, number] | null;
	contrast: number | null;
	defaultShadow: string;
}

export interface GlowRun {
	initialMode: string | undefined;
	light: GlowReading;
	dark: GlowReading;
	textBefore: string;
	textAfterClick: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** WCAG relative luminance of an sRGB triple (0-255). */
function luminance([r, g, b]: [number, number, number]): number {
	const lin = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio of two computed rgb() strings. */
export function contrastOf(a: [number, number, number], b: [number, number, number]): number {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
}

/** The first rgb() in a computed colour string (the canvas background). */
export function rgbOf(colour: string): [number, number, number] | null {
	const m = /rgba?\((\d+), (\d+), (\d+)/.exec(colour);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The colour of the 3px ring in a computed box-shadow list (Tailwind ring-3 is `0 0 0 3px`); the other shadow slots are empty. */
export function ringRgb(shadow: string): [number, number, number] | null {
	const m = /rgba?\((\d+), (\d+), (\d+)[^)]*\) 0px 0px 0px 3px/.exec(shadow);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Runs the glow sequence on the built page at distDir + path, at the given width. */
export async function runGlow(distDir: string, path: string, width: number): Promise<GlowRun> {
	const chrome = findChrome();
	if (!chrome) throw new Error("no Chrome found: set CHROME_PATH");
	const server = Bun.serve({
		port: 0,
		fetch: async (req) => {
			const url = new URL(req.url);
			let file = join(distDir, decodeURIComponent(url.pathname));
			if (url.pathname.endsWith("/")) file = join(file, "index.html");
			const f = Bun.file(file);
			return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
		},
	});
	const profile = mkdtempSync(join(tmpdir(), "bf-glow-"));
	const port = await freePort();
	const proc = Bun.spawn(
		[chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=" + width + ",1000", "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "about:blank"],
		{ stdout: "ignore", stderr: "ignore" },
	);
	let ws: WebSocket | undefined;
	try {
		let target: { webSocketDebuggerUrl: string } | undefined;
		for (let i = 0; i < 80 && !target; i++) {
			await sleep(150);
			try {
				const list = (await (await fetch("http://127.0.0.1:" + port + "/json/list")).json()) as { type: string; webSocketDebuggerUrl: string }[];
				target = list.find((t) => t.type === "page");
			} catch {}
		}
		if (!target) throw new Error("headless Chrome did not expose a target");
		ws = new WebSocket(target.webSocketDebuggerUrl);
		await new Promise((r) => ws!.addEventListener("open", r));
		let id = 0;
		const pending = new Map<number, (v: any) => void>();
		ws.addEventListener("message", (e) => {
			const m = JSON.parse(String(e.data));
			if (m.id && pending.has(m.id)) {
				pending.get(m.id)!(m.result);
				pending.delete(m.id);
			}
		});
		const send = (method: string, params: any = {}) =>
			new Promise<any>((res) => {
				const n = ++id;
				pending.set(n, res);
				ws!.send(JSON.stringify({ id: n, method, params }));
			});
		const evaluate = async (expression: string) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
		const waitReady = async () => {
			for (let i = 0; i < 120; i++) {
				await sleep(150);
				if ((await evaluate("!!document.querySelector('[aria-label=\"Colour mode\"] [data-slot=\"toggle-group-item\"]')")) === true) break;
			}
			await sleep(800);
		};
		const readGlow = async (): Promise<GlowReading> => {
			const raw = JSON.parse(
				await evaluate(
					"JSON.stringify({ canvas: getComputedStyle(document.body).backgroundColor, halo: getComputedStyle(document.querySelector(" + JSON.stringify(GLOW_SEL) + ")).boxShadow, defaultShadow: getComputedStyle(document.querySelector(" + JSON.stringify(PLAIN_SEL) + ")).boxShadow })",
				),
			) as { canvas: string; halo: string; defaultShadow: string };
			const haloRgb = ringRgb(raw.halo);
			const canvasRgb = rgbOf(raw.canvas);
			return {
				...raw,
				haloRgb,
				contrast: haloRgb && canvasRgb ? contrastOf(haloRgb, canvasRgb) : null,
			};
		};
		const press = async (label: string) => {
			await evaluate("document.querySelector('[aria-label=\"Colour mode\"]').scrollIntoView({ block: 'center', behavior: 'instant' })");
			await sleep(250);
			const at = JSON.parse(
				await evaluate(
					"(() => { const b = [...document.querySelectorAll('[aria-label=\"Colour mode\"] [data-slot=\"toggle-group-item\"]')].find(x => x.textContent.trim() === '" + label + "'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()",
				),
			);
			await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y, buttons: 0 });
			await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await sleep(700);
		};
		const clickGlow = async () => {
			await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").scrollIntoView({ block: 'center', behavior: 'instant' })");
			await sleep(250);
			const at = JSON.parse(await evaluate("(() => { const r = document.querySelector(" + JSON.stringify(GLOW_SEL) + ").getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
			await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y, buttons: 0 });
			await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await sleep(400);
		};

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
		await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + path });
		await waitReady();
		const initialMode = await evaluate("document.documentElement.dataset.mode");
		const light = await readGlow();
		const textBefore = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await clickGlow();
		const textAfterClick = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await press("Dark");
		const dark = await readGlow();
		return { initialMode, light, dark, textBefore, textAfterClick };
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
