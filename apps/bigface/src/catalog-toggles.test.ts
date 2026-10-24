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
	"the native comparison paints only the palette's own foreground hues in light, and paints some",
	async () => {
		const css = readFileSync(join(pkgThemes, "_foreground.css"), "utf8");
		const hexes = [...css.matchAll(/--theme-[\w-]+:\s*(#[0-9a-f]{6});/gi)].map((m) => m[1].toLowerCase());
		expect(hexes.length, "twelve foreground roles").toBe(12);
		const rgb = (h: string) => "rgb(" + [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(",") + ")";
		const allowed = new Set(hexes.map(rgb));
		const audit = await measurePanelColours(dist, "/ui/business/", 1440, "light", "native");
		const light = audit.panels.flatMap((p) => p.offenders).filter((o) => o.mode === "light");
		const stray = light.filter((o) => !allowed.has(o.color) && !(o.color === "rgb(0,176,255)" && o.prop === "backgroundColor"));
		expect(stray.map((o) => o.color + " " + o.prop), "native light paints only the foreground hues (and the fill)").toEqual([]);
		expect(light.some((o) => allowed.has(o.color)), "the comparison does paint the palette hues").toBe(true);
	},
	120_000,
);

test("the dev server pre-bundles the two deps the catalogue island loads late, and the business page runs the pre-paint script", () => {
	const config = readFileSync(join(siteDir, "astro.config.mjs"), "utf8");
	expect(config).toContain('optimizeDeps: { include: ["recharts", "sonner"] }');
	const layout = readFileSync(join(siteDir, "src/layouts/BusinessShowcase.astro"), "utf8");
	expect(layout).toContain("themeInitScript");
});
