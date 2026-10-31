import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@gjuoun/bigface-shadcn-ui/components/ui/button";
import { Badge } from "@gjuoun/bigface-shadcn-ui/components/ui/badge";
import { CopyCommand } from "@/components/CopyCommand";
import TerminalDemo from "@/components/TerminalDemo";
import demo from "@/data/demo.json";
import { LABEL, PAGE } from "@/lib/layout";
import { withBase } from "@/lib/utils";

// The install snippets are highlighted at build in the page and handed in as markup.
export interface BGHeroProps {
  installCommands: { command: string; label: string }[];
  installHtml: string[];
}

export function BGHero({ installCommands, installHtml }: BGHeroProps) {
  return (
    <section className="border-b border-border">
      <div className={PAGE + " grid gap-10 py-8 md:grid-cols-[1.05fr_0.95fr] md:items-start md:gap-10 md:py-20 lg:gap-16 lg:py-24"}>
        <div className="min-w-0 md:col-start-1 md:row-start-1">
          <Badge
            variant="outline"
            className="h-auto rounded-md border-primary/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary"
          >
            v0.1.0 · MIT
          </Badge>

          <h1 className="mt-5 text-[2.35rem] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-5xl md:text-[2.55rem] lg:text-[3.6rem]">
            Ship to the box
            <span className="block">you already own.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            bundant ships your container over plain SSH, gates it on health, and swaps traffic through kamal-proxy. Docker or
            podman, one CLI, nothing left running on the host.{" "}
            <span className="text-foreground">
              No Kubernetes. <span className="whitespace-nowrap">No registry required.</span>
            </span>
          </p>

          <div className="mt-7 grid gap-2.5 sm:flex sm:flex-wrap sm:items-center">
            <a href={withBase("docs/")} className={buttonVariants({ size: "lg", className: "h-11 w-full px-5 sm:w-auto" })}>
              Get started
              <ArrowRight className="size-4" />
            </a>
            <a
              href={withBase("#commands")}
              className={buttonVariants({ size: "lg", variant: "outline", className: "h-11 w-full px-5 sm:w-auto" })}
            >
              Browse commands
            </a>
          </div>
        </div>

        <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 lg:pt-1">
          <p className={LABEL + " mb-3"}>Try a command</p>
          <TerminalDemo demo={demo} layout="compact" />
        </div>

        <div className="min-w-0 md:col-start-1 md:row-start-2">
          <div className="max-w-md">
            <CopyCommand commands={installCommands} highlighted={installHtml} />
          </div>

          <ul className="mt-6 flex flex-col gap-2 text-[0.8125rem] text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-5">
            <li className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> docker or podman
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> plain ssh, no agent
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="size-3.5 text-primary" /> MIT, self-hosted
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
