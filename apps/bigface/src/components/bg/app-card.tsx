import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";
import { inline } from "../../data/inline.ts";
import type { Target } from "../../data/targets.ts";
import { BGBadge } from "./badge.tsx";
import { bgCardVariants } from "./card.tsx";

// One app in the home grid. .spotlight is the hook for Base.astro's pointer glow (--mx/--my).
const LEVEL_LABEL: Record<string, string> = {
  tool: "Checked with the tool",
  schema: "Checked against its schema",
  format: "Format-checked only",
};
const DOT: Record<string, string> = {
  tool: "bg-chart-5 shadow-[0_0_8px_color-mix(in_srgb,var(--chart-5)_70%,transparent)]",
  schema:
    "bg-chart-4 text-primary-foreground shadow-[0_0_8px_color-mix(in_srgb,var(--chart-4)_70%,transparent)]",
  format: "bg-destructive shadow-[0_0_8px_color-mix(in_srgb,var(--destructive)_70%,transparent)]",
};

export interface BGAppCardProps {
  target: Target;
  index: number;
  base: string;
}

export function BGAppCard({ target: t, index, base }: BGAppCardProps) {
  const label = LEVEL_LABEL[t.check.level] ?? t.check.level;
  return (
    <a
      className={cn(
        bgCardVariants({ tone: "plate" }),
        "spotlight group/card grid grid-rows-[auto_auto_1fr_auto] gap-[0.3rem] overflow-hidden rounded-[16px] px-[1.15rem] pt-[1.1rem] pb-4 text-foreground no-underline transition-[transform,border-color,box-shadow] duration-350 ease-bf hover:-translate-y-1 hover:border-primary/45 hover:text-foreground hover:shadow-[0_26px_50px_-28px_color-mix(in_srgb,var(--primary)_65%,transparent)]",
        "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),color-mix(in_srgb,var(--primary)_16%,transparent),transparent_68%)] after:opacity-0 after:transition-opacity after:duration-350 after:content-[''] hover:after:opacity-100",
      )}
      data-card-kind={t.kind}
      data-reveal
      href={base + "/apps/" + t.id + "/"}
    >
      <span className="font-code text-[0.68rem] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
      <span className="font-display text-[1.22rem] font-semibold tracking-[-0.02em]">{t.name}</span>
      <span className="text-[0.88rem] leading-[1.45] text-muted-foreground" dangerouslySetInnerHTML={{ __html: inline(t.tagline) }} />
      <span className="mt-[0.55rem] flex items-center justify-between gap-[0.6rem]">
        <BGBadge tone="pill">{t.kind}</BGBadge>
        <span className="inline-flex items-center gap-[0.6rem]">
          <span
            className={cn("inline-block size-[7px] rounded-full", DOT[t.check.level])}
            role="img"
            aria-label={label}
            title={label}
          ></span>
          <span className="text-primary transition-transform duration-300 ease-bf group-hover/card:translate-x-1" aria-hidden="true">
            →
          </span>
        </span>
      </span>
    </a>
  );
}
