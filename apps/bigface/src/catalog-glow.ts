// The Button glow variant, driven in headless Chrome with real pointer and focus input, in each colour mode. Per state
// (rest, hover, focus) it reads the computed box-shadow and the pixels of the glow's own edge band, taken from a
// screenshot and compared with the painted primary fill and with the bg role's value. The stock default button beside it
// is the control. One real click moves the example's count. The pixel maths is pure (measureBand) and is tested on a
// synthetic image as well as on the live page.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export const GLOW_SEL = '[data-demo="button"] [data-glow-example]';
export const PLAIN_SEL = '[data-demo="button"] [data-slot="button"][data-variant="default"]';

/** Screenshot margin around the button: the focus ring sits 3px outside the border box. */
const MARGIN = 6;
/** The edge band in px from the outer edge: the 1px border (transparent, so the canvas shows) and the 3px inset ring. */
const BAND = 4;
/** Transitions and animations off while sampling, so a colour caught mid-fade is never measured. */
const QUIET = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export type Rgb = [number, number, number];
export type State = "rest" | "hover" | "focus";

/** One state's measurement of the glow button. `differ` counts edge pixels that are not the painted fill; `bg` counts those equal to the bg role. */
export interface Band {
	state: State;
	/** The painted fill, sampled inside the button (hover paints it at 80%, so this is what is on screen). */
	fill: Rgb | null;
	/** The bg role's value: a probe element with `bg-background`, the class the glow ring uses. */
	bg: Rgb | null;
	/** The surface behind the button (the card it sits on), sampled 5px outside the outer edge. */
	surface: Rgb | null;
	/** The 3px inset ring: px 1 to 4 inside the outer edge. `differ` counts ring pixels that are not the painted fill. */
	ring: { total: number; differ: number; bg: number };
	/** The border row: px 0 to 1 inside the outer edge. The 1px border is transparent in the stock, so the surface behind shows through. */
	border: { total: number; differ: number; surface: number; other: number };
	/** Border-row pixels that are neither the fill nor the bg role, with depth and colour (the first 12). */
	odd: { depth: number; c: Rgb }[];
	/** The outside band: px 1 to 4 outside the border box; `differ` counts pixels that are not the surface behind (an outer ring). */
	outer: { total: number; differ: number };
	focusVisible: boolean;
	shadow: string;
}

/** Geometry read from the page, in document pixels. */
export interface Geo { L: number; T: number; R: number; B: number; radius: number; fill: string; bg: string; focusVisible: boolean; shadow: string }

export interface ModeReading {
	canvas: string;
	/** The glow button at rest: its computed box-shadow (`halo`) and the inset ring's colour. */
	halo: string;
	haloRgb: Rgb | null;
	hoverShadow: string;
	focusShadow: string;
	/** The stock default button at rest: no ring, its own box-shadow. */
	defaultShadow: string;
	band: { rest: Band; hover: Band; focus: Band };
	plain: Band;
}

