import { useState } from "react";
import { Github, Menu } from "lucide-react";
import { withBase } from "@/lib/utils";
import { asset } from "@/lib/assets";
import { BGThemeToggle } from "@sites/bigface/components/bg/theme-toggle";
import { PAGE } from "@/lib/layout";

const LINKS = [
  { href: withBase("#features"), label: "Features" },
  { href: withBase("#how"), label: "How it works" },
  { href: withBase("#commands"), label: "Commands" },
  { href: withBase("docs/"), label: "Docs" },
];

// The mobile menu is the one piece of state on this site; the rest is static markup.
export function BGNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className={PAGE + " flex h-16 items-center justify-between gap-4"}>
        <a href={withBase("")} className="flex items-center gap-2.5" aria-label="bundant home">
          <span className="block size-8 shrink-0 overflow-hidden rounded-[4px]" aria-hidden="true">
            <img
              src={asset("img/content-bear.png")}
              alt=""
              width="32"
              height="32"
              className="block size-full object-cover"
              style={{ transform: "scale(1.35)", transformOrigin: "72% 50%" }}
            />
          </span>
          <span className="text-[0.9375rem] font-semibold tracking-tight">bundant</span>
          <span className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            0.1.0
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex h-11 items-center rounded-md px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <BGThemeToggle />
          <a
            href="https://github.com/gjuoun/bundant"
            target="_blank"
            rel="noreferrer"
            className="hidden h-11 items-center gap-2 rounded-lg border border-border px-3 text-[0.8125rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
          >
            <Github className="size-4" />
            <span>GitHub</span>
          </a>
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            data-mobile-menu
            onClick={() => setOpen((value) => !value)}
            className="grid size-11 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </div>

      <div id="mobile-menu" className={(open ? "" : "hidden ") + "border-t border-border/60 bg-card md:hidden"}>
        <nav className={PAGE + " grid gap-1 py-3"} aria-label="Mobile">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://github.com/gjuoun/bundant"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Github className="size-4" /> GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
