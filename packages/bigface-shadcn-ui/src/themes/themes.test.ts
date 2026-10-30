import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import paletteJson from "../../../bigface-tokens/palette/palette.json";
import { DEFAULT_MODE, REQUIRED, THEMES } from "./roles.ts";
import { renderAll, themesDir, type PaletteLike, type PaletteMode } from "../../scripts/gen-tokens.ts";

// The Bigface package is COLOUR ONLY, and the theme is shadcn's two blocks: every palette colour as a light
// value on :root and [data-mode="light"], and again as a dark value on [data-mode="dark"]. These tests hold the
// package to that shape and to the standing colour rulings. styles.css's own shape is shadcn-theme.test.ts.
const palette = paletteJson as unknown as PaletteLike;
const dark = palette.modes.dark as PaletteMode;
const light = palette.modes.light as PaletteMode;

const css = (name: string) =>
	readFileSync(name === "styles.css" ? join(themesDir, "../styles/styles.css") : join(themesDir, name), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** The blocks of bigface.css, as selector -> (role -> value). */
const blocks = () => {
	const out: Record<string, Record<string, string>> = {};
	for (const b of strip(css("bigface.css")).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
		const decls: Record<string, string> = {};
		for (const m of (b[2] as string).matchAll(/--theme-([\w-]+):\s*([^;]+);/g)) decls[m[1] as string] = (m[2] as string).trim();
		out[(b[1] as string).replace(/\s+/g, " ").trim()] = decls;
	}
	return out;
};
const LIGHT = ':root, [data-mode="light"]';
const DARK = '[data-mode="dark"]';
/** The roles of one mode's block. */
const roles = (mode: "light" | "dark" = "light") => blocks()[mode === "light" ? LIGHT : DARK] ?? {};

const hex = (mode: PaletteMode, name: string) => (mode.colors[name] as string).toLowerCase();

describe("bigface-shadcn-ui: colour only", () => {
	test("the generated files equal a fresh render (regenerate with theme:sync)", () => {
		for (const [path, next] of Object.entries(renderAll(palette))) {
			expect(readFileSync(path, "utf8"), path).toBe(next);
		}
	});

	test("one theme, bigface, the default; light is the default mode", () => {
		expect(THEMES.map((t) => t.id)).toEqual(["bigface"]);
		expect(THEMES[0]?.isDefault).toBe(true);
		expect(DEFAULT_MODE).toBe("light");
	});

	test("the theme is shadcn's two blocks: light on :root and [data-mode=light], dark on [data-mode=dark]", () => {
		expect(Object.keys(blocks())).toEqual([LIGHT, DARK]);
		expect(Object.keys(roles("light")).sort()).toEqual([...REQUIRED].sort());
		expect(Object.keys(roles("dark")).sort()).toEqual([...REQUIRED].sort());
		expect(css("bigface.css")).not.toContain("light-dark(");
	});

	test("every value is that mode's palette hex, unchanged: no role is derived", () => {
		for (const mode of ["light", "dark"] as const) {
			const pal = mode === "light" ? light : dark;
			for (const [role, value] of Object.entries(roles(mode))) {
				const paletteName = THEMES[0]!.roles[role] as string;
				expect(value, mode + " " + role).toBe(hex(pal, paletteName));
			}
		}
	});

	test("the two modes are the palette's own: yellow is #ffeb3b in both, not a darkened ink", () => {
		expect(roles("light").yellow).toBe("#ffeb3b");
		expect(roles("dark").yellow).toBe("#ffeb3b");
		expect(roles("light").yellow).toBe(hex(light, "yellow"));
	});

	test("standing colour decision: paper in light, dark canvas in dark, never pure white", () => {
		expect(roles("light").bg).toBe("#f8f8f0");
		expect(roles("dark").bg).toBe("#252925");
		const everything = [css("bigface.css"), css("styles.css")].join("\n").toLowerCase();
		expect(everything).not.toContain("#fff;");
		expect(everything).not.toContain("#ffffff");
		expect(everything).not.toContain("255, 255, 255");
	});
});
