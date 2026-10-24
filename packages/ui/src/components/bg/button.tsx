import { Button } from "@gjuoun/bigface-ui/components/ui/button";
import { cn } from "@gjuoun/bigface-ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

// Bigface variants, layered on shadcn's Button without touching components/ui/button.tsx.
// The corner radius is the THEME's (--theme-radius), not a hardcoded pill: business 6px, console 2px,
// play 40px (which clamps to a pill on a 40px control). A control that ignored the theme would make
// every theme look alike at a glance, which is exactly what the three feels must not do.
// `tone` picks a Bigface look; shadcn's own `variant` / `size` still pass straight through. The BG
// classes are merged last, so on a conflict (background, padding, radius…) they win over shadcn's.
// The feel half of a theme reaches every BG button: duration and easing come from the theme's own
// motion tokens, and the press scale is its `press` key — the same markup feels calm in business,
// crisp in console and springy in game.
export const bgButtonVariants = cva(
	"transition-[transform,color,background-color,border-color,box-shadow] duration-[var(--theme-duration,150ms)] ease-[var(--theme-ease,ease)] hover:scale-[var(--theme-hover,1)] active:scale-[var(--theme-press,0.97)]",
	{
		variants: {
			tone: {
				none: "",
				// the bright call to action: blue gradient plate, dark ink
				glow: "h-auto rounded-[var(--theme-radius,0.625rem)] bg-transparent hover:bg-transparent px-[1.15rem] py-[0.7rem] text-[0.94rem] font-semibold no-underline bg-linear-135/srgb from-[var(--theme-primary)] to-[var(--theme-primary-edge)] text-[var(--theme-on-primary)] shadow-[var(--theme-primary-shadow,none)] hover:-translate-y-0.5 hover:from-[var(--theme-primary)] hover:to-[var(--theme-primary)] hover:text-[var(--theme-on-primary)] hover:shadow-[var(--theme-primary-shadow,none)]",
				// quiet outline pill next to the glow button
				ghost:
					"h-auto rounded-[var(--theme-radius,0.625rem)] border-bf-selection bg-bf-border/6 px-[1.15rem] py-[0.7rem] text-[0.94rem] font-semibold text-foreground no-underline hover:border-bf-blue hover:bg-bf-blue/8 hover:text-bf-blue",
				// the small mono "copy" pill
				copy: "h-auto cursor-pointer gap-1.5 rounded-[var(--theme-radius,0.625rem)] border-bf-selection bg-bf-border/8 px-[0.6rem] py-[0.35rem] font-code text-[0.72rem] font-normal tracking-[0.04em] text-bf-fg-muted hover:border-bf-blue hover:bg-bf-blue/12 hover:text-foreground [&.done]:border-bf-lime [&.done]:text-bf-lime",
				// header link with a hairline: the GitHub call to action
				nav: "h-auto rounded-[var(--theme-radius,0.625rem)] border-bf-selection bg-transparent px-3 py-[0.4rem] text-[0.9rem] font-normal text-foreground no-underline hover:border-bf-blue hover:bg-transparent hover:text-bf-blue",
				// filter / chip that fills when aria-pressed
				chip: "h-auto cursor-pointer rounded-[var(--theme-radius,0.625rem)] border-bf-border bg-bf-border/4 px-[0.8rem] py-[0.35rem] font-code text-[0.78rem] leading-[1.65] font-normal tracking-[0.04em] text-bf-fg-muted transition-[color,border-color,background] duration-200 hover:border-bf-selection hover:bg-bf-border/4 hover:text-foreground aria-pressed:border-bf-blue aria-pressed:bg-bf-blue aria-pressed:text-ink-on-bright aria-pressed:hover:bg-bf-blue aria-pressed:hover:text-ink-on-bright",
			},
		},
		defaultVariants: { tone: "none" },
	},
);

type ButtonProps = React.ComponentProps<typeof Button>;
export type BGButtonProps = Omit<ButtonProps, "asChild"> &
	VariantProps<typeof bgButtonVariants> & {
		/** Render as a link (shadcn's asChild + <a>), so .astro pages can pass plain text children. */
		href?: string;
	};

export function BGButton({
	tone,
	className,
	href,
	children,
	variant,
	size,
	...props
}: BGButtonProps) {
	const classes = cn(bgButtonVariants({ tone }), className);
	// Tones sit on shadcn's default variant: it has no dark: classes, which would out-rank ours
	// (the page is <html class="dark">), and every class it sets is one a tone overrides.
	const base = tone && tone !== "none" ? "default" : variant;
	if (href !== undefined) {
		const { type: _type, ...rest } = props;
		return (
			<Button asChild variant={base} size={size} className={classes}>
				<a href={href} {...(rest as React.ComponentProps<"a">)}>
					{children}
				</a>
			</Button>
		);
	}
	return (
		<Button
			type="button"
			variant={base}
			size={size}
			className={classes}
			{...props}
		>
			{children}
		</Button>
	);
}
