// The business catalogue's interaction proof. It drives every demo that declares a trigger with a real pointer
// action in headless Chrome (click, hover, drag, wheel, right-click, or focus) and checks that the page
// responded: a DOM mutation, a focus change, or a scroll. It is a reusable module: the site test imports it.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome } from "./panel-overflow.ts";

export interface InteractionResult {
	name: string;
	kind: string;
	pass: boolean;
	mutations: number;
	focus: boolean;
	scrolled: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run every interaction on the built page at distDir + path. Returns one result per demo that has a trigger. */
export async function runInteractions(distDir: string, path = "/ui/business/"): Promise<{ total: number; statics: string[]; results: InteractionResult[] }> {
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
	const profile = mkdtempSync(join(tmpdir(), "bf-interact-"));
	const port = 9300 + Math.floor(Math.random() * 600);
	const proc = Bun.spawn(
		[chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1440,1000", "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "about:blank"],
		{ stdout: "ignore", stderr: "ignore" },
	);
	const results: InteractionResult[] = [];
	let statics: string[] = [];
	let total = 0;
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
		const evaluate = async (expression: string) =>
			(await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

		await send("Page.enable");
		await send("Runtime.enable");
		await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
		await send("Page.navigate", { url: "http://127.0.0.1:" + server.port + path });
		for (let i = 0; i < 120; i++) {
			await sleep(150);
			if ((await evaluate("document.readyState")) === "complete") break;
		}
		await sleep(1500);

		const demos = JSON.parse(
			await evaluate(
				"JSON.stringify([...document.querySelectorAll('[data-demo]')].map((d) => { const t = d.querySelector('[data-trigger]'); return { name: d.dataset.demo, kind: t ? t.dataset.trigger : null }; }))",
			),
		) as { name: string; kind: string | null }[];
		total = demos.length;
		statics = demos.filter((d) => !d.kind).map((d) => d.name);

		for (const d of demos) {
			if (!d.kind) continue;
			const sel = "[data-demo=\"" + d.name + "\"]";
			const at = JSON.parse(
				await evaluate(
					"(() => { const d = document.querySelector('" + sel + "'); const t = d.querySelector('[data-trigger]'); t.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = t.getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()",
				),
			) as { x: number; y: number };
			await sleep(120);
			await evaluate(
				"(() => { window.__m = { n: 0 }; window.__o = new MutationObserver((l) => { window.__m.n += l.length; }); window.__o.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); window.__f = document.activeElement; window.__s = [...document.querySelectorAll('" + sel + " *')].filter((e) => e.scrollHeight > e.clientHeight + 2).map((e) => e.scrollTop); return true; })()",
			);
			const { x, y } = at;
			const scrolledNow = "JSON.stringify([...document.querySelectorAll('" + sel + " *')].filter((e) => e.scrollHeight > e.clientHeight + 2).map((e) => e.scrollTop).some((v, i) => v !== (window.__s[i] ?? 0)))";
			if (d.kind === "click" || d.kind === "focus") {
				await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
				await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
				await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
			} else if (d.kind === "hover") {
				await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
			} else if (d.kind === "drag") {
				await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
				await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
				for (let k = 1; k <= 6; k++) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + k * 10, y, button: "left", buttons: 1 });
				await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 60, y, button: "left", clickCount: 1 });
			} else if (d.kind === "wheel") {
				// a list may start pinned to one end, so try down, then up: any scroll counts
				await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
				await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: 240 });
				await sleep(250);
				const moved = JSON.parse(await evaluate(scrolledNow));
				if (!moved) await send("Input.dispatchMouseEvent", { type: "mouseWheel", x, y, deltaX: 0, deltaY: -240 });
			} else if (d.kind === "contextmenu") {
				await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
				await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "right", clickCount: 1 });
				await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "right", clickCount: 1 });
			}
			await sleep(d.kind === "hover" ? 1000 : 450);
			const after = JSON.parse(
				await evaluate(
					"JSON.stringify({ n: window.__m.n, focus: document.activeElement !== window.__f, scrolled: " + scrolledNow + " })",
				),
			) as { n: number; focus: boolean; scrolled: boolean };
			results.push({ name: d.name, kind: d.kind, pass: after.n > 0 || after.focus || after.scrolled, mutations: after.n, focus: after.focus, scrolled: after.scrolled });
			await evaluate("(() => { window.__o && window.__o.disconnect(); return true; })()");
			await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
			await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
			await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4, buttons: 0 });
			await sleep(250);
		}
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
	return { total, statics, results };
}
