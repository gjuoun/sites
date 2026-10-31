// The endless strip of tool names under the hero. Pauses on hover.
const ITEM =
  "inline-flex items-center gap-[2.2rem] whitespace-nowrap after:text-primary after:opacity-50 after:content-['✦']";

export interface BGMarqueeProps {
  items: string[];
}

export function BGMarquee({ items }: BGMarqueeProps) {
  return (
    <div
      className="group/marquee mt-6 overflow-hidden border-y border-border py-[0.9rem] [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]"
      aria-hidden="true"
    >
      <div className="flex w-max animate-marquee gap-[2.2rem] font-code text-[0.84rem] tracking-[0.14em] text-foreground/72 uppercase group-hover/marquee:[animation-play-state:paused]">
        {items.map((name) => (
          <span key={"a-" + name} className={ITEM}>
            {name}
          </span>
        ))}
        {items.map((name) => (
          <span key={"b-" + name} className={ITEM}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
