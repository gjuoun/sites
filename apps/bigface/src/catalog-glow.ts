// The Button glow variant (the hero look): a gradient primary fill and a translucent blue drop shadow, measured in headless Chrome.
// The shadow is outside the button, so the proof is outside the edge. For each state (rest, hover) the page is captured twice at the
// same clip: once with the button, and once with the button set to visibility:hidden (a hidden element paints no box-shadow). The
// second capture is the surface the button stands on, pixel for pixel, so a neighbouring control or the cell colour is never
// mistaken for shadow. A band pixel is a surface pixel 1 to 6px outside the border box, on a straight run of an edge (corners are
// skipped). Its change from the surface must lie on the segment from the surface toward --theme-blue (#00b0ff): that is a blue-shifted
// shadow, not a grey or a ring. The sampler also reads the inside edge (no pixel of the surface colour may sit inside the border
// box, which would be a ring between fill and shadow), the fill gradient (rest) and the flat fill (hover), and the ink.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export const GLOW_SEL = '[data-demo="button"] [data-glow-example]';
/** Screenshot margin around the button, in CSS px: the hover shadow reaches about 48px below the edge. */
const MARGIN = 56;
/** --theme-blue as painted in both modes (the same hex in light and dark). */
export const BLUE: Rgb = [0, 176, 255];
/** The band: 1 to this many px outside the edge. */
export const BAND_DEPTH = 6;
/** A surface pixel counts as shadow when its blue share is at least this (about 5 of 255 levels in the blue channel). */
export const MIN_A = 0.02;
/** Off-line residual allowed per channel (8-bit rounding is under 1). */
const RESIDUAL = 3;
/** Quiet the page while sampling: no transitions or animations, so a colour caught mid-fade is never measured. */
const QUIET = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export type Rgb = [number, number, number];
export type State = "rest" | "hover";
export type Side = "top" | "right" | "bottom" | "left";
/** Geometry read from the page, in document pixels. */
export interface Geo { L: number; T: number; R: number; B: number; radius: number; fill: string; bg: string; ink: string; shadow: string; surface: string }
export interface Img { w: number; h: number; d: number[] }

