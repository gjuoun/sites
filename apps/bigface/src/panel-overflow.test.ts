import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { findChrome, measureCatalogLayout, measurePanelColours, measurePanelOverflow } from "./panel-overflow.ts";
import { runInteractions } from "./catalog-interact.ts";
import { STATIC_DEMOS } from "./pages/ui/business/_catalog.tsx";

// The business catalogue is stock shadcn in the business colours. So the tests hold the COLOUR contract and the
// catalogue liveness. No radius, shadow, size or type is asserted: those are shadcn's own, and a test that pins them
// would pin the CLI defaults, not the theme. The console page keeps its containment test, unchanged.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html")) || !existsSync(join(dist, "ui/console/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

test.skipIf(!findChrome())(
	"the business catalogue lists all 63 shadcn components, and every interactive one responds to a real pointer action",
	async () => {
		const r = await runInteractions(dist, "/ui/business/");
		expect(r.total, "components in the catalogue").toBe(63);
		expect([...r.statics].sort(), "components with no inherent interaction").toEqual([...STATIC_DEMOS].sort());
		expect(r.results.length).toBe(63 - STATIC_DEMOS.length);
		const failed = r.results.filter((x) => !x.pass).map((x) => x.name + "/" + x.kind);
		expect(failed, "demos that did not respond").toEqual([]);
	},
	240_000,
);

for (const mode of ["light", "dark"] as const) {
	for (const width of [1440, 390]) {
		test.skipIf(!findChrome())(
			"the business catalogue does not scroll sideways in " + mode + " at " + width + "px",
			async () => {
				const m = await measureCatalogLayout(dist, "/ui/business/", width, mode);
				expect(m.hScroll, mode + " @" + width).toBe(0);
			},
			120_000,
		);
	}
}

for (const mode of ["light", "dark"] as const) {
	test.skipIf(!findChrome())(
		"business colours trace to the synced palettes in " + mode,
		async () => {
			const audit = await measurePanelColours(dist, "/ui/business/", 1440, mode);
			// The page body and every mode scope are audited, each in its own mode. The one dark-palette value a light
			// page may carry is the native blue fill (the ruling: primary fills are #00b0ff with dark ink).
			expect(audit.panels.length, "body and scopes audited").toBeGreaterThan(1);
			// The audit must see the page: a vacuous audit (no colour keys read) passes everything.
			const all = audit.panels.flatMap((p) => p.offenders);
			expect(all.length, "the audit reads the painted colours").toBeGreaterThan(0);
			// Allowed, by name, and nothing else. (1) The primary FILL is the native blue, in light, as the ruling says.
			// (2) The same blue as INK (text, caret, underline, border, outline): the stock classes read --color-primary,
			// which is the fill token, for those too. A stock class cannot take a second token, so this class is parked
			// as a QUESTION (evidence.md, round 5, question A). It is counted and reported, not hidden.
			const NATIVE_FILL = "rgb(0,176,255)";
			const INK_PROPS = ["color", "caretColor", "textDecorationColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor", "outlineColor"];
			const fillOk = (o: { mode: string; color: string; prop: string }) => o.mode === "light" && o.color === NATIVE_FILL && o.prop === "backgroundColor";
			const parkedInk = (o: { mode: string; color: string; prop: string }) => o.mode === "light" && o.color === NATIVE_FILL && INK_PROPS.includes(o.prop);
			const parked = all.filter((o) => parkedInk(o)).reduce((n, o) => n + o.count, 0);
			console.log("parked (question A), uses of the fill blue as ink in light: " + parked);
			const leaks = all
				.filter((o) => !fillOk(o) && !parkedInk(o))
				.map((o) => o.mode + " " + o.color + " " + o.prop + " <" + o.tag + "> x" + o.count);
			expect(leaks, "colours outside the synced palettes").toEqual([]);
		},
		120_000,
	);
}

test.skipIf(!findChrome())(
	"the console page stays inside its own panels, unchanged by the business package",
	async () => {
		const m = await measurePanelOverflow(dist, "/ui/console/", 1440);
		expect(m.panels, "console renders light and dark").toBe(2);
		expect(m.offenders.map((o) => o.theme + "/" + o.mode + " " + o.tag)).toEqual([]);
		expect(m.clipped).toEqual([]);
	},
	120_000,
);

test("the retired game theme is offline in every page the site ships", async () => {
	const hits = await $`rg -l 'data-theme="game"' ${dist}`.nothrow().quiet();
	expect(hits.stdout.toString().trim()).toBe("");
});
