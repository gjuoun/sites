import { beforeAll, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { runToggles } from "./catalog-toggles.ts";
import { findChrome, measurePanelColours } from "./panel-overflow.ts";

// The catalogue's two toggles, proven in a real browser. The mode toggle flips the whole page and a chosen mode survives
// a reload. The foreground comparison changes the foreground roles in light only, and is disabled in dark. The source
// checks pin the wiring: the pre-paint script on this page and the pre-bundled deps the dev server needs.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");
const pkgThemes = join(siteDir, "../../packages/bigface-business-ui/src/themes");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

for (const width of [1440, 390]) {
	test.skipIf(!findChrome())(
		"the toggles work at " + width + "px: the mode flips the page, the foreground comparison is light only, and a chosen mode survives a reload",
		async () => {
			const r = await runToggles(dist, "/ui/business/", width);
			expect(r.initial.mode, "starts light").toBe("light");
			expect(r.dark.mode).toBe("dark");
			expect(r.dark.canvas, "the dark canvas is the dark paper").toBe("rgb(37, 41, 37)");
			expect(r.light.canvas, "the light canvas is the paper").toBe("rgb(248, 248, 240)");
			// the foreground comparison: native changes the link and ring token in light; toned restores it
			expect(r.nativeLight.fg).toBe("native");
			expect(r.nativeLight.primaryInk, "native light: the palette's own blue").toBe("#00b0ff");
			expect(r.nativeLight.canvas, "a foreground swap leaves the surfaces alone").toBe(r.light.canvas);
			expect(r.tonedAgain.fg).toBe("toned");
			expect(r.tonedAgain.primaryInk, "toned restores the derived blue").toBe(r.initial.primaryInk);
			// light only: the comparison is disabled in dark, and nothing reaches dark
			expect(r.foregroundsDisabledInDark, "foreground toggle disabled in dark").toBe(true);
			expect(r.nativeInDark.fg, "no foreground choice is set in dark").toBeUndefined();
			expect(r.nativeInDark.primaryInk, "dark keeps its own foreground").toBe(r.dark.primaryInk);
			// the chosen mode survives a reload; the comparison does not (default toned)
			expect(r.afterReloadWithDark.mode, "dark survives a reload").toBe("dark");
		},
		360_000,
	);
}

test.skipIf(!findChrome())(
	"in light, the native comparison paints nothing outside the synced palettes, and the audit reads the page",
	async () => {
		// After the ruling the light accents ARE the native palette, so the comparison has no colour to add. What is
		// still true, and checked here: the page reads colours (a vacuous audit fails), and no painted colour is
		// dark-only, so nothing reaches a light surface from outside the synced palettes.
		const audit = await measurePanelColours(dist, "/ui/business/", 1440, "light", "native");
		expect(audit.panels.reduce((n, p) => n + p.checked, 0), "the audit reads the painted colours").toBeGreaterThan(100);
		const offenders = audit.panels.flatMap((p) => p.offenders).filter((o) => o.mode === "light");
		expect(offenders.map((o) => o.color + " " + o.prop), "no dark-only colour on a light surface").toEqual([]);
	},
	120_000,
);

test("the dev server pre-bundles the two deps the catalogue island loads late, and the business page runs the pre-paint script", () => {
	const config = readFileSync(join(siteDir, "astro.config.mjs"), "utf8");
	expect(config).toContain('optimizeDeps: { include: ["recharts", "sonner"] }');
	const layout = readFileSync(join(siteDir, "src/layouts/BusinessShowcase.astro"), "utf8");
	expect(layout).toContain("themeInitScript");
});
