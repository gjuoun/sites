import type * as React from "react";

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
            {/* An icon beside the theme toggle, not a labelled button: the nav is already three
                words, and the mark is the one control a reader does not need spelled out. */}
            <a
              aria-label="GitHub"
              title="GitHub"
              href={repo}
              className="inline-flex size-7 items-center justify-center text-foreground/75 transition-colors hover:text-foreground"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
            </a>
            {children}
          </nav>
        </div>
      </header>
    </>
  );
}
