import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";

// Bigface variants, layered on the package's stock Button without touching it. A tone picks a Bigface
// look; shadcn's own variant / size still pass straight through, and the BG classes are merged last so
// a tone wins on a conflict. Radius is the theme's (stock rounded-lg) except for the two pill shapes
// the design has always had: the copy chip and the filter chip.
export const bgButtonVariants = cva("", {
  variants: {
    tone: {
      none: "",
      glow: "h-auto bg-transparent px-[1.15rem] py-[0.7rem] text-[0.94rem] font-semibold no-underline bg-linear-135/srgb from-primary to-chart-2 text-primary-foreground shadow-[0_8px_26px_color-mix(in_srgb,var(--primary)_30%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_50%,transparent)] hover:-translate-y-0.5 hover:bg-transparent hover:from-chart-2 hover:to-chart-3 hover:text-primary-foreground hover:shadow-[0_14px_34px_color-mix(in_srgb,var(--primary)_40%,transparent),inset_0_1px_0_color-mix(in_srgb,var(--foreground)_60%,transparent)]",
      ghost:
        "h-auto border-border bg-muted/6 px-[1.15rem] py-[0.7rem] text-[0.94rem] font-semibold text-foreground no-underline hover:border-primary hover:bg-primary/8 hover:text-primary",
      copy: "h-auto cursor-pointer gap-1.5 rounded-full border-border bg-muted/8 px-[0.6rem] py-[0.35rem] font-code text-[0.72rem] font-normal tracking-[0.04em] text-muted-foreground hover:border-primary hover:bg-primary/12 hover:text-foreground [&.done]:border-chart-5 [&.done]:text-chart-5",
      nav: "h-auto border-border bg-transparent px-3 py-[0.4rem] text-[0.9rem] font-normal text-foreground no-underline hover:border-primary hover:bg-transparent hover:text-primary",
      chip: "h-auto cursor-pointer rounded-full border-border bg-muted/4 px-[0.8rem] py-[0.35rem] font-code text-[0.78rem] leading-[1.65] font-normal tracking-[0.04em] text-muted-foreground transition-[color,border-color,background] duration-200 hover:border-primary/40 hover:bg-muted/4 hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary aria-pressed:hover:text-primary-foreground",
    },
  },
  defaultVariants: { tone: "none" },
});

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
  // Tones sit on shadcn's default variant: it carries no mode-variant classes that would out-rank
  // ours, and every class it sets is one a tone overrides.
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
    <Button type="button" variant={base} size={size} className={classes} {...props}>
      {children}
    </Button>
  );
}
