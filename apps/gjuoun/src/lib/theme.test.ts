import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MODE_STORAGE_KEY } from "@gjuoun/bigface-shadcn-ui/lib/themes";

const src = (rel: string) =>
	readFileSync(join(import.meta.dir, "..", rel), "utf8");

test("the toggle writes the package's mode key", () => {
	expect(MODE_STORAGE_KEY).toBe("bigface-mode");
	expect(src("components/ThemeToggle.tsx")).toContain("MODE_STORAGE_KEY");
});

test("components and views are React (tsx) only: Astro is for routes and the document shell", () => {
	for (const dir of ["../components", "../views"]) {
		const files = readdirSync(join(import.meta.dir, dir));
		expect(files.length, dir).toBeGreaterThan(0);
		expect(
			files.filter((f) => !f.endsWith(".tsx")),
			dir,
		).toEqual([]);
	}
});

// The site carries no stylesheet of its own: tailwind.css is Tailwind, the typography plugin, the theme, the
// three @source lines and the font, and every other rule is a utility in the markup.
test("the only stylesheet is tailwind.css, and it holds only imports, sources and the font", () => {
	expect(readdirSync(join(import.meta.dir, "../styles"))).toEqual([
		"tailwind.css",
	]);
	expect(existsSync(join(import.meta.dir, "../styles/site.css"))).toBe(false);
	const css = src("styles/tailwind.css").replace(/\/\*[\s\S]*?\*\//g, "");
	const top = css
		.replace(/\{[^{}]*\}/g, "{}")
		.split(/;|\{\}/)
		.map((s) => s.trim().replace(/\s+/g, " "))
		.filter(Boolean);
	expect(top).toEqual([
		'@import "tailwindcss"',
		'@import "@gjuoun/bigface-shadcn-ui/styles.css"',
		'@plugin "@tailwindcss/typography"',
		'@source "../../../../packages/bigface-shadcn-ui/src/components/ui/card.tsx"',
		'@source "../../../../packages/bigface-shadcn-ui/src/components/ui/badge.tsx"',
		'@source "../../../../packages/bigface-shadcn-ui/src/components/ui/button.tsx"',
		"@font-face",
		"@font-face",
		"@theme inline",
	]);
	expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(rgb|hsl|oklch)\(/);
});
