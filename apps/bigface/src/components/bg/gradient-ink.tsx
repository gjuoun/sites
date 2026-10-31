import type * as React from "react";
import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";

// The moving caret → pale blue → blue → green headline ink. A gradient clipped to the text, swept by
// the site's hue motion; the stops are the theme's roles (foreground, chart-3, primary, chart-5).
export function BGGradientInk({ className, children, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "animate-hue bg-linear-100/srgb from-foreground via-chart-3 via-30% to-chart-5 bg-[length:220%_100%] bg-clip-text text-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
