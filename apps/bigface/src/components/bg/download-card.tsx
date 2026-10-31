import { cn } from "@gjuoun/bigface-shadcn-ui/lib/utils";
import { bgCardVariants } from "./card.tsx";

// A download link styled as a small card: arrow tile, file label, one line of detail.
export interface BGDownloadCardProps {
  href: string;
  label: string;
  detail: string;
  className?: string;
}

export function BGDownloadCard({ href, label, detail, className }: BGDownloadCardProps) {
  return (
    <a
      className={cn(
        bgCardVariants({ tone: "plate" }),
        "flex items-center gap-[0.8rem] rounded-[14px] px-4 py-[0.8rem] text-foreground no-underline transition-[border-color,transform] duration-250 ease-bf hover:-translate-y-0.5 hover:border-primary/45 hover:text-foreground",
        className,
      )}
      href={href}
      download
    >
      <span className="grid size-[34px] place-items-center rounded-[10px] bg-primary/14 text-[0.95rem] text-primary">↓</span>
      <span>
        <strong className="block font-code text-[0.85rem] font-semibold">{label}</strong>
        <span className="text-[0.75rem] text-muted-foreground">{detail}</span>
      </span>
    </a>
  );
}
