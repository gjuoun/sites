import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIRED } from "./roles.ts";

// The colour contract as a guard, not a convention. The mode lives in color-scheme and every mode-dependent
// colour is a light-dark() token, so a `dark:` utility anywhere is a regression (a shadcn registry add or an
// upstream sync would reintroduce it). `black` and `white` are gone too: the two neutral ends of a mode are the
// scrim and thumb formulas, not palette roles.
const SRC = join(import.meta.dir, "..");
const sources = (dir: string): string[] =>
	readdirSync(join(SRC, dir), { recursive: true, encoding: "utf8" })
		.filter((f) => /\.(ts|tsx)$/.test(f))
		.map((f) => join(SRC, dir, f));
const files = [...sources("components"), ...sources("lib")];

/** A dark: utility (not the `dark: "..."` key of a config object, which has a space after the colon). */
const LEGACY_DARK = /\bdark:(?!\s)/g;
/** A black or white colour utility: forbidden, the neutral ends are scrim and thumb. */
const LEGACY_END = /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|caret|accent|shadow)-(?:black|white)\b/g;

const hits = (re: RegExp): string[] =>
	files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(re)].map((m) => f.replace(SRC + "/", "") + ": " + m[0]));

describe("no legacy mode syntax in the package", () => {
	test("no dark: utility anywhere", () => {
		expect(hits(LEGACY_DARK)).toEqual([]);
	});

	test("no black or white colour utility", () => {
		expect(hits(LEGACY_END)).toEqual([]);
	});

	test("the stylesheet has no dark variant and no black/white token", () => {
		const css = readFileSync(join(SRC, "styles/styles.css"), "utf8");
		expect(css).not.toContain("@custom-variant dark");
		expect(css).not.toMatch(/--color-(black|white)\b/);
	});

	test("every --theme-* read is a declared role, and the block declares exactly the roles", () => {
		const declared = new Set(REQUIRED.map((k) => "--theme-" + k));
		const readers = [
			...sources("components"),
			...sources("lib"),
			...sources("hooks"),
			join(SRC, "styles", "styles.css"),
		];
		const business = join(SRC, "..", "..", "..", "apps", "bigface", "src", "pages", "ui", "business");
		const businessFiles = readdirSync(business, { recursive: true, encoding: "utf8" })
			.filter((f) => /\.(ts|tsx|css)$/.test(f))
			.map((f) => join(business, f));
		const reads = new Set<string>();
		for (const f of [...readers, ...businessFiles]) {
			for (const m of readFileSync(f, "utf8").matchAll(/--theme-([A-Za-z][\w-]*)/g)) reads.add("--theme-" + m[1]);
		}
		const unknown = [...reads].filter((n) => !declared.has(n));
		expect(unknown).toEqual([]);
		const block = readFileSync(join(SRC, "themes", "business.css"), "utf8");
		const names = [...block.matchAll(/^\s*(--theme-[\w-]+):/gm)].map((m) => m[1]!).sort();
		expect(names).toEqual([...declared].sort());
	});

	test("color-scheme is declared by exactly three rules: root, light, dark", () => {
		const css = readFileSync(join(SRC, "styles/styles.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
		const rules = [...css.matchAll(/([^{}]+)\{\s*color-scheme:\s*(\w+)\s*;?\s*\}/g)].map((m) => m[1]!.trim() + "=" + m[2]);
		expect(css.match(/color-scheme\s*:/g)?.length).toBe(3);
		expect(rules.sort()).toEqual([':root=light', '[data-mode="dark"]=dark', '[data-mode="light"]=light']);
	});
});
