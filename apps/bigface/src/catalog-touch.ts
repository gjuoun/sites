// The catalogue's two control rows, driven with real TOUCH events (hasTouch), the way a phone reaches them. Before any
// tap it reads where the page is and whether each control is in the viewport and receives the touch. It never scrolls
// a control into view first: the earlier pointer tests did, which hid a page that loads far down.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export interface ControlRect {
	label: string;
	group: string;
	top: number;
	bottom: number;
	inView: boolean;
	hit: boolean;
}

export interface TouchRun {
	scrollYAtLoad: number;
	viewportHeight: number;
	controlsAtLoad: ControlRect[];
	controlsAfterTaps: ControlRect[];
	readings: { after: string; mode: string | undefined; fg: string | undefined; canvas: string }[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const CONTROLS = "[aria-label=\"Colour mode\"] [data-slot=\"toggle-group-item\"], [aria-label=\"Foregrounds\"] [data-slot=\"toggle-group-item\"]";
const READ_CONTROLS = "JSON.stringify({ scrollY: Math.round(scrollY), vh: innerHeight, controls: [...document.querySelectorAll('" + CONTROLS + "')].map((el) => { const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const hitEl = at && at.closest('[data-slot=\"toggle-group-item\"]'); return { label: el.textContent.trim(), group: el.closest('[aria-label]').getAttribute('aria-label'), top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= innerHeight, hit: hitEl === el }; }) })";

/** Loads the built page with touch enabled, reads the controls, taps the four controls, and reads again. */
export async function runTouch(distDir: string, path: string, width: number, height = 844): Promise<TouchRun> {
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
	const profile = mkdtempSync(join(tmpdir(), "bf-touch-"));
	const port = await freePort();
	const proc = Bun.spawn(
		[chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=" + width + "," + height, "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "about:blank"],
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
		const readState = async () =>
			JSON.parse(await evaluate("JSON.stringify({ mode: document.documentElement.dataset.mode, fg: document.documentElement.dataset.fg, canvas: getComputedStyle(document.body).backgroundColor })"));
		const tap = async (group: string, label: string) => {
			// the centre of the control as it is NOW, with no scrolling first: a real phone user taps what is on screen
			const at = JSON.parse(
				await evaluate(
					"(() => { const b = [...document.querySelectorAll('[aria-label=\"" + group + "\"] [data-slot=\"toggle-group-item\"]')].find((x) => x.textContent.trim() === '" + label + "'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()",
				),
			);
			await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: at.x, y: at.y }] });
			await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
			await sleep(700);
		};

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
		await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
		await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + path });
		for (let i = 0; i < 120; i++) {
			await sleep(150);
			if ((await evaluate("document.readyState")) === "complete") break;
		}
		await sleep(1500);
		const load = JSON.parse(await evaluate(READ_CONTROLS));
		const readings: TouchRun["readings"] = [];
		await tap("Colour mode", "Dark");
		readings.push({ after: "dark", ...(await readState()) });
		await tap("Colour mode", "Light");
		readings.push({ after: "light", ...(await readState()) });
		await tap("Foregrounds", "Native");
		readings.push({ after: "native", ...(await readState()) });
		await tap("Foregrounds", "Toned");
		readings.push({ after: "toned", ...(await readState()) });
		const after = JSON.parse(await evaluate(READ_CONTROLS));
		return {
			scrollYAtLoad: load.scrollY,
			viewportHeight: load.vh,
			controlsAtLoad: load.controls,
			controlsAfterTaps: after.controls,
			readings,
		};
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
