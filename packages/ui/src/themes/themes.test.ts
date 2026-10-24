import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import darkJson from "../../../bigface-tokens/palette/bigface.json";
import lightJson from "../../../bigface-tokens/palette/bigface-light.json";
import { contrastRatio } from "../../../bigface-tokens/src/contrast-math.ts";
import { renderAll, themesDir } from "../../scripts/gen-tokens.ts";
import contract from "./contract.json";
import { COLOURS, MODES, OPTIONAL, REQUIRED, THEMES } from "./roles.ts";

const dark = darkJson as unknown as Parameters<typeof renderAll>[0];
const light = lightJson as unknown as Parameters<typeof renderAll>[0];

// The theme files are generated and committed, the same rule tokens.css follows: the committed file
// must equal a fresh render, and CI regenerates then diffs.
const files = renderAll(dark, light);

/** The declarations of a stylesheet, per rule block, with comments stripped. */
const blocks = (css: string) => {
	const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const out: { selectors: string[]; decls: Record<string, string> }[] = [];
	for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selectors = (m[1] as string)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const decls: Record<string, string> = {};
		for (const d of (m[2] as string).split(";")) {
			const i = d.indexOf(":");
			if (i < 0) continue;
			decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
		}
		out.push({ selectors, decls });
	}
	return out;
};

const isDark = (sel: string) => /\[data-mode="dark"\]/.test(sel);
const isLight = (sel: string) => !isDark(sel);

/** Both blocks of one theme file, keyed by mode. */
const themeBlocks = (id: string) => {
	const css = readFileSync(join(themesDir, id + ".css"), "utf8");
	const all = blocks(css);
	const darkDecls = Object.assign(
		{},
		...all.filter((b) => isDark(b.selectors[0] as string)).map((b) => b.decls),
	);
	const lightDecls = Object.assign(
		{},
		...all.filter((b) => isLight(b.selectors[0] as string)).map((b) => b.decls),
	);
	return { light: lightDecls, dark: darkDecls };
};

