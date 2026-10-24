import * as React from "react";
import businessCss from "@gjuoun/bigface-business-ui/themes/business.css?raw";
import darkPalette from "@gjuoun/bigface-tokens/palette.json";
import lightPalette from "@gjuoun/bigface-tokens/palette-light.json";
import { Block } from "./_frame.tsx";

// The colour section reads the generated business theme, so it cannot drift from what the components use. Each light
// value sits in a light scope and each dark value in a dark scope, so every swatch is painted by the same --theme-*
// tokens the components use, and the colour audit measures each in its own mode.

type Hex = string;
interface Pair {
	label: string;
	text: string;
	bg: string;
}

function parseBlocks(css: string): { light: Record<string, Hex>; dark: Record<string, Hex> } {
	const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
	const light: Record<string, Hex> = {};
	const dark: Record<string, Hex> = {};
	for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		const selector = m[1].trim();
		const target = selector.endsWith('[data-theme="business"]') ? light : selector.includes('[data-theme="business"][data-mode="dark"]') ? dark : null;
		if (!target) continue;
		for (const d of m[2].matchAll(/--theme-([\w-]+):\s*([^;]+);/g)) target[d[1]] = d[2].trim();
	}
	return { light, dark };
}

const parsed = parseBlocks(businessCss);

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
	{ label: "Body text on canvas", text: "ink", bg: "canvas" },
	{ label: "Heading on canvas", text: "heading", bg: "canvas" },
	{ label: "Muted text on canvas", text: "muted-ink", bg: "canvas" },
	{ label: "Link and ring on canvas", text: "primary-ink", bg: "canvas" },
	{ label: "Primary button: ink on fill", text: "on-primary", bg: "primary" },
	{ label: "Secondary button", text: "on-secondary", bg: "secondary" },
	{ label: "Frame", text: "on-frame", bg: "frame" },
	{ label: "Solid", text: "on-solid", bg: "solid" },
	{ label: "Success text on canvas", text: "success", bg: "canvas" },
	{ label: "Danger text on canvas", text: "danger", bg: "canvas" },
];

const RULES = [
	"Paper, never white: light surfaces are the paper tone, and pure white is not used in either mode.",
	"The accent family is the palette's own in both modes (ruling 2026-10-24): a light page shows the vivid hues on paper.",
	"Accents are not text-safe on paper: link, success, info and danger text, and the lime and yellow family, measure below AA above. Body ink and muted text keep AA.",
	"The primary ink (links and rings) follows the accent, so it measures 2.27:1 on paper. Whether a readable light ink returns is parked for Jun.",
	"Stock shadcn classes are not restyled: bg-black/10 and bg-white resolve through the palette ends.",
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
		<td data-slot="theme-scope" data-theme="business" data-mode={mode} data-fg-lock="" className="bg-background px-3 py-2 text-foreground">
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
		<td data-slot="theme-scope" data-theme="business" data-mode={mode} data-fg-lock="" className="bg-background px-3 py-2 text-foreground">
			<span className="flex items-center gap-3">
				<span
					className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md px-2 text-sm leading-none font-medium whitespace-nowrap"
					style={{ backgroundColor: "var(--theme-" + pair.bg + ")", color: "var(--theme-" + pair.text + ")" }}
				>
					Aa
				</span>
				<span className="font-mono text-xs whitespace-nowrap">{ratio === null ? "-" : ratio.toFixed(2) + ":1"} {verdict}</span>
			</span>
		</td>
	);
}

function PaletteColumn({ mode }: { mode: "light" | "dark" }) {
	const palette = mode === "light" ? lightPalette : darkPalette;
	return (
		<div data-slot="theme-scope" data-theme="business" data-mode={mode} className="flex flex-col gap-3 rounded-lg border bg-background p-4 text-foreground">
			<h3 className="text-sm font-semibold">{mode === "light" ? "Light" : "Dark"} palette: {palette.name}</h3>
			<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
				{Object.entries(palette.colors).map(([name, c]) => (
					<li key={name} className="flex items-center gap-2 text-xs">
						<span aria-hidden className="size-5 shrink-0 rounded-sm border border-foreground/30" style={{ backgroundColor: c.hex }} />
						<span className="font-mono">{name}</span>
						<span className="ml-auto font-mono text-muted-foreground">{c.hex}</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function ColourSection() {
	const roles = Object.keys(parsed.light);
	return (
		<Block id="colour" title="Colour" source="src/themes/business.css, generated from the Bigface palettes">
			<p className="max-w-[62ch] text-sm text-muted-foreground">
				Light and dark sit side by side. Each column is painted by its own mode scope, so every swatch is the token the components use, not a copy.
			</p>
			<div className="flex flex-col gap-3">
				<h3 className="text-base font-semibold">Role table</h3>
				<p className="text-sm text-muted-foreground">{roles.length} roles. Each name is a --theme-* variable; the hex is its value in the generated file.</p>
				<div className="overflow-x-auto rounded-lg border">
					<table className="w-full min-w-[30rem] table-fixed text-sm">
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
					<table className="w-full min-w-[30rem] table-fixed text-sm">
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
				<p className="text-sm text-muted-foreground">The named colours the roles are drawn from, one palette per mode.</p>
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
