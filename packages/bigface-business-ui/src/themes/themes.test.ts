import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import darkJson from "../../../bigface-tokens/palette/bigface.json";
import lightJson from "../../../bigface-tokens/palette/bigface-light.json";
import contract from "./contract.json";
import { COLOURS, DEFAULT_MODE, OPTIONAL, REQUIRED, THEMES } from "./roles.ts";
import { mixHex, renderAll, themesDir } from "../../scripts/gen-tokens.ts";
import { contrastRatio } from "../../../bigface-tokens/src/contrast-math.ts";

// The business package ships ONE theme. These tests hold it to the contract and to the standing business
// decisions Jun ruled on, so a regeneration cannot quietly move a value.
type Pal = { colors: Record<string, { hex: string }>; ansi: Record<string, { hex: string }> };
const dark = darkJson as unknown as Pal;
const light = lightJson as unknown as Pal;

const css = (name: string) => readFileSync(join(themesDir, name), "utf8");
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

/** Declarations of the light block and the dark block of business.css. */
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

/** Evaluate color-mix(in oklab, #hex p%, #hex) to a hex so contrast can be measured. */
const evaluate = (value: string): string => {
	const m = /^color-mix\(in oklab, (#[0-9a-f]{6}) ([\d.]+)%, (#[0-9a-f]{6})\)$/.exec(value);
	if (!m) return value;
	const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	const lab = (h: string) => {
		const [r, g, b] = [1, 3, 5].map((i) => toLin(Number.parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		return [
			0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
			1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
			0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
		];
	};
	const a = lab(m[1] as string);
	const b = lab(m[3] as string);
	const t = Number(m[2]) / 100;
	const [L, A, B] = [0, 1, 2].map((k) => (a[k] as number) * t + (b[k] as number) * (1 - t));
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	const enc = (v: number) => {
		const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, "0");
	};
	return "#" + [
		4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
	].map(enc).join("");
};

describe("bigface-business-ui theme", () => {
	test("the generated files equal a fresh render (regenerate with theme:sync)", () => {
		for (const [path, next] of Object.entries(renderAll(dark, light))) {
			expect(readFileSync(path, "utf8"), path).toBe(next);
		}
	});

	test("the package default mode is light, and the registry says so", () => {
		expect(DEFAULT_MODE).toBe("light");
	});

	test("one theme, business, and it is the default", () => {
		expect(THEMES.map((t) => t.id)).toEqual(["business"]);
		expect(THEMES[0]?.isDefault).toBe(true);
	});

	test("the contract lists exactly the keys the theme sets", () => {
		const known = [...REQUIRED, ...OPTIONAL].map((k) => "--theme-" + k).sort();
		expect([...Object.keys(contract.required), ...Object.keys(contract.optional)].sort()).toEqual(known);
		const b = blocks();
		for (const key of Object.keys(b.light)) expect(known, key).toContain(key);
		for (const key of Object.keys(b.dark)) expect(known, key).toContain(key);
	});

	test("every required key is set in both the light and the dark block", () => {
		const b = blocks();
		for (const key of REQUIRED) {
			expect(b.light["--theme-" + key], "light " + key).toBeDefined();
			expect(b.dark["--theme-" + key], "dark " + key).toBeDefined();
		}
	});

	test("standing decision: controls and cards are 6px, from one radius token", () => {
		const b = blocks();
		expect(b.light["--theme-radius"]).toBe("0.375rem");
		expect(b.dark["--theme-radius"]).toBe("0.375rem");
	});

	test("standing decision: the two-tier primary — native blue fill, dark ink; readable blue text in light", () => {
		const b = blocks();
		const nativeBlue = dark.colors.blue?.hex.toLowerCase();
		const readableBlue = light.colors.blue?.hex.toLowerCase();
		expect(nativeBlue).toBe("#00b0ff");
		expect(readableBlue).toBe("#007aa6");
		for (const mode of [b.light, b.dark]) {
			expect(mode["--theme-primary"]).toBe(nativeBlue);
			expect(mode["--theme-primary-fill"]).toBe(nativeBlue);
			expect(mode["--theme-on-primary"]).toBe("#252925");
		}
		expect(b.light["--theme-primary-ink"]).toBe(readableBlue);
		expect(b.dark["--theme-primary-ink"]).toBe(nativeBlue);
	});

	test("standing decision: no shadow on the plate in light mode; dark keeps the glow", () => {
		const b = blocks();
		expect(b.light["--theme-primary-shadow"]).toBe("none");
		expect(b.dark["--theme-primary-shadow"]).toContain("color-mix");
	});

	test("standing decision: paper surfaces in light, never pure white", () => {
		const b = blocks();
		expect(b.light["--theme-canvas"]).toBe(light.colors.bg?.hex.toLowerCase());
		expect(b.light["--theme-canvas"]).toBe("#f8f8f0");
		const everything = [css("business.css"), css("_light.css"), readFileSync(join(themesDir, "../styles/tokens.css"), "utf8")].join("\n").toLowerCase();
		expect(everything).not.toContain("#fff;");
		expect(everything).not.toContain("#ffffff");
		expect(everything).not.toContain("255, 255, 255");
	});

	test("every colour role resolves to the native palette value it names, or the exact mix of two", () => {
		const b = blocks();
		for (const mode of ["light", "dark"] as const) {
			const palette = (mode === "light" ? light : dark) as Pal;
			// a role may pin itself to the dark palette (the two-tier primary does, on purpose)
			const pick = (name: string, pinned?: string) =>
				((pinned === "dark" ? dark : palette) as Pal).colors[name]?.hex.toLowerCase();
			for (const [key, value] of Object.entries(COLOURS)) {
				if (typeof value === "string" || ("light" in value)) continue;
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

	test("text pairs clear WCAG AA in both modes; dark muted ink is the one recorded exemption", () => {
		const b = blocks();
		for (const mode of ["light", "dark"] as const) {
			const read = (k: string) => evaluate(b[mode]["--theme-" + k] as string);
			expect(contrastRatio(read("on-primary"), read("primary")), mode + " on-primary").toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(read("ink"), read("canvas")), mode + " ink").toBeGreaterThanOrEqual(4.5);
			expect(contrastRatio(read("on-frame"), read("frame")), mode + " on-frame").toBeGreaterThanOrEqual(4.5);
		}
		expect(contrastRatio(evaluate(b.light["--theme-primary-ink"] as string), evaluate(b.light["--theme-canvas"] as string))).toBeGreaterThanOrEqual(4.5);
	});

	test("the reset file resets exactly the optional keys", () => {
		const reset = strip(css("_reset.css"));
		const keys = [...reset.matchAll(/--theme-([\w-]+): initial;/g)].map((m) => "--theme-" + m[1]);
		expect(keys.sort()).toEqual(OPTIONAL.map((k) => "--theme-" + k).sort());
	});
});
