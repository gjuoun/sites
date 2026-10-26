// The business theme as data: COLOUR ONLY.
//
// Every entry names a colour of the native Bigface palette. A block resolves against the dark file (dark
// mode) or the generated light file (light mode), so the same map gives both modes. There is no feel here:
// radius, type, spacing, shadow geometry and motion are Tailwind's and shadcn's own, so every component
// renders exactly as the CLI ships it. A theme colours the components; it does not restyle them.
//
// A value is one of:
//   { color: "<palette colour>" }                  a colour of the palette (optionally pinned with palette: "dark")
//   { mix: [a, pct, b] }                           color-mix(in oklab, a pct%, b) of two palette colours
//   { plate: "<accent>" }                          a DEEPENED plate for an accent: the lightest mix of the accent into the dark
//                                                  ink that still gives the accent 4.5:1 as text (solved in scripts/gen-tokens.ts)
//   { light: <value>, dark: <value> }              a different value per mode
//   "<literal>"                                    a non-colour literal (none in this package)
export type Value =
	| string
	| { color: string; palette?: "dark" | "light" }
	| { mix: [string, number, string] }
	| { plate: string }
	| { light: Value; dark: Value };

export type ThemeRoles = Record<string, Value>;

export interface Theme {
	id: string;
	label: string;
	/** The default theme: it also answers when no [data-theme] is set. */
	isDefault?: boolean;
	/** One line on what the theme is for. */
	purpose: string;
	roles: ThemeRoles;
}

/** Keys every theme must set. */
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
] as const;

/**
 * Two-tier primary, the business ruling: the FILL is bigface's native blue (#00b0ff in both modes) with the
 * dark ink on top (6.08:1 as ink-on-fill). TEXT and rings follow the accent blue in both modes (ruling 2026-10-24: 2.27:1 on paper, parked for Jun).
 * black and white are the palette's own darkest and lightest: the stock scrim (bg-black/10) and the stock
 * slider thumb (bg-white) resolve through them, so no stock class has to change. White is paper, never #fff.
 */
export const COLOURS: ThemeRoles = {
	canvas: { color: "bg" },
	ink: { color: "fg" },
	heading: { color: "paper" },
	primary: { color: "blue", palette: "dark" },
	"primary-fill": { color: "blue", palette: "dark" },
	"primary-ink": { color: "blue" },
	"on-primary": { color: "bg", palette: "dark" },
	"primary-edge": { mix: ["blue", 78, "bg"] },
	frame: { color: "highlight" },
	"on-frame": { color: "fg" },
	"gray-100": { color: "border" },
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
	surface: { color: "highlight" },
	subtle: { color: "border" },
	secondary: { color: "border" },
	"on-secondary": { color: "fg" },
	// Native muted grey: 2.79:1 on the dark canvas, the palette's own long-standing choice.
	"muted-ink": { color: "fgDim" },
	border: { color: "border" },
	input: { color: "border" },
	focus: { color: "blue" },
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
	solid: { color: "highlight" },
	"on-solid": { color: "fg" },
	// The accent family as text colours, and a deepened plate for each: a vivid accent is read on its own plate, not on
	// the paper (ruling 2026-10-24: the colour itself is unchanged; the plate is the deepened tint it is read on).
	"accent-blue": { color: "blue" },
	"plate-blue": { plate: "blue" },
	"accent-light-blue": { color: "lightBlue" },
	"plate-light-blue": { plate: "lightBlue" },
	"accent-pale-blue": { color: "paleBlue" },
	"plate-pale-blue": { plate: "paleBlue" },
	"accent-cyan": { color: "cyan" },
	"plate-cyan": { plate: "cyan" },
	"accent-green": { color: "green" },
	"plate-green": { plate: "green" },
	"accent-lime": { color: "lime" },
	"plate-lime": { plate: "lime" },
	"accent-yellow": { color: "yellow" },
	"plate-yellow": { plate: "yellow" },
	"accent-bright-yellow": { color: "brightYellow" },
	"plate-bright-yellow": { plate: "brightYellow" },
	"accent-burnt-orange": { color: "burntOrange" },
	"plate-burnt-orange": { plate: "burntOrange" },
	"accent-purple": { color: "purple" },
	"plate-purple": { plate: "purple" },
	black: { light: { color: "fg" }, dark: { color: "bg" } },
	white: { light: { color: "bg" }, dark: { color: "fg" } },
};

/** Optional keys: every colour role that is not required. */
export const OPTIONAL = Object.keys(COLOURS).filter((k) => !(REQUIRED as readonly string[]).includes(k));

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
