import { Activity, Boxes, Container, Layers, Route, ShieldCheck } from "lucide-react";
import { features, type FeatureIcon } from "@/lib/features";
import { LABEL, PAGE } from "@/lib/layout";

const ICONS: Record<FeatureIcon, typeof Boxes> = {
  route: Route,
  boxes: Boxes,
  layers: Layers,
  "shield-check": ShieldCheck,
  container: Container,
  activity: Activity,
};

export function BGFeatures() {
  return (
    <section id="features" className="border-b border-border py-16 md:py-24">
      <div className={PAGE}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className={LABEL}>Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything the CLI does.
              <br className="hidden sm:block" />
              Nothing it pretends to.
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground md:text-right">
            Six capabilities, all present in <span className="font-mono text-foreground">bundant 0.1.0</span>. If it is not in
            the CLI today, it is not on this page.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = ICONS[feature.icon];
            return (
              <article key={feature.title} data-feature className="rounded-xl border border-border bg-card p-6">
                <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <h3 className="mt-4 text-[0.9375rem] font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted-foreground">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
