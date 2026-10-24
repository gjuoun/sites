import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import darkJson from "../../../bigface-tokens/palette/bigface.json";
import lightJson from "../../../bigface-tokens/palette/bigface-light.json";
import contract from "./contract.json";
import { COLOURS, DEFAULT_MODE, FOREGROUND, OPTIONAL, REQUIRED, THEMES } from "./roles.ts";
import { mixHex, renderAll, themesDir } from "../../scripts/gen-tokens.ts";
import { contrastRatio } from "../../../bigface-tokens/src/contrast-math.ts";

// The business package is COLOUR ONLY. These tests hold it to the colour contract and to the standing colour
// rulings: the two-tier primary, paper surfaces, no pure white, black and white from the palette. Nothing here
// asserts a size, a radius or a shadow geometry, because the package sets none of them.
type Pal = { colors: Record<string, { hex: string }>; ansi: Record<string, { hex: string }> };
const dark = darkJson as unknown as Pal;
const light = lightJson as unknown as Pal;

const css = (name: string) =>
	readFileSync(join(themesDir, name.endsWith("theme.css") ? "../styles/theme.css" : name), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** The light and dark block declarations of business.css. */
const blocks = () => {
	const text = strip(css("business.css"));
	const out: { light: Record<string, string>; dark: Record<string, string> } = { light: {}, dark: {} };
	for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const target = /data-mode="dark"/.test(m[1] as string) ? out.dark : out.light;
		for (const d of (m[2] as string).split(";")) {
			const i = d.indexOf(":");
			if (i > 0) target[d.slice(0, i).trim()] = d.slice(i + 1).trim();
		}
	}
	return out;
};

/** Evaluate color-mix(in oklab, #hex p%, #hex) to a hex, so contrast can be measured. */
const evaluate = (value: string): string => {
	const m = /^color-mix\(in oklab, (#[0-9a-f]{6}) ([\d.]+)%, (#[0-9a-f]{6})\)$/.exec(value);
	if (!m) return value;
	return mixHex(m[1] as string, Number(m[2]), m[3] as string);
};

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
		expect([...REQUIRED, ...OPTIONAL].length).toBe(keys.length);
	});

	test("the contract lists exactly the keys the theme sets", () => {
		const known = [...REQUIRED, ...OPTIONAL].map((k) => "--theme-" + k).sort();
		expect([...Object.keys(contract.required), ...Object.keys(contract.optional)].sort()).toEqual(known);
		const b = blocks();
		for (const key of [...Object.keys(b.light), ...Object.keys(b.dark)]) expect(known, key).toContain(key);
	});

	test("every required role is set in both the light and the dark block", () => {
		const b = blocks();
		for (const key of REQUIRED) {
			expect(b.light["--theme-" + key], "light " + key).toBeDefined();
			expect(b.dark["--theme-" + key], "dark " + key).toBeDefined();
		}
	});

	test("theme.css carries no feel override: no spacing, text size, radius scale, motion or shadow geometry", () => {
		const text = strip(css("theme.css"));
		expect(text).not.toMatch(/--spacing:/);
		expect(text).not.toMatch(/--text-(xs|sm|base|lg):/);
		expect(text).not.toMatch(/--default-transition-/);
		expect(text).not.toMatch(/--theme-(space|radius|duration|ease|hover|press|weight)/);
		expect(text).not.toMatch(/--font-(sans|mono|display):/);
		// the only radius is shadcn's own default, and the scale derives from it
		expect(text).toContain("--radius: 0.625rem;");
	});

	test("shadows keep Tailwind's geometry and take the palette's colour: no black literal", () => {
		const text = strip(css("theme.css"));
		expect(text).toContain("--shadow-sm: 0 1px 3px 0 color-mix(in oklab, var(--color-black) 10%, transparent)");
		expect(text).not.toMatch(/rgb\(0 0 0/);
	});

	test("standing colour decision: paper surfaces in light, dark canvas in dark, never pure white", () => {
		const b = blocks();
		expect(b.light["--theme-canvas"]).toBe("#f8f8f0");
		expect(b.dark["--theme-canvas"]).toBe("#252925");
		const everything = [css("business.css"), css("_reset.css"), css("theme.css")].join("\n").toLowerCase();
		expect(everything).not.toContain("#fff;");
		expect(everything).not.toContain("#ffffff");
		expect(everything).not.toContain("255, 255, 255");
	});

	test("the primary: native blue fill with dark ink; the light blue is the native blue by ruling (2026-10-24)", () => {
		const b = blocks();
		const nativeBlue = dark.colors.blue?.hex.toLowerCase();
		// Jun's ruling: the accent family borrows the dark palette exactly, so the light blue IS the native blue.
		// The readable-ink tier this test used to pin (#007aa6) is now a PARKED question for Jun (sites evidence,
		// round 7: keep a derived readable ink for text and links, or let link text follow the accent). Until he
		// decides, primary-ink follows blue, and this test records that rather than pinning the old value.
		expect(nativeBlue).toBe("#00b0ff");
		expect(light.colors.blue?.hex.toLowerCase()).toBe(nativeBlue);
		for (const mode of [b.light, b.dark]) {
			expect(mode["--theme-primary"]).toBe(nativeBlue);
			expect(mode["--theme-primary-fill"]).toBe(nativeBlue);
			expect(mode["--theme-on-primary"]).toBe("#252925");
		}
		expect(b.light["--theme-primary-ink"]).toBe(nativeBlue);
		expect(b.dark["--theme-primary-ink"]).toBe(nativeBlue);
	});

	test("black and white are the palette's own ends, per mode; white is paper, not #fff", () => {
		const b = blocks();
		expect(b.light["--theme-black"]).toBe("#252925");
		expect(b.light["--theme-white"]).toBe("#f8f8f0");
		expect(b.dark["--theme-black"]).toBe("#252925");
		expect(b.dark["--theme-white"]).toBe("#d9d9d4");
	});

	test("every colour role resolves to the native palette value it names, or the exact mix of two", () => {
		const b = blocks();
		for (const mode of ["light", "dark"] as const) {
			const palette = (mode === "light" ? light : dark) as Pal;
			const pick = (name: string, pinned?: string) =>
				((pinned === "dark" ? dark : palette) as Pal).colors[name]?.hex.toLowerCase();
			for (const [key, value] of Object.entries(COLOURS)) {
				if (typeof value === "string" || "light" in value) continue;
				const got = b[mode]["--theme-" + key];
				if ("color" in value) {
					expect(got, mode + " " + key).toBe(pick(value.color, value.palette));
				} else {
					const [a, pct, c] = value.mix;
					expect(got, mode + " " + key).toBe(mixHex(pick(a) as string, pct, pick(c) as string));
				}
			}
		}
	});

	test("text pairs clear WCAG AA in both modes", () => {
		const b = blocks();
		for (const mode of ["light", "dark"] as const) {
			const read = (k: string) => evaluate(b[mode]["--theme-" + k] as string);
			expect(contrastRatio(read("on-primary"), read("primary")), mode + " on-primary").toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(read("ink"), read("canvas")), mode + " ink").toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(read("on-frame"), read("frame")), mode + " on-frame").toBeGreaterThanOrEqual(4.5);
		}
		// The link and ring ink on paper follows the accent (ruling 2026-10-24) and measures below AA: recorded here,
		// not hidden. Parked as a question; see the primary test above.
		const linkInk = Math.round(contrastRatio(evaluate(b.light["--theme-primary-ink"] as string), evaluate(b.light["--theme-canvas"] as string)) * 100) / 100;
		expect(linkInk, "primary-ink on paper (accepted tradeoff, parked)").toBe(2.27);
	});

	test("the reset resets exactly the optional roles", () => {
		const reset = strip(css("_reset.css"));
		const keys = [...reset.matchAll(/--theme-([\w-]+): initial;/g)].map((m) => "--theme-" + m[1]);
		expect(keys.sort()).toEqual(OPTIONAL.map((k) => "--theme-" + k).sort());
	});
});

