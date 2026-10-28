import { describe, expect, test } from "bun:test";
import { buildMeta, MAX_DESCRIPTION, pageTitle } from "./seo";

const site = new URL("https://example.test");

describe("pageTitle", () => {
	test("home reads the full portfolio line", () => {
		expect(pageTitle(undefined)).toBe("Jun Guo — portfolio, resume and posts");
	});
	test("other pages read <Page> — Jun Guo", () => {
		expect(pageTitle("Posts")).toBe("Posts — Jun Guo");
	});
});

describe("buildMeta", () => {
	test("canonical is the absolute url with a trailing slash", () => {
		const home = buildMeta({
			site,
			path: "/",
			description: "d",
			type: "website",
		});
		const post = buildMeta({
			site,
			path: "/posts/effect-gen",
			description: "d",
			type: "article",
		});
		expect(home.canonical).toBe("https://example.test/");
		expect(post.canonical).toBe("https://example.test/posts/effect-gen/");
	});

	test("descriptions are at most 160 characters", () => {
		const long = "word ".repeat(80);
		const meta = buildMeta({
			site,
			path: "/",
			description: long,
			type: "website",
		});
		expect(meta.description.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
		expect(meta.description.endsWith("…")).toBe(true);
	});

	test("short descriptions are kept as written", () => {
		const meta = buildMeta({
			site,
			path: "/",
			description: "short",
			type: "website",
		});
		expect(meta.description).toBe("short");
	});

	test("og carries type, title, description, url and site_name, with no image", () => {
		const meta = buildMeta({
			site,
			path: "/projects/",
			title: "Projects",
			description: "All projects.",
			type: "website",
		});
		expect(meta.og).toEqual({
			type: "website",
			title: "Projects — Jun Guo",
			description: "All projects.",
			url: "https://example.test/projects/",
			site_name: "Jun Guo",
		});
		expect("image" in meta.og).toBe(false);
	});

	test("article type is passed through to og", () => {
		const meta = buildMeta({
			site,
			path: "/posts/effect-gen/",
			title: "Sequence steps",
			description: "d",
			type: "article",
		});
		expect(meta.og.type).toBe("article");
	});
});
