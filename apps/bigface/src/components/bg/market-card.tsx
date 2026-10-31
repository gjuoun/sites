import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";
import { bgCardVariants } from "./card.tsx";
import { BGButton } from "./button.tsx";
import { BGEyebrow } from "./eyebrow.tsx";

// "Published" strip for targets that ship through their app's own gallery.
export interface BGMarketCardProps {
  label: string;
  url: string;
  name: string;
}

export function BGMarketCard({ label, url, name }: BGMarketCardProps) {
  return (
    <section
      className={cn(
        bgCardVariants({ tone: "plate" }),
        "mt-[1.6rem] flex flex-wrap items-center justify-between gap-4 px-[1.2rem] py-4",
      )}
      data-reveal
    >
      <div className="flex flex-col gap-[0.15rem]">
        <BGEyebrow className="mb-1">published</BGEyebrow>
        <strong className="font-display text-[1.1rem]">{label}</strong>
        <span className="text-muted-foreground">{name} installs and updates it from its own gallery.</span>
      </div>
      <BGButton tone="glow" href={url}>
        Open listing <span aria-hidden="true">↗</span>
      </BGButton>
    </section>
  );
}
