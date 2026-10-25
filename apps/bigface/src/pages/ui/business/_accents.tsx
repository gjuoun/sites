import * as React from "react";

// The accent family (ruling 2026-10-24): the palette's own vivid hues, each with a deepened plate. A vivid accent reads
// poorly on the paper canvas, so where it is content (a chip, a mark with a label) it is set on its plate: the plate is
// the lightest mix of the accent into the dark ink that still gives the accent 4.5:1 as text (solved in the business
// generator). The colour itself never changes; only the surface it sits on does.
export const ACCENTS = [
	"blue",
	"light-blue",
	"pale-blue",
	"cyan",
	"green",
	"lime",
	"yellow",
	"bright-yellow",
	"burnt-orange",
	"purple",
] as const;

/** One accent as a chip: the accent as text on its own plate. Both are theme roles, so both modes follow the page. */
export function AccentChips() {
	return (
		<div className="flex flex-col gap-2">
			<h5 className="text-xs font-semibold tracking-[0.08em] text-foreground uppercase">Accents on their plates</h5>
			<div className="flex flex-wrap gap-2">
				{ACCENTS.map((id) => (
					<span
						key={id}
						className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
						style={{ backgroundColor: "var(--theme-plate-" + id + ")", color: "var(--theme-accent-" + id + ")" }}
					>
						{id}
					</span>
				))}
			</div>
		</div>
	);
}
