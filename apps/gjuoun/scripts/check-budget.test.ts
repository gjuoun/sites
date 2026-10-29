import { describe, expect, test } from "bun:test";
import { loadedScripts } from "./check-budget.ts";

describe("loadedScripts", () => {
	test("a bundle no page references is not counted", () => {
		const js = { "client.abc.js": "react runtime" };
		expect(loadedScripts(["<html><body>static</body></html>"], js)).toEqual([]);
	});

	test("a script src, a modulepreload and an island url are counted", () => {
		const js = { "a.1.js": "", "b.2.js": "", "c.3.js": "", "unused.4.js": "" };
		const html = [
			'<script type="module" src="/_astro/a.1.js"></script>',
			'<link rel="modulepreload" href="/_astro/b.2.js">',
			'<astro-island component-url="/_astro/c.3.js"></astro-island>',
		].join("");
		expect(loadedScripts([html], js).sort()).toEqual([
			"a.1.js",
			"b.2.js",
			"c.3.js",
		]);
	});

	test("a chunk imported by a loaded script is counted too", () => {
		const js = {
			"page.1.js": 'import"./shared.2.js";',
			"shared.2.js": "",
			"other.3.js": "",
		};
		const html = '<script type="module" src="/_astro/page.1.js"></script>';
		expect(loadedScripts([html], js).sort()).toEqual([
			"page.1.js",
			"shared.2.js",
		]);
	});
});
