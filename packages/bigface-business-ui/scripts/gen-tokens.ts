// Generates the business package's stylesheets from the two Bigface palettes and the colour-only role map:
//
//   src/themes/business.css   the business theme: a light block and a dark block (colour only)
//   src/themes/_reset.css     optional roles back to initial, per [data-theme] scope
//
//   bun run theme:sync   rewrite both files in place
//   bun run theme:check  fail when either is stale (CI uses this)
//
// A role names a palette colour; both modes come out of one map. Nothing here writes a size, a radius, a shadow
// geometry, a font or a motion value: those are Tailwind's and shadcn's own.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { OPTIONAL, REQUIRED, THEMES, type Theme, type Value } from "../src/themes/roles.ts";
import { contrastRatio } from "../../bigface-tokens/src/contrast-math.ts";

export interface PaletteLike {
	colors: Record<string, { hex: string }>;
	ansi: Record<string, { hex: string }>;
}

const toLinear = (v: number): number => {
	const c = v / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Two colours mixed in OKLab, as one hex. A computed tint, not a color-mix() the minifier would rewrite. */
export function mixHex(a: string, pct: number, b: string): string {
	const lab = (h: string) => {
		const [r, g, bb] = [1, 3, 5].map((i) =>
			toLinear(Number.parseInt(h.slice(i, i + 2), 16)),
		) as [number, number, number];
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bb);
		const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bb);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bb);
		return [
			0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
			1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
			0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
		] as [number, number, number];
	};
	const x = lab(a);
	const y = lab(b);
	const t = pct / 100;
	const L = x[0] * t + y[0] * (1 - t);
	const A = x[1] * t + y[1] * (1 - t);
	const B = x[2] * t + y[2] * (1 - t);
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	const enc = (v: number) => {
		const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
	};
	return (
		"#" +
		[
			4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
		]
			.map(enc)
			.join("")
	);
}

/** WCAG floor for text: a plate must give its accent at least this ratio. */
export const PLATE_FLOOR = 4.5;

/**
 * The deepened plate of an accent: the lightest mix of the accent into the base that still gives the accent PLATE_FLOOR
 * as text. More accent is lighter, so the contrast falls as the share rises; bisection finds the largest share that
 * still clears the floor. Deterministic: same accent and base, same hex.
 */
export function solvePlate(accent: string, base: string, floor = PLATE_FLOOR): string {
	if (contrastRatio(accent, base) < floor) throw new Error("accent " + accent + " cannot clear " + floor + " on " + base);
	let lo = 0; // always clears the floor
	let hi = 100; // never does (checked by the loop)
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (contrastRatio(accent, mixHex(accent, mid, base)) >= floor) lo = mid;
		else hi = mid;
	}
	return mixHex(accent, lo, base);
}

const hexOf = (palette: PaletteLike, name: string): string => {
	const c = palette.colors[name] ?? palette.ansi[name];
	if (!c) throw new Error("no palette colour named " + name);
	return c.hex.toLowerCase();
};

/** One role value for one mode. */
export function cssValue(
	v: Value,
	palette: PaletteLike,
	dark?: PaletteLike,
	mode: "light" | "dark" = "dark",
): string {
	if (typeof v === "string") return v;
	if ("light" in v) return cssValue(mode === "light" ? v.light : v.dark, palette, dark, mode);
	if ("color" in v) {
		const chosen = v.palette === "dark" && dark ? dark : palette;
		return hexOf(chosen, v.color);
	}
	// A plate is solved against the dark ink, the same in both modes: the accents are identical in both palettes.
	if ("plate" in v) return solvePlate(hexOf(palette, v.plate), hexOf(dark ?? palette, "bg"));
	const [a, pct, b] = v.mix;
	return mixHex(hexOf(palette, a), pct, hexOf(palette, b));
}

/** A theme's block for one mode, in contract order: every required role, then every optional role. */
export function renderBlock(
	theme: Theme,
	palette: PaletteLike,
	dark?: PaletteLike,
	mode: "light" | "dark" = "dark",
): string {
	const keys = [...REQUIRED, ...OPTIONAL] as string[];
	const missing = keys.filter((k) => !(k in theme.roles));
	const extra = Object.keys(theme.roles).filter((k) => !keys.includes(k));
	if (missing.length) throw new Error(theme.id + ": missing roles " + missing.join(", "));
	if (extra.length) throw new Error(theme.id + ": unknown roles " + extra.join(", "));
	return keys
		.map((k) => "  --theme-" + k + ": " + cssValue(theme.roles[k] as Value, palette, dark, mode) + ";")
		.join("\n");
}

/** Light selectors, dark selectors (the three-part rule), then the two blocks. */
export function renderThemeFile(theme: Theme, dark: PaletteLike, light: PaletteLike): string {
	const own = '[data-theme="' + theme.id + '"]';
	const lightSel = theme.isDefault ? ":root:not([data-theme]),\n" + own : own;
	const darkSel = [
		...(theme.isDefault ? [':root:not([data-theme])[data-mode="dark"]'] : []),
		own + '[data-mode="dark"]',
		'[data-mode="dark"] ' + own + ':not([data-mode="light"])',
	].join(",\n");
	return [
		"/* Generated by packages/bigface-business-ui/scripts/gen-tokens.ts from src/themes/roles.ts and the two",
		"   Bigface palettes. Colour only. Do not edit: change the role map, then run theme:sync. */",
		"",
		lightSel + " {",
		renderBlock(theme, light, dark, "light"),
		"}",
		"",
		darkSel + " {",
		renderBlock(theme, dark, dark, "dark"),
		"}",
		"",
	].join("\n");
}

/** _reset.css: optional roles go back to their defaults inside every theme scope. */
export function renderReset(): string {
	return [
		"/* Generated by packages/bigface-business-ui/scripts/gen-tokens.ts from the contract. Do not edit.",
		"   Custom properties inherit, so a nested scope would otherwise keep the outer theme's optional roles.",
		"   initial is the guaranteed-invalid value: the mapping's var() fallback wins. */",
		"",
		"[data-theme] {",
		...OPTIONAL.map((k) => "  --theme-" + k + ": initial;"),
		"}",
		"",
	].join("\n");
}

const here = import.meta.dir;
export const themesDir = join(here, "../src/themes");
const palettePath = join(here, "../../bigface-tokens/palette/bigface.json");
const lightPalettePath = join(here, "../../bigface-tokens/palette/bigface-light.json");

/** Every file theme:sync writes, as path to contents. */
export function renderAll(dark: PaletteLike, light: PaletteLike): Record<string, string> {
	const files: Record<string, string> = {
		[join(themesDir, "_reset.css")]: renderReset(),
	};
	for (const theme of THEMES) {
		files[join(themesDir, theme.id + ".css")] = renderThemeFile(theme, dark, light);
	}
	return files;
}

const read = (p: string) => JSON.parse(readFileSync(p, "utf8")) as PaletteLike;

if (import.meta.main) {
	const files = renderAll(read(palettePath), read(lightPalettePath));
	const check = process.argv.includes("--check");
	let stale = 0;
	for (const [path, next] of Object.entries(files)) {
		const current = existsSync(path) ? readFileSync(path, "utf8") : "";
		if (!check) {
			writeFileSync(path, next);
			console.log("wrote " + path);
			continue;
		}
		if (current !== next) {
			console.error("stale: " + path);
			stale++;
		}
	}
	if (check) {
		if (stale) {
			console.error(stale + " file(s) stale: run theme:sync");
			process.exit(1);
		}
		console.log("theme files are up to date (" + Object.keys(files).length + ")");
	}
}
