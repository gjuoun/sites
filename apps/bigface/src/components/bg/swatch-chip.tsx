import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";
import type * as React from "react";
import { inkOn } from "../../data/palette.ts";

// One colour of the home strip: grows on hover, shows its name and hex in the ink that contrasts
// best (inkOn), and copies the hex on click (data-copy → Base.astro's handler). The palette hex is
// specimen data, so it arrives inline.
const LABEL =
  "absolute left-[0.6rem] font-code text-[0.66rem] tracking-[0.04em] text-(--ink) opacity-0 transition-opacity duration-300 group-hover/sw:opacity-92 max-[620px]:hidden";

export interface BGSwatchChipProps {
  name: string;
  hex: string;
}

export function BGSwatchChip({ name, hex }: BGSwatchChipProps) {
  return (
    <button
      type="button"
      className="group/sw relative min-w-0 flex-1 cursor-pointer overflow-hidden rounded-[12px] border-0 bg-(--c) p-0 leading-[1.65] will-change-[flex-grow] [transition:flex-grow_0.5s_var(--ease-bf),transform_0.35s_var(--ease-bf),box-shadow_0.3s_var(--ease-bf),filter_0.3s_var(--ease-bf)] group-hover/strip:not-hover:brightness-90 group-hover/strip:not-hover:saturate-[0.72] hover:grow-[2.6] hover:-translate-y-1 hover:shadow-[0_18px_34px_-26px_color-mix(in_srgb,var(--foreground)_60%,transparent)]"
      style={{ "--c": hex, "--ink": inkOn(hex).ink } as React.CSSProperties}
      data-copy={hex}
      data-swap="off"
      aria-label={"Copy " + name + " " + hex}
    >
      <span className={cn(LABEL, "bottom-6 font-semibold")}>{name}</span>
      <span className={cn(LABEL, "bottom-[0.55rem]")}>{hex}</span>
    </button>
  );
}
