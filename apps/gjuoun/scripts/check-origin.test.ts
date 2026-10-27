import { describe, expect, test } from "bun:test";
import { originViolations } from "./check-origin";

const origin = new URL("https://jun-blog.qqntt.com");
const home = (canonical: string, body = "") =>
	`<html><head><link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}"></head><body>${body}</body></html>`;

describe("originViolations", () => {
	test("a clean output has no violations", () => {
		const files = new Map([
			["index.html", home("https://jun-blog.qqntt.com/", '<a href="https://github.com/gjuoun">GitHub</a>')],
			["sitemap.xml", "<urlset><url><loc>https://jun-blog.qqntt.com/</loc></url></urlset>"],
			["robots.txt", "Sitemap: https://jun-blog.qqntt.com/sitemap.xml\n"],
			["rss.xml", "<rss><channel><link>https://jun-blog.qqntt.com/</link></channel></rss>"],
		]);
		expect(originViolations(files, origin)).toEqual([]);
	});

	test("a second site host in a canonical or a contact link is reported", () => {
		const files = new Map([
			["index.html", home("https://jun-blog.qqntt.com/", '<a href="https://jun.qqntt.com/">jun</a>')],
		]);
		expect(originViolations(files, origin)).toEqual([
			"index.html names host jun.qqntt.com, not the origin or a declared external host",
		]);
	});

	test("a canonical on another host is reported", () => {
		const files = new Map([["index.html", home("https://jun.qqntt.com/")]]);
		expect(originViolations(files, origin)).toContain(
			"index.html self url https://jun.qqntt.com/ is not on jun-blog.qqntt.com",
		);
	});

	test("the misspelled host gqntt is reported", () => {
		const files = new Map([["index.html", home("https://jun-blog.qqntt.com/", "jun.gqntt.com")]]);
		expect(originViolations(files, origin)).toContain('index.html contains "gqntt"');
	});

	test("an output with no self url fails", () => {
		const files = new Map([["index.html", "<html></html>"]]);
		expect(originViolations(files, origin)).toEqual([
			"no self-referencing url found in the built output",
		]);
	});
});
