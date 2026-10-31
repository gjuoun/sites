import { MONO, SANS } from "../../data/metrics.ts";
import { RELEASE_URL } from "../../data/site.ts";
import { BGButton } from "@sites/bigface/components/bg/button";
import { BGEyebrow } from "@sites/bigface/components/bg/eyebrow";
import { BGAgentChat } from "./agent-chat.tsx";

const STATS = [
  { value: MONO.ratio.toFixed(3), label: "汉 / ASCII ratio" },
  { value: MONO.upm + " / " + SANS.upm, label: "upm Mono / Sans" },
  { value: "8", label: "faces shipped" },
  { value: "OFL 1.1", label: "licence" },
];

export interface BGSpecimenHeroProps {
  version: string;
}

export function BGSpecimenHero({ version }: BGSpecimenHeroProps) {
  return (
    <section id="specimen" className="scroll-mt-24 pt-[clamp(1.5rem,5vw,3.5rem)] pb-6">
      <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] transition-[opacity,translate] duration-700 [.js_&]:translate-y-4 [.js_&]:opacity-0 [.js_&.in]:translate-y-0 [.js_&.in]:opacity-100" data-reveal>
        <div className="grid grid-cols-1 gap-4 min-[1180px]:grid-cols-2" data-two-column>
          <div>
            <BGEyebrow>A modern font for your agent · v{version}</BGEyebrow>

            <h1 className="mt-[0.6rem] mb-[0.4rem] text-[clamp(3.2rem,7vw,5.2rem)] font-extrabold tracking-[-0.035em] leading-[1.08] text-balance">
              <span className="bg-linear-100/srgb from-chart-3 via-primary to-chart-2 [background-size:220%_100%] bg-clip-text text-transparent animate-hue">黢黑</span>
              <span className="text-foreground">Qu Black</span>
            </h1>

            <p className="my-[1em] max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-foreground/75">
              Your agent answers in English, 中文 and code — in the same message. Qu Black renders all three on one grid:{" "}
              <strong className="text-foreground">Qu Black Mono</strong> keeps a measured{" "}
              <strong className="text-foreground">2:1</strong> cell (汉 1.200em, ASCII 0.600em), so diffs, tables and logs stay
              aligned; <strong className="text-foreground">Qu Black Sans</strong> keeps the prose readable next to them.
            </p>

            <div data-cta-row className="mt-[1.4rem] flex flex-wrap items-center gap-[0.6rem]">
              <BGButton tone="glow" href={RELEASE_URL}>
                Download v{version}
              </BGButton>
              <BGButton tone="ghost" href="#howto">
                How to use
              </BGButton>
            </div>

            <dl className="mt-[1.5rem] mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-border min-[560px]:grid-cols-4">
              {STATS.map((stat) => (
                <div key={stat.label} className="bg-card/80 px-[0.8rem] py-[0.65rem]">
                  <dt className="font-mono text-[0.58rem] tracking-[0.08em] text-muted-foreground uppercase">{stat.label}</dt>
                  <dd className="m-0 font-mono text-[0.95rem] text-foreground">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Two-up: the card is taken out of flow so the left column sets the row height, then the
              card is stretched back to that height and its thread grows into the space. */}
          <div className="relative min-w-0">
            <BGAgentChat />
          </div>
        </div>

        <div className="mt-[clamp(1.6rem,4vw,2.6rem)] rounded-[22px] border border-border bg-card/70 p-[clamp(1rem,3vw,2rem)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1" data-specimen-header>
            {/* The two-word family name costs one more mono cell in the face label, which used to push
                this row past the phone width; below 760px the label tightens its tracking instead of
                wrapping, so the two halves keep one centreline. */}
            <span className="font-mono text-[0.72rem] tracking-[0.14em] text-foreground/75 uppercase max-[760px]:tracking-[0.08em]">
              editable specimen
              <span className="hidden min-[760px]:inline"> — click and type, Enter to commit, Esc to revert</span>
            </span>
            <span id="face-label" className="font-mono text-[0.72rem] text-primary" aria-live="polite">
              Qu Black Sans Regular
            </span>
          </div>

          <p
            id="hero-specimen"
            data-specimen
            contentEditable="true"
            spellCheck={false}
            role="textbox"
            aria-label="Editable specimen"
            aria-multiline="false"
            data-specimen-scale
            className="max-w-[68ch] m-0 cursor-text leading-[1.25] font-normal outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary/60 [--specimen-size:clamp(1.9rem,5vw,3.4rem)] text-[calc(var(--specimen-size)*var(--specimen-scale,1))]"
          >
            黢黑 Qu Black 中英混排 2:1 grid · 字体 specimen
          </p>
          <p
            id="specimen-sample"
            data-specimen
            data-specimen-scale
            className="max-w-[68ch] mt-4 mb-0 leading-[1.6] text-foreground/75 [--specimen-size:clamp(1rem,2vw,1.35rem)] text-[calc(var(--specimen-size)*var(--specimen-scale,1))]"
          >
            汉 a 国 b 图 c 一 d 口 e — the mono face keeps 汉字 twice as wide as ASCII, so code blocks, tables and terminal
            output line up across languages.
          </p>

          <div
            className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
            role="group"
            aria-label="Specimen controls"
            data-control-strip
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-control-groups>
              <div className="flex items-center gap-2" data-control-group="family">
                <span className="min-w-[3.25rem] font-mono text-[0.72rem] text-muted-foreground uppercase">family</span>
                <BGButton tone="chip" data-control="family" data-value="sans" aria-pressed="true">
                  Sans
                </BGButton>
                <BGButton tone="chip" data-control="family" data-value="mono" aria-pressed="false">
                  Mono
                </BGButton>
              </div>
              <div className="flex items-center gap-2" data-control-group="weight">
                <span className="min-w-[3.25rem] font-mono text-[0.72rem] text-muted-foreground uppercase">weight</span>
                <BGButton tone="chip" data-control="weight" data-value="regular" aria-pressed="true">
                  Regular
                </BGButton>
                <BGButton tone="chip" data-control="weight" data-value="bold" aria-pressed="false">
                  Bold
                </BGButton>
              </div>
              <div className="flex items-center gap-2" data-control-group="style">
                <span className="min-w-[3.25rem] font-mono text-[0.72rem] text-muted-foreground uppercase">style</span>
                <BGButton tone="chip" data-control="italic" data-value="toggle" aria-pressed="false">
                  Italic
                </BGButton>
              </div>
            </div>
            <span className="ml-auto font-mono text-[0.7rem] text-muted-foreground" data-control-metrics>
              keys: B/L bold · M/N mono · S sans · I italic · ↓↑ sections · 1–8 jump
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
