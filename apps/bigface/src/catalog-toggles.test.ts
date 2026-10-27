import { beforeAll, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { runModeToggle } from "./catalog-toggles.ts";
import { findChrome } from "./panel-overflow.ts";

// The catalogue's mode toggle, proven in a real browser: clicking flips the whole page, and a chosen mode survives a
// reload. The source checks pin the wiring: the pre-paint script on this page and the pre-bundled deps the dev server
// needs (a stale pre-bundle left the island unhydrated, so the toggle did nothing).
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

for (const width of [1440, 390]) {
	test.skipIf(!findChrome())(
		"the mode toggle flips the whole page, and a chosen mode survives a reload, at " + width + "px",
		async () => {
			const r = await runModeToggle(dist, "/ui/business/", width);
			expect(r.initial.mode, "starts light").toBe("light");
			expect(r.dark.mode).toBe("dark");
			expect(r.dark.canvas, "the dark canvas is the dark neutral bg").toBe("rgb(37, 41, 37)");
			expect(r.light.canvas, "the light canvas is the scheme caret").toBe("rgb(248, 248, 240)");
			expect(r.afterReloadWithDark.mode, "dark survives a reload").toBe("dark");
			expect(r.afterReloadWithDark.canvas).toBe(r.dark.canvas);
		},
		240_000,
	);
}

test("the dev server pre-bundles the two deps the catalogue island loads late, and the business page runs the pre-paint script", () => {
	const config = readFileSync(join(siteDir, "astro.config.mjs"), "utf8");
	expect(config).toContain('optimizeDeps: { include: ["recharts", "sonner"] }');
	const layout = readFileSync(join(siteDir, "src/layouts/BusinessShowcase.astro"), "utf8");
	expect(layout).toContain("themeInitScript");
});
