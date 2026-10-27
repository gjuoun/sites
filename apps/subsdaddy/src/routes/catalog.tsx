import { createFileRoute, Link } from "@tanstack/react-router";
import { UnifiedTable } from "@/components/unified-table";
import { SiteFooter } from "@/components/site-footer";
import { NOTE, PAGE, PAGE_TITLE, SECTION } from "@/components/layout";
import { dataset } from "@/lib/dataset";
import { catalogTable, type DS } from "@/lib/sections";

export const Route = createFileRoute("/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const t = catalogTable(dataset as unknown as DS);
  return (
    <main className={PAGE}>
      <header className={SECTION}>
        <h1 className={PAGE_TITLE}>Plans catalog</h1>
        <p className={NOTE}>
          Published prices and allowances. These plans have no local token measurement, so they are not ranked. Est. $/B is a model-level
          estimate, shown as a range across the reference models.
        </p>
        <p className={NOTE}><Link to="/" className="underline">← ranking</Link></p>
      </header>
      <UnifiedTable testId="catalog" columns={t.columns} rows={t.rows} />
      <SiteFooter />
    </main>
  );
}
