// The business catalogue's mode toggle, driven in headless Chrome with real pointer events. It reads the page the way a
// reader would: the canvas colour and the mode attribute, before and after each click, and after a reload.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launchChrome } from "./panel-overflow.ts";

export interface ModeReading {
	mode: string | undefined;
	canvas: string;
}

export interface ModeRun {
	initial: ModeReading;
	dark: ModeReading;
	light: ModeReading;
	afterReloadWithDark: ModeReading;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs the mode sequence on the built page at distDir + path, at the given width. */
export async function runModeToggle(distDir: string, path: string, width: number): Promise<ModeRun> {
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
	const profile = mkdtempSync(join(tmpdir(), "bf-mode-"));
	const { proc, wsUrl } = await launchChrome(profile, width, 1000);
	let ws: WebSocket | undefined;
	try {
		ws = new WebSocket(wsUrl);
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
		const readState = async (): Promise<ModeReading> =>
			JSON.parse(await evaluate("JSON.stringify({ mode: document.documentElement.dataset.mode, canvas: getComputedStyle(document.body).backgroundColor })"));
		const waitReady = async () => {
			for (let i = 0; i < 120; i++) {
				await sleep(150);
				if ((await evaluate("!!document.querySelector('[aria-label=\"Colour mode\"] [data-slot=\"toggle-group-item\"]')")) === true) break;
			}
			await sleep(800);
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

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: false });
		await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + path });
		await waitReady();
		const initial = await readState();
		await press("Dark");
		const dark = await readState();
		await press("Light");
		const light = await readState();
		// a chosen mode survives a reload: the pre-paint script on this page applies the stored value
		await press("Dark");
		await send("Page.reload", { ignoreCache: true });
		await waitReady();
		const afterReloadWithDark = await readState();
		return { initial, dark, light, afterReloadWithDark };
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
