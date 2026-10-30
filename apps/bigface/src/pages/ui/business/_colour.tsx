import * as React from "react";
import businessCss from "@gjuoun/bigface-shadcn-ui/themes/bigface.css?raw";
import { paletteFor } from "../../../data/palette.ts";
import { Block } from "./_frame.tsx";
import { THEME_NEUTRALS, themeNeutralsLightToDark } from "../../../data/neutrals.ts";

// The colour section reads the generated business theme, so it cannot drift from what the components use. Each light
// value sits in a light scope and each dark value in a dark scope, so every swatch is painted by the same --theme-*
// tokens the components use, and the colour audit measures each in its own mode.

type Hex = string;
interface Pair {
	label: string;
	text: string;
	bg: string;
}

// Two blocks, as shadcn writes a theme: the light one, then the [data-mode="dark"] one. The page reads each block
// into its own column.
function parseTheme(css: string): { light: Record<string, Hex>; dark: Record<string, Hex> } {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const light: Record<string, Hex> = {};
	const dark: Record<string, Hex> = {};
	for (const block of clean.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
		const target = (block[1] as string).includes('[data-mode="dark"]') ? dark : light;
		for (const m of (block[2] as string).matchAll(/--theme-([\w-]+):\s*([^;]+);/g)) {
			target[m[1] as string] = (m[2] as string).trim() as Hex;
		}
	}
	return { light, dark };
}

const parsed = parseTheme(businessCss);
// The ink on the primary fill is a formula, not a palette role: light takes the fg, dark takes the canvas.
parsed.light["on-primary"] = parsed.light.fg as Hex;
parsed.dark["on-primary"] = parsed.dark.bg as Hex;

