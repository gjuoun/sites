import { inline } from "../../data/inline.ts";

// The "do it by hand" fold: numbered steps with green markers.
export interface BGManualStepsProps {
  steps: string[];
}

export function BGManualSteps({ steps }: BGManualStepsProps) {
  return (
    <details className="my-[1.2rem] rounded-[14px] border border-border bg-border/55 px-4 py-[0.9rem]">
      <summary className="cursor-pointer font-code text-[0.8rem] text-muted-foreground">Or do it by hand</summary>
      <ol className="my-[1em] grid list-decimal gap-2 pl-[1.4rem] marker:font-bold marker:text-chart-5">
        {steps.map((step, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(step) }} />
        ))}
      </ol>
    </details>
  );
}
