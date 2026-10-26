import { createFileRoute, Link } from "@tanstack/react-router";
import { UnifiedTable } from "@/components/unified-table";
import { dataset } from "@/lib/dataset";
import { measuredTable, modelTables, type DS } from "@/lib/sections";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const ds = dataset as unknown as DS;
  const measured = measuredTable(ds);
  const models = modelTables(ds);
  return (
    <main className="mx-auto max-w-6xl space-y-10 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">subsdaddy</h1>
        <p className="text-muted-foreground">
          Subscription plans compared on $/B token, speed and time to first token. Our own traffic and OpenRouter's public numbers are shown
          side by side and never combined. A missing value is N/A, with its reason.
        </p>
        <p className="text-sm text-muted-foreground">
          as of {dataset.lanes.measured_at} · usage window {dataset.usage.window_days} days from {dataset.usage.coverage_start} · OpenRouter
          stats fetched {dataset.benchmark.measured_at} (30-minute window)
        </p>
        <p className="text-sm">
          <Link to="/methodology" className="underline">Methodology and limits</Link>
          {" · "}
          <Link to="/catalog" className="underline">Plans catalog</Link>
        </p>
      </header>

      <section className="space-y-3" aria-labelledby="sec-a">
        <h2 id="sec-a" className="text-xl font-semibold">A · Measured on our own traffic</h2>
        <p className="text-sm text-muted-foreground">
          Tok/s and TTFT come from our usage logs. The OR column is OpenRouter's p50 for each plan's lane model, shown beside ours.
        </p>
        <UnifiedTable testId="measured" columns={measured.columns} rows={measured.rows} />
      </section>

      <section className="space-y-8" aria-labelledby="sec-b">
        <h2 id="sec-b" className="text-xl font-semibold">B · By model</h2>
        <p className="text-sm text-muted-foreground">
          One table per reference model. Est. $/B is the catalog estimate for that model; tok/s and TTFT are OpenRouter's p50 for that model.
        </p>
        {models.map((s) => (
          <div key={s.ref} className="space-y-2" data-model={s.ref}>
            <h3 className="text-lg font-medium">{s.name}</h3>
            <p className="text-sm text-muted-foreground">{s.table.subtitle}</p>
            <p className="text-xs text-muted-foreground">{s.table.orNote}</p>
            <UnifiedTable testId={"model-" + s.ref} columns={s.table.columns} rows={s.table.rows} />
          </div>
        ))}
      </section>
    </main>
  );
}
