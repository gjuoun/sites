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

// The correction that made the three themes different: one colour system, three feels. That is only true
// if the same markup actually lays out differently, so this reads the demo card in each panel.
test.skipIf(!findChrome())(
	"the three themes look different in the same mode",
	async () => {
		const m = await measurePanelOverflow(dist, "/ui/theme/", 1440);
		const dark = m.metrics.filter((p) => p.mode === "dark");
		expect(dark).toHaveLength(3);

		// density and type: the roomier theme's card is taller, its padding and title size move
		const heights = dark.map((p) => p.cardHeight);
		expect(
			Math.max(...heights) - Math.min(...heights),
			"card height spread " + heights.join("/"),
		).toBeGreaterThanOrEqual(40);
		expect(new Set(dark.map((p) => p.cardPadding)).size, "card padding").toBe(
			3,
		);
		expect(new Set(dark.map((p) => p.titleSize)).size, "title font size").toBe(
			3,
		);

		// every feel token the page demonstrates differs three ways
		for (const key of [
			"radius",
			"space",
			"duration",
			"ease",
			"press",
			"weight",
		] as const) {
			expect(
				new Set(dark.map((p) => p[key])).size,
				key + " " + dark.map((p) => p[key]).join("/"),
			).toBe(3);
		}

		// the art direction, in pixels: console near-square, business a small rounded rect, game near pill
		const at = (theme: string) =>
			dark.find((p) => p.theme === theme) as (typeof dark)[number];
		const cardRadius = (theme: string) =>
			Number.parseFloat(at(theme).cardRadius);
		expect(cardRadius("console"), "console is near-square").toBeLessThanOrEqual(
			4,
		);
		expect(
			cardRadius("business"),
			"business is a small rounded rect",
		).toBeGreaterThan(cardRadius("console"));
		expect(cardRadius("business")).toBeLessThanOrEqual(10);
		expect(cardRadius("game"), "game is near pill").toBeGreaterThanOrEqual(32);
		expect(
			cardRadius("game") - cardRadius("console"),
			"the spread is unmistakable",
		).toBeGreaterThanOrEqual(32);

		// console is visibly tighter than business, and game is the roomiest
		expect(at("console").cardPadding).toBeLessThan(at("business").cardPadding);
		expect(at("game").cardPadding).toBeGreaterThan(at("business").cardPadding);

		// hover only moves in the playful feel; the other two hold still
		expect([at("business").hover, at("console").hover]).toEqual(["1", "1"]);


		// The radius has to reach the CONTROLS, not just the card: before this, every button measured a
		// hardcoded pill (1.67772e+07px) in all three themes, and the badges were proportional pills.
		const claim = (theme: string) => at(theme).claimRadius;
		const claimIsPill = (theme: string) => claim(theme) >= at(theme).claimHeight / 2 - 0.5;

		expect(claim("business"), "business button radius").toBeGreaterThanOrEqual(5);
		expect(claim("business")).toBeLessThanOrEqual(8);
		expect(claimIsPill("business"), "business must not be a pill").toBe(false);
		expect(claim("console"), "console button radius").toBeLessThanOrEqual(3);
		expect(claim("game"), "game button radius").toBeGreaterThanOrEqual(32);
		expect(claimIsPill("game"), "game stays a pill").toBe(true);

		// badges and chips follow the same token, so a panel cannot mix a 6px card with a pill badge
		for (const theme of ["business", "console", "game"]) {
			expect(at(theme).badgeRadius, theme + " badge follows the theme").toBe(claim(theme));
		}
		expect(at("business").badgeRadius, "business badge is not a pill").toBeLessThan(
			at("business").badgeHeight / 2,
		);

		// the press is demonstrable: game overshoots on hover and squishes on press
		expect(Number(at("game").hover), "game hover").toBeGreaterThan(1);
		expect(Number(at("game").press), "game press").toBeLessThanOrEqual(0.92);
		expect(Number(at("console").press), "console press").toBeGreaterThan(
			Number(at("game").press),
		);
	},
	120_000,
);
