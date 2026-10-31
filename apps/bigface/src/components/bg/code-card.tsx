import { BGCard } from "./card.tsx";
import { BGCopyButton } from "./copy-button.tsx";

// The first lines of a generated theme file, with its path and a copy button.
export interface BGCodeCardProps {
  path: string;
  code: string;
  truncated: boolean;
}

export function BGCodeCard({ path, code, truncated }: BGCodeCardProps) {
  return (
    <BGCard tone="plate" className="overflow-hidden p-[0.4rem]">
      <div className="flex items-center justify-between gap-4 px-2 pt-[0.4rem] pb-2 font-code text-[0.72rem]">
        <span className="text-muted-foreground">{path}</span>
        <BGCopyButton value={code} />
      </div>
      <pre className="m-0 max-h-[420px] overflow-auto bg-border/85">
        <code>
          {code}
          {truncated ? "\n…" : ""}
        </code>
      </pre>
    </BGCard>
  );
}