/** Evaluate a generated value: a hex as-is, a color-mix(in oklab, a p%, b) by mixing. */
const evaluate = (value: string): string => {
	const m =
		/^color-mix\(\s*in oklab,\s*(#[0-9a-f]{6})\s+([\d.]+)%,\s*(#[0-9a-f]{6})\s*\)$/.exec(
			value,
		);
	if (!m) return value;
	const lab = (h: string) => {
		const v = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
		const lin = (c: number) => {
			const s = c / 255;
			return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		const [r, g, b] = v.map(lin) as [number, number, number];
		const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
		const mm = Math.cbrt(
			0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b,
		);
		const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
		return [
			0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s,
			1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s,
			0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s,
		] as [number, number, number];
	};
	const [a, b] = [lab(m[1] as string), lab(m[3] as string)];
	const t = Number(m[2]) / 100;
	const L = [
		a[0] * t + b[0] * (1 - t),
		a[1] * t + b[1] * (1 - t),
		a[2] * t + b[2] * (1 - t),
	] as [number, number, number];
	const l = (L[0] + 0.3963377774 * L[1] + 0.2158037573 * L[2]) ** 3;
	const mm = (L[0] - 0.1055613458 * L[1] - 0.0638541728 * L[2]) ** 3;
	const s = (L[0] - 0.0894841775 * L[1] - 1.291485548 * L[2]) ** 3;
	const enc = (v: number) => {
		const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(1, Math.max(0, c)) * 255)
			.toString(16)
			.padStart(2, "0");
	};
	return (
		"#" +
		[
			4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s,
			-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s,
			-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s,
		]
			.map(enc)
			.join("")
	);
};

/** Keys that are not colours: the feel half. */
const FEEL = [
	"radius",
	"space",
	"text-xs",
	"text-sm",
	"text-base",
	"text-lg",
	"duration",
	"ease",
	"press",
	"hover",
	"weight",
];

describe("generated theme files", () => {
	test("every committed file equals a fresh render", () => {
		for (const [path, next] of Object.entries(files)) {
			expect(readFileSync(path, "utf8"), path).toBe(next);
		}
	});

	test("control: the render is driven by roles.ts, not hand-written", () => {
		expect(THEMES).toHaveLength(3);
		expect(themeBlocks("game").dark["--theme-radius"]).toBe("2.5rem");
		expect(themeBlocks("console").dark["--theme-radius"]).toBe("0.125rem");
	});

	test("each theme has a light and a dark block, each with every required key", () => {
		for (const theme of THEMES) {
			const { light: l, dark: d } = themeBlocks(theme.id);
			for (const mode of [l, d]) {
				for (const key of REQUIRED) {
					expect(mode["--theme-" + key], theme.id + " " + key).toBeDefined();
				}
			}
		}
	});

	test("both blocks set exactly the contract keys — no typos, nothing extra", () => {
		const known = new Set(
			[...REQUIRED, ...OPTIONAL].map((k) => "--theme-" + k),
		);
		const declared = new Set([
			...Object.keys(contract.required),
			...Object.keys(contract.optional),
		]);
		expect([...declared].sort()).toEqual([...known].sort());
		for (const theme of THEMES) {
			for (const mode of Object.values(themeBlocks(theme.id))) {
				for (const key of Object.keys(mode)) {
					expect(known.has(key), theme.id + " " + key).toBe(true);
				}
			}
		}
	});

	test("_reset.css resets exactly the optional keys", () => {
		const reset = blocks(
			readFileSync(join(themesDir, "_reset.css"), "utf8"),
		)[0] as {
			decls: Record<string, string>;
		};
		expect(Object.keys(reset.decls).sort()).toEqual(
			OPTIONAL.map((k) => "--theme-" + k).sort(),
		);
		for (const value of Object.values(reset.decls))
			expect(value).toBe("initial");
	});

	test("the three themes share ONE colour system, in both modes", () => {
		const colourKeys = [...Object.keys(COLOURS)].map((k) => "--theme-" + k);
		expect(colourKeys.length).toBeGreaterThan(20);
		for (const mode of ["light", "dark"] as const) {
			const [first, ...rest] = THEMES.map((t) => themeBlocks(t.id)[mode]);
			for (const other of rest) {
				for (const key of colourKeys) {
					expect(other[key], mode + " " + key).toBe(
						(first as Record<string, string>)[key],
					);
				}
			}
		}
	});

	test("every colour is the native palette value the role names, or that mix of two of them", () => {
		const palettes = { light, dark } as const;
		for (const theme of THEMES) {
			for (const mode of ["light", "dark"] as const) {
				const palette = palettes[mode] as unknown as {
					colors: Record<string, { hex: string }>;
				};
				const decls = themeBlocks(theme.id)[mode] as Record<string, string>;
				for (const [key, value] of Object.entries(COLOURS)) {
					const got = decls["--theme-" + key] as string;
					if (typeof value === "string") continue;
					if ("color" in value) {
						// a role can pin itself to the native dark palette (the brand fill does)
						const source =
							value.palette === "dark" ? (dark as unknown as typeof palette) : palette;
						const want = source.colors[value.color]?.hex.toLowerCase();
						expect(got, theme.id + "/" + mode + " " + key).toBe(want);
						continue;
					}
					const [a, pct, b] = value.mix;
					const want = evaluate(
						"color-mix(in oklab, " +
							(palette.colors[a] as { hex: string }).hex.toLowerCase() +
							" " +
							pct +
							"%, " +
							(palette.colors[b] as { hex: string }).hex.toLowerCase() +
							")",
					);
					expect(
						got,
						theme.id +
							"/" +
							mode +
							" " +
							key +
							" (" +
							value.mix.join(",") +
							")",
					).toBe(want);
				}
			}
		}
	});

	test("the FEEL is what differs: density, type, radius, elevation and motion", () => {
		const at = (id: string, key: string) =>
			(themeBlocks(id).dark as Record<string, string>)["--theme-" + key];
		for (const key of [
			"space",
			"radius",
			"text-sm",
			"text-base",
			"duration",
			"ease",
			"press",
			"weight",
			"shadow-sm",
		]) {
			const values = THEMES.map((t) => at(t.id, key));
			expect(
				new Set(values).size,
				key + " must differ across themes: " + values.join(" / "),
			).toBe(3);
		}
		// hover only moves in the playful feel: a bounce is not a house style
		expect(at("game", "hover")).not.toBe("1");
		expect([at("business", "hover"), at("console", "hover")]).toEqual([
			"1",
			"1",
		]);

		// density really moves the same way in both modes
		expect(Number.parseFloat(at("game", "space") as string)).toBeGreaterThan(
			Number.parseFloat(at("console", "space") as string),
		);
		expect(
			Number.parseFloat(at("business", "space") as string),
		).toBeGreaterThan(Number.parseFloat(at("console", "space") as string));
	});

	test("text pairs clear WCAG AA in every theme × mode (dark muted ink is the one exemption)", () => {
		// fgDim is 2.79:1 on the dark canvas — the palette's own choice, identical in all three themes.
		const exemptions = new Set(THEMES.map((t) => t.id + "/dark/muted-ink"));
		for (const theme of THEMES) {
			const { light: l, dark: d } = themeBlocks(theme.id);
			for (const [mode, decls] of [
				["light", l],
				["dark", d],
			] as const) {
				const read = (k: string) =>
					evaluate((decls as Record<string, string>)["--theme-" + k] as string);
				for (const [fg, bg, name] of [
					["on-primary", "primary", "on-primary"],
					["ink", "canvas", "ink"],
					["on-frame", "frame", "on-frame"],
					["muted-ink", "canvas", "muted-ink"],
				] as const) {
					if (exemptions.has(theme.id + "/" + mode + "/" + name)) continue;
					expect(
						contrastRatio(read(fg), read(bg)),
						theme.id + "/" + mode + "/" + name,
					).toBeGreaterThanOrEqual(4.5);
				}
			}
		}
	});

	test("the exemption list is honest: dark muted ink really is below AA", () => {
		for (const theme of THEMES) {
			const decls = themeBlocks(theme.id).dark;
			expect(
				contrastRatio(
					evaluate(decls["--theme-muted-ink"] as string),
					evaluate(decls["--theme-canvas"] as string),
				),
			).toBeLessThan(4.5);
		}
	});

	test("_light.css re-declares every palette name from the light palette", () => {
		const css = readFileSync(join(themesDir, "_light.css"), "utf8");
		expect(css).toContain('[data-mode="light"]');
		type Pal = { colors: Record<string, { hex: string }>; ansi: Record<string, { hex: string }> };
		const lightPal = light as unknown as Pal;
		const darkPal = dark as unknown as Pal;
		const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
		for (const [name, c] of Object.entries(lightPal.colors)) {
			expect(css, name).toContain("--bf-" + kebab(name) + ": " + c.hex.toLowerCase() + ";");
		}
		for (const [name, c] of Object.entries(lightPal.ansi)) {
			expect(css, name).toContain("--bf-ansi-" + kebab(name) + ": " + c.hex.toLowerCase() + ";");
		}
		// A dark value that is not also a light value must be absent: a light scope cannot paint it.
		const lightHexes = new Set(Object.values(lightPal.colors).map((c) => c.hex.toLowerCase()));
		for (const c of Object.values(darkPal.colors)) {
			if (lightHexes.has(c.hex.toLowerCase())) continue;
			expect(css.toLowerCase(), c.hex).not.toContain(": " + c.hex.toLowerCase() + ";");
		}
	});

	test("the primary is two-tier: native blue as the fill, the readable blue as text", () => {
		type Pal = { colors: Record<string, { hex: string }> };
		const nativeBlue = (dark as unknown as Pal).colors.blue?.hex.toLowerCase() as string;
		const readableBlue = (light as unknown as Pal).colors.blue?.hex.toLowerCase() as string;
		expect(nativeBlue).toBe("#00b0ff");
		expect(readableBlue).not.toBe(nativeBlue);
		for (const theme of THEMES) {
			for (const mode of ["light", "dark"] as const) {
				const decls = themeBlocks(theme.id)[mode] as Record<string, string>;
				// The fill is bigface's own blue in both modes; the ink on it is dark.
				expect(decls["--theme-primary-fill"], theme.id + "/" + mode).toBe(nativeBlue);
				expect(decls["--theme-primary"], theme.id + "/" + mode).toBe(nativeBlue);
				expect(decls["--theme-on-primary"], theme.id + "/" + mode).toBe("#252925");
				// Text and links take the readable blue in light mode; dark mode can carry the native one.
				expect(decls["--theme-primary-ink"], theme.id + "/" + mode).toBe(
					mode === "light" ? readableBlue : nativeBlue,
				);
			}
		}
	});

	test("dark ink on the native blue plate clears AA as ink-on-fill", () => {
		const ink = evaluate("#252925");
		const plate = evaluate("#00b0ff");
		expect(contrastRatio(ink, plate)).toBeGreaterThanOrEqual(4.5);
	});

	test("the default theme also answers with no data-theme set", () => {
		const css = readFileSync(join(themesDir, "console.css"), "utf8");
		expect(css).toContain(":root:not([data-theme])");
		expect(css).toContain(':root:not([data-theme])[data-mode="dark"]');
		for (const other of THEMES.filter((t) => !t.isDefault)) {
			expect(
				readFileSync(join(themesDir, other.id + ".css"), "utf8"),
			).not.toContain(":root:not([data-theme])");
		}
	});

	test("light and dark blocks differ: the same role resolves against two palettes", () => {
		for (const theme of THEMES) {
			const { light: l, dark: d } = themeBlocks(theme.id);
			expect(l["--theme-canvas"]).not.toBe(d["--theme-canvas"]);
		}
	});

	test("every mode in the registry has a block", () => {
		expect([...MODES]).toEqual(["light", "dark"]);
	});
});
