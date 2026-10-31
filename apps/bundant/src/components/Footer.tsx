import { Github } from "lucide-react";
import { buttonVariants } from "@gjuoun/bigface-shadcn-ui/components/ui/button";
import { LABEL, PAGE } from "@/lib/layout";
import { withBase } from "@/lib/utils";

export function BGFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-background">
      <div className={PAGE}>
        <div className="grid gap-8 border-b border-border py-14 md:grid-cols-[1.2fr_0.8fr] md:items-end">
          <div>
            <p className={LABEL}>Ready when your ssh is</p>
            <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-tight sm:text-3xl">
              Ship the next revision without touching the platform.
            </h2>
          </div>
          <div className="grid gap-2.5 sm:flex sm:flex-wrap md:justify-end">
            <a href={withBase("docs/deploy-yml/")} className={buttonVariants({ className: "h-10 w-full px-4 sm:w-auto" })}>
              Read the docs
            </a>
            <a
              href="https://github.com/gjuoun/bundant"
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", className: "h-10 w-full px-4 sm:w-auto" })}
            >
              <Github className="size-4" /> GitHub
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 py-7 text-[0.8125rem] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">b</span>
            <span>bundant — zero-downtime single-host deploys.</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a href={withBase("docs/")} className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0">
              Docs
            </a>
            <a href="https://github.com/gjuoun/bundant" className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0">
              GitHub
            </a>
            <a href="https://github.com/gjuoun/bigface-theme" className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0">
              Theme
            </a>
            <a
              href="https://github.com/gjuoun/bundant/blob/main/LICENSE"
              className="inline-flex min-h-11 items-center hover:text-foreground sm:min-h-0"
            >
              MIT License
            </a>
            <span className="font-mono text-[11px] text-muted-foreground">{year}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
