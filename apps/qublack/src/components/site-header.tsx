import type * as React from "react";
import { BGGithubLink } from "@sites/bigface/components/bg/github-link";

// Qu Black's own header. The family owns the primitives (the button, the toggle); the shell is this
// site's identity — the 黢 tile, the card surface once the page scrolls, and the three links that
// are actually on the page.
export interface QuBlackHeaderProps {
  base: string;
  repo: string;
  /** The theme toggle, declared as an island by the layout that owns the directive. */
  children?: React.ReactNode;
}

const LINK =
  "text-foreground/75 no-underline transition-colors duration-200 hover:text-foreground hover:bg-muted/10 rounded-full px-3 py-[0.4rem] max-[520px]:px-2";

const NAV = [
  { href: "#howto", label: "How to use" },
  { href: "#download", label: "Download" },
];

export function QuBlackHeader({ base, repo, children }: QuBlackHeaderProps) {
  return (
    <>
      <a
        className="absolute -left-[9999px] focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2"
        href="#main"
      >
        Skip to content
      </a>
      <header
        id="site-header"
        className="sticky top-0 z-40 border-b border-transparent transition-[border-color,background] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [&.scrolled]:border-border [&.scrolled]:bg-card/92 [&.scrolled]:backdrop-blur-[18px] [&.scrolled]:backdrop-saturate-150"
      >
        <div className="mx-auto w-[min(1180px,100%-2.5rem)] max-[760px]:w-[min(1180px,100%-1.75rem)] flex items-center justify-between gap-4 py-[0.85rem]">
          <a
            className="group inline-flex items-center gap-[0.65rem] font-display text-[1.1rem] font-bold tracking-[-0.01em] text-foreground no-underline hover:text-foreground"
            href={base + "/"}
          >
            {/* The tile centres the glyph's em box, not its ink: 黢's rendered ink sits ~2.5px above the
                34px tile's centre (pixel-measured at 2x), so the glyph carries that nudge and nothing
                else. */}
            <span
              className="grid size-[34px] place-items-center rounded-[9px] bg-card font-mono text-[1.05rem] text-primary shadow-[0_0_0_1px_var(--ring)] transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-hover:-rotate-6"
              aria-hidden="true"
            >
              <span className="inline-block translate-y-[2.5px]">黢</span>
            </span>
            <span className="max-[520px]:sr-only">Qu Black</span>
          </a>
          <nav aria-label="Main" className="flex items-center gap-[0.4rem] text-[0.9rem] max-[700px]:gap-[0.15rem]">
            {NAV.map((item) => (
              <a key={item.href} className={LINK} href={item.href}>
                {item.label}
              </a>
            ))}
            <BGGithubLink href={repo} />
            {children}
          </nav>
        </div>
      </header>
    </>
  );
}
