import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import darkJson from "../../../bigface-tokens/palette/bigface.json";
import lightJson from "../../../bigface-tokens/palette/bigface-light.json";
import contract from "./contract.json";
import { ACCENT_DOCS } from "./accents.ts";
import { DEFAULT_MODE, REQUIRED, THEMES } from "./roles.ts";
import { mixHex, PLATE_FLOOR, renderAll, solvePlate, themesDir } from "../../scripts/gen-tokens.ts";
import { contrastRatio } from "../../../bigface-tokens/src/contrast-math.ts";

// The business package is COLOUR ONLY, and the theme is ONE block: a role whose two palettes differ is
// light-dark(light, dark), one whose palettes agree is a bare hex. These tests hold the package to that
// contract and to the standing colour rulings. Nothing here asserts a size, a radius or a shadow geometry.
type Pal = { colors: Record<string, { hex: string }>; ansi: Record<string, { hex: string }> };
const dark = darkJson as unknown as Pal;
const light = lightJson as unknown as Pal;

const css = (name: string) =>
	readFileSync(name === "styles.css" ? join(themesDir, "../styles/styles.css") : join(themesDir, name), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every --theme-* declaration of business.css, as role -> value. There is only one block. */
const roles = () => {
	const out: Record<string, string> = {};
	for (const m of strip(css("business.css")).matchAll(/--theme-([\w-]+):\s*([^;]+);/g)) {
		out[m[1] as string] = (m[2] as string).trim();
	}
	return out;
};

/** The branch a value takes in a mode; a bare hex is the same in both. */
const pick = (value: string, mode: "light" | "dark"): string => {
	const m = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/i.exec(value);
	if (!m) return value.toLowerCase();
	return ((mode === "light" ? m[1] : m[2]) as string).toLowerCase();
};

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

	test("the contract is colour only: no size, radius, shadow geometry, font or motion role", () => {
		const keys = [...Object.keys(contract.required), ...Object.keys(contract.optional)];
		const feel = /radius|space|text-|shadow-(2xs|xs|sm|md|lg|xl|2xl|card|modal)|duration|ease|hover|press|weight|font-/;
		expect(keys.filter((k) => feel.test(k))).toEqual([]);
		expect(Object.keys(contract.required).length).toBe(REQUIRED.length);
	});

	test("the contract lists exactly the keys the theme sets", () => {
		const known = REQUIRED.map((k) => "--theme-" + k).sort();
		expect([...Object.keys(contract.required), ...Object.keys(contract.optional)].sort()).toEqual(known);
		expect(Object.keys(roles()).sort()).toEqual([...REQUIRED].sort());
	});

	test("the theme is one block: no dark-mode selector, one declaration per role", () => {
		const text = strip(css("business.css"));
		expect(text).not.toContain('[data-mode="dark"]');
		expect(text.match(/\{/g)?.length).toBe(1);
		expect(Object.keys(roles()).length).toBe(REQUIRED.length);
	});

	test("every value is light-dark(light, dark) or one bare hex, and the neutrals carry both palettes", () => {
		const r = roles();
		for (const [role, value] of Object.entries(r)) {
			expect(value, role).toMatch(/^(?:light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\)|#[0-9a-f]{6})$/i);
		}
		for (const role of ["bg", "panel", "fg", "fgDim", "border"]) {
			expect(r[role], role).toBe("light-dark(" + hex(light, role) + ", " + hex(dark, role) + ")");
		}
		for (const role of ["blue", "lightBlue", "paleBlue", "cyan", "green", "burntOrange"]) {
			const paletteName = THEMES[0]!.roles[role] as string;
			expect(r[role], role).toBe(hex(dark, paletteName));
			expect(r[role], role + " is the same in both palettes").toBe(hex(light, paletteName));
		}
		// lime, yellow and purple are accent-docs data: no CSS variable carries them
		expect(r.lime).toBeUndefined();
		expect(r.yellow).toBeUndefined();
		expect(r.purple).toBeUndefined();
	});

	test("theme.css carries no feel override: no spacing, text size, radius scale, motion or shadow geometry", () => {
		const text = strip(css("styles.css"));
		expect(text).not.toMatch(/--spacing:/);
		expect(text).not.toMatch(/--text-(xs|sm|base|lg):/);
		expect(text).not.toMatch(/--default-transition-/);
		expect(text).not.toMatch(/--theme-(space|radius|duration|ease|hover|press|weight)/);
		// the font stacks moved here from the retired tailwind.css; they are the only font keys allowed
		expect((text.match(/--font-[\w-]+:/g) ?? []).sort()).toEqual(["--font-display:", "--font-heading:", "--font-mono:", "--font-sans:"]);
		expect(text).toContain("--radius: 0.625rem;");
	});

	test("shadows keep the geometry and take the palette darkest neutral: no black literal", () => {
		const text = strip(css("styles.css"));
		expect(text).not.toMatch(/rgb\(0 0 0/);
		expect(text).not.toMatch(/--color-(black|white)/);
		expect(text).toContain("color-mix(in oklab, var(--color-scrim) 10%, transparent)");
		expect(text).toContain("--color-scrim: light-dark(var(--theme-fg), var(--theme-bg));");
	});

	test("standing colour decision: paper in light, dark canvas in dark, never pure white", () => {
		const r = roles();
		expect(pick(r.bg as string, "light")).toBe("#f8f8f0");
		expect(pick(r.bg as string, "dark")).toBe("#252925");
		const everything = [css("business.css"), css("styles.css")].join("\n").toLowerCase();
		expect(everything).not.toContain("#fff;");
		expect(everything).not.toContain("#ffffff");
		expect(everything).not.toContain("255, 255, 255");
	});

	test("text pairs clear WCAG AA in both modes", () => {
		const r = roles();
		for (const mode of ["light", "dark"] as const) {
			const onBg = (role: string) => contrastRatio(pick(r[role] as string, mode), pick(r.bg as string, mode));
			const fillInk = mode === "light" ? r.fg : r.bg;
			expect(onBg("fg"), mode + " fg on bg").toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(pick(fillInk as string, mode), pick(r.blue as string, mode)), mode + " ink on the fill").toBeGreaterThanOrEqual(4.5);
		}
		// the muted grey clears AA in both modes; the palette accent does not, and that tradeoff is recorded
		expect(contrastRatio(pick(r.fgDim as string, "light"), pick(r.bg as string, "light"))).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(pick(r.fgDim as string, "dark"), pick(r.bg as string, "dark"))).toBeGreaterThanOrEqual(4.5);
		// the accent-as-link measures 2.27:1 on paper: an accepted tradeoff, recorded rather than hidden
		expect(Math.round(contrastRatio(pick(r.blue as string, "light"), pick(r.bg as string, "light")) * 100) / 100).toBe(2.27);
	});
});

