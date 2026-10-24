// The business catalogue's two toggles, driven in headless Chrome with real pointer events. It reads the page the way a
// reader would: the canvas colour, the mode and foreground attributes, the foreground token, and the disabled state.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export interface ToggleReading {
	mode: string | undefined;
	fg: string | undefined;
	canvas: string;
	primaryInk: string;
}

export interface ToggleRun {
	initial: ToggleReading;
	dark: ToggleReading;
	light: ToggleReading;
	nativeLight: ToggleReading;
	tonedAgain: ToggleReading;
	foregroundsDisabledInDark: boolean;
	nativeInDark: ToggleReading;
	afterReloadWithDark: ToggleReading;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs the sequence on the built page at distDir + path, at the given width. */
export async function runToggles(distDir: string, path: string, width: number): Promise<ToggleRun> {
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
	const profile = mkdtempSync(join(tmpdir(), "bf-toggle-"));
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
		const readState = async (): Promise<ToggleReading> =>
			JSON.parse(
				await evaluate(
					"JSON.stringify({ mode: document.documentElement.dataset.mode, fg: document.documentElement.dataset.fg, canvas: getComputedStyle(document.body).backgroundColor, primaryInk: getComputedStyle(document.documentElement).getPropertyValue('--theme-primary-ink').trim() })",
				),
			);
		const waitReady = async () => {
			for (let i = 0; i < 120; i++) {
				await sleep(150);
				if ((await evaluate("!!document.querySelector('[aria-label=\"Colour mode\"] [data-slot=\"toggle-group-item\"]')")) === true) break;
			}
			await sleep(800);
		};
		const press = async (group: string, label: string) => {
			await evaluate("document.querySelector('[aria-label=\"" + group + "\"]').scrollIntoView({ block: 'center', behavior: 'instant' })");
			await sleep(250);
			const at = JSON.parse(
				await evaluate(
					"(() => { const b = [...document.querySelectorAll('[aria-label=\"" + group + "\"] [data-slot=\"toggle-group-item\"]')].find(x => x.textContent.trim() === '" + label + "'); const r = b.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()",
				),
			);
			await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y, buttons: 0 });
			await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await sleep(700);
		};

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
		await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + path });
		await waitReady();

		const initial = await readState();
		await press("Colour mode", "Dark");
		const dark = await readState();
		const foregroundsDisabledInDark = (await evaluate("[...document.querySelectorAll('[aria-label=\"Foregrounds\"] [data-slot=\"toggle-group-item\"]')].every(b => b.disabled)")) === true;
		await press("Foregrounds", "Native");
		const nativeInDark = await readState();
		await press("Colour mode", "Light");
		const light = await readState();
		await press("Foregrounds", "Native");
		const nativeLight = await readState();
		await press("Foregrounds", "Toned");
		const tonedAgain = await readState();
		// the mode a reader chose survives a reload (the pre-paint script); the comparison resets to toned
		await press("Colour mode", "Dark");
		await send("Page.reload", { ignoreCache: true });
		await waitReady();
		const afterReloadWithDark = await readState();
		return { initial, dark, light, nativeLight, tonedAgain, foregroundsDisabledInDark, nativeInDark, afterReloadWithDark };
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