export interface GlowRun {
	initialMode: string | undefined;
	light: ModeReading;
	dark: ModeReading;
	textBefore: string;
	textAfterClick: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The first rgb() in a computed colour string (the canvas background). */
export function rgbOf(colour: string): Rgb | null {
	const m = /rgba?\((\d+), (\d+), (\d+)/.exec(colour);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** The colour of the inset 3px ring in a computed box-shadow (Tailwind inset-ring-3 is `inset 0 0 0 3px`). */
export function insetRingRgb(shadow: string): Rgb | null {
	const m = /(rgba?\((\d+), (\d+), (\d+))(?:, [\d.]+)?\) 0px 0px 0px 3px inset/.exec(shadow);
	return m ? [Number(m[2]), Number(m[3]), Number(m[4])] : null;
}

/** Whether the computed box-shadow has an outer 3px ring (the stock focus-visible ring is one). */
export const hasOuterRing = (shadow: string) => /0px 0px 0px 3px(?! inset)/.test(shadow);

/**
 * Measures the glow's edge band from decoded RGBA pixels of a screenshot taken at `clip` (document pixels). Pure: no browser,
 * so the counting is testable on a synthetic image. A pixel counts for the edge band when its centre is inside the button and
 * less than BAND px from the outer edge; the corner squares (the radius plus 1px) are skipped, where the arc is anti-aliased.
 */
export function measureBand(
	state: State,
	img: { w: number; h: number; d: number[] },
	clip: { x: number; y: number },
	geo: Geo,
): Band {
	const px = (ix: number, iy: number): Rgb => {
		const i = (iy * img.w + ix) * 4;
		return [img.d[i]!, img.d[i + 1]!, img.d[i + 2]!];
	};
	const at = (x: number, y: number) => px(Math.floor(x - clip.x), Math.floor(y - clip.y));
	const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	// The painted fill: inside the button at mid-height, 6px in from the left edge (the label starts at 10px of padding).
	const fill = at(geo.L + 6, (geo.T + geo.B) / 2);
	const surface = at(geo.L - 5, (geo.T + geo.B) / 2);
	const bg = rgbOf(geo.bg);
	if (!bg) throw new Error("bg role probe did not resolve to a colour: " + geo.bg);
	const out: Band = {
		state,
		fill,
		bg,
		surface,
		ring: { total: 0, differ: 0, bg: 0 },
		border: { total: 0, differ: 0, surface: 0, other: 0 },
		odd: [],
		outer: { total: 0, differ: 0 },
		focusVisible: geo.focusVisible,
		shadow: geo.shadow,
	};
	const corner = geo.radius + 1;
	for (let iy = 0; iy < img.h; iy++)
		for (let ix = 0; ix < img.w; ix++) {
			const cx = clip.x + ix + 0.5;
			const cy = clip.y + iy + 0.5;
			if ((cx - geo.L < corner || geo.R - cx < corner) && (cy - geo.T < corner || geo.B - cy < corner)) continue;
			const depth = Math.min(cx - geo.L, geo.R - cx, cy - geo.T, geo.B - cy);
			const c = px(ix, iy);
			const isBg = same(c, bg);
			const isSurface = same(c, surface);
			if (depth > 0) {
				if (depth < 1) {
					out.border.total++;
					if (!same(c, fill)) out.border.differ++;
					if (isSurface) out.border.surface++;
					if (!same(c, fill) && !isSurface) {
						out.border.other++;
						if (out.odd.length < 12) out.odd.push({ depth, c });
					}
				} else if (depth < BAND) {
					out.ring.total++;
					if (!same(c, fill)) out.ring.differ++;
					if (isBg) out.ring.bg++;
				}
			} else if (depth > -BAND) {
				out.outer.total++;
				if (!isSurface) out.outer.differ++;
			}
		}
	return out;
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
		const scrollTo = (sel: string) => evaluate("document.querySelector(" + JSON.stringify(sel) + ").scrollIntoView({ block: 'center', behavior: 'instant' })");
		const moveMouse = (x: number, y: number) => send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 });
		const moveTo = async (sel: string) => {
			const at = JSON.parse(await evaluate("(() => { const r = document.querySelector(" + JSON.stringify(sel) + ").getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()"));
			await moveMouse(at.x, at.y);
			await sleep(250);
		};
		// Geometry in document pixels, the computed box-shadow, and the bg role's value from a probe with the bg-background class.
		const geoOf = (sel: string) =>
			evaluate(
				"JSON.stringify((() => { const el = document.querySelector(" + JSON.stringify(sel) + "); const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const probe = document.createElement('div'); probe.className = 'bg-background'; document.body.appendChild(probe); const bg = getComputedStyle(probe).backgroundColor; probe.remove(); return { L: r.left + scrollX, T: r.top + scrollY, R: r.right + scrollX, B: r.bottom + scrollY, radius: parseFloat(cs.borderTopLeftRadius) || 0, fill: cs.backgroundColor, bg, focusVisible: el.matches(':focus-visible'), shadow: cs.boxShadow }; })())",
			).then((s: string) => JSON.parse(s) as Geo);
		// Screenshot of the button and its margin, decoded in the page (canvas getImageData), then measured here.
		const sample = async (sel: string, state: State): Promise<Band> => {
			const geo = await geoOf(sel);
			const clip = { x: Math.floor(geo.L) - MARGIN, y: Math.floor(geo.T) - MARGIN, width: Math.ceil(geo.R) - Math.floor(geo.L) + 2 * MARGIN, height: Math.ceil(geo.B) - Math.floor(geo.T) + 2 * MARGIN, scale: 1 };
			const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip });
			const img = JSON.parse(
				await evaluate(
					"(async () => { const img = new Image(); img.src = 'data:image/png;base64," + shot.data + "'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return JSON.stringify({ w: img.width, h: img.height, d: Array.from(g.getImageData(0, 0, img.width, img.height).data) }); })()",
				),
			);
			if (img.w !== clip.width || img.h !== clip.height) throw new Error("screenshot is " + img.w + "x" + img.h + ", expected " + clip.width + "x" + clip.height);
			return measureBand(state, img, clip, geo);
		};
		// Each state is set by real input: hover by the pointer, focus by the focus API with focus-visible, rest with the pointer away.
		const readBand = async (state: State, sel: string): Promise<Band> => {
			await scrollTo(sel);
			await sleep(250);
			if (state === "hover") await moveTo(sel);
			else await moveMouse(1, 1);
			if (state === "focus") {
				await evaluate("document.querySelector(" + JSON.stringify(sel) + ").focus({ focusVisible: true })");
				await sleep(150);
			}
			return sample(sel, state);
		};
		const readMode = async (): Promise<ModeReading> => {
			const canvas = await evaluate("getComputedStyle(document.body).backgroundColor");
			const rest = await readBand("rest", GLOW_SEL);
			const hover = await readBand("hover", GLOW_SEL);
			const focus = await readBand("focus", GLOW_SEL);
			const plain = await readBand("rest", PLAIN_SEL);
			return {
				canvas,
				halo: rest.shadow,
				haloRgb: insetRingRgb(rest.shadow),
				hoverShadow: hover.shadow,
				focusShadow: focus.shadow,
				defaultShadow: plain.shadow,
				band: { rest, hover, focus },
				plain,
			};
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
		const light = await readMode();
		const textBefore = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await clickGlow();
		const textAfterClick = await evaluate("document.querySelector(" + JSON.stringify(GLOW_SEL) + ").textContent.trim()");
		await press("Dark");
		const dark = await readMode();
		return { initialMode, light, dark, textBefore, textAfterClick };
	} finally {
		ws?.close();
		proc.kill();
		server.stop(true);
		rmSync(profile, { recursive: true, force: true });
	}
}
