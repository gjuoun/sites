import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { rgbOf, runGlow } from "./catalog-glow.ts";
import { findChrome } from "./panel-overflow.ts";

// The Button glow variant (a variant in ui/button.tsx, not a composite). In a real browser the glow example draws a 3px
// ring in the canvas colour in each mode (ring-background: the bg role, no colour token of its own), the stock default
// button beside it draws no ring, and one real click moves the example's count. The ring is pinned to the canvas, not to
// a value: a palette change moves the ring and the canvas together.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

const CANVAS = { light: "rgb(248, 248, 240)", dark: "rgb(37, 41, 37)" } as const;

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

for (const width of [1440, 390]) {
	test.skipIf(!findChrome())(
		"at " + width + "px: the glow ring is drawn in the canvas colour in light and dark, and the stock default button draws no ring",
		async () => {
			const r = await runGlow(dist, "/ui/business/", width);
			expect(r.initialMode, "starts light").toBe("light");
			expect(r.light.canvas).toBe(CANVAS.light);
			expect(r.light.haloRgb, "light ring is the canvas colour").toEqual(rgbOf(r.light.canvas));
			expect(r.light.halo, "light glow has a 3px ring").toContain("0px 0px 0px 3px");
			expect(r.light.defaultShadow, "stock default has no ring (light)").not.toContain("0px 0px 0px 3px");
			expect(r.dark.canvas).toBe(CANVAS.dark);
			expect(r.dark.haloRgb, "dark ring is the canvas colour").toEqual(rgbOf(r.dark.canvas));
			expect(r.dark.halo, "dark glow has a 3px ring").toContain("0px 0px 0px 3px");
			expect(r.dark.defaultShadow, "stock default has no ring (dark)").not.toContain("0px 0px 0px 3px");
		},
		240_000,
	);

	test.skipIf(!findChrome())(
		"at " + width + "px: one real click moves the glow example's count",
		async () => {
			const r = await runGlow(dist, "/ui/business/", width);
			expect(r.textBefore).toBe("Glowed 0×");
			expect(r.textAfterClick, "a real click counts").toBe("Glowed 1×");
		},
		240_000,
	);
}
