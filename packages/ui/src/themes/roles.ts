// The three Bigface themes as data. ONE colour system, three feels.
//
// Colour: every theme resolves the same role map against the native Bigface palette — the dark file for a
// dark block, the generated light file for a light one. No theme invents a hue; primary is the palette's
// blue in all three, success its green, danger its burnt orange, info its cyan, highlight its purple.
//
// Feel: that is what a theme actually chooses — density (the spacing unit every utility is derived from),
// the type scale, corner radius, elevation, motion and press. The generator renders both into the same
// --theme-* namespace; theme.css maps the feel keys onto Tailwind's own tokens (--spacing, --text-*,
// --shadow-*, --default-transition-*), so the same component markup reads denser or bolder without any
// component knowing which theme it is in.
//
// A value is one of:
//   { color: "<palette colour>" }      a colour name from palette/bigface.json or bigface-light.json
//   { mix: [a, pct, b] }               color-mix(in oklab, a pct%, b) of two palette colours
//   "0.5rem" / "0 1px 2px …" / a font stack   a literal, for the keys that are not colours
export type Value = string | { color: string } | { mix: [string, number, string] };

export type ThemeRoles = Record<string, Value>;

export interface Theme {
	id: string;
	label: string;
	/** The default theme: it also answers when no [data-theme] is set. */
	isDefault?: boolean;
	/** One line on what the theme is for, shown in the gallery. */
	purpose: string;
	/** How it feels, in three words — the gallery prints this next to the name. */
	feel: string;
	roles: ThemeRoles;
}

export const FONT_SANS = '"Recursive", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = '"Recursive", ui-monospace, "SF Mono", Menlo, monospace';

/** Keys every theme must set, straight from contract.json (kept in the same order). */
export const REQUIRED = [
	"canvas",
	"ink",
	"heading",
	"primary",
	"on-primary",
	"primary-edge",
	"frame",
	"on-frame",
	"gray-100",
	"gray-200",
	"gray-300",
	"gray-400",
	"gray-500",
	"gray-600",
	"gray-700",
	"success",
	"danger",
	"info",
	"highlight",
	"radius",
	"font-sans",
	"font-mono",
] as const;

/**
 * The colour half: identical for all three themes, on purpose. Every entry names a colour of the native
 * palette, so the dark and light blocks differ only because they resolve against different palettes.
 */
export const COLOURS: ThemeRoles = {
	canvas: { color: "bg" },
	ink: { color: "fg" },
	heading: { color: "caret" },
	primary: { color: "blue" },
	"on-primary": { color: "bg" },
	"primary-edge": { mix: ["blue", 78, "bg"] },
	frame: { color: "cursorLine" },
	"on-frame": { color: "fg" },
	"gray-100": { color: "borderMuted" },
	"gray-200": { color: "border" },
	"gray-300": { color: "border" },
	"gray-400": { color: "selection" },
	"gray-500": { color: "fgDim" },
	"gray-600": { color: "comment" },
	"gray-700": { color: "fg" },
	success: { color: "green" },
	danger: { color: "burntOrange" },
	info: { color: "cyan" },
	highlight: { color: "purple" },
	surface: { color: "cursorLine" },
	subtle: { color: "borderMuted" },
	secondary: { color: "borderMuted" },
	"on-secondary": { color: "fg" },
	// Native muted grey. It is 2.79:1 on the dark canvas — the palette's own long-standing choice, kept
	// identical in all three themes and recorded as an exemption in themes.test.ts.
	"muted-ink": { color: "fgDim" },
	border: { color: "border" },
	input: { color: "border" },
	focus: { color: "blue" },
	"frame-accent": { mix: ["blue", 16, "cursorLine"] },
	"on-frame-accent": { color: "blue" },
	"frame-border": { mix: ["fg", 12, "cursorLine"] },
	"primary-tint": { mix: ["blue", 12, "bg"] },
	"success-tint": { mix: ["green", 14, "bg"] },
	"danger-tint": { mix: ["burntOrange", 14, "bg"] },
	"info-tint": { mix: ["cyan", 14, "bg"] },
	"highlight-tint": { mix: ["purple", 14, "bg"] },
	"chart-1": { color: "blue" },
	"chart-2": { color: "lime" },
	"chart-3": { color: "yellow" },
	"chart-4": { color: "burntOrange" },
	"chart-5": { color: "purple" },
	overlay: { mix: ["bg", 75, "caret"] },
	solid: { color: "cursorLine" },
	"on-solid": { color: "fg" },
};

