import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { findChrome, measurePanelOverflow } from "./panel-overflow.ts";

// The theme panels are the only place where six scoped themes share a grid, and the overflow bug they
// had (an h-full card inside a padded, static-flow panel) is invisible to any DOM assertion: only a
// layout engine has boxes. So this test serves the built page to a real headless Chrome and measures.
// It skips only when no Chrome is installed (set CHROME_PATH where it lives elsewhere).
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/theme/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0)
			throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

test.skipIf(!findChrome())(
	"no theme panel paints outside its own bounds",
	async () => {
		// Desktop and a phone width: the panels drop to one column and every label wraps differently, which
		// is where a min-content width would show up as a horizontal overflow rather than a vertical one.
		for (const width of [1440, 390]) {
			const m = await measurePanelOverflow(dist, "/ui/theme/", width);
			expect(m.panels, "the gallery renders all six theme x mode panels").toBe(
				6,
			);
			// One line per offender, so a failure says which element and by how much.
			const report = m.offenders.map(
				(o) =>
					o.theme +
					"/" +
					o.mode +
					" " +
					o.tag +
					(o.slot ? "[" + o.slot + "]" : "") +
					" " +
					JSON.stringify({ l: o.left, r: o.right, t: o.top, b: o.bottom }),
			);
			expect(report, "viewport " + width).toEqual([]);
			expect(m.clipped, "viewport " + width).toEqual([]);
		}
	},
	120_000,
);
