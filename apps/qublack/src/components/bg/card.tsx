import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Card } from "@gjuoun/bigface-business-ui/components/ui/card";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";

// Bigface surface: the deep translucent plate with a hairline border and a long soft shadow.
// `glow` adds the blue→lime gradient rim. Padding/gap are reset so content keeps its own layout.
export const bgCardVariants = cva("", {
  variants: {
    tone: {
      none: "",
      plate:
        "relative block gap-0 overflow-visible rounded-[24px] bg-transparent bg-linear-160/srgb from-card/85 to-card/90 py-0 text-[1rem] text-foreground ring-0 border border-border shadow-[0_24px_60px_-30px_color-mix(in_srgb,var(--card)_90%,transparent)]",
    },
    glow: {
      false: "",
      true: "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:p-px before:bg-linear-140/srgb before:from-primary/55 before:via-chart-5/12 before:via-45% before:to-transparent before:to-70% before:content-[''] before:[mask:linear-gradient(black_0_0)_content-box,linear-gradient(black_0_0)] before:[mask-composite:exclude]",
    },
  },
  defaultVariants: { tone: "none", glow: false },
});

export type BGCardProps = React.ComponentProps<typeof Card> & VariantProps<typeof bgCardVariants>;

export function BGCard({ tone, glow, className, ...props }: BGCardProps) {
  return <Card className={cn(bgCardVariants({ tone, glow }), className)} {...props} />;
}
