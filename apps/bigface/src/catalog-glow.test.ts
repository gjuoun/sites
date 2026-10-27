import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { BLUE, GRADIENT_BINS, type Geo, GLOW_SEL, type GlowRun, type Img, LIME, measureRim, type Rgb, rgbOf, runGlow } from "./catalog-glow.ts";
import { findChrome } from "./panel-overflow.ts";

// The Button glow variant is a plain primary fill at rest, and on hover a 1px rim over the fill's outermost ring: the reference
// card's gradient (140deg; blue at 55, lime at 12 at 45, transparent at 70) cut to a hairline. Measured in headless Chrome, in
// light and dark, at 1440 and 390: at rest the rim band is the fill and the border shows the cell; on hover the band carries a lime
// tint on the fill-to-lime line, peaking at the gradient's 45 percent and absent from 70 percent on; the border stays the cell surface,
// so the rim never leaves the button; the fill and the ink do not change. Set GLOW_SHOTS to a directory to write the PNGs.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");
const shots = process.env.GLOW_SHOTS;

const CANVAS = { light: "rgb(248, 248, 240)", dark: "rgb(37, 41, 37)" } as const;
const modes = ["light", "dark"] as const;

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
	if (shots) mkdirSync(shots, { recursive: true });
}, 120_000);

const lum = (c: Rgb) => {
	const f = (v: number) => {
		const x = v / 255;
		return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a: Rgb, b: Rgb) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
	return (hi + 0.05) / (lo + 0.05);
};

// The sampler is checked on a synthetic image first, where the answer is known. A 40x30 button at x 10 to 50, y 10 to 40, radius 0.
// Pixels 0 to 1px outside the box are the transparent border; 1 to 2px inside are the rim band; the rest is the fill.
const BG: Rgb = [248, 248, 240];
const FILL = BLUE;
const geo: Geo = { L: 10, T: 10, R: 50, B: 40, radius: 0, fill: "rgb(0, 176, 255)", bg: "rgb(248, 248, 240)", ink: "rgb(47, 51, 47)", shadow: "none" };
const paint = (pick: (depth: number, cx: number, cy: number) => Rgb): Img => {
	const w = 60, h = 50, d = new Array<number>(w * h * 4);
	for (let iy = 0; iy < h; iy++)
		for (let ix = 0; ix < w; ix++) {
			const cx = ix + 0.5, cy = iy + 0.5;
			const depth = Math.min(cx - 10, 50 - cx, cy - 10, 40 - cy);
			const c = depth <= 0 ? BG : pick(depth, cx, cy);
			const i = (iy * w + ix) * 4;
			d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
		}
	return { w, h, d };
};
const onLime = (a: number): Rgb => [0, 1, 2].map((i) => Math.round(FILL[i]! + a * (LIME[i]! - FILL[i]!))) as Rgb;

describe("the rim sampler, on a synthetic image", () => {
	test("at rest: the band is the fill, no pixel is tinted, and the border ring is the cell surface", () => {
		const r = measureRim("rest", paint((depth) => (depth < 1 ? BG : FILL)), { x: 0, y: 0 }, geo);
		expect(r.band.total).toBeGreaterThan(0);
		expect(r.band.fill).toBe(r.band.total);
		expect(r.band.lime).toBe(0);
		expect(r.band.other).toBe(0);
		expect(r.ring.surface).toBe(r.ring.total);
		expect(r.ring.total).toBeGreaterThan(0);
	});
	test("on hover: a band pixel at 12 percent lime is counted as a lime tint, and the bins add up", () => {
		const r = measureRim("hover", paint((depth) => (depth < 2 ? onLime(0.12) : FILL)), { x: 0, y: 0 }, geo);
		expect(r.band.lime).toBe(r.band.total);
		expect(r.band.other).toBe(0);
		expect(r.band.maxA).toBeCloseTo(0.12, 1);
		expect(r.bins.reduce((s, b) => s + b.n, 0)).toBe(r.band.total);
		expect(r.bins.length).toBe(GRADIENT_BINS);
	});
	test("a band pixel off the fill-to-lime line is other, not a tint", () => {
		const r = measureRim("hover", paint((depth) => (depth < 2 ? [200, 100, 100] : FILL)), { x: 0, y: 0 }, geo);
		expect(r.band.other).toBe(r.band.total);
		expect(r.band.lime).toBe(0);
	});
	test("a tint in the transparent border is counted as ring other: the rim would leave the button", () => {
		const r = measureRim("hover", paint((depth) => (depth < 1 ? onLime(0.12) : FILL)), { x: 0, y: 0 }, geo);
		expect(r.ring.other).toBe(r.ring.total);
		expect(r.ring.surface).toBe(0);
	});
});

