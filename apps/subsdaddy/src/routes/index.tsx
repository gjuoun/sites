import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SummaryView } from "@/components/summary-view";
import { NOTE, PAGE, PAGE_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset } from "@/lib/dataset";
import type { DS } from "@/lib/sections";
import { MEASURED, summaryTable, viewChips, type SummaryTable } from "@/lib/summary";
import { CONTEXT_IDS } from "@/data/context";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const ds = dataset as unknown as DS;
  const chips = viewChips(ds);
  const tables: Record<string, SummaryTable> = {};
  for (const c of chips) for (const k of CONTEXT_IDS) tables[c.id + "|" + k] = summaryTable(ds, c.id, k);
  return (
    <main className={PAGE}>
      <header className="space-y-2">
        <h1 className={PAGE_TITLE}>subsdaddy</h1>
        <p className={NOTE}>Subscription plans compared on $/B, tok/s and TTFT p50.</p>
        <p className={SMALL_NOTE}>
          as of {dataset.lanes.measured_at} · usage window {dataset.usage.window_days} days from {dataset.usage.coverage_start} · OpenRouter stats fetched{" "}
          {dataset.benchmark.measured_at}
        </p>
      </header>
      <SummaryView chips={chips} tables={tables} initial={MEASURED} />
      <p className={SMALL_NOTE}>
        Estimates assume the whole allowance runs one model. Details, sources and allowances: <Link to="/methodology" className="underline">/methodology</Link>
      </p>
      <SiteFooter />
    </main>
  );
}
