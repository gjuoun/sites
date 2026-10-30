import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";

// Bigface "pill": mono uppercase tag with a dot, tinted by how far a theme was checked.
export const bgBadgeVariants = cva("", {
  variants: {
    tone: {
      none: "",
      pill: "h-auto gap-[0.35rem] rounded-full border-border bg-muted/5 px-[0.6rem] py-[0.22rem] font-code text-[0.72rem] font-normal tracking-[0.06em] text-muted-foreground uppercase before:size-[5px] before:rounded-full before:bg-current before:content-['']",
      tool: "h-auto gap-[0.35rem] rounded-full border-chart-5/40 bg-muted/5 px-[0.6rem] py-[0.22rem] font-code text-[0.72rem] font-normal tracking-[0.06em] text-chart-5 uppercase before:size-[5px] before:rounded-full before:bg-current before:content-['']",
      schema:
        "h-auto gap-[0.35rem] rounded-full border-chart-4/40 bg-muted/5 px-[0.6rem] py-[0.22rem] font-code text-[0.72rem] font-normal tracking-[0.06em] text-chart-4 uppercase before:size-[5px] before:rounded-full before:bg-current before:content-['']",
      format:
        "h-auto gap-[0.35rem] rounded-full border-destructive/40 bg-muted/5 px-[0.6rem] py-[0.22rem] font-code text-[0.72rem] font-normal tracking-[0.06em] text-destructive uppercase before:size-[5px] before:rounded-full before:bg-current before:content-['']",
    },
  },
  defaultVariants: { tone: "none" },
});

export type BGBadgeProps = React.ComponentProps<typeof Badge> &
  VariantProps<typeof bgBadgeVariants>;

export function BGBadge({ tone, className, variant, ...props }: BGBadgeProps) {
  return (
    <Badge
      variant={tone && tone !== "none" ? "outline" : variant}
      className={cn(bgBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}
