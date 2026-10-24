import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { findChrome, measureCatalogLayout, measurePanelColours, measurePanelOverflow } from "./panel-overflow.ts";
import { runInteractions } from "./catalog-interact.ts";
import { STATIC_DEMOS } from "./pages/ui/business/_catalog.tsx";

// The business catalogue is stock shadcn in the business colours. So the tests hold the COLOUR contract and the
// catalogue liveness. No radius, shadow, size or type is asserted: those are shadcn own, and a test that pins them
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
			const panel = audit.panels[0];
			expect(panel, "the catalogue is audited").toBeDefined();
			// The one dark-palette value a light page may carry is the native blue fill (primary fills are #00b0ff with
			// dark ink). Stock text-primary links resolve to the same token: the open question on text contrast, listed
			// in the evidence rather than hidden here.
			const NATIVE_FILL = "rgb(0,176,255)";
			const leaks = (panel?.offenders ?? [])
				.filter((o) => !(mode === "light" && o.color === NATIVE_FILL))
				.map((o) => o.color + " " + o.prop + " <" + o.tag + "> x" + o.count);
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
