import { beforeAll, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { runTouch } from "./catalog-touch.ts";
import { findChrome } from "./panel-overflow.ts";

// The control cluster on a phone: a fresh load must leave both rows on screen, both must receive a touch, and a tap must
// flip the page. At 1440 the same holds. The first load must not be scrolled anywhere by the catalogue's own code.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");

beforeAll(async () => {
	if (!existsSync(join(dist, "ui/business/index.html"))) {
		const r = await $`bun run build`.cwd(siteDir).quiet().nothrow();
		if (r.exitCode !== 0) throw new Error("site build failed:\n" + r.stderr.toString());
	}
}, 120_000);

for (const [width, height] of [[390, 844], [1440, 1000]] as const) {
	test.skipIf(!findChrome())(
		"at " + width + "px with touch: a fresh load leaves both control rows on screen and tappable, and taps flip the page",
		async () => {
			const r = await runTouch(dist, "/ui/business/", width, height);
			expect(r.scrollYAtLoad, "a fresh load starts at the top").toBe(0);
			for (const c of r.controlsAtLoad) {
				expect(c.inView, c.group + " " + c.label + " is on screen at load (top " + c.top + ")").toBe(true);
				expect(c.hit, c.group + " " + c.label + " receives a touch at its position").toBe(true);
			}
			expect(r.readings.map((x) => x.after)).toEqual(["dark", "light", "native", "toned"]);
			expect(r.readings[0]!.mode).toBe("dark");
			expect(r.readings[0]!.canvas).toBe("rgb(37, 41, 37)");
			expect(r.readings[1]!.canvas).toBe("rgb(248, 248, 240)");
			expect(r.readings[2]!.fg).toBe("native");
			expect(r.readings[3]!.fg).toBe("toned");
			for (const c of r.controlsAfterTaps) expect(c.inView, c.label + " still on screen after the taps").toBe(true);
		},
		240_000,
	);
}
