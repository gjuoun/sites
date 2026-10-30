import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIRED } from "./roles.ts";

// styles.css is shadcn's default theme (https://ui.shadcn.com/docs/theming, "Default Theme CSS") with the
// palette in place of the neutral values and data-mode in place of the .dark class. Nothing else: no alias,
// no formula colour, no shadow, font or color-scheme override. These tests hold it to that.
const SRC = join(import.meta.dir, "..");
const styles = readFileSync(join(SRC, "styles/styles.css"), "utf8");
const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
/** The custom-property declarations of the one flat block that opens with `prelude`. */
const decls = (prelude: string) => {
	const at = stripComments(styles).indexOf(prelude + " {");
	if (at < 0) return [];
	const body = stripComments(styles).slice(at + prelude.length + 2).split("}")[0] as string;
	return [...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => ({ name: m[1] as string, value: (m[2] as string).trim() }));
};
const sources = (dir: string): string[] =>
	readdirSync(join(SRC, dir), { recursive: true, encoding: "utf8" })
		.filter((f) => /\.(ts|tsx)$/.test(f))
		.map((f) => join(SRC, dir, f));

/** shadcn's colour tokens, in the guide's order. */
const SHADCN = [
	"background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "primary",
	"primary-foreground", "secondary", "secondary-foreground", "muted", "muted-foreground", "accent",
	"accent-foreground", "destructive", "border", "input", "ring", "chart-1", "chart-2", "chart-3", "chart-4",
	"chart-5", "sidebar", "sidebar-foreground", "sidebar-primary", "sidebar-primary-foreground", "sidebar-accent",
	"sidebar-accent-foreground", "sidebar-border", "sidebar-ring",
];
const RADIUS = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];

describe("styles.css is shadcn's default theme", () => {
	test("the top level is the guide's: palette and shadcn imports, the dark variant, @theme inline, the roles, base", () => {
		const top = stripComments(styles).replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "{}");
		const statements = top.split(/;|\{\}/).map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
		expect(statements).toEqual([
			'@import "../themes/bigface.css"',
			'@import "shadcn/tailwind.css"',
			'@custom-variant dark (&:where([data-mode="dark"], [data-mode="dark"] *))',
			"@theme inline",
			":root, [data-theme], [data-mode]",
			"@layer base",
		]);
	});

	test("@theme inline is shadcn's colour keys, the theme's one yellow, and the radius scale", () => {
		const theme = decls("@theme inline");
		// The yellow is the package's one addition to shadcn's key list: the palette's #ffeb3b, exposed so a
		// highlighted run of text is painted in the theme's yellow rather than in a chart-ramp colour.
		expect(theme.map((d) => d.name)).toEqual([
			...SHADCN.map((n) => "--color-" + n),
			"--color-yellow",
			...RADIUS.map((n) => "--radius-" + n),
		]);
		for (const n of SHADCN) expect(theme.find((d) => d.name === "--color-" + n)?.value).toBe("var(--" + n + ")");
		expect(theme.find((d) => d.name === "--color-yellow")?.value).toBe("var(--theme-yellow)");
	});

	test("the roles block declares --radius and every shadcn role, each reading one palette colour", () => {
		const roles = decls(":root,\n[data-theme],\n[data-mode]");
		expect(roles.map((d) => d.name).sort()).toEqual(["--radius", ...SHADCN.map((n) => "--" + n)].sort());
		for (const d of roles) {
			if (d.name === "--radius") expect(d.value).toBe("0.625rem");
			else expect(d.value, d.name).toMatch(/^var\(--theme-[A-Za-z]+\)$/);
		}
	});

	test("base is shadcn's two rules, and nothing sets color-scheme, a font, a shadow or a black/white token", () => {
		const flat = stripComments(styles).replace(/\s+/g, " ");
		expect(flat).toContain("@layer base { * { @apply border-border outline-ring/50; } body { @apply bg-background text-foreground; } }");
		expect(flat).not.toMatch(/color-scheme|--font-|--shadow|--color-(black|white)\b|light-dark\(/);
	});
});

test("every --theme-* read is a declared palette colour, and bigface.css declares exactly them", () => {
	const declared = new Set(REQUIRED.map((k) => "--theme-" + k));
	const readers = [...sources("components"), ...sources("lib"), ...sources("hooks"), join(SRC, "styles", "styles.css")];
	const business = join(SRC, "..", "..", "..", "apps", "bigface", "src", "pages", "ui", "business");
	const businessFiles = readdirSync(business, { recursive: true, encoding: "utf8" })
		.filter((f) => /\.(ts|tsx|css)$/.test(f))
		.map((f) => join(business, f));
	const reads = new Set<string>();
	for (const f of [...readers, ...businessFiles]) {
		for (const m of readFileSync(f, "utf8").matchAll(/--theme-([A-Za-z][\w-]*)/g)) reads.add("--theme-" + m[1]);
	}
	expect([...reads].filter((n) => !declared.has(n))).toEqual([]);
	const block = readFileSync(join(SRC, "themes", "bigface.css"), "utf8");
	const names = [...new Set([...block.matchAll(/^\s*(--theme-[\w-]+):/gm)].map((m) => m[1] as string))].sort();
	expect(names).toEqual([...declared].sort());
});
