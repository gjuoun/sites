import { LOOKALIKES } from "../../data/lookalikes.ts";
import { BGLookalikeRow } from "./lookalike-row.tsx";

export function BGLookalikes() {
  return (
    <section id="lookalikes" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            03 — Lookalikes
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">Confusables, Latin and Chinese</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Identifiers have to survive a glance. The panel switches with the family controls at the top, so the same row
            can be read in the Sans and the Mono face.
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card/70 px-[clamp(1rem,2.5vw,1.6rem)]">
          {LOOKALIKES.map((row) => (
            <BGLookalikeRow key={row.label} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
}
