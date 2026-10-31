import { ASCII_CELLS } from "../../data/ascii.ts";
import { BGHighlightCode } from "@sites/bigface/components/bg/highlight-code";

// The backbone of a programming font: all 95 printable ASCII cells, with their codepoints.

export function BGAsciiTable() {
  return (
    <section id="ascii" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            02 — ASCII
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">Ninety-five cells, one width</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Every printable ASCII codepoint at the mono face's 0.600em advance. Punctuation sits on the same cell as{" "}
            <BGHighlightCode>M</BGHighlightCode>, which is what keeps columns straight.
          </p>
        </div>

        <div
          id="ascii-grid"
          className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-muted/60 min-[700px]:max-[1100px]:grid-cols-[repeat(auto-fill,minmax(92px,1fr))]"
        >
          {ASCII_CELLS.map((cell) => (
            <div key={cell.hex} className="group flex flex-col items-center justify-between gap-1 bg-card px-1 py-2 transition-colors duration-200 hover:bg-card">
              <span className="font-mono text-[1.45rem] leading-none text-foreground" data-ascii-char={cell.hex}>
                {cell.char === " " ? "␠" : cell.char}
              </span>
              <span className="font-mono text-[0.6rem] tracking-[0.06em] text-muted-foreground uppercase">{cell.hex}</span>
              <span className="max-w-full text-center font-mono text-[0.55rem] leading-[1.25] break-words text-muted-foreground/70" title={cell.name}>
                {cell.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
