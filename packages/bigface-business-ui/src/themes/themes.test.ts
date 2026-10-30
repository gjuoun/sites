import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import darkJson from "../../../bigface-tokens/palette/bigface.json";
import lightJson from "../../../bigface-tokens/palette/bigface-light.json";
import { contrastRatio } from "../../../bigface-tokens/src/contrast-math.ts";
import { darkenUntil, MIN_CONTRAST, toOklch } from "../../../bigface-tokens/src/light.ts";
import { DEFAULT_MODE, LIGHT_DERIVED, REQUIRED, THEMES } from "./roles.ts";
import { renderAll, themesDir } from "../../scripts/gen-tokens.ts";

// The business package is COLOUR ONLY, and the theme is shadcn's two blocks: every palette colour as a light
// value on :root and [data-mode="light"], and again as a dark value on [data-mode="dark"]. These tests hold the
// package to that shape and to the standing colour rulings. styles.css's own shape is shadcn-theme.test.ts.
type Pal = { colors: Record<string, { hex: string }>; ansi: Record<string, { hex: string }> };
const dark = darkJson as unknown as Pal;
const light = lightJson as unknown as Pal;

const css = (name: string) =>
	readFileSync(name === "styles.css" ? join(themesDir, "../styles/styles.css") : join(themesDir, name), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** The blocks of business.css, as selector -> (role -> value). */
const blocks = () => {
	const out: Record<string, Record<string, string>> = {};
	for (const b of strip(css("business.css")).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
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

const hex = (palette: Pal, name: string) => (palette.colors[name] as { hex: string }).hex.toLowerCase();

describe("bigface-business-ui: colour only", () => {
	test("the generated files equal a fresh render (regenerate with theme:sync)", () => {
		for (const [path, next] of Object.entries(renderAll(dark, light))) {
			expect(readFileSync(path, "utf8"), path).toBe(next);
		}
	});

	test("one theme, business, the default; light is the default mode", () => {
		expect(THEMES.map((t) => t.id)).toEqual(["business"]);
		expect(THEMES[0]?.isDefault).toBe(true);
		expect(DEFAULT_MODE).toBe("light");
	});

	test("the theme is shadcn's two blocks: light on :root and [data-mode=light], dark on [data-mode=dark]", () => {
		expect(Object.keys(blocks())).toEqual([LIGHT, DARK]);
		expect(Object.keys(roles("light")).sort()).toEqual([...REQUIRED].sort());
		expect(Object.keys(roles("dark")).sort()).toEqual([...REQUIRED].sort());
		expect(css("business.css")).not.toContain("light-dark(");
	});

	test("every value is one palette hex, or a derived role computed from one", () => {
		for (const mode of ["light", "dark"] as const) {
			const pal = mode === "light" ? light : dark;
			for (const [role, value] of Object.entries(roles(mode))) {
				const paletteName = THEMES[0]!.roles[role] as string;
				const derived = mode === "light" && (LIGHT_DERIVED as readonly string[]).includes(role);
				const expected = derived
					? darkenUntil(hex(pal, paletteName), hex(pal, "bg"), MIN_CONTRAST)
					: hex(pal, paletteName);
				expect(value, mode + " " + role).toBe(expected);
			}
		}
	});

	test("the one derived role: the yellow reads on paper, keeps its hue, and the dark block is untouched", () => {
		const paper = hex(light, "bg");
		const darkYellow = roles("dark").yellow as string;
		const lightYellow = roles("light").yellow as string;
		expect(LIGHT_DERIVED).toEqual(["yellow"]);
		expect(darkYellow).toBe("#ffeb3b");
		expect(lightYellow).not.toBe(darkYellow);
		expect(contrastRatio(lightYellow, paper)).toBeGreaterThanOrEqual(MIN_CONTRAST);
		expect(toOklch(lightYellow)[0]).toBeLessThan(toOklch(darkYellow)[0]);
		expect(Math.abs(toOklch(lightYellow)[2] - toOklch(darkYellow)[2])).toBeLessThan(2);
	});

	test("standing colour decision: paper in light, dark canvas in dark, never pure white", () => {
		expect(roles("light").bg).toBe("#f8f8f0");
		expect(roles("dark").bg).toBe("#252925");
		const everything = [css("business.css"), css("styles.css")].join("\n").toLowerCase();
		expect(everything).not.toContain("#fff;");
		expect(everything).not.toContain("#ffffff");
		expect(everything).not.toContain("255, 255, 255");
	});
});
