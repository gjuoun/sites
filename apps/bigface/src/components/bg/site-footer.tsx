// Site footer: the mark with a one-line pitch, and the footer nav.
const LINK = "text-primary no-underline transition-colors duration-200 hover:text-chart-5";

import type { BGShellLink } from "./site-header.tsx";

export interface BGSiteFooterProps {
  base: string;
  repo: string;
  ports: number;
  /** The site's own footer nav. Absolute fragments when they stay on the page. */
  links?: BGShellLink[];
  brand?: string;
  /** A text mark in place of the avatar image, for a site whose brand is a glyph. */
  mark?: string;
  /** One line under the mark; the default is Bigface's own pitch. */
  pitch?: string;
}

export function BGSiteFooter({ base, repo, ports, links, brand = "Bigface", mark, pitch }: BGSiteFooterProps) {
  const nav: BGShellLink[] = links ?? [
    { href: "/#apps", label: "Apps" },
    { href: "/palette/", label: "Palette" },
    { href: "/#install", label: "Install" },
    { href: "/install.sh", label: "install.sh" },
    { href: repo, label: "GitHub" },
    { href: repo + "/blob/main/LICENSE", label: "MIT licence" },
  ];
  return (
    <footer className="border-t border-border bg-linear-to-b/srgb from-border/20 to-border/85">
      <div className="mx-auto flex w-[min(1180px,100%-2.5rem)] flex-wrap items-start justify-between gap-8 pt-10 pb-12">
        <div>
          <div className="flex items-center gap-[0.7rem] font-display font-bold">
            {mark ? (
              <span className="text-[1.5rem] leading-none font-bold">{mark}</span>
            ) : (
              <img
                className="size-10 rounded-[11px] shadow-[0_0_0_1px_var(--border)]"
                src={base + "/img/bigface-avatar.svg"}
                alt=""
                width="40"
                height="40"
              />
            )}
            {brand}
          </div>
          <p className="mt-[0.6rem] mb-0 max-w-[34ch] text-[0.85rem] text-muted-foreground">
            {pitch ?? "One dark palette, " + ports + " ports, no per-tool adjustments. Started in 2018 as a JetBrains scheme."}
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-[0.6rem] text-[0.88rem]">
          {nav.map((link) => (
            <a key={link.href} className={LINK} href={link.href.startsWith("http") ? link.href : base + link.href}>
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
