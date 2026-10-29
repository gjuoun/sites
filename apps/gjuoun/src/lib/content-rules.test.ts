import { describe, expect, test } from "bun:test";
import { checkContent, publishedPosts } from "./content-rules";

const post = (over: Record<string, unknown> = {}) => ({
	slug: "p",
	title: "P",
	summary: "s",
	date: new Date("2026-01-01"),
	draft: false,
	tags: [],
	starter: false,
	...over,
});
const SERIES = "Effect, one function at a time";
const project = (over: Record<string, unknown> = {}) => ({
	slug: "qublack",
	name: "QuBlack",
	summary: "s",
	status: "public",
	url: "https://example.test/qublack",
	stack: [],
	order: 1,
	...over,
});

describe("checkContent", () => {
	test("a valid set has no violations", () => {
		const content = {
			posts: [
				post({ slug: "effect-gen", series: SERIES, order: 1 }),
				post({ slug: "effect-retry", series: SERIES, order: 2 }),
			],
			projects: [project()],
		};
		expect(checkContent(content)).toEqual([]);
	});

	test("slug must be unique across posts", () => {
		const violations = checkContent({
			posts: [post({ slug: "dup" }), post({ slug: "dup" })],
			projects: [],
		});
		expect(violations.join("\n")).toContain("dup");
	});

	test("order inside a series is 1..n with no gaps", () => {
		const violations = checkContent({
			posts: [
				post({ slug: "a", series: SERIES, order: 1 }),
				post({ slug: "b", series: SERIES, order: 2 }),
				post({ slug: "c", series: SERIES, order: 4 }),
			],
			projects: [],
		});
		expect(violations.join("\n")).toContain(SERIES);
	});

	test("a public project needs a url or a repo", () => {
		const violations = checkContent({
			posts: [],
			projects: [project({ url: undefined, repo: undefined })],
		});
		expect(violations.join("\n")).toContain("qublack");
	});

	test("project status must be public, private, or archived", () => {
		const violations = checkContent({
			posts: [],
			projects: [project({ status: "secret" })],
		});
		expect(violations.join("\n")).toContain("secret");
	});
});

describe("publishedPosts", () => {
	test("draft posts are excluded", () => {
		const kept = publishedPosts([
			post({ slug: "live" }),
			post({ slug: "wip", draft: true }),
		]);
		expect(kept.map((p) => p.slug)).toEqual(["live"]);
	});
});
