import { createFileRoute, Link } from "@tanstack/react-router";
import { LaneBlock } from "@/components/lane-block";
import { RankingTable } from "@/components/ranking-table";
import { SiteFooter } from "@/components/site-footer";
import { NOTE, PAGE, PAGE_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset, formatReset, rankedLanes } from "@/lib/own-data";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const lanes = rankedLanes(dataset.lanes.lanes);
  const recent = dataset.usage.recent;
  return (
    <main className={PAGE}>
      <header className="space-y-2">
        <h1 className={PAGE_TITLE}>subsdaddy</h1>
        <p className={NOTE}>
          The four LLM subscriptions I pay for: what each one actually runs, what it costs per billion tokens, and how fast it is.
        </p>
        <p className={SMALL_NOTE}>
          quota read {formatReset(dataset.quota.measured_at)} · traffic {recent.window_days} days ({formatReset(recent.coverage_start)} to {formatReset(recent.coverage_end)}) · fees owner-confirmed
        </p>
      </header>

      <section className="space-y-2">
        <RankingTable lanes={lanes} observations={dataset.quota.observations} />
        <p className={SMALL_NOTE}>
          $/B is the plan fee over the tokens its binding quota window delivered, priced from my gateway's own logs. A lane with no readable window keeps its row and says why.
        </p>
      </section>

      {lanes.map((lane) => (
        <LaneBlock key={lane.lane} lane={lane} observations={dataset.quota.observations} />
      ))}

      <p className={SMALL_NOTE}>
        Formulas, sources and limits: <Link to="/methodology" className="underline">/methodology</Link>
      </p>
      <SiteFooter />
    </main>
  );
}
