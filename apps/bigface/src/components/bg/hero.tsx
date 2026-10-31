import { BGButton } from "./button.tsx";
import { BGCommandLine } from "./command-line.tsx";
import { BGEyebrow } from "./eyebrow.tsx";
import { BGSyntaxPreview } from "./syntax-preview.tsx";

// Home hero: pitch + actions + one-line install on the left, the parallax stage (spinning ring,
// the bear mark, a floating terminal) on the right. Base.astro's pointer script moves [data-depth].
export interface BGHeroProps {
  base: string;
  repo: string;
  ports: number;
  command: string;
}

export function BGHero({ base, repo, ports, command }: BGHeroProps) {
  return (
    <section className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-center gap-[clamp(2rem,5vw,4rem)] pt-[clamp(1.5rem,5vw,4rem)] pb-8 max-[900px]:grid-cols-1">
      <div data-reveal>
        <BGEyebrow>
          one palette · {ports} ports · since 2018
        </BGEyebrow>
        <h1 className="mt-[0.6rem] mb-[0.4rem] text-[clamp(3.4rem,8.5vw,6.2rem)] font-extrabold tracking-[-0.035em] text-chart-2">
          Bigface
        </h1>
        <p className="max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-muted-foreground">
          One dark palette, ported to {ports} tools. No per-tool tweaking, no variants, no second-guessing.
        </p>
        <p className="text-muted-foreground">
          Born in 2018 as a JetBrains scheme, now generated for your terminal, editors, shell and notes from a single
          palette file. Every colour that came from the original scheme is checked against it by a test.
        </p>
        <div className="mt-[1.6rem] mb-[1.1rem] flex flex-wrap gap-[0.6rem]">
          <BGButton tone="glow" href="#install">
            Install in one line
          </BGButton>
          <BGButton tone="ghost" href={base + "/palette/"}>
            See the palette
          </BGButton>
          <BGButton tone="ghost" href={repo}>
            GitHub
          </BGButton>
        </div>
        <BGCommandLine command={command} copyLabel="Copy the install command" />
      </div>

      <div
        className="group/stage relative mt-5 grid min-h-[340px] place-items-center pt-[2.2rem] max-[900px]:min-h-[300px]"
        data-parallax
        aria-hidden="true"
      >
        <div className="absolute z-0 aspect-square w-[min(78%,340px)] animate-ring rounded-full bg-[conic-gradient(from_0deg,color-mix(in_srgb,var(--primary)_0%,transparent)_0deg,color-mix(in_srgb,var(--primary)_55%,transparent)_70deg,color-mix(in_srgb,var(--chart-5)_35%,transparent)_140deg,color-mix(in_srgb,var(--primary)_0%,transparent)_220deg,color-mix(in_srgb,var(--chart-2)_40%,transparent)_300deg,color-mix(in_srgb,var(--primary)_0%,transparent)_360deg)] opacity-75 blur-[26px]"></div>
        <img
          className="absolute top-0 -right-2 z-3 h-auto w-[clamp(88px,10vw,132px)] -rotate-6 rounded-[30px] shadow-[0_0_0_6px_var(--background),0_0_0_7px_color-mix(in_srgb,var(--chart-2)_30%,transparent),0_30px_70px_-22px_color-mix(in_srgb,var(--primary)_85%,transparent)] transition-[rotate] duration-600 ease-bf group-hover/stage:rotate-0"
          data-depth="1"
          src={base + "/img/bigface-avatar.svg"}
          alt=""
          width="112"
          height="112"
        />
        <div
          className="relative z-2 w-full transform-[perspective(1400px)_rotateY(-7deg)_rotateX(3deg)] drop-shadow-[0_40px_60px_color-mix(in_srgb,var(--border)_70%,transparent)] transition-transform duration-600 ease-bf group-hover/stage:transform-[perspective(1400px)_rotateY(-2deg)_rotateX(0deg)]"
          data-depth="0.4"
        >
          <BGSyntaxPreview terminal />
        </div>
      </div>
    </section>
  );
}
