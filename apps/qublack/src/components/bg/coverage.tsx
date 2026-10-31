import { FACE_LIST, MONO, SANS } from "../../data/metrics.ts";

const BLOCKS = [
  "CJK Unified Ideographs",
  "CJK punctuation & fullwidth forms",
  "Latin + typographic punctuation",
  "Box drawing & block elements",
  "Geometric shapes & arrows",
  "Braille (U+2800–U+28FF)",
];

export function BGCoverage() {
  const monoFaces = FACE_LIST.filter((name) => name.startsWith("QuBlackMono"));
  const sansFaces = FACE_LIST.filter((name) => name.startsWith("QuBlackSans"));
  return (
    <section id="coverage" className="scroll-mt-24 py-10">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="mb-[1.6rem] max-w-[62ch]">
          <p className="my-[1em] max-w-[68ch] inline-flex items-center gap-2 font-mono text-[0.72rem] tracking-[0.16em] text-foreground/75 uppercase before:size-[6px] before:rounded-full before:bg-primary before:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary)_16%,transparent)] before:content-['']">
            06 — Coverage
          </p>
          <h2 className="mt-2 mb-[0.7rem] text-[clamp(1.7rem,3.2vw,2.4rem)] font-bold leading-[1.08] tracking-[-0.025em] text-balance">What is in the eight faces</h2>
          <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
            Glyph counts below are read from the built TTFs, not copied by hand. Colour emoji are deliberately absent: the
            placeholder codepoints are stripped from the cmap so the system emoji font takes over.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[16px] border border-border min-[760px]:grid-cols-4">
          <div className="bg-card/80 px-4 py-3">
            <div className="font-mono text-[1.5rem] text-foreground">{MONO.glyphs.toLocaleString("en-US")}</div>
            <div className="text-[0.78rem] text-muted-foreground">Mono glyphs per face</div>
          </div>
          <div className="bg-card/80 px-4 py-3">
            <div className="font-mono text-[1.5rem] text-foreground">{SANS.glyphs.toLocaleString("en-US")}</div>
            <div className="text-[0.78rem] text-muted-foreground">Sans glyphs per face</div>
          </div>
          <div className="bg-card/80 px-4 py-3">
            <div className="font-mono text-[1.5rem] text-foreground">{monoFaces.length + sansFaces.length}</div>
            <div className="text-[0.78rem] text-muted-foreground">TTF faces in the release</div>
          </div>
          <div className="bg-card/80 px-4 py-3">
            <div className="font-mono text-[1.5rem] text-foreground">OFL 1.1</div>
            <div className="text-[0.78rem] text-muted-foreground">Licence for every face</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 min-[900px]:grid-cols-2 mt-4" data-two-column>
          <div className="rounded-[16px] border border-border bg-card/70 p-4">
            <p className="max-w-[68ch] mb-2 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">Blocks shipped</p>
            <ul className="m-0 grid list-none gap-[0.35rem] p-0 text-[0.86rem] text-foreground/75">
              {BLOCKS.map((block) => (
                <li key={block} className="before:mr-2 before:text-primary before:content-['·']">
                  {block}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[16px] border border-border bg-card/70 p-4">
            <p className="max-w-[68ch] mb-2 font-mono text-[0.7rem] tracking-[0.12em] text-muted-foreground uppercase">Notes</p>
            <ul className="m-0 grid list-none gap-[0.35rem] p-0 text-[0.86rem] text-foreground/75">
              <li className="before:mr-2 before:text-chart-5 before:content-['·']">
                Emoji=Yes codepoints are stripped (mono 189 / sans 100 per face); the system font draws colour emoji.
              </li>
              <li className="before:mr-2 before:text-chart-5 before:content-['·']">
                Box drawing and block elements stay half-width in both families — tables survive.
              </li>
              <li className="before:mr-2 before:text-chart-5 before:content-['·']">
                Nerd Font variants are not part of v1; they need a Sarasa Term SC NF skeleton.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