const HEX = /^#[0-9a-f]{6}$/i;
function luminance(hex: Hex): number {
	const n = Number.parseInt(hex.slice(1), 16);
	const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours, or null when either is not a six-digit hex. */
export function contrast(a: Hex, b: Hex): number | null {
	if (!HEX.test(a) || !HEX.test(b)) return null;
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: Pair[] = [
	{ label: "Body and heading text on canvas", text: "fg", bg: "bg" },
	{ label: "Muted text on canvas", text: "fgDim", bg: "bg" },
	{ label: "Link and ring on canvas", text: "blue", bg: "bg" },
	{ label: "Primary button: ink on fill", text: "on-primary", bg: "blue" },
	{ label: "Secondary button, card, popover", text: "fg", bg: "panel" },
	{ label: "Success text on canvas", text: "green", bg: "bg" },
	{ label: "Danger text on canvas", text: "burntOrange", bg: "bg" },
];

const RULES = [
	"Paper, never white: light surfaces are the paper tone, and pure white is not used in either mode.",
	"The accent family is the palette's own in both modes (ruling 2026-10-24): a light page shows the vivid hues on paper.",
	"Accents are not text-safe on paper: link, success, info and danger text measure below AA there. Body ink and muted text keep AA.",
	"The primary ink (links and rings) follows the accent, so it measures 2.27:1 on paper. Whether a readable light ink returns is parked for Jun.",
	"The ink on the primary fill is each mode's own darkest readable value: light fg (5.29:1), dark canvas (6.08:1). Dark fg would measure 1.98:1 on the fill.",
	"Surfaces (card, popover, secondary, muted, accent, sidebar) read the panel tier: one neutral, no per-mode fork.",
	"Overlays, shadows and the slider thumb are shadcn's own black and white: the theme does not restyle them.",
];

// Both tables share one column template, so the role table and the text-pairs table line up column for column.
const GRID = (
	<colgroup>
		<col style={{ width: "44%" }} />
		<col style={{ width: "28%" }} />
		<col style={{ width: "28%" }} />
	</colgroup>
);

const HEAD = "px-3 py-2 text-left font-semibold text-foreground";

function ModeCell({ mode, role, hex }: { mode: "light" | "dark"; role: string; hex: Hex }) {
	return (
		<td data-slot="theme-scope" data-theme="bigface" data-mode={mode} className="bg-background px-3 py-2 text-foreground">
			<span className="flex items-center gap-2">
				<span aria-hidden className="inline-block size-5 shrink-0 rounded-sm border border-foreground/30" style={{ backgroundColor: "var(--theme-" + role + ")" }} />
				<span className="font-mono text-xs">{hex}</span>
			</span>
		</td>
	);
}

function PairCell({ mode, pair, colours }: { mode: "light" | "dark"; pair: Pair; colours: Record<string, Hex> }) {
	const ratio = contrast(colours[pair.text] ?? "", colours[pair.bg] ?? "");
	const verdict = ratio === null ? "no hex" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large only" : "below AA";
	return (
		<td data-slot="theme-scope" data-theme="bigface" data-mode={mode} className="bg-background px-3 py-2 text-foreground">
			<span className="flex items-center gap-3">
				<span
					className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-sm leading-none font-medium whitespace-nowrap"
					style={{ backgroundColor: "var(--theme-" + pair.bg + ")", color: "var(--theme-" + pair.text + ")" }}
				>
					Aa
				</span>
				<span className="min-w-0 font-mono text-xs">{ratio === null ? "-" : ratio.toFixed(2) + ":1"} {verdict}</span>
			</span>
		</td>
	);
}

function PaletteRow({ name, hex }: { name: string; hex: Hex }) {
	return (
		<li className="flex items-center gap-2 text-xs">
			<span aria-hidden className="size-5 shrink-0 rounded-sm border border-foreground/30" style={{ backgroundColor: hex }} />
			<span className="font-mono">{name}</span>
			<span className="ml-auto font-mono text-muted-foreground">{hex}</span>
		</li>
	);
}

// The accents the theme uses: every business.css role that is not a neutral.
const accentRoles = Object.keys(parsed.light).filter(
	(role) => role !== "on-primary" && !(THEME_NEUTRALS as readonly string[]).includes(role),
);

function PaletteColumn({ mode }: { mode: "light" | "dark" }) {
	const palette = paletteFor(mode);
	const hexOf = (name: string): Hex => (palette.colors as Record<string, { hex: Hex }>)[name]?.hex ?? "";
	return (
		<div data-slot="theme-scope" data-theme="bigface" data-mode={mode} className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground">
			<h3 className="text-sm font-semibold">{mode === "light" ? "Light" : "Dark"} palette: {palette.name}</h3>
			<h4 className="pt-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Neutrals, lightest first</h4>
			<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{themeNeutralsLightToDark(palette).map((name) => (
					<PaletteRow key={name} name={name} hex={hexOf(name)} />
				))}
			</ul>
			<h4 className="pt-1 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">Accents the theme uses</h4>
			<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{accentRoles.map((role) => (
					<PaletteRow key={role} name={role} hex={parsed[mode][role] ?? ""} />
				))}
			</ul>
		</div>
	);
}

export function ColourSection() {
	const roles = Object.keys(parsed.light);
	return (
		<Block id="colour" title="Colour" source="src/themes/bigface.css, generated from the Bigface palettes">
			<p className="max-w-[62ch] text-sm text-muted-foreground">
				Light and dark sit side by side. Each column is painted by its own mode scope, so every swatch is the token the components use, not a copy.
			</p>
			<div className="flex flex-col gap-3">
				<h3 className="text-base font-semibold">Role table</h3>
				<p className="text-sm text-muted-foreground">{roles.length} roles. Each name is a --theme-* variable; the hex is its value in the generated file.</p>
				<div className="overflow-x-auto rounded-lg border">
					<table className="w-full min-w-[36rem] table-fixed text-sm">
						{GRID}
						<thead className="bg-muted">
							<tr className="border-b">
								<th scope="col" className={HEAD}>Role</th>
								<th scope="col" className={HEAD}>Light</th>
								<th scope="col" className={HEAD}>Dark</th>
							</tr>
						</thead>
						<tbody>
							{roles.map((role) => (
								<tr key={role} className="border-t">
									<th scope="row" className="px-3 py-2 text-left font-mono text-xs font-normal">{role}</th>
									<ModeCell mode="light" role={role} hex={parsed.light[role]} />
									<ModeCell mode="dark" role={role} hex={parsed.dark[role] ?? parsed.light[role]} />
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex flex-col gap-3">
				<h3 className="text-base font-semibold">Text pairs</h3>
				<p className="text-sm text-muted-foreground">Contrast of each text role on its background, in both modes. AA is 4.5:1 for body text and 3:1 for large text.</p>
				<div className="overflow-x-auto rounded-lg border">
					<table className="w-full min-w-[36rem] table-fixed text-sm">
						{GRID}
						<thead className="bg-muted">
							<tr className="border-b">
								<th scope="col" className={HEAD}>Pair</th>
								<th scope="col" className={HEAD}>Light</th>
								<th scope="col" className={HEAD}>Dark</th>
							</tr>
						</thead>
						<tbody>
							{PAIRS.map((p) => (
								<tr key={p.label} className="border-t">
									<th scope="row" className="px-3 py-2 text-left font-normal">
										{p.label}
										<span className="block font-mono text-xs text-muted-foreground">{p.text} on {p.bg}</span>
									</th>
									<PairCell mode="light" pair={p} colours={parsed.light} />
									<PairCell mode="dark" pair={p} colours={parsed.dark} />
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
			<div className="flex flex-col gap-3">
				<h3 className="text-base font-semibold">Palette</h3>
				<p className="text-sm text-muted-foreground">The palette colours the theme draws from, one palette per mode. Only the colours business.css uses are shown.</p>
				<div className="grid gap-4 md:grid-cols-2">
					<PaletteColumn mode="light" />
					<PaletteColumn mode="dark" />
				</div>
			</div>
			<div className="flex flex-col gap-2">
				<h3 className="text-base font-semibold">Pairing rules</h3>
				<ul className="list-disc space-y-1 pl-5 text-sm">
					{RULES.map((rule) => (
						<li key={rule}>{rule}</li>
					))}
				</ul>
			</div>
		</Block>
	);
}
