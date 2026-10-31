import type * as React from "react";
import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";

// Small mono kicker above a heading, with the blue dot.
export function BGEyebrow({ className, children, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 font-code text-[0.72rem] tracking-[0.16em] text-muted-foreground uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
