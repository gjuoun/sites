import { MONO, SANS } from "../../data/metrics.ts";
import { BGHighlightCode } from "@sites/bigface/components/bg/highlight-code";

// The claim this family exists for, rendered as a comparison rather than asserted as a number.
const HAN = "汉国图一永口";
const LATIN = "abcdefghijkl";

export function BGGridProof() {
  return (
    <section id="grid" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            04 — The grid
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">One hanzi is two ASCII cells</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Qu Black Mono is built on a 1000-unit Sarasa cell with <BGHighlightCode>unitsPerEm</BGHighlightCode> set to 833:
            glyphs never move, the em shrinks, and the 1000-unit hanzi cell reads as 1.200em while the 500-unit ASCII cell
            reads as 0.600em.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 items-start" data-two-column>
          <div className="rounded-[18px] border border-border bg-card/70 p-[clamp(1rem,2.5vw,1.6rem)]">
            <p className="max-w-[68ch] mb-3 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">
              Qu Black Mono — hanzi over two latin cells
            </p>
            <div className="overflow-x-auto">
              <div className="font-mono text-[clamp(1.5rem,3.4vw,2.2rem)] leading-[1.35] whitespace-pre">
                <div>{HAN}</div>
                <div className="text-primary">{LATIN}</div>
              </div>
            </div>
            <dl className="mt-4 mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-[12px] border border-border" data-stat-grid>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">hanzi advance</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{MONO.han.toFixed(3)}em</dd>
              </div>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">ascii advance</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{MONO.ascii.toFixed(3)}em</dd>
              </div>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">ratio</dt>
                <dd id="ratio-value" className="m-0 font-mono text-[0.95rem] text-chart-5">{MONO.ratio.toFixed(3)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[18px] border border-border bg-card/70 p-[clamp(1rem,2.5vw,1.6rem)]">
            <p className="max-w-[68ch] mb-3 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">
              Qu Black Sans — proportional
            </p>
            <div className="text-[clamp(1.15rem,2.6vw,1.5rem)] leading-[1.6]">
              中英混排时，比例家族让正文更自然：<BGHighlightCode>className</BGHighlightCode> 与{" "}
              <BGHighlightCode>app.pak</BGHighlightCode> 仍然留在等宽家族里。
            </div>
            <dl className="mt-4 mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-border" data-stat-grid>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">upm</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{SANS.upm}</dd>
              </div>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">hanzi</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{SANS.han.toFixed(3)}em</dd>
              </div>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">ascii</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{SANS.ascii.toFixed(3)}em</dd>
              </div>
              <div className="bg-card/80 px-3 py-2">
                <dt className="font-mono text-[0.62rem] text-muted-foreground uppercase">line height</dt>
                <dd className="m-0 font-mono text-[0.95rem] text-foreground">{SANS.lineHeight.toFixed(3)}em</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
