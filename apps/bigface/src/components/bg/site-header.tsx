import { BGGithubLink } from "./github-link.tsx";

// Site header: skip link, brand, main nav. Sits on the page background at rest; the scroll script in
// Base.astro adds .scrolled once the page moves, which gives it a hairline and a surface. Below 520px
// the brand keeps only its mark (the name stays for screen readers) and the links tighten, so all four
// fit a 390px screen.
const LINK =
  "rounded-lg px-3 py-[0.4rem] text-muted-foreground no-underline transition-[color,background] duration-200 hover:bg-border/10 hover:text-foreground max-[520px]:px-2";

export interface BGShellLink {
  href: string;
  label: string;
}

const DEFAULT_LINKS: BGShellLink[] = [
  { href: "/#apps", label: "Apps" },
  { href: "/palette/", label: "Palette" },
  { href: "/#install", label: "Install" },
];

export interface BGSiteHeaderProps {
  base: string;
  repo: string;
  /** The site's own nav: absolute paths when they are routes, fragments when they are in-page. */
  links?: BGShellLink[];
  brand?: string;
  /** A text mark in place of the avatar image, for a site whose brand is a glyph. */
  mark?: string;
}

export function BGSiteHeader({
  base,
  repo,
  links = DEFAULT_LINKS,
  brand = "Bigface",
  mark,
}: BGSiteHeaderProps) {
  return (
    <>
      <a
        className="absolute -left-[9999px] focus:top-4 focus:left-4 focus:z-100 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        href="#main"
      >
        Skip to content
      </a>
      <header
        id="site-header"
        className="sticky top-0 z-40 border-b border-transparent transition-[border-color,background] duration-300 ease-bf [&.scrolled]:border-border [&.scrolled]:bg-border/92 [&.scrolled]:backdrop-blur-[18px] [&.scrolled]:backdrop-saturate-150"
      >
        <div className="mx-auto flex w-[min(1180px,100%-2.5rem)] items-center justify-between gap-4 py-[0.85rem] max-[760px]:w-[min(1180px,100%-1.75rem)]">
          <a
            className="group inline-flex items-center gap-[0.65rem] font-display text-[1.1rem] font-bold tracking-[-0.01em] text-foreground no-underline hover:text-foreground"
            href={base + "/"}
          >
            {mark ? (
              <span className="font-display text-[1.35rem] leading-none font-bold">{mark}</span>
            ) : (
              <img
                className="size-[34px] rounded-[9px] shadow-[0_0_0_1px_var(--border),0_6px_18px_color-mix(in_srgb,var(--primary)_35%,transparent)] transition-transform duration-400 ease-bf group-hover:scale-[1.06] group-hover:-rotate-6"
                src={base + "/img/bigface-avatar.svg"}
                alt=""
                width="34"
                height="34"
              />
            )}
            <span className="max-[520px]:sr-only">{brand}</span>
          </a>
          <nav aria-label="Main" className="flex items-center gap-[0.4rem] text-[0.9rem] max-[520px]:gap-[0.15rem]">
            {links.map((link) => (
              <a key={link.href} className={LINK} href={base + link.href}>
                {link.label}
              </a>
            ))}
            <BGGithubLink href={repo} />
          </nav>
        </div>
      </header>
    </>
  );
}
