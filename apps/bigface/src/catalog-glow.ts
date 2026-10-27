// The Button glow variant, driven in headless Chrome with real pointer input, in each colour mode and at two widths.
// The variant is a plain primary fill at rest. On hover a 1px rim fades in over the fill's outermost ring: the reference
// card's gradient (140deg; blue at 55 percent, lime at 12 percent at 45 percent, transparent at 70 percent) cut to a
// hairline by a mask. The sampler reads three things per state: the transparent border (it shows the cell surface behind the
// button, so the rim never leaves the button), the rim band (the first painted pixel ring, 1 to 2px inside the border box), and the
// gradient position of every band pixel, so the lime tint is read against where it sits. The fill is sampled at mid-height.
// The stock default button beside it is the control. The pixel maths is pure (measureRim) and is tested on a synthetic
// image as well as on the live page.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export const GLOW_SEL = '[data-demo="button"] [data-glow-example]';
export const PLAIN_SEL = '[data-demo="button"] [data-slot="button"][data-variant="default"]';

/** Screenshot margin around the button, in CSS px. */
const MARGIN = 6;
/** The gradient's angle, as the reference card writes it (bg-linear-140). */
export const GRADIENT_DEG = 140;
/** The gradient positions are read in this many bins over 0 to 1. */
export const GRADIENT_BINS = 10;
/** The palette colours as painted in both modes: --theme-blue and --theme-lime are the same hex in light and dark. */
export const BLUE: Rgb = [0, 176, 255];
export const LIME: Rgb = [198, 255, 0];
/** Transitions and animations off while sampling, so a colour caught mid-fade is never measured. */
const QUIET = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export type Rgb = [number, number, number];
export type State = "rest" | "hover";

/** Geometry read from the page, in document pixels. */
export interface Geo { L: number; T: number; R: number; B: number; radius: number; fill: string; bg: string; ink: string; shadow: string }
export interface Img { w: number; h: number; d: number[] }
/** One gradient-position bin: band pixels in it, how many carry the lime tint, and the strongest tint seen. */
export interface Bin { n: number; lime: number; maxA: number }

