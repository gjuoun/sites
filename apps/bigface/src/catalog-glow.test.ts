import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { runGlow } from "./catalog-glow.ts";
import { findChrome } from "./panel-overflow.ts";

// The Button glow variant (a variant in ui/button.tsx, not a composite). In a real browser the glow example draws a 3px
// halo in --color-glow-halo in each mode, the stock default button beside it draws none, and one real click moves the
// example's count. The halo is decorative; its measured contrast against the canvas is pinned to the derivation.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

const HALO = { light: [175, 221, 249], dark: [46, 92, 117] } as const;
const CANVAS = { light: "rgb(248, 248, 240)", dark: "rgb(37, 41, 37)" } as const;

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

for (const width of [1440, 390]) {
	test.skipIf(!findChrome())(
		"at " + width + "px: the glow halo is drawn in light and dark, and the stock default button draws none",
		async () => {
			const r = await runGlow(dist, "/ui/business/", width);
			expect(r.initialMode, "starts light").toBe("light");
			expect(r.light.canvas).toBe(CANVAS.light);
			expect(r.light.haloRgb, "light halo is glow-halo light").toEqual([...HALO.light]);
			expect(r.light.defaultShadow, "stock default has no halo (light)").not.toContain("175, 221, 249");
			expect(r.dark.canvas).toBe(CANVAS.dark);
			expect(r.dark.haloRgb, "dark halo is glow-halo dark").toEqual([...HALO.dark]);
			expect(r.dark.defaultShadow, "stock default has no halo (dark)").not.toContain("46, 92, 117");
		},
		240_000,
	);

	test.skipIf(!findChrome())(
		"at " + width + "px: one real click moves the glow example's count, and the halo contrast is 1.25:1 or more in both modes",
		async () => {
			const r = await runGlow(dist, "/ui/business/", width);
			expect(r.textBefore).toBe("Glowed 0×");
			expect(r.textAfterClick, "a real click counts").toBe("Glowed 1×");
			expect(r.light.contrast ?? 0, "light halo vs canvas").toBeGreaterThanOrEqual(1.25);
			expect(r.light.contrast ?? 0).toBeCloseTo(1.35, 1);
			expect(r.dark.contrast ?? 0, "dark halo vs canvas").toBeGreaterThanOrEqual(1.25);
			expect(r.dark.contrast ?? 0).toBeCloseTo(2.04, 1);
		},
		240_000,
	);
}
