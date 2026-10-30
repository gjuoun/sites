// The palette pipeline's colour maths, the part the theme generator needs.
//
// Copied from bigface-theme src/light.ts at the revision in SYNCED_FROM: that file's job is to write
// palette/bigface-light.json (it imports the palette loaders and the seeds), while all this package needs
// is the one derivation — "the same hue, darkened until it reads". The functions below are that file's
// functions, unchanged, so a palette edit upstream keeps one meaning of "light-mode accent".
//
// Note for the next sync: the vendored-bigface CI job cmp's palette/*.json, contrast-math.ts,
// installer.ts and themes/; this file is not in that list, so refresh it by hand with SYNCED_FROM.
import { contrastRatio } from "./contrast-math.ts";

/** Every text-bearing colour clears WCAG AA on the light canvas. */
export const MIN_CONTRAST = 4.5;

// --- sRGB <-> OKLab / OKLCH. Lowering lightness in OKLCH keeps a hue and its chroma while it is
// darkened, which is what a light-mode accent is: the same colour, dark enough to read on a pale canvas.
const toLinear = (v: number): number => {
	const c = v / 255;
	return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (v: number): number => {
	const c = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, c)) * 255);
};
const rgb = (hex: string): [number, number, number] =>
	[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const hex = (channels: [number, number, number]): string =>
	"#" + channels.map((v) => v.toString(16).padStart(2, "0")).join("");

export function toOklab(h: string): [number, number, number] {
	const [r, g, b] = rgb(h).map(toLinear) as [number, number, number];
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

const oklabToLinear = (L: number, A: number, B: number): [number, number, number] => {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
};

export function fromOklab([L, A, B]: [number, number, number]): string {
	return hex(oklabToLinear(L, A, B).map(fromLinear) as [number, number, number]);
}

/**
 * The most chroma a hue can carry at this lightness before sRGB clips it. Darkening a bright accent
 * without this pushes it out of gamut, and the per-channel clamp that follows shifts the hue several
 * degrees (blue → teal-ish); clamping chroma instead keeps the colour the user picked, just darker.
 */
const clampChroma = (L: number, C: number, H: number): number => {
	const at = (c: number) =>
		oklabToLinear(L, c * Math.cos((H * Math.PI) / 180), c * Math.sin((H * Math.PI) / 180));
	const fits = (c: number) => at(c).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
	if (fits(C)) return C;
	let lo = 0;
	let hi = C;
	for (let i = 0; i < 20; i++) {
		const mid = (lo + hi) / 2;
		if (fits(mid)) lo = mid;
		else hi = mid;
	}
	return lo;
};

export const toOklch = (h: string): [number, number, number] => {
	const [L, A, B] = toOklab(h);
	return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180) / Math.PI];
};
export const fromOklch = ([L, C, H]: [number, number, number]): string =>
	fromOklab([L, C * Math.cos((H * Math.PI) / 180), C * Math.sin((H * Math.PI) / 180)]);

/** The colour with its OKLCH lightness lowered until it clears `floor` on `bg`. Hue and chroma are kept:
 * the chroma is re-maximised against sRGB at every step, so the colour darkens without clipping. */
export function darkenUntil(hexIn: string, bg: string, floor = MIN_CONTRAST): string {
	let [L, C, H] = toOklch(hexIn);
	let out = fromOklch([L, clampChroma(L, C, H), H]);
	while (contrastRatio(out, bg) < floor && L > 0.05) {
		L -= 0.004;
		out = fromOklch([L, clampChroma(L, C, H), H]);
	}
	return out;
}