// One browser run per width and call, shared by the live tests below.
const runs = new Map<number, Promise<GlowRun>>();
const runAt = (width: number) => {
	if (!runs.has(width)) runs.set(width, runGlow(dist, "/ui/business/", width, shots));
	return runs.get(width)!;
};

const census = (label: string, r: { band: Record<string, number> }) => console.log(label + " " + JSON.stringify(r.band));

for (const width of [1440, 390]) {
	describe("at " + width + "px", () => {
		test.skipIf(!findChrome())(
			"rest: no rim. The band is the fill, and the border ring is the cell surface; the stock default is the control",
			async () => {
				const r = await runAt(width);
				expect(r.initialMode, "starts light").toBe("light");
				for (const mode of modes) {
					const m = r[mode];
					const rest = m.rest;
					census(mode + " " + width + " rest band", rest);
					expect(m.canvas, mode + " canvas").toBe(CANVAS[mode]);
					expect(rest.band.total, mode + ": band sampled").toBeGreaterThan(0);
					expect(rest.band.fill, mode + ": a rest rim pixel is a fill pixel").toBe(rest.band.total);
					expect(rest.band.lime, mode + ": no lime tint at rest").toBe(0);
					expect(rest.band.other, mode + ": no other colour in the band at rest").toBe(0);
					expect(rest.ring.surface, mode + ": the border ring is the cell surface behind the button at rest").toBe(rest.ring.total);
					expect(rest.ring.total, mode + ": border ring sampled").toBeGreaterThan(0);
					expect(m.plain.band.lime, mode + ": the stock default has no rim (control)").toBe(0);
					expect(m.plain.band.fill, mode + ": the stock default band is its fill (control)").toBe(m.plain.band.total);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover: the rim fades in. The band carries lime tint, every tinted pixel is on the fill-to-lime line, and the border stays the cell surface",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const h = r[mode].hover;
					census(mode + " " + width + " hover band", h);
					expect(h.band.total, mode + ": band sampled").toBeGreaterThan(0);
					expect(h.band.lime, mode + ": hover rim has lime-tinted pixels").toBeGreaterThan(0);
					expect(h.band.other, mode + ": every rim pixel is fill or lime tint").toBe(0);
					expect(h.band.canvas, mode + ": no hover band pixel is the canvas").toBe(0);
					expect(h.band.maxA, mode + ": strongest lime tint is the reference 12 percent").toBeGreaterThan(0.1);
					expect(h.band.maxA, mode + ": not above the reference 12 percent").toBeLessThanOrEqual(0.13);
					expect(h.ring.surface, mode + ": the border ring stays the cell surface on hover").toBe(h.ring.total);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover: the gradient runs along 140deg; lime peaks near the 45 percent stop and is absent from 70 percent on",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const bins = r[mode].hover.bins;
					const limeOf = (b: { lime: number; maxA: number }) => b.lime;
					const peak = bins.reduce((best, b, i) => (b.maxA > bins[best]!.maxA ? i : best), 0);
					console.log(mode + " " + width + " gradient bins (n/lime/maxA): " + bins.map((b) => b.n + "/" + b.lime + "/" + b.maxA.toFixed(3)).join(" "));
					expect(peak, mode + ": the strongest lime is in the 0.3 to 0.5 bins (45 percent)").toBeGreaterThanOrEqual(3);
					expect(peak, mode + ": the strongest lime is in the 0.3 to 0.5 bins (45 percent)").toBeLessThanOrEqual(4);
					for (let i = 7; i < bins.length; i++) expect(limeOf(bins[i]!), mode + ": no lime past 70 percent, bin " + i).toBe(0);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover keeps the fill and the ink unchanged, and the ink reads on the fill (WCAG 4.5)",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const { rest, hover } = r[mode];
					expect(hover.fill, mode + ": the fill is the same at rest and on hover").toEqual(rest.fill);
					expect(hover.ink, mode + ": the ink is the same at rest and on hover").toBe(rest.ink);
					const ink = rgbOf(hover.ink)!;
					expect(contrast(ink, hover.fill!), mode + ": the ink on the fill is at least 4.5:1").toBeGreaterThanOrEqual(4.5);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover lifts the button 2px, adds no shadow, and one real click moves the glow example's count",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const { rest, hover } = r[mode];
					expect(hover.box.T, mode + ": hover lifts the button 2px").toBe(rest.box.T - 2);
					expect(rest.shadow, mode + ": no shadow at rest").toBe("none");
					expect(hover.shadow, mode + ": no shadow on hover").toBe("none");
				}
				expect(r.textBefore).toBe("Glowed 0×");
				expect(r.textAfterClick, "a real click counts").toBe("Glowed 1×");
			},
			240_000,
		);
	});
}
