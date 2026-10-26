import { createFileRoute, Link } from "@tanstack/react-router";
import { UnifiedTable } from "@/components/unified-table";
import { dataset } from "@/lib/dataset";
import { catalogTable, type DS } from "@/lib/sections";

export const Route = createFileRoute("/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const t = catalogTable(dataset as unknown as DS);
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Plans catalog</h1>
        <p className="text-muted-foreground">
          Published prices and allowances. These plans have no local token measurement, so they are not ranked. Est. $/B is a model-level
          estimate, shown as a range across the reference models.
        </p>
        <p className="text-sm"><Link to="/" className="underline">← ranking</Link></p>
      </header>
      <UnifiedTable testId="catalog" columns={t.columns} rows={t.rows} />
    </main>
  );
}
