import { Link } from "@tanstack/react-router";

/** The same footer on every page: the three pages, in the same order. */
export function SiteFooter() {
  return (
    <footer data-footer="links" className="border-t border-border pt-4 text-sm">
      <nav className="flex gap-4">
        <Link to="/" className="underline">Ranking</Link>
        <Link to="/catalog" className="underline">Plans catalog</Link>
        <Link to="/methodology" className="underline">Methodology and limits</Link>
      </nav>
    </footer>
  );
}
