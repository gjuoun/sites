import { BGButton } from "./button.tsx";

// App grid filter. Base.astro's script reads data-filter / data-kind, flips aria-pressed and hides
// cards whose data-card-kind does not match.
export interface BGFilterChipsProps {
  kinds: string[];
}

export function BGFilterChips({ kinds }: BGFilterChipsProps) {
  return (
    <div className="mb-[1.2rem] flex flex-wrap gap-[0.4rem]" data-filter role="group" aria-label="Filter apps">
      <BGButton tone="chip" data-kind="all" aria-pressed="true">
        All
      </BGButton>
      {kinds.map((kind) => (
        <BGButton key={kind} tone="chip" data-kind={kind} aria-pressed="false">
          {kind}
        </BGButton>
      ))}
    </div>
  );
}
