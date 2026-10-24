// The three Bigface themes as data: per theme, one map of role → value. The palette is chosen by the
// block being rendered (dark or light), so a role names a colour once and both modes come out of it.
//
// A value is one of:
//   { color: "<palette colour>" }      a colour name from palette/bigface.json or bigface-light.json
//   { mix: [a, pct, b] }               color-mix(in oklab, a pct%, b) of two palette colours
//   "4px" / "1px solid …" / a font stack   a literal, for the keys that are not colours
//
// Nothing here may name a hex: values come from the palettes, which is what keeps the colour guards
// honest. scripts/gen-tokens.ts renders these maps into src/themes/<id>.css.
export type Value =
	| string
	| { color: string }
	| { mix: [string, number, string] };

export type ThemeRoles = Record<string, Value>;

export interface Theme {
	id: string;
	label: string;
	/** The default theme: it also answers when no [data-theme] is set. */
	isDefault?: boolean;
	/** Used by the /ui/ matrix: one line on what the theme is for. */
	purpose: string;
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

/** The roles all three themes share; a theme overrides the ones that make it itself. */
const shared = (o: {
	primary: string;
	success: string;
	danger: string;
	info: string;
	highlight: string;
	radius: string;
	mutedInk: Value;
}): ThemeRoles => ({
	canvas: { color: "bg" },
	ink: { color: "fg" },
	heading: { color: "caret" },
	primary: { color: o.primary },
	"on-primary": { color: "bg" },
	"primary-edge": { mix: [o.primary, 78, "bg"] },
	frame: { color: "cursorLine" },
	"on-frame": { color: "fg" },
	"gray-100": { color: "borderMuted" },
	"gray-200": { color: "border" },
	"gray-300": { color: "border" },
	"gray-400": { color: "selection" },
	"gray-500": { color: "fgDim" },
	"gray-600": { color: "comment" },
	"gray-700": { color: "fg" },
	success: { color: o.success },
	danger: { color: o.danger },
	info: { color: o.info },
	highlight: { color: o.highlight },
	radius: o.radius,
	"font-sans": FONT_SANS,
	"font-mono": FONT_MONO,
	surface: { color: "cursorLine" },
	subtle: { color: "borderMuted" },
	secondary: { color: "borderMuted" },
	"on-secondary": { color: "fg" },
	"muted-ink": o.mutedInk,
	border: { color: "border" },
	input: { color: "border" },
	focus: { color: o.primary },
	"frame-accent": { mix: [o.primary, 16, "cursorLine"] },
	"on-frame-accent": { color: o.primary },
	"frame-border": { mix: ["fg", 12, "cursorLine"] },
	"primary-tint": { mix: [o.primary, 12, "bg"] },
	"success-tint": { mix: [o.success, 14, "bg"] },
	"danger-tint": { mix: [o.danger, 14, "bg"] },
	"info-tint": { mix: [o.info, 14, "bg"] },
	"highlight-tint": { mix: [o.highlight, 14, "bg"] },
	"chart-1": { color: o.primary },
	"chart-2": { color: o.success },
	"chart-3": { color: o.highlight },
	"chart-4": { color: o.danger },
	"chart-5": { color: o.info },
	overlay: { mix: ["bg", 75, "caret"] },
	solid: { color: "cursorLine" },
	"on-solid": { color: "fg" },
	"shadow-card":
		"0 1px 3px color-mix(in srgb, var(--theme-canvas) 22%, transparent)",
	"shadow-modal":
		"0 20px 60px color-mix(in srgb, var(--theme-canvas) 45%, transparent)",
});

export const THEMES: Theme[] = [
	{
		id: "business",
		label: "Business",
		purpose: "Light, simple and elegant: landing pages and product surfaces.",
		roles: shared({
			primary: "blue",
			success: "green",
			danger: "burntOrange",
			info: "blue",
			highlight: "purple",
			radius: "0.5rem",
			mutedInk: { mix: ["fg", 75, "bg"] },
		}),
	},
	{
		id: "console",
		label: "Console",
		isDefault: true,
		purpose:
			"Minimalist dark workspace for developer tools: the library's original look.",
		roles: shared({
			primary: "blue",
			success: "green",
			danger: "burntOrange",
			info: "cyan",
			highlight: "purple",
			radius: "0.625rem",
			// Console keeps the palette's own muted grey so the dark theme is unchanged; it is the one
			// recorded exemption in themes.test.ts (fgDim is 2.79:1 on bg, as it has always been).
			mutedInk: { color: "fgDim" },
		}),
	},
	{
		id: "game",
		label: "Play",
		purpose:
			"Reward-forward: game communities and leaderboards (a freecash-style surface).",
		roles: shared({
			primary: "green",
			success: "lime",
			danger: "burntOrange",
			info: "cyan",
			highlight: "brightYellow",
			radius: "0.75rem",
			mutedInk: { mix: ["fg", 75, "bg"] },
		}),
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
] as const;

export const THEME_STORAGE_KEY = "bigface-theme";
export const MODE_STORAGE_KEY = "bigface-mode";
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
export const DEFAULT_THEME = (THEMES.find((t) => t.isDefault) as Theme).id;
export const DEFAULT_MODE: Mode = "dark";
