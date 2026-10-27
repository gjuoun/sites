// The business theme as data: COLOUR ONLY, and in the palette's own names.
//
// A role IS a palette colour: `bg` means the palette's `bg`. The neutrals and accents the components
// actually use. light-dark() carries the two modes, so there is no per-mode block, no optional tier and
// no role that exists only to paper over one mode. The six neutrals are the palette's own: bg, panel,
// fg, fgDim, border and highlight.
//
// Anything that is not a palette colour is a formula in styles.css (the ink on the primary fill, the
// translucent veils) or generated data in accents.ts (the deepened plates for the accent docs). A
// theme stores only what comes out of the palette.
export const NEUTRALS = ["bg", "panel", "fg", "fgDim", "border", "highlight"] as const;

/**
 * The accents the components read: primary and ring, destructive, success, info, and the chart ramp
 * (blue → lightBlue → paleBlue → cyan → green), burntOrange for danger, and lime, the glow rim's gradient end. lime is
 * one of the nine palette accents, exposed here as a role; yellow and purple have no CSS variable and stay accent-docs data
 * in accents.ts.
 */
export const ACCENTS = ["blue", "lightBlue", "paleBlue", "cyan", "green", "burntOrange", "lime"] as const;

/** Every role a theme must set. There is no optional tier: the contract is the whole list. */
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