/** The feel half: the only thing a theme chooses. */
export interface Feel {
	/** Base spacing unit; every p-/m-/gap-/h- utility is a multiple of it (0.25rem = Tailwind's own). */
	space: string;
	radius: string;
	/** Type scale, mapped onto Tailwind's text-xs…text-lg. */
	"text-xs": string;
	"text-sm": string;
	"text-base": string;
	"text-lg": string;
	/** Elevation, mapped onto Tailwind's shadow-sm / shadow-md. */
	"shadow-sm": string;
	"shadow-md": string;
	/** Motion: every transition-* utility uses these, and :active scales by press. */
	duration: string;
	ease: string;
	press: string;
}

const feel = (f: Feel): ThemeRoles => ({
	...f,
	"font-sans": FONT_SANS,
	"font-mono": FONT_MONO,
	// The two component-level elevations the contract also exposes.
	"shadow-card":
		"0 1px 3px color-mix(in srgb, var(--theme-canvas) 22%, transparent)",
	"shadow-modal":
		"0 20px 60px color-mix(in srgb, var(--theme-canvas) 45%, transparent)",
});

export const THEMES: Theme[] = [
	{
		id: "business",
		label: "Business",
		feel: "airy · crisp · calm",
		purpose: "Quiet marketing and product surfaces: room to breathe, crisp corners, slow confidence.",
		roles: {
			...COLOURS,
			...feel({
				space: "0.3rem",
				radius: "0.5rem",
				"text-xs": "0.78rem",
				"text-sm": "0.94rem",
				"text-base": "1.06rem",
				"text-lg": "1.25rem",
				"shadow-sm": "0 1px 2px color-mix(in srgb, var(--theme-canvas) 10%, transparent)",
				"shadow-md": "0 10px 30px -18px color-mix(in srgb, var(--theme-canvas) 30%, transparent)",
				duration: "300ms",
				ease: "cubic-bezier(0.22, 1, 0.36, 1)",
				press: "0.995",
			}),
		},
	},
	{
		id: "console",
		label: "Console",
		isDefault: true,
		feel: "dense · compact · flat",
		purpose: "A developer workspace: tight spacing, small type, small radius, no ornament.",
		roles: {
			...COLOURS,
			...feel({
				// Tailwind's own unit and scale: this is the site's theme, and its look is the baseline.
				space: "0.25rem",
				radius: "0.625rem",
				"text-xs": "0.75rem",
				"text-sm": "0.875rem",
				"text-base": "1rem",
				"text-lg": "1.125rem",
				// the site's own elevations, unchanged: console is what bigface ships today
				"shadow-sm": "0 1px 3px 0 var(--bf-shadow), 0 1px 2px -1px var(--bf-shadow)",
				"shadow-md": "0 4px 6px -1px var(--bf-shadow), 0 2px 4px -2px var(--bf-shadow)",
				duration: "150ms",
				ease: "cubic-bezier(0.4, 0, 0.2, 1)",
				press: "0.97",
			}),
		},
	},
	{
		id: "game",
		label: "Play",
		feel: "bold · round · springy",
		purpose: "Reward-forward game communities: big type, pillowy radius, a chunky shadow, a squishy press.",
		roles: {
			...COLOURS,
			...feel({
				space: "0.3125rem",
				radius: "1.5rem",
				"text-xs": "0.82rem",
				"text-sm": "1rem",
				"text-base": "1.12rem",
				"text-lg": "1.4rem",
				"shadow-sm": "0 2px 0 color-mix(in srgb, var(--theme-canvas) 55%, transparent)",
				"shadow-md": "0 4px 0 color-mix(in srgb, var(--theme-canvas) 55%, transparent)",
				duration: "120ms",
				ease: "cubic-bezier(0.34, 1.56, 0.64, 1)",
				press: "0.93",
			}),
		},
	},
];

/** Optional keys, in contract order: the reset file and the checker both read this. */
export const OPTIONAL = [
	"surface",
	"subtle",
	"secondary",
	"on-secondary",
	"muted-ink",
	"border",
	"input",
	"focus",
	"frame-accent",
	"on-frame-accent",
	"frame-border",
	"primary-tint",
	"success-tint",
	"danger-tint",
	"info-tint",
	"highlight-tint",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"overlay",
	"solid",
	"on-solid",
	"shadow-card",
	"shadow-modal",
	"space",
	"text-xs",
	"text-sm",
	"text-base",
	"text-lg",
	"shadow-sm",
	"shadow-md",
	"duration",
	"ease",
	"press",
] as const;

export const THEME_STORAGE_KEY = "bigface-theme";
export const MODE_STORAGE_KEY = "bigface-mode";
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_THEME = (THEMES.find((t) => t.isDefault) as Theme).id;
export const DEFAULT_MODE: Mode = "dark";