// Recorded fact (ruling 2026-10-24): the light accents ARE the native palette now, so the derived foreground set the
// Toned/Native comparison was built to contrast no longer exists for these roles. Every foreground role's light value
// equals its native value; the comparison is a no-op in light until Jun decides what it should show (parked question).
test("in light, the toned and native foregrounds are identical (the comparison is a no-op after the ruling)", () => {
	const b = blocks();
	const native = strip(css("_foreground.css"));
	const nativeOf = (k: string) => (native.match(new RegExp("--theme-" + k + ":\\s*(#[0-9a-f]{6})", "i")) ?? [])[1]?.toLowerCase();
	for (const k of FOREGROUND) {
		expect(nativeOf(k), k).toBeDefined();
		expect(String(b.light["--theme-" + k]).toLowerCase(), k).toBe(nativeOf(k));
	}
});

// The foreground comparison (data-fg="native") is a light-only, page-level affordance: every selector in its file
// carries the no-dark guard, and it names exactly the foreground roles, each a value of the role map.
test("the foreground comparison is light only and names exactly the foreground roles", () => {
	const text = strip(css("_foreground.css"));
	const selectors = [...text.matchAll(/([^{}]+)\{/g)].map((m) => (m[1] as string).trim()).filter(Boolean);
	expect(selectors.length, "a selector block").toBeGreaterThan(0);
	for (const s of selectors) {
		expect(s, s).toContain('[data-fg="native"]');
		expect(s, s).toContain(':not([data-mode="dark"])');
	}
	expect(text, "a locked scope is never overridden").toContain(':not([data-fg-lock])');
	const names = [...text.matchAll(/--theme-([\w-]+):/g)].map((m) => m[1] as string).sort();
	expect(names).toEqual([...FOREGROUND].sort());
	for (const k of FOREGROUND) expect(k in COLOURS, k).toBe(true);
});
