import { Check } from "lucide-react";
import { dryRunExcerpt, howSteps, whyCards } from "@/lib/features";
import { LABEL, PAGE } from "@/lib/layout";
import { OK } from "@/lib/tokens";

export function BGWhyAndHow() {
  return (
    <section id="why" className="border-b border-border py-16 md:py-24">
      <span id="how" className="block scroll-mt-20"></span>
      <div className={PAGE}>
        <div className="max-w-2xl">
          <p className={LABEL}>Why and how</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">The platform is the overhead.</h2>
          <p className="mt-4 text-muted-foreground">
            A single host already gives you a network, a proxy and a restart policy. bundant adds the deploy discipline without
            asking you to run a cluster to get it.
          </p>
        </div>

        <ul className="mt-10 grid min-w-0 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-border/60">
          {whyCards.map((card, index) => (
            <li
              key={card.title}
              className="flex min-w-0 gap-4 border-b border-border/60 p-5 last:border-b-0 sm:border-b-0 sm:p-6"
            >
              <span className="font-mono text-[11px] text-primary">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <h3 className="text-[0.9375rem] font-semibold tracking-tight">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-12">
          <p className={LABEL}>A deploy, in four steps</p>
          <ol className="mt-5 grid min-w-0 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-border/60">
            {howSteps.map((step) => (
              <li key={step.step} className="min-w-0 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted font-mono text-[11px] text-primary">
                    {step.step}
                  </span>
                  <h3 className="text-[0.9375rem] font-semibold tracking-tight">{step.title}</h3>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 min-w-0 overflow-hidden rounded-xl border border-border bg-muted">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <span className="size-1.5 shrink-0 rounded-full bg-primary"></span>
                <span className="truncate">bundant deploy --dry-run</span>
              </div>
              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                real output
              </span>
            </div>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words px-4 py-4 font-mono text-[11px] leading-[1.75] text-muted-foreground">
              <code>{dryRunExcerpt}</code>
            </pre>
            <div className="flex items-start gap-2 border-t border-border/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <Check className={"mt-0.5 size-3.5 shrink-0 " + OK} />
              <span>
                Every step is printed before it runs. <span className="text-foreground">Nothing hidden, nothing implicit.</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
