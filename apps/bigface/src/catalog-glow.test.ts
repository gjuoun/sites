import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { type GlowRun, GLOW_SEL, hasOuterRing, insetRingRgb, type ModeReading, measureBand, type Geo, rgbOf, runGlow } from "./catalog-glow.ts";
import { findChrome } from "./panel-overflow.ts";

// The Button glow variant (a variant in ui/button.tsx, not a composite). The ring is an INSET ring in the bg role: it is drawn
// inside the primary fill, just under the edge, so the canvas colour reads as a cut line. Measured in headless Chrome: the
// computed box-shadow, the pixels of the edge band (light and dark, 1440 and 390), the hover state, and the focus state, where
// the glow ring and the stock focus ring must both be present. The stock default button is the control: it has no ring.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

const CANVAS = { light: "rgb(248, 248, 240)", dark: "rgb(37, 41, 37)" } as const;

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

// The sampler is checked on a synthetic image first, where the answer is known. A 40x30 button (radius 0) with its 3px inset
// ring in the canvas colour: 360 ring pixels (depth 1 to 4) and 492 edge-band pixels (depth 0 to 4, less the four corner
// pixels), all canvas. With the ring left in the fill instead, no edge pixel differs from the fill: that is the FAIL the live
// test guards against.
describe("the edge-band sampler, on a synthetic image", () => {
	const FILL: [number, number, number] = [0, 176, 255];
	const BG: [number, number, number] = [248, 248, 240];
	const geo: Geo = { L: 10, T: 10, R: 50, B: 40, radius: 0, fill: "rgb(0, 176, 255)", bg: "rgb(248, 248, 240)", focusVisible: false, shadow: "" };
	const image = (ring: boolean) => {
		const w = 60, h = 50, d = new Array<number>(w * h * 4);
		for (let iy = 0; iy < h; iy++)
			for (let ix = 0; ix < w; ix++) {
				const cx = ix + 0.5, cy = iy + 0.5;
				const inside = cx > 10 && cx < 50 && cy > 10 && cy < 40;
				const depth = Math.min(cx - 10, 50 - cx, cy - 10, 40 - cy);
				const c = !inside || (ring && depth < 4) ? BG : FILL;
				const i = (iy * w + ix) * 4;
				d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
			}
		return { w, h, d };
	};
	test("an inset ring in the bg colour counts as 360 ring pixels and 492 edge pixels, all of them bg", () => {
		const b = measureBand("rest", image(true), { x: 0, y: 0 }, geo);
		expect(b.fill).toEqual(FILL);
		expect(b.bg).toEqual(BG);
		expect(b.ring).toEqual({ total: 360, differ: 360, bg: 360 });
		expect(b.border).toEqual({ total: 132, differ: 132, surface: 132, other: 0 });
		expect(b.outer.differ).toBe(0);
	});
	test("with no ring, zero edge pixels differ from the fill: the live test reads that as a FAIL", () => {
		const b = measureBand("rest", image(false), { x: 0, y: 0 }, geo);
		expect(b.border.differ).toBe(0);
		expect(b.ring.differ).toBe(0);
	});
});

// One browser run per width, shared by the live tests below.
const runs = new Map<number, Promise<GlowRun>>();
const runAt = (width: number) => {
	if (!runs.has(width)) runs.set(width, runGlow(dist, "/ui/business/", width));
	return runs.get(width)!;
};

const modes = ["light", "dark"] as const;

for (const width of [1440, 390]) {
	describe("at " + width + "px", () => {
		test.skipIf(!findChrome())(
			"the glow ring is an inset ring in the bg role, in light and dark, and the stock default draws none",
			async () => {
				const r = await runAt(width);
				expect(r.initialMode, "starts light").toBe("light");
				for (const mode of modes) {
					const m = r[mode];
					expect(m.canvas, mode + " canvas").toBe(CANVAS[mode]);
					expect(m.halo, mode + ": the glow has a 3px inset ring").toContain("0px 0px 0px 3px inset");
					expect(m.haloRgb, mode + ": the inset ring is the bg role").toEqual(rgbOf(m.canvas));
					expect(hasOuterRing(m.halo), mode + ": no outer ring at rest").toBe(false);
					expect(m.defaultShadow, mode + ": the stock default has no ring").not.toContain("0px 0px 0px 3px");
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"the edge band is measured: it differs from the primary fill, every differing pixel is the bg role, in light and dark",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const rest = m.band.rest;
					expect(rest.bg, mode + ": the bg role probe").toEqual(rgbOf(m.canvas));
					expect(rest.ring.total, mode + ": ring pixels sampled").toBeGreaterThan(0);
					expect(rest.ring.differ, mode + ": a glow with zero differing ring pixels is a FAIL").toBeGreaterThan(0);
					expect(rest.ring.bg, mode + ": every ring pixel that differs from the fill is the bg role").toBe(rest.ring.differ);
					console.log("census " + mode + " " + width + "px: ring " + JSON.stringify(rest.ring) + " border " + JSON.stringify(rest.border) + " outer " + JSON.stringify(rest.outer) + " hover ring " + JSON.stringify(m.band.hover.ring) + " focus outer " + JSON.stringify(m.band.focus.outer));
					expect(rest.outer.differ, mode + ": no outer ring at rest: the pixels outside match the surface behind").toBe(0);
					expect(rest.border.other, mode + ": the border row is the fill or the surface behind, nothing else").toBe(0);
					expect(m.plain.fill, mode + ": glow and stock default paint the same primary fill").toEqual(rest.fill);
					expect(m.plain.ring.differ, mode + ": the stock default has no ring").toBe(0);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover keeps the inset ring and its band in light and dark",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const h = m.band.hover;
					expect(insetRingRgb(m.hoverShadow), mode + ": hover keeps the inset ring").toEqual(rgbOf(m.canvas));
					expect(h.ring.total, mode + ": hover ring pixels sampled").toBeGreaterThan(0);
					expect(h.ring.differ, mode + ": hover ring differs from the painted fill").toBeGreaterThan(0);
					expect(h.ring.bg, mode + ": every hover ring pixel that differs from the fill is the bg role").toBe(h.ring.differ);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"focus: the glow ring and the stock focus ring are both present, and the focus ring is painted outside the button",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const f = m.band.focus;
					expect(f.focusVisible, mode + ": :focus-visible matches").toBe(true);
					expect(insetRingRgb(m.focusShadow), mode + ": focus keeps the inset ring").toEqual(rgbOf(m.canvas));
					expect(hasOuterRing(m.focusShadow), mode + ": focus adds the stock outer ring").toBe(true);
					expect(f.ring.bg, mode + ": every focus ring pixel is the bg role").toBe(f.ring.total);
					expect(f.outer.differ, mode + ": the focus ring is painted outside the button").toBeGreaterThan(0);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"one real click moves the glow example's count",
			async () => {
				const r = await runAt(width);
				expect(r.textBefore).toBe("Glowed 0×");
				expect(r.textAfterClick, "a real click counts").toBe("Glowed 1×");
			},
			240_000,
		);
	});
}
