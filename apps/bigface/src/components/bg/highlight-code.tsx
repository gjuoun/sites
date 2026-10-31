import type * as React from "react";
import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";

// An inline code chip: the theme's one yellow as ink, on a plate that stays dark in every mode.
//
// Yellow cannot sit on paper — it measures 1.14:1 against the light canvas — so the plate is the dark
// neutral of each block: fgDim on paper and the border neutral in the dark block. Both are semantic
// roles the theme already publishes; color-scheme is set by the theme toggle, and the light branch is
// the fallback.
export interface BGHighlightCodeProps extends React.ComponentProps<"code"> {}

export function BGHighlightCode({ className, children, ...props }: BGHighlightCodeProps) {
  return (
    <code
      className={cn(
        "font-mono bg-[light-dark(var(--muted-foreground),var(--border))] px-[0.1em] py-[0.04em] rounded-[6px] [font-variation-settings:'MONO'_1,'CASL'_0,'CRSV'_0.5] text-[0.88em] text-yellow",
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
}
