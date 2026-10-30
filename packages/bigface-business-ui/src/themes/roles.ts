// The business theme as data: COLOUR ONLY, and in the palette's own names.
//
// A role IS a palette colour: `bg` means the palette's `bg`. The neutrals and accents the components
// actually use. Each is written twice, a light hex and a dark hex, in shadcn's two blocks; there is no
// optional tier. The six neutrals are the palette's own: bg, panel, fg, fgDim, border and highlight.
//
// Anything that is not a palette colour is shadcn's own (styles.css maps roles, nothing more) or
// generated data in accents.ts (the deepened plates for the accent docs). A theme stores only what
// comes out of the palette.
export const NEUTRALS = ["bg", "panel", "fg", "fgDim", "border", "highlight"] as const;

/**
 * The accents the components read: primary and ring, destructive, success, info, and the chart ramp
 * (blue → lightBlue → paleBlue → cyan → green) and burntOrange for danger. yellow is the theme's one
 * yellow — the palette's #ffeb3b in both modes — read as ink on a highlighted run of text; the palette
 * has exactly one yellow, so no second one is defined. lime and purple stay accent-docs data.
 */
export const ACCENTS = [
	"blue",
	"lightBlue",
	"paleBlue",
	"cyan",
	"green",
	"burntOrange",
	"yellow",
] as const;

/**
 * Roles whose light-mode ink is derived rather than borrowed. A role normally names one palette colour
 * for both blocks; the yellow is the exception, because it is read as ink: the palette's bright yellow
 * measures 1.12:1 on the light paper. The light block therefore carries the same hue and chroma with its
 * OKLCH lightness lowered until it clears AA (darkenUntil in the palette pipeline) — derived by the
 * generator, never picked by hand. The dark block keeps the palette value untouched.
 */
export const LIGHT_DERIVED = ["yellow"] as const;

/** Every role a theme must set. */
export const REQUIRED = [...NEUTRALS, ...ACCENTS] as const;

/** A theme maps each role to a palette colour name. */
export type ThemeRoles = Record<string, string>;

export interface Theme {
	id: string;
	label: string;
	/** The default theme: it also answers when no [data-theme] is set. */
	isDefault?: boolean;
	/** One line on what the theme is for. */
	purpose: string;
	roles: ThemeRoles;
}

/**
 * The business role map is the identity: each role names the palette colour of the same name.
 * The map stays (rather than being dropped) because a theme is data: a second theme could point a
 * role at a different palette colour without touching the generator.
 */
export const COLOURS: ThemeRoles = {
	...Object.fromEntries(REQUIRED.map((k) => [k, k])),
};

export const THEMES: Theme[] = [
	{
		id: "business",
		label: "Business",
		isDefault: true,
		purpose: "The light, quiet marketing and product surfaces, with a dark mode for the same pages.",
		roles: COLOURS,
	},
];

export const THEME_STORAGE_KEY = "bigface-theme";
export const MODE_STORAGE_KEY = "bigface-mode";
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_THEME = (THEMES.find((t) => t.isDefault) as Theme).id;
/** The business package defaults to light: a quiet marketing surface is paper first. */
export const DEFAULT_MODE: Mode = "light";
