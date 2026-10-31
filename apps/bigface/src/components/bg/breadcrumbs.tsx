// Bigface / Apps / <name> trail above an app page.
export interface BGBreadcrumbsProps {
  base: string;
  name: string;
}

export function BGBreadcrumbs({ base, name }: BGBreadcrumbsProps) {
  return (
    <nav className="flex gap-[0.45rem] pt-2 font-code text-[0.8rem] text-muted-foreground" aria-label="Breadcrumb">
      <a href={base + "/"}>Bigface</a>
      <span>/</span>
      <a href={base + "/#apps"}>Apps</a>
      <span>/</span>
      <span className="text-foreground">{name}</span>
    </nav>
  );
}