/** One state's census of the glow button. */
export interface Rim {
	state: State;
	/** The painted fill, sampled inside the button at mid-height, 6px in from the left edge. */
	fill: Rgb | null;
	/** The bg role's value: a probe with the bg-background class. */
	bg: Rgb;
	/** The computed ink (text colour) of the button. */
	ink: string;
	/** The computed box-shadow: the rim is not a shadow, so this must carry no halo. */
	shadow: string;
	/** The border box's top and left in document pixels: the hover lift moves the top. */
	box: { T: number; L: number };
	/** The surface the button sits on (the catalogue cell), 5px left of the edge at mid-height. */
	surface: Rgb | null;
	/** The transparent border: the 1px ring just outside the padding box, depth 0 to 1. Shows the surface behind it, so it must equal the surface. */
	ring: { total: number; surface: number; other: number };
	/** The rim band: the first painted ring, depth 1 to 2. fill: equal to the fill. lime: on the fill-to-lime line (a tint toward lime). */
	band: { total: number; fill: number; canvas: number; lime: number; other: number; maxA: number };
	/** The band by gradient position (0 at the top-left, 1 at the bottom-right, along the 140deg axis). */
	bins: Bin[];
}
export interface ModeReading {
	canvas: string;
	rest: Rim;
	hover: Rim;
	/** The stock default button at rest: the control, no rim. */
	plain: Rim;
}
export interface GlowRun {
	initialMode: string | undefined;
	light: ModeReading;
	dark: ModeReading;
	textBefore: string;
	textAfterClick: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The first rgb() in a computed colour string. */
export function rgbOf(colour: string): Rgb | null {
	const m = /rgba?\((\d+), (\d+), (\d+)/.exec(colour);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Measures the rim from decoded RGBA pixels of a screenshot taken at clip (document pixels). Pure: no browser, so the counting
 * is testable on a synthetic image. The border box is taken to whole pixels, as Chrome paints it. Corner squares (the radius
 * plus 1px) are skipped, where the arc is anti-aliased. A band pixel is the fill (equal to the fill sample), the canvas, a tint
 * toward lime (on the segment from the fill to lime, within 3 per channel of it), or other. The gradient position of a pixel is
 * its projection on the 140deg axis across the box, 0 at the start and 1 at the end.
 */
export function measureRim(state: State, img: Img, clip: { x: number; y: number }, geo: Geo): Rim {
	const px = (ix: number, iy: number): Rgb => {
		const i = (iy * img.w + ix) * 4;
		return [img.d[i]!, img.d[i + 1]!, img.d[i + 2]!];
	};
	const at = (x: number, y: number) => px(Math.floor(x - clip.x), Math.floor(y - clip.y));
	const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
	const L = Math.round(geo.L), T = Math.round(geo.T), R = Math.round(geo.R), B = Math.round(geo.B);
	const midX = (L + R) / 2;
	const midY = (T + B) / 2;
	const fill = at(L + 6, midY);
	const surface = at(L - 5, midY);
	const bg = rgbOf(geo.bg);
	if (!bg) throw new Error("bg role probe did not resolve to a colour: " + geo.bg);
	const rad = (GRADIENT_DEG * Math.PI) / 180;
	const dx = Math.sin(rad);
	const dy = -Math.cos(rad);
	const len = Math.abs((R - L) * dx) + Math.abs((B - T) * dy);
	const lime = [0, 1, 2].map((i) => LIME[i]! - fill[i]!);
	const limeLen2 = lime.reduce((s, v) => s + v * v, 0);
	const out: Rim = {
		state,
		fill,
		bg,
		ink: geo.ink,
		shadow: geo.shadow,
		box: { T, L },
		surface,
		ring: { total: 0, surface: 0, other: 0 },
		band: { total: 0, fill: 0, canvas: 0, lime: 0, other: 0, maxA: 0 },
		bins: Array.from({ length: GRADIENT_BINS }, () => ({ n: 0, lime: 0, maxA: 0 })),
	};
	const corner = geo.radius + 1;
	for (let iy = 0; iy < img.h; iy++)
		for (let ix = 0; ix < img.w; ix++) {
			const cx = clip.x + ix + 0.5;
			const cy = clip.y + iy + 0.5;
			if ((cx - L < corner || R - cx < corner) && (cy - T < corner || B - cy < corner)) continue;
			const depth = Math.min(cx - L, R - cx, cy - T, B - cy);
			if (depth <= 0 || depth >= 2) continue;
			const c = px(ix, iy);
			if (depth < 1) {
				out.ring.total++;
				if (same(c, surface)) out.ring.surface++;
				else out.ring.other++;
				continue;
			}
			out.band.total++;
			let tint = 0;
			if (same(c, fill)) out.band.fill++;
			else if (same(c, bg)) out.band.canvas++;
			else {
				const diff = [0, 1, 2].map((i) => c[i]! - fill[i]!);
				const a = diff.reduce((s, v, i) => s + v * lime[i]!, 0) / limeLen2;
				const on = [0, 1, 2].map((i) => fill[i]! + a * lime[i]!) as Rgb;
				if (a > 0 && dist(c, on) <= 3) {
					out.band.lime++;
					tint = a;
					out.band.maxA = Math.max(out.band.maxA, a);
				} else out.band.other++;
			}
			const p = ((cx - midX) * dx + (cy - midY) * dy) / len + 0.5;
			const bin = out.bins[Math.min(GRADIENT_BINS - 1, Math.max(0, Math.floor(p * GRADIENT_BINS)))]!;
			bin.n++;
			if (tint > 0) {
				bin.lime++;
				bin.maxA = Math.max(bin.maxA, tint);
			}
		}
	return out;
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
		// Geometry in document pixels, the computed ink and box-shadow, and the bg role's value from a probe with the bg-background class.
		const geoOf = (sel: string) =>
			evaluate(
				"JSON.stringify((() => { const el = document.querySelector(" + JSON.stringify(sel) + "); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const probe = document.createElement('div'); probe.className = 'bg-background'; document.body.appendChild(probe); const bg = getComputedStyle(probe).backgroundColor; probe.remove(); return { L: r.left + scrollX, T: r.top + scrollY, R: r.right + scrollX, B: r.bottom + scrollY, radius: parseFloat(cs.borderTopLeftRadius) || 0, fill: cs.backgroundColor, bg, ink: cs.color, shadow: cs.boxShadow }; })())",
			).then((s: string) => JSON.parse(s) as Geo);
		const savePng = (file: string, data: string) => writeFileSync(file, Buffer.from(data, "base64"));
		// Screenshot of the button and its margin, decoded in the page (canvas getImageData), then measured here.
		const sample = async (sel: string, state: State, file?: string): Promise<Rim> => {
			const geo = await geoOf(sel);
			const clip = { x: Math.floor(geo.L) - MARGIN, y: Math.floor(geo.T) - MARGIN, width: Math.ceil(geo.R) - Math.floor(geo.L) + 2 * MARGIN, height: Math.ceil(geo.B) - Math.floor(geo.T) + 2 * MARGIN, scale: 1 };
			const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
			if (file) savePng(file, shot.data);
			const img = JSON.parse(
				await evaluate(
					"(async () => { const img = new Image(); img.src = 'data:image/png;base64," + shot.data + "'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return JSON.stringify({ w: img.width, h: img.height, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) }); })()",
				),
			);
			if (img.w !== clip.width || img.h !== clip.height) throw new Error("screenshot is " + img.w + "x" + img.h + ", expected " + clip.width + "x" + clip.height);
			return measureRim(state, img, clip, geo);
		};
		// Each state is set by real pointer input: hover by the pointer over the button, rest with the pointer away.
		const readRim = async (state: State, sel: string, file?: string): Promise<Rim> => {
			await scrollTo(sel);
			await sleep(250);
			if (state === "hover") await moveTo(sel);
			else await moveMouse(1, 1);
			return sample(sel, state, file);
		};
		// The rim at 4x: the whole button and a 4px margin, captured at scale 4 (re-rasterised, not upscaled).
		const cropRim = async (sel: string, file: string) => {
			const geo = await geoOf(sel);
			const pad = 4;
			const clip = { x: Math.floor(geo.L) - pad, y: Math.floor(geo.T) - pad, width: Math.ceil(geo.R) - Math.floor(geo.L) + 2 * pad, height: Math.ceil(geo.B) - Math.floor(geo.T) + 2 * pad, scale: 4 };
			const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
			savePng(file, shot.data);
		};
		const readMode = async (mode: string): Promise<ModeReading> => {
			const canvas = await evaluate("getComputedStyle(document.body).backgroundColor");
			const name = (state: string) => (shots ? join(shots, "glow-" + mode + "-" + width + "-" + state + ".png") : undefined);
			const rest = await readRim("rest", GLOW_SEL, name("rest"));
			const hover = await readRim("hover", GLOW_SEL, name("hover"));
			if (shots) await cropRim(GLOW_SEL, join(shots, "glow-rim-4x-" + mode + "-" + width + ".png"));
			const plain = await readRim("rest", PLAIN_SEL);
			return { canvas, rest, hover, plain };
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
