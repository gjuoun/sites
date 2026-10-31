import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";
import { bgCardVariants } from "./card.tsx";

// Link to the next app page.
export interface BGNextCardProps {
  href: string;
  name: string;
}

export function BGNextCard({ href, name }: BGNextCardProps) {
  return (
    <a
      className={cn(
        bgCardVariants({ tone: "plate" }),
        "mt-12 flex items-center gap-[0.7rem] rounded-[16px] px-[1.2rem] py-4 font-display text-foreground no-underline hover:border-primary/45 hover:text-foreground",
      )}
      href={href}
    >
      <span className="font-code text-[0.7rem] tracking-[0.1em] text-muted-foreground uppercase">Next up</span>
      <strong>Bigface for {name}</strong>
      <span className="ml-auto text-primary" aria-hidden="true">
        →
      </span>
    </a>
  );
}
