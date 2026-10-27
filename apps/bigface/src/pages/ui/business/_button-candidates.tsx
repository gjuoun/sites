// DEMO ONLY. A candidate sheet for the Button glow rim: five hover rims side by side, to pick by eye.
// None of these is a shipped variant; components/ui/button.tsx is unchanged. Each candidate reads only the theme's
// existing colour variables (--theme-blue, --theme-lime). To remove the sheet: delete this file, and the import and the
// <ButtonCandidates /> line in _catalog.tsx.

import * as React from "react";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";

// The shape every candidate shares: a plain primary fill at rest, a hover lift, and a relative box for the rim.
const BASE = "relative bg-primary text-primary-foreground hover:bg-primary hover:-translate-y-0.5";
// The rim is a pseudo-element with a 1px padding ring, masked to the ring alone (the content box is excluded).
const RIM_SHARED = "before:pointer-events-none before:p-px before:content-[''] before:[mask-image:linear-gradient(#000_0_0),linear-gradient(#000_0_0)] before:[mask-clip:content-box,border-box] before:[mask-composite:exclude] before:opacity-0 before:transition-opacity hover:before:opacity-100";
// Inside: the ring sits on the padding box, over the fill's outermost pixel.
const RIM_INSIDE = "before:absolute before:inset-0 before:rounded-[inherit]";
// Outside: the ring sits 1px outside the border box, on the surface the button stands on.
const RIM_OUTSIDE = "before:absolute before:-inset-[2px] before:rounded-[calc(var(--radius-lg)_+_1px)]";
// The reference card's stops, as the shipped glow variant writes them.
const REF_GRAD = "before:bg-linear-140/srgb before:from-[var(--theme-blue)]/55 before:via-[var(--theme-lime)]/12 before:via-45% before:to-transparent before:to-70%";

// The static copy under each candidate (no pointer on a phone): the same class string with the rim's reveal not gated on
// hover. Exactly three tokens change: the hover reveal is dropped, the rest opacity goes to 100, and candidate 5's hover shadow is on.
const forced = (cls: string) =>
	cls
		.split(" ")
		.filter((t) => t !== "hover:before:opacity-100")
		.map((t) => (t === "before:opacity-0" ? "before:opacity-100" : t.startsWith("hover:shadow-[") ? t.slice(6) : t))
		.join(" ");

// The bloom as a standalone literal, so Tailwind generates the un-hovered class the static copy needs.
const LIME_BLOOM = "shadow-[0_0_0_1px_color-mix(in_oklab,var(--theme-lime)_60%,transparent),0_0_10px_-2px_color-mix(in_oklab,var(--theme-lime)_50%,transparent)]";

export const CANDIDATES = [
	{ n: 1, name: "reference, inside", note: "blue/55 via lime/12 at 45%, to transparent at 70%; 1px on the fill's edge", cls: [RIM_SHARED, RIM_INSIDE, REF_GRAD].join(" ") },
	{ n: 2, name: "reference, outside", note: "the same stops, 1px on the canvas just outside the edge", cls: [RIM_SHARED, RIM_OUTSIDE, REF_GRAD].join(" ") },
	{ n: 3, name: "stronger lime, outside", note: "blue/40 via lime/60 at 50%, to transparent at 80%; 1px outside", cls: [RIM_SHARED, RIM_OUTSIDE, "before:bg-linear-140/srgb before:from-[var(--theme-blue)]/40 before:via-[var(--theme-lime)]/60 before:via-50% before:to-transparent before:to-80%"].join(" ") },
	{ n: 4, name: "lime to blue diagonal, outside", note: "lime/70 to blue/70 across the rim at 135deg; 1px outside", cls: [RIM_SHARED, RIM_OUTSIDE, "before:bg-linear-135/srgb before:from-[var(--theme-lime)]/70 before:to-[var(--theme-blue)]/70"].join(" ") },
	{ n: 5, name: "thin outer ring, soft bloom", note: "1px lime ring at 60% and a 10px lime bloom at 50%; no pseudo-element", cls: "hover:" + LIME_BLOOM },
];

export function ButtonCandidates() {
	return (
		<div data-demo-only="button-candidates" className="flex flex-col gap-4 rounded-lg border border-dashed border-muted-foreground p-4">
			<p className="font-mono text-xs tracking-[0.06em] text-muted-foreground uppercase">DEMO ONLY · glow rim candidates · not shipped · hover each button</p>
			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
				{CANDIDATES.map((c) => (
					<div key={c.n} data-frame={"candidate " + c.n} data-candidate={c.n} className="flex flex-col items-start gap-2 px-3 py-4">
						<Button size="lg" className={BASE + " " + c.cls}>Candidate {c.n}</Button>
						{/* DEMO ONLY static copy, for a pointerless screen: inert, rim forced visible. Delete with the sheet. */}
						<div inert className="flex flex-col items-start gap-1">
							<Button size="lg" className={BASE + " " + forced(c.cls)}>Candidate {c.n}</Button>
							<span className="font-mono text-xs text-muted-foreground">rim forced · static copy</span>
						</div>
						<span className="font-mono text-xs text-foreground">{c.n} · {c.name}</span>
						<span className="text-xs text-muted-foreground">{c.note}</span>
					</div>
				))}
			</div>
		</div>
	);
}