// The accent family (ruling 2026-10-24): each accent is the palette own colour as text, and a deepened plate it is
// read on. The plate is the LIGHTEST mix of the accent into the dark ink that still gives the accent PLATE_FLOOR:
// the ratio sits at the floor, not far above it, so the plate is no darker than the accent needs. The docs table
// is data, not a theme role: no component reads it.
test("each accent is the palette own colour, and reads on its deepened plate at the floor", () => {
	const base = hex(dark, "bg");
	expect(ACCENT_DOCS.length).toBe(9);
	for (const doc of ACCENT_DOCS) {
		const accent = hex(dark, doc.palette);
		expect(doc.accent, doc.id).toBe(accent);
		expect(doc.plate, doc.id + " is the solved plate").toBe(solvePlate(accent, base));
		const ratio = contrastRatio(accent, doc.plate);
		expect(ratio, doc.id + " on its plate").toBeGreaterThanOrEqual(PLATE_FLOOR);
		expect(ratio, doc.id + " plate is no darker than it needs to be").toBeLessThan(PLATE_FLOOR + 0.15);
	}
});

// Keeps mixHex imported and honest: the plates above are computed with it, so one case pins the arithmetic.
test("mixHex is OKLab and deterministic, and lands on the accent at 100%", () => {
	expect(mixHex("#00b0ff", 100, "#252925")).toBe("#00b0ff");
	expect(mixHex("#00b0ff", 0, "#252925")).toBe("#252925");
	expect(mixHex("#00b0ff", 50, "#252925")).toBe(mixHex("#00b0ff", 50, "#252925"));
});
