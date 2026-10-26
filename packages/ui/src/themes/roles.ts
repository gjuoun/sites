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
//   { color: "<palette colour>" }      a colour name from palette/bigface.json or bigface-light.json;
//                                      `palette: "dark"` pins it to the native dark palette, which is how
//                                      the light theme keeps bigface's own blue as its button fill.
//   { mix: [a, pct, b] }               color-mix(in oklab, a pct%, b) of two palette colours
//   "0.5rem" / "0 1px 2px …" / a font stack   a literal, for the keys that are not colours
export type Value =
	| string
	| { color: string; palette?: "dark" | "light" }
	| { mix: [string, number, string] }
	| { light: Value; dark: Value };

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

export const FONT_SANS =
	'"Recursive", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO =
	'"Recursive", ui-monospace, "SF Mono", Menlo, monospace';

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
	heading: { color: "paper" },
	// Two-tier primary, Jun's ruling: the FILL is bigface's native blue with dark ink on top (the same
	// construction the dark theme's buttons already use, 6.08:1 as ink-on-fill); TEXT/links keep the
	// readable derived blue. Both name the palette, never a hex.
	primary: { color: "blue", palette: "dark" },
	"primary-fill": { color: "blue", palette: "dark" },
	"primary-ink": { color: "blue" },
	"on-primary": { color: "bg", palette: "dark" },
	"primary-edge": { mix: ["blue", 78, "bg"] },
	frame: { color: "panel" },
	"on-frame": { color: "fg" },
	"gray-100": { color: "panel" },
	"gray-200": { color: "border" },
	"gray-300": { color: "border" },
	"gray-400": { color: "highlight" },
	"gray-500": { color: "fgDim" },
	"gray-600": { color: "fgDim" },
	"gray-700": { color: "fg" },
	success: { color: "green" },
	danger: { color: "burntOrange" },
	info: { color: "cyan" },
	highlight: { color: "purple" },
	surface: { color: "panel" },
	subtle: { color: "panel" },
	secondary: { color: "panel" },
	"on-secondary": { color: "fg" },
	// Native muted grey. It is 2.79:1 on the dark canvas — the palette's own long-standing choice, kept
	// identical in all three themes and recorded as an exemption in themes.test.ts.
	"muted-ink": { color: "fgDim" },
	border: { color: "border" },
	input: { color: "border" },
	focus: { color: "blue" }, // the accent blue (ruling 2026-10-24); a readable light ring is parked for Jun
	"frame-accent": { mix: ["blue", 16, "highlight"] },
	"on-frame-accent": { color: "blue" },
	"frame-border": { mix: ["fg", 12, "highlight"] },
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
	overlay: { mix: ["bg", 75, "paper"] },
	solid: { color: "panel" },
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
	/** Motion: every transition-* utility uses these; hover and press are the two scale beats. */
	duration: string;
	ease: string;
	hover: string;
	press: string;
	/** Weight of a demo heading, so a feel can be heavier or flatter in its type. */
	weight: string;
	/** The primary plate's elevation — business drops it in light mode; a plain string applies to both. */
	"primary-shadow": string | { light: string; dark: string };
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
		purpose:
			"Quiet marketing and product surfaces: room to breathe, crisp corners, slow confidence.",
		roles: {
			...COLOURS,
			...feel({
				// comfortable, not tight; a small rounded rect, calm motion
				space: "0.3125rem",
				radius: "0.375rem",
				"text-xs": "0.78rem",
				"text-sm": "0.94rem",
				"text-base": "1.06rem",
				"text-lg": "1.28rem",
				"shadow-sm":
					"0 1px 2px color-mix(in srgb, var(--theme-canvas) 8%, transparent)",
				"shadow-md":
					"0 12px 32px -20px color-mix(in srgb, var(--theme-canvas) 30%, transparent)",
				duration: "240ms",
				ease: "cubic-bezier(0.22, 1, 0.36, 1)",
				hover: "1",
				press: "0.99",
				weight: "600",
				// Business light: the blue plate carries no dark drop at all; dark keeps bigface's glow.
				"primary-shadow": { light: "none", dark: "0 8px 26px color-mix(in srgb, var(--bf-blue) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--bf-paper) 50%, transparent)" },
			}),
		},
	},
	{
		id: "console",
		label: "Console",
		isDefault: true,
		feel: "dense · compact · flat",
		purpose:
			"A developer workspace: tight spacing, small type, small radius, no ornament.",
		roles: {
			...COLOURS,
			...feel({
				// Tailwind's own unit and scale: this is the site's theme, and its look is the baseline.
				// tightest density, near-square corners, no ornament, the shortest beat
				space: "0.1875rem",
				radius: "0.125rem",
				"text-xs": "0.72rem",
				"text-sm": "0.82rem",
				"text-base": "0.95rem",
				"text-lg": "1.05rem",
				"shadow-sm": "0 0 0 0 transparent",
				"shadow-md": "0 1px 2px 0 var(--bf-shadow)",
				duration: "90ms",
				ease: "cubic-bezier(0.4, 0, 0.2, 1)",
				hover: "1",
				press: "0.975",
				weight: "500",
				"primary-shadow": "0 8px 26px color-mix(in srgb, var(--bf-blue) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--bf-paper) 50%, transparent)",
			}),
		},
	},
	{
		id: "game",
		label: "Play",
		feel: "bold · round · springy",
		purpose:
			"Reward-forward game communities: big type, pillowy radius, a chunky shadow, a squishy press.",
		roles: {
			...COLOURS,
			...feel({
				// pill corners, the biggest type, the chunkiest shadow, a spring on hover and press
				space: "0.375rem",
				radius: "2.5rem",
				"text-xs": "0.85rem",
				"text-sm": "1.05rem",
				"text-base": "1.2rem",
				"text-lg": "1.55rem",
				"shadow-sm":
					"0 3px 0 color-mix(in srgb, var(--theme-canvas) 60%, transparent)",
				"shadow-md":
					"0 6px 0 color-mix(in srgb, var(--theme-canvas) 60%, transparent)",
				duration: "180ms",
				ease: "cubic-bezier(0.34, 1.56, 0.64, 1)",
				hover: "1.04",
				press: "0.9",
				weight: "800",
				"primary-shadow": "0 8px 26px color-mix(in srgb, var(--bf-blue) 30%, transparent), inset 0 1px 0 color-mix(in srgb, var(--bf-paper) 50%, transparent)",
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
	"primary-fill",
	"primary-ink",
	"primary-shadow",
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
	"hover",
	"weight",
] as const;

export const THEME_STORAGE_KEY = "bigface-theme";
export const MODE_STORAGE_KEY = "bigface-mode";
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_THEME = (THEMES.find((t) => t.isDefault) as Theme).id;
export const DEFAULT_MODE: Mode = "dark";