/** One state's measurement of the shadow band. */
export interface Shadow {
	state: State;
	/** The border box in whole pixels. Hover lifts the top by 2px. */
	box: { T: number; L: number; R: number; B: number };
	/** The surface behind the button, read from the page (the nearest non-transparent background). */
	surface: Rgb;
	/** The computed ink and box-shadow. */
	ink: string;
	shadow: string;
	/** The fill at two points on the gradient diagonal: top-left and bottom-right of the box. */
	fillTL: Rgb;
	fillBR: Rgb;
	/** The fill at mid-height, 6px in: the ink's background. */
	fillMid: Rgb;
	/** The band: 1 to BAND_DEPTH px outside the edge. occluded = a pixel that is not the surface in the baseline (a neighbour). */
	band: { total: number; occluded: number; surface: number; changed: number; tinted: number; other: number; meanA: number; maxA: number };
	/** Per side: surface pixels, tinted pixels and mean blue share. */
	side: Record<Side, { n: number; tinted: number; meanA: number }>;
	/** Mean blue share at 1px, 2px … BAND_DEPTH px outside the edge (all sides, surface pixels only). */
	profile: number[];
	/** The inside edge: straight-run pixels within 1px inside the border box, and how many are the surface colour (a ring). */
	inside: { total: number; ring: number };
}
export interface ModeReading { canvas: string; rest: Shadow; hover: Shadow }
export interface GlowRun { initialMode: string | undefined; light: ModeReading; dark: ModeReading; textBefore: string; textAfterClick: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The first rgb() or rgba() in a computed colour string, or null when it is transparent. */
export function rgbOf(colour: string): Rgb | null {
	const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(colour);
	if (!m || (m[4] !== undefined && Number(m[4]) === 0)) return null;
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Which edge a point outside the box lies beside, and how far outside (pixel centres). Corners return null. */
function outsideOf(cx: number, cy: number, L: number, T: number, R: number, B: number, r: number): { side: Side; depth: number } | null {
	const inX = cx >= L + r + 2 && cx <= R - r - 2;
	const inY = cy >= T + r + 2 && cy <= B - r - 2;
	if (cy < T && inX) return { side: "top", depth: T - cy };
	if (cy > B && inX) return { side: "bottom", depth: cy - B };
	if (cx < L && inY) return { side: "left", depth: L - cx };
	if (cx > R && inY) return { side: "right", depth: cx - R };
	return null;
}

/**
 * Measures the shadow band from two decoded captures at the same clip (document pixels): shot with the button, base without it.
 * Pure: no browser, so the counting is testable on a synthetic image.
 */
export function measureShadow(state: State, shot: Img, base: Img, clip: { x: number; y: number }, geo: Geo): Shadow {
	const px = (img: Img, ix: number, iy: number): Rgb => {
		const i = (iy * img.w + ix) * 4;
		return [img.d[i]!, img.d[i + 1]!, img.d[i + 2]!];
	};
	const at = (img: Img, x: number, y: number) => px(img, Math.floor(x - clip.x), Math.floor(y - clip.y));
	const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	const L = Math.round(geo.L), T = Math.round(geo.T), R = Math.round(geo.R), B = Math.round(geo.B);
	const r = geo.radius;
	const surface = rgbOf(geo.surface);
	if (!surface) throw new Error("the surface did not resolve to a colour: " + geo.surface);
	const bv = (b: Rgb) => BLUE.map((v, i) => v - b[i]!) as Rgb;
	const side: Shadow["side"] = { top: { n: 0, tinted: 0, meanA: 0 }, right: { n: 0, tinted: 0, meanA: 0 }, bottom: { n: 0, tinted: 0, meanA: 0 }, left: { n: 0, tinted: 0, meanA: 0 } };
	const sideSum: Record<Side, number> = { top: 0, right: 0, bottom: 0, left: 0 };
	const profSum = new Array<number>(BAND_DEPTH).fill(0);
	const profN = new Array<number>(BAND_DEPTH).fill(0);
	const band = { total: 0, occluded: 0, surface: 0, changed: 0, tinted: 0, other: 0, meanA: 0, maxA: 0 };
	let sum = 0;
	const inside = { total: 0, ring: 0 };
	for (let iy = 0; iy < shot.h; iy++)
		for (let ix = 0; ix < shot.w; ix++) {
			const cx = clip.x + ix + 0.5;
			const cy = clip.y + iy + 0.5;
			const out = outsideOf(cx, cy, L, T, R, B, r);
			if (out) {
				const k = Math.ceil(out.depth);
				if (k < 1 || k > BAND_DEPTH) continue;
				band.total++;
				const b = px(base, ix, iy);
				if (!same(b, surface)) {
					band.occluded++;
					continue;
				}
				band.surface++;
				const c = px(shot, ix, iy);
				if (!same(c, b)) band.changed++;
				const v = bv(b);
				const diff = [0, 1, 2].map((i) => c[i]! - b[i]!);
				const vv = v.reduce((s, x) => s + x * x, 0);
				const a = [0, 1, 2].reduce((s, i) => s + diff[i]! * v[i]!, 0) / vv;
				const res = Math.max(...[0, 1, 2].map((i) => Math.abs(diff[i]! - a * v[i]!)));
				const aa = Math.max(0, a);
				if (a >= MIN_A && res <= RESIDUAL) {
					band.tinted++;
					side[out.side].tinted++;
				} else if (res > RESIDUAL) band.other++;
				band.maxA = Math.max(band.maxA, aa);
				sum += aa;
				side[out.side].n++;
				sideSum[out.side] += aa;
				profSum[k - 1]! += aa;
				profN[k - 1]!++;
				continue;
			}
			if (cx < L || cx > R || cy < T || cy > B) continue;
			const straightTB = (cy - T < 1 || B - cy < 1) && cx >= L + r + 2 && cx <= R - r - 2;
			const straightLR = (cx - L < 1 || R - cx < 1) && cy >= T + r + 2 && cy <= B - r - 2;
			if (straightTB || straightLR) {
				inside.total++;
				if (same(px(shot, ix, iy), surface)) inside.ring++;
			}
		}
	band.meanA = band.surface ? sum / band.surface : 0;
	for (const s of ["top", "right", "bottom", "left"] as Side[]) side[s].meanA = side[s].n ? sideSum[s] / side[s].n : 0;
	const profile = profSum.map((v, i) => (profN[i] ? v / profN[i]! : 0));
	const mid = (T + B) / 2;
	const w = R - L, h = B - T;
	return {
		state,
		box: { T, L, R, B },
		surface,
		ink: geo.ink,
		shadow: geo.shadow,
		fillTL: at(shot, L + 0.25 * w, T + 0.3 * h),
		fillBR: at(shot, L + 0.75 * w, T + 0.7 * h),
		fillMid: at(shot, L + 6, mid),
		band,
		side,
		profile,
		inside,
	};
}

/** Runs the glow sequence on the built page at distDir + path, at the given width. shots, when set, is a directory for PNGs. */
export async function runGlow(distDir: string, path: string, width: number, shots?: string): Promise<GlowRun> {
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
		const scrollTo = (sel: string) => evaluate("document.querySelector(" + JSON.stringify(sel) + ").scrollIntoView({ block: 'center', behavior: 'instant' })");
		const moveMouse = (x: number, y: number) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
		const moveTo = async (sel: string) => {
			const at = JSON.parse(await evaluate("(() => { const r = document.querySelector(" + JSON.stringify(sel) + ").getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
			await moveMouse(at.x, at.y);
			await sleep(250);
		};
		// Geometry in document pixels, the computed ink and box-shadow, the surface (nearest non-transparent background above the button)
		// and the bg role's value from a probe with the bg-background class.
		const geoOf = (sel: string) =>
			evaluate(
				"JSON.stringify((() => { const el = document.querySelector(" + JSON.stringify(sel) + "); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const probe = document.createElement('div'); probe.className = 'bg-background'; document.body.appendChild(probe); const bg = getComputedStyle(probe).backgroundColor; probe.remove(); let s = el.parentElement; let surface = 'rgba(0, 0, 0, 0)'; while (s) { const c = getComputedStyle(s).backgroundColor; if (rgbaAlpha(c) > 0) { surface = c; break; } s = s.parentElement; } if (rgbaAlpha(surface) === 0) surface = bg; return { L: r.left + scrollX, T: r.top + scrollY, R: r.right + scrollX, B: r.bottom + scrollY, radius: parseFloat(cs.borderTopLeftRadius) || 0, fill: cs.backgroundColor, bg, ink: cs.color, shadow: cs.boxShadow, surface }; function rgbaAlpha(c) { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return 1; const p = m[1].split(',').map(Number); return p.length > 3 ? p[3] : 1; } })())",
			).then((s: string) => JSON.parse(s) as Geo);
		const savePng = (file: string, data: string) => writeFileSync(file, Buffer.from(data, "base64"));
		const capture = async (clip: { x: number; y: number; width: number; height: number; scale: number }) => (await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip })).data as string;
		const decode = async (data: string, clip: { width: number; height: number }): Promise<Img> => {
			const img = JSON.parse(
				await evaluate(
					"(async () => { const img = new Image(); img.src = 'data:image/png;base64," + data + "'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return JSON.stringify({ w: img.width, h: img.height, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) }); })()",
				),
			);
			if (img.w !== clip.width || img.h !== clip.height) throw new Error("screenshot is " + img.w + "x" + img.h + ", expected " + clip.width + "x" + clip.height);
			return img;
		};
		const setVisible = (sel: string, on: boolean) => evaluate("document.querySelector(" + JSON.stringify(sel) + ").style.visibility = " + JSON.stringify(on ? "" : "hidden"));
		// One state: the pointer sets it (hover over the button, rest with the pointer away), then the page is captured with the button and
		// without it at the same clip. The baseline is the surface; the difference is the shadow alone.
		const sampleState = async (state: State, mode: string, file?: string): Promise<Shadow> => {
			await scrollTo(GLOW_SEL);
			await sleep(250);
			if (state === "hover") await moveTo(GLOW_SEL);
			else await moveMouse(1, 1);
			await sleep(150);
			const geo = await geoOf(GLOW_SEL);
			const clip = { x: Math.floor(geo.L) - MARGIN, y: Math.floor(geo.T) - MARGIN, width: Math.ceil(geo.R) - Math.floor(geo.L) + 2 * MARGIN, height: Math.ceil(geo.B) - Math.floor(geo.T) + 2 * MARGIN, scale: 1 };
			const shotData = await capture(clip);
			await setVisible(GLOW_SEL, false);
			const baseData = await capture(clip);
			await setVisible(GLOW_SEL, true);
			if (file) savePng(file, shotData);
			const shot = await decode(shotData, clip);
			const base = await decode(baseData, clip);
			return measureShadow(state, shot, base, clip, geo);
		};
		// The shadow at 4x: the button and its margin, re-rasterised at scale 4 (not upscaled).
		const cropShadow = async (state: State, file: string) => {
			await scrollTo(GLOW_SEL);
			await sleep(250);
			if (state === "hover") await moveTo(GLOW_SEL);
			else await moveMouse(1, 1);
			await sleep(150);
			const geo = await geoOf(GLOW_SEL);
			const pad = 28;
			savePng(file, await capture({ x: Math.floor(geo.L) - pad, y: Math.floor(geo.T) - pad, width: Math.ceil(geo.R) - Math.floor(geo.L) + 2 * pad, height: Math.ceil(geo.B) - Math.floor(geo.T) + 2 * pad, scale: 4 }));
		};
		const readMode = async (mode: string): Promise<ModeReading> => {
			const canvas = await evaluate("getComputedStyle(document.body).backgroundColor");
			const name = (state: string) => (shots ? join(shots, "glow-" + mode + "-" + state + "-" + width + ".png") : undefined);
			const rest = await sampleState("rest", mode, name("rest"));
			const hover = await sampleState("hover", mode, name("hover"));
			if (shots) {
				await cropShadow("rest", join(shots, "glow-shadow-4x-" + mode + "-rest-" + width + ".png"));
				await cropShadow("hover", join(shots, "glow-shadow-4x-" + mode + "-hover-" + width + ".png"));
			}
			return { canvas, rest, hover };
		};
		const clickGlow = async () => {
			await scrollTo(GLOW_SEL);
			await sleep(250);
			const at = JSON.parse(await evaluate("(() => { const r = document.querySelector(" + JSON.stringify(GLOW_SEL) + ").getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
			await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: at.x, y: at.y, buttons: 0 });
			await send("Input.dispatchMouseEvent", { type: "mousePressed", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: at.x, y: at.y, button: "left", clickCount: 1 });
			await sleep(400);
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
		await evaluate("(() => { const s = document.createElement('style'); s.textContent = " + JSON.stringify(QUIET) + "; document.head.appendChild(s); })()");
		const initialMode = await evaluate("document.documentElement.dataset.mode");
		const light = await readMode("light");
		const textBefore = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await clickGlow();
		const textAfterClick = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await press("Dark");
		const dark = await readMode("dark");
		return { initialMode, light, dark, textBefore, textAfterClick };
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
