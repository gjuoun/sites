import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OUT, UI, renderAll, surface } from "../../scripts/gen-bg2.ts";

// The BG2 surface (ruling Q3-A: verbatim names). Every stock export of components/ui is reachable as BG2<name> from
// the module with the same stem, and the BG2 binding IS the stock binding (identity, not an equal copy). Plain names
// keep importing from components/ui. There is no composite and no barrel in v1.
const surf = surface();
const all = surf.flatMap((m) => m.exports);

describe("BG2 export surface", () => {
	test("372 BG2 names over 63 modules, one module per stock file, no duplicate name", () => {
		expect(surf.length).toBe(63);
		expect(all.length).toBe(372);
		expect(new Set(all.map((e) => e.bg2)).size).toBe(372);
		expect(all.filter((e) => e.type).map((e) => e.stock).sort()).toEqual(["CarouselApi", "ChartConfig"]);
		expect(all.every((e) => e.bg2 === "BG2" + e.stock)).toBe(true);
	});

	test("each module re-exports exactly its stock names, and each BG2 value IS the stock value", async () => {
		for (const m of surf) {
			const bg2 = await import(join(OUT, m.file.replace(/\.tsx$/, ".ts")));
			const stock = await import(join(UI, m.file));
			const values = m.exports.filter((e) => !e.type);
			expect(Object.keys(bg2).sort(), m.file).toEqual(values.map((e) => e.bg2).sort());
			for (const e of values) {
				expect(bg2[e.bg2], e.bg2).toBe(stock[e.stock]);
			}
		}
	});

	test("plain names still import from components/ui, unchanged", async () => {
		for (const m of surf) {
			const stock = await import(join(UI, m.file));
			for (const e of m.exports.filter((x) => !x.type)) expect(stock[e.stock], e.stock).toBeDefined();
		}
	});

	test("the files in src/bg2 are exactly the generator's render (bg2:check), with no stale file", () => {
		const want = renderAll();
		const have = readdirSync(OUT).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort();
		expect(have).toEqual(Object.keys(want).map((p) => p.split("/").pop() as string).sort());
		for (const [path, text] of Object.entries(want)) expect(readFileSync(path, "utf8"), path).toBe(text);
	});

	test("v1 has no composite: no components/bg directory, and no BG2 name is a composite", () => {
		expect(existsSync(join(UI, "../bg"))).toBe(false);
	});
});
