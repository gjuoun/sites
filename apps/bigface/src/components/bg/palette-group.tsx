import type * as React from "react";

// One section of the palette page: a heading with a count, then its content.
export interface BGPaletteGroupProps {
  id: string;
  title: string;
  count?: number;
  children?: React.ReactNode;
}

export function BGPaletteGroup({ id, title, count, children }: BGPaletteGroupProps) {
  return (
    <section id={id} className="mt-[2.8rem]" data-reveal>
      <h2 className="mb-4 flex items-baseline gap-[0.6rem] text-[clamp(1.35rem,2.4vw,1.8rem)]">
        {title}{" "}
        {count !== undefined && <span className="font-code text-[0.7rem] tracking-[0.08em] text-muted-foreground">{count}</span>}
      </h2>
      {children}
    </section>
  );
}
