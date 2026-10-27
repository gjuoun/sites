import { describe, expect, test } from "bun:test";
import { checkLinks } from "./check-links";

describe("checkLinks", () => {
	test("a clean site has no broken links", () => {
		const pages = new Map([
			[
				"index.html",
				'<a href="/posts/">Posts</a><a href="#top" id="top">top</a><img src="/favicon.svg">',
			],
			[
				"posts/index.html",
				'<a href="/">Home</a><a href="/posts/effect-gen/#step">step</a>',
			],
			[
				"posts/effect-gen/index.html",
				'<h2 id="step">Step</h2><a href="../">back</a>',
			],
		]);
		const result = checkLinks(pages, new Set(["favicon.svg"]));
		expect(result.broken).toEqual([]);
		expect(result.pages).toBe(3);
	});

	test("a broken internal link is reported with its source page", () => {
		const pages = new Map([["index.html", '<a href="/missing/">gone</a>']]);
		const result = checkLinks(pages, new Set());
		expect(result.broken).toHaveLength(1);
		expect(result.broken[0]?.from).toBe("index.html");
		expect(result.broken[0]?.href).toBe("/missing/");
	});

	test("a missing fragment target is reported", () => {
		const pages = new Map([
			["index.html", '<a href="/posts/#nowhere">x</a>'],
			["posts/index.html", '<h2 id="somewhere">y</h2>'],
		]);
		const result = checkLinks(pages, new Set());
		expect(result.broken.map((b) => b.href)).toEqual(["/posts/#nowhere"]);
	});

	test("external links are listed, not fetched", () => {
		const pages = new Map([
			[
				"index.html",
				'<a href="https://example.com/">x</a><a href="mailto:a@b.c">m</a>',
			],
		]);
		const result = checkLinks(pages, new Set());
		expect(result.broken).toEqual([]);
		expect(result.external).toEqual(["https://example.com/", "mailto:a@b.c"]);
	});
});
