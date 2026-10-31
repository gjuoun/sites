import type { Target } from "../../data/targets.ts";
import { BGBadge } from "./badge.tsx";
import { BGEyebrow } from "./eyebrow.tsx";
import { BGGradientInk } from "./gradient-ink.tsx";

// App page header: kind and port number, the name, the tagline, and how far the theme was checked.
export interface BGAppHeroProps {
  target: Target;
  index: number;
  total: number;
  levelLabel: string;
}

export function BGAppHero({ target, index, total, levelLabel }: BGAppHeroProps) {
  return (
    <header className="pt-6 pb-2" data-reveal>
      <div>
        <BGEyebrow>
          {target.kind} · port {String(index + 1).padStart(2, "0")} of {total}
        </BGEyebrow>
        <h1 className="text-[clamp(2.3rem,5.2vw,3.6rem)] font-extrabold">
          <BGGradientInk>Bigface for {target.name}</BGGradientInk>
        </h1>
        <p className="max-w-[56ch] text-[clamp(1.05rem,1.7vw,1.3rem)] text-muted-foreground">{target.tagline}</p>
        <div className="mt-4 flex flex-wrap gap-[0.45rem]">
          <BGBadge tone={target.check.level}>{levelLabel}</BGBadge>
          <BGBadge tone="pill">
            {target.files.length} file{target.files.length === 1 ? "" : "s"}
          </BGBadge>
        </div>
      </div>
    </header>
  );
}
