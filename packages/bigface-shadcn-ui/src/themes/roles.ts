// The Bigface theme as data: COLOUR ONLY, and in the palette's own names.
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
 * yellow — the palette's #ffeb3b in both modes — carried as a fill and an underline accent; on paper it
 * is never body ink (it measures 1.12:1 there). lime and purple stay palette data for ANSI and syntax.
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
 * No role is derived. Every value in both blocks is the palette hex itself, so the theme and the palette
 * can be compared row by row — the light yellow is the palette's yellow (#ffeb3b), not a darkened ink.
 * A role whose colour cannot read as text on paper is used as a fill there, never as body ink.
 */

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
 * The Bigface role map is the identity: each role names the palette colour of the same name.
 * The map stays (rather than being dropped) because a theme is data: a second theme could point a
 * role at a different palette colour without touching the generator.
 */
export const COLOURS: ThemeRoles = {
	...Object.fromEntries(REQUIRED.map((k) => [k, k])),
};

export const THEMES: Theme[] = [
	{
		id: "bigface",
		label: "Bigface",
		isDefault: true,
		purpose: "The Bigface palette on shadcn's stock components: paper-light, green-grey dark.",
		roles: COLOURS,
	},
];

export const THEME_STORAGE_KEY = "bigface-theme";
export const MODE_STORAGE_KEY = "bigface-mode";
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_THEME = (THEMES.find((t) => t.isDefault) as Theme).id;
/** The Bigface package defaults to light: the paper mode is the theme's own starting point. */
export const DEFAULT_MODE: Mode = "light";
