// The Button glow variant, driven in headless Chrome with real pointer and focus input, in each colour mode. Per state
// (rest, hover, focus) it reads the computed box-shadow and the pixels of the outside band: the four rows just outside the
// button's edge, where the paleBlue halo is. Every band pixel must be tinted toward paleBlue, neither the canvas nor the
// primary fill. The fill is sampled at its top and bottom ends to show it is a gradient. The stock default button beside it
// is the control: it has no halo. One real click moves the example's count. The pixel maths is pure (measureBand) and is
// tested on a synthetic image as well as on the live page.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, freePort } from "./panel-overflow.ts";

export const GLOW_SEL = '[data-demo="button"] [data-glow-example]';
export const PLAIN_SEL = '[data-demo="button"] [data-slot="button"][data-variant="default"]';

/** Screenshot margin around the button: the focus ring sits 3px outside the border box. */
const MARGIN = 6;
/** The outside band in px: the four rows just outside the border box, where the halo and the focus ring are. */
const BAND = 4;
/** The halo colour as painted: the palette's paleBlue (#b3e5fc). */
const PALE: Rgb = [179, 229, 252];
/** Transitions and animations off while sampling, so a colour caught mid-fade is never measured. */
const QUIET = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

export type Rgb = [number, number, number];
export type State = "rest" | "hover" | "focus";

/** One state's measurement of the glow button. `outer` counts the outside band: every pixel in it should be tinted toward paleBlue. */
export interface Band {
	state: State;
	/** The painted fill, sampled inside the button at mid-height, 6px in from the left edge. */
	fill: Rgb | null;
	/** The gradient's two ends, sampled inside the button at mid-width, 3px in from the top edge and from the bottom edge. */
	top: Rgb | null;
	bottom: Rgb | null;
	/** The bg role's value: a probe element with `bg-background`, the canvas colour. */
	bg: Rgb | null;
	/** The surface 5px left of the outer edge: the catalogue cell the button sits in. */
	surface: Rgb | null;
	/** The border box's top and left in document pixels: the hover lift moves the top. */
	box: { T: number; L: number };
	/** The outside band, the rows 1 to 4px outside the border box. Each pixel is the canvas, the fill or a gradient end, the focus ring, tinted toward paleBlue, or other. */
	outer: { total: number; canvas: number; fill: number; ring: number; tinted: number; strong: number; other: number };
	focusVisible: boolean;
	shadow: string;
}
/** Geometry read from the page, in document pixels. */
export interface Geo { L: number; T: number; R: number; B: number; radius: number; fill: string; bg: string; focusVisible: boolean; shadow: string }

export interface ModeReading {
	canvas: string;
	/** The glow button at rest: its computed box-shadow (`halo`), and whether that shadow carries the paleBlue halo. */
	halo: string;
	paleInHalo: boolean;
	hoverShadow: string;
	focusShadow: string;
	/** The stock default button at rest: no halo, its own box-shadow. */
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

/** Whether a computed box-shadow carries the paleBlue halo (Chrome prints the colour as rgb(179, 229, 252)). */
export const paleIn = (shadow: string) => shadow.includes("rgb(179, 229, 252)");
/** Whether the computed box-shadow has an outer 3px ring (the stock focus-visible ring is one). */
export const hasOuterRing = (shadow: string) => /0px 0px 0px 3px(?! inset)/.test(shadow);

/**
 * Measures the outside band from decoded RGBA pixels of a screenshot taken at `clip` (document pixels). Pure: no browser, so
 * the counting is testable on a synthetic image. A pixel is in the band when its centre is 0 to 4px outside the border box;
 * the corner squares (the radius plus 1px) are skipped, where the arc is anti-aliased. A band pixel is one of: the focus ring
 * (3px, blue: blue minus red over 90, where the paleBlue halo never exceeds 73), the canvas, the fill or a gradient end, tinted
 * toward paleBlue (nearer paleBlue than the canvas is, and bluer than it), or other. Of the tinted, `strong` is those at least a
 * quarter of the way to paleBlue with a clear blue margin: the halo, as opposed to a faintly bluer border line.
 */
export function measureBand(state: State, img: { w: number; h: number; d: number[] }, clip: { x: number; y: number }, geo: Geo): Band {
	const px = (ix: number, iy: number): Rgb => {
		const i = (iy * img.w + ix) * 4;
		return [img.d[i]!, img.d[i + 1]!, img.d[i + 2]!];
	};
	const at = (x: number, y: number) => px(Math.floor(x - clip.x), Math.floor(y - clip.y));
	const same = (a: Rgb, b: Rgb) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
	const dist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
	const blueness = (c: Rgb) => c[2] - c[0];
	const midX = (geo.L + geo.R) / 2;
	const midY = (geo.T + geo.B) / 2;
	const fill = at(geo.L + 6, midY);
	const top = at(midX, geo.T + 3);
	const bottom = at(midX, geo.B - 3);
	const surface = at(geo.L - 5, midY);
	const bg = rgbOf(geo.bg);
	if (!bg) throw new Error("bg role probe did not resolve to a colour: " + geo.bg);
	const ends = [fill, top, bottom];
	const out: Band = {
		state,
		fill,
		top,
		bottom,
		bg,
		surface,
		box: { T: geo.T, L: geo.L },
		outer: { total: 0, canvas: 0, fill: 0, ring: 0, tinted: 0, strong: 0, other: 0 },
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
			if (depth >= 0 || depth <= -BAND) continue;
			const c = px(ix, iy);
			out.outer.total++;
			if (depth > -3 && blueness(c) > 90) out.outer.ring++;
			else if (same(c, bg)) out.outer.canvas++;
			else if (ends.some((e) => e && same(c, e))) out.outer.fill++;
			else if (dist(c, PALE) < dist(bg, PALE) && blueness(c) > blueness(bg)) {
				out.outer.tinted++;
				// strong: at least a quarter of the way to paleBlue, with a clear blue margin (a 1px panel border is weakly bluer)
				if (dist(c, PALE) <= 0.75 * dist(bg, PALE) && blueness(c) >= blueness(bg) + 8) out.outer.strong++;
			}
			else out.outer.other++;
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
				paleInHalo: paleIn(rest.shadow),
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
