import type { LookalikeRow } from "../../data/lookalikes.ts";

export interface BGLookalikeRowProps {
  row: LookalikeRow;
}

// Three strict columns — glyphs / annotation / note — so the middle column starts at the same
// x on every row instead of trailing the glyph run. Single column below 900px.
export function BGLookalikeRow({ row }: BGLookalikeRowProps) {
  return (
    <div
      className="lookalike-row grid grid-cols-[minmax(0,1fr)_17rem_minmax(0,1fr)] items-baseline gap-x-5 border-b border-border/60 py-4 last:border-b-0 max-[900px]:grid-cols-1 max-[900px]:items-start max-[900px]:gap-y-2"
      data-lookalike={row.label}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" data-specimen data-lookalike-glyphs>
        {row.glyphs.map((glyph, i) => (
          <span key={i} className="text-[clamp(1.7rem,4vw,2.6rem)] leading-none text-foreground">
            {glyph}
          </span>
        ))}
      </div>
      <span className="font-mono text-[0.68rem] text-muted-foreground" data-testid="lookalike-label">
        {row.label}
      </span>
      <p className="max-w-[68ch] m-0 text-[0.85rem] text-foreground/75">{row.note}</p>
    </div>
  );
}
