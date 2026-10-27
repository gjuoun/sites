import { beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { type Geo, GLOW_SEL, type GlowRun, hasOuterRing, measureBand, paleIn, type Rgb, runGlow } from "./catalog-glow.ts";
import { findChrome } from "./panel-overflow.ts";

// The Button glow variant (a variant in ui/button.tsx): a gradient primary fill with an outside halo in the palette's paleBlue,
// and the hover lift. Measured in headless Chrome: the computed box-shadow, and the four rows just outside the edge, which must
// all be tinted toward paleBlue (neither the canvas nor the fill), in light and dark, at 1440 and 390. Hover keeps the halo and
// lifts the button 2px. Focus keeps the stock focus ring above the halo. The stock default button is the control: no halo.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

const CANVAS = { light: "rgb(248, 248, 240)", dark: "rgb(37, 41, 37)" } as const;
const PALE: Rgb = [179, 229, 252];

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! * (1 - t) + b[i]! * t)) as Rgb;
const lum = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// The sampler is checked on a synthetic image first, where the answer is known. A 40x30 button (radius 0) with its edge at
// x 10 to 50 and y 10 to 40: the four rows outside it are 4px deep. A halo paints them paleBlue-tinted; with no halo they are
// the canvas, and that is the FAIL the live test guards against. A focus ring is 3px of blue over the halo.
describe("the outside-band sampler, on a synthetic image", () => {
	const FILL: Rgb = [0, 176, 255];
	const BG: Rgb = [248, 248, 240];
	const HALO: Rgb = mix(BG, PALE, 0.4);
	const geo: Geo = { L: 10, T: 10, R: 50, B: 40, radius: 0, fill: "rgb(0, 176, 255)", bg: "rgb(248, 248, 240)", focusVisible: false, shadow: "" };
	const image = (halo: Rgb | null, ring: boolean) => {
		const w = 60, h = 50, d = new Array<number>(w * h * 4);
		for (let iy = 0; iy < h; iy++)
			for (let ix = 0; ix < w; ix++) {
				const cx = ix + 0.5, cy = iy + 0.5;
				const inside = cx > 10 && cx < 50 && cy > 10 && cy < 40;
				const depth = Math.min(cx - 10, 50 - cx, cy - 10, 40 - cy);
				let c: Rgb = inside ? FILL : BG;
				if (!inside && halo && depth > -4 && depth < 0) c = halo;
				if (!inside && ring && depth > -3 && depth < 0) c = mix(halo ?? BG, FILL, 0.5);
				const i = (iy * w + ix) * 4;
				d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
			}
		return { w, h, d };
	};
	test("a paleBlue halo: every outside pixel is tinted, none is the canvas or the fill", () => {
		const b = measureBand("rest", image(HALO, false), { x: 0, y: 0 }, geo);
		expect(b.fill).toEqual(FILL);
		expect(b.top).toEqual(FILL);
		expect(b.outer.total).toBeGreaterThan(0);
		expect(b.outer).toEqual({ total: b.outer.total, canvas: 0, fill: 0, ring: 0, tinted: b.outer.total, strong: b.outer.total, other: 0 });
	});
	test("no halo: every outside pixel is the canvas, which the live test reads as a FAIL", () => {
		const b = measureBand("rest", image(null, false), { x: 0, y: 0 }, geo);
		expect(b.outer).toEqual({ total: b.outer.total, canvas: b.outer.total, fill: 0, ring: 0, tinted: 0, strong: 0, other: 0 });
	});
	test("a 3px focus ring over the halo is counted as ring; the fourth row is still the halo", () => {
		const b = measureBand("focus", image(HALO, true), { x: 0, y: 0 }, geo);
		expect(b.outer.ring).toBeGreaterThan(0);
		expect(b.outer.tinted).toBeGreaterThan(0);
		expect(b.outer.ring + b.outer.tinted).toBe(b.outer.total);
		expect(b.outer.canvas + b.outer.other).toBe(0);
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
			"the glow is a paleBlue halo outside the edge: the rest shadow carries it, with no inset ring, and the stock default has none",
			async () => {
				const r = await runAt(width);
				expect(r.initialMode, "starts light").toBe("light");
				for (const mode of modes) {
					const m = r[mode];
					expect(m.canvas, mode + " canvas").toBe(CANVAS[mode]);
					expect(m.paleInHalo, mode + ": the halo is the palette's paleBlue").toBe(true);
					expect(m.halo, mode + ": a 20px outside glow").toContain("20px -2px");
					expect(m.halo, mode + ": no inset ring").not.toContain("inset");
					expect(hasOuterRing(m.halo), mode + ": no focus ring at rest").toBe(false);
					expect(paleIn(m.defaultShadow), mode + ": the stock default has no halo").toBe(false);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"the outside band is tinted toward paleBlue at rest: no pixel is the canvas or the fill, in light and dark",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const rest = m.band.rest;
					const o = rest.outer;
					console.log("census " + mode + " " + width + "px: outside " + JSON.stringify(o) + " stock default outside " + JSON.stringify(m.plain.outer));
					expect(o.total, mode + ": outside pixels sampled").toBeGreaterThan(0);
					expect(o.canvas, mode + ": a zero-difference outside band is a FAIL: pixels equal to the canvas").toBe(0);
					expect(o.fill, mode + ": pixels equal to the primary fill").toBe(0);
					expect(o.ring, mode + ": no focus ring at rest").toBe(0);
					expect(o.other, mode + ": pixels neither canvas, fill nor tinted").toBe(0);
					expect(o.tinted, mode + ": every outside pixel is tinted toward paleBlue").toBe(o.total);
					expect(o.strong, mode + ": every outside pixel is a strong halo tint, not a faint border").toBe(o.total);
					expect(m.plain.outer.strong, mode + ": the stock default has no halo (the control)").toBe(0);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"the fill is a gradient: the top and bottom ends differ, and the bottom is the deeper blue",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const rest = r[mode].band.rest;
					console.log("gradient " + mode + " " + width + "px: top " + JSON.stringify(rest.top) + " bottom " + JSON.stringify(rest.bottom));
					expect(rest.top, mode + ": top sampled").not.toBeNull();
					expect(rest.bottom, mode + ": bottom sampled").not.toBeNull();
					expect(rest.bottom, mode + ": top and bottom differ").not.toEqual(rest.top);
					expect(lum(rest.bottom!), mode + ": the bottom end is the deeper edge").toBeLessThan(lum(rest.top!));
					expect(rest.top![2], mode + ": the fill is the blue family").toBeGreaterThan(rest.top![0]);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"hover keeps the halo, lifts the button 2px, and the outside band stays tinted",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const h = m.band.hover;
					expect(paleIn(m.hoverShadow), mode + ": hover keeps the paleBlue halo").toBe(true);
					expect(h.box.T, mode + ": hover lifts the button 2px").toBe(m.band.rest.box.T - 2);
					expect(h.outer.canvas, mode + ": hover: no outside pixel is the canvas").toBe(0);
					expect(h.outer.tinted, mode + ": hover: every outside pixel is tinted").toBe(h.outer.total);
				}
			},
			240_000,
		);

		test.skipIf(!findChrome())(
			"focus: the stock focus ring is drawn outside the halo, and the halo stays visible beyond it",
			async () => {
				const r = await runAt(width);
				for (const mode of modes) {
					const m = r[mode];
					const f = m.band.focus;
					expect(f.focusVisible, mode + ": :focus-visible matches").toBe(true);
					expect(hasOuterRing(m.focusShadow), mode + ": focus adds the stock 3px ring").toBe(true);
					expect(paleIn(m.focusShadow), mode + ": focus keeps the paleBlue halo").toBe(true);
					expect(f.outer.ring, mode + ": the focus ring is painted outside the edge").toBeGreaterThan(0);
					expect(f.outer.tinted, mode + ": the halo is visible beyond the ring").toBeGreaterThan(0);
					expect(f.outer.canvas, mode + ": no focus outside pixel is the bare canvas").toBe(0);
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
