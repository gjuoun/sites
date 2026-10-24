import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { findChrome, measurePanelColours, measurePanelOverflow } from "./panel-overflow.ts";

// One theme per page. The business page is the business package alone; /ui/theme is console alone. The
// layout proofs run the built pages in a real headless Chrome, because no DOM library has a layout engine.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html")) || !existsSync(join(dist, "ui/theme/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

const PAGES = [
	{ path: "/ui/business/", theme: "business" },
	{ path: "/ui/theme/", theme: "console" },
] as const;

for (const page of PAGES) {
	test.skipIf(!findChrome())(
		page.theme + " panels stay inside their bounds on " + page.path,
		async () => {
			for (const width of [1440, 390]) {
				const m = await measurePanelOverflow(dist, page.path, width);
				expect(m.panels, page.path + " renders light and dark").toBe(2);
				const report = m.offenders.map(
					(o) =>
						o.theme + "/" + o.mode + " " + o.tag + (o.slot ? "[" + o.slot + "]" : "") + " " +
						JSON.stringify({ l: o.left, r: o.right, t: o.top, b: o.bottom }),
				);
				expect(report, page.path + " @" + width).toEqual([]);
				expect(m.clipped, page.path + " @" + width).toEqual([]);
			}
		},
		120_000,
	);
}

test.skipIf(!findChrome())(
	"business controls are 6px and never a pill, in both modes; the card and badge match",
	async () => {
		const m = await measurePanelOverflow(dist, "/ui/business/", 1440);
		expect(m.metrics).toHaveLength(2);
		for (const p of m.metrics) {
			expect(p.cardRadius, p.mode + " card").toBe("6px");
			expect(p.claimRadius, p.mode + " button").toBe(6);
			expect(p.claimRadius < p.claimHeight / 2, p.mode + " button is not a pill").toBe(true);
			expect(p.badgeRadius, p.mode + " badge").toBe(6);
		}
	},
	120_000,
);

test.skipIf(!findChrome())(
	"console stays near-square on /ui/theme",
	async () => {
		const m = await measurePanelOverflow(dist, "/ui/theme/", 1440);
		for (const p of m.metrics) {
			expect(p.cardRadius, p.mode + " card").toBe("2px");
			expect(p.claimRadius, p.mode + " button").toBeLessThanOrEqual(3);
		}
	},
	120_000,
);

test.skipIf(!findChrome())(
	"the business panels use only palette colours: no white, and the light panel's only dark-palette value is the native blue fill",
	async () => {
		const audit = await measurePanelColours(dist, "/ui/business/", 1440);
		// Jun's ruling: primary FILLS (the Claim plate and the Switch on-state) are the native #00b0ff, with dark
		// ink on top. That is the single dark-palette value a light panel may carry; anything else is a leak.
		const NATIVE_FILL = "rgb(0,176,255)";
		const leaks = audit.panels.flatMap((p) =>
			p.offenders
				.filter((o) => !(p.mode === "light" && o.color === NATIVE_FILL))
				.map((o) => p.mode + " " + o.color + " " + o.prop + " <" + o.tag + "> x" + o.count),
		);
		expect(leaks).toEqual([]);
	},
	120_000,
);

test("the retired game theme is offline in every page the site ships", async () => {
	const hits = await $`rg -l 'data-theme="game"|--theme-radius:2.5rem' ${dist}`.nothrow().quiet();
	expect(hits.stdout.toString().trim()).toBe("");
});
