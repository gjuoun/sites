import { createFileRoute } from "@tanstack/react-router";
import { UnifiedTable } from "@/components/unified-table";
import { SiteFooter } from "@/components/site-footer";
import { MODEL_BLOCK, MODEL_GAP, MODEL_TITLE, NOTE, PAGE, PAGE_TITLE, SECTION, SECTION_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset } from "@/lib/dataset";
import { dsRankingTable, measuredTable, modelTables, officialTable, type DS } from "@/lib/sections";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const ds = dataset as unknown as DS;
  const measured = measuredTable(ds);
  const models = modelTables(ds);
  const dsRank = dsRankingTable(ds);
  return (
    <main className={PAGE}>
      <header className="space-y-2">
        <h1 className={PAGE_TITLE}>subsdaddy</h1>
        <p className={NOTE}>
          Subscription plans compared on $/B token, speed and time to first token. Our own traffic and OpenRouter's public numbers are shown
          side by side and never combined. A missing value is N/A, with its reason.
        </p>
        <p className={SMALL_NOTE}>
          as of {dataset.lanes.measured_at} · usage window {dataset.usage.window_days} days from {dataset.usage.coverage_start} · OpenRouter
          stats fetched {dataset.benchmark.measured_at} (30-minute window)
        </p>
      </header>

      <section className={SECTION} aria-labelledby="sec-a">
        <h2 id="sec-a" className={SECTION_TITLE}>A · Measured on our own traffic</h2>
        <p className={NOTE}>
          Tok/s and TTFT come from our usage logs. The OR column is OpenRouter's p50 for each plan's lane model, shown beside ours.
        </p>
        <UnifiedTable testId="measured" columns={measured.columns} rows={measured.rows} />
        <p className={SMALL_NOTE}>{measured.footnote}</p>
      </section>

      <section className={MODEL_GAP} aria-labelledby="sec-ds">
        <div className={SECTION}>
          <h2 id="sec-ds" className={SECTION_TITLE}>DeepSeek value ranking</h2>
          <p className={NOTE}>{dsRank.subtitle}</p>
        </div>
        <UnifiedTable testId="ds-ranking" columns={dsRank.columns} rows={dsRank.rows} />
        {dsRank.excludedLines.map((l) => (
          <p key={l} className={SMALL_NOTE}>{l}</p>
        ))}
      </section>

      <section className={MODEL_GAP} aria-labelledby="sec-b">
        <div className={SECTION}>
          <h2 id="sec-b" className={SECTION_TITLE}>B · By model</h2>
          <p className={NOTE}>
            One table per reference model. Est. $/B is the catalog estimate for that model; tok/s and TTFT are OpenRouter's p50 for that model.
          </p>
        </div>
        {models.map((s) => (
          <div key={s.ref} className={MODEL_BLOCK} data-model={s.ref}>
            <h3 className={MODEL_TITLE}>{s.name}</h3>
            {s.table.rows.length === 0 ? (
              <p className={NOTE} data-no-plan={s.ref}>No plan on this site lists {s.name} on its published model list, so there is no table for it.</p>
            ) : (
              <>
                <p className={NOTE}>{s.table.subtitle}</p>
                <UnifiedTable testId={"model-" + s.ref} columns={s.table.columns} rows={s.table.rows} />
                <p className={SMALL_NOTE}>{s.table.orNote}</p>
                {s.table.tierNote && <p className={SMALL_NOTE} data-tier-note="yes">{s.table.tierNote}</p>}
              </>
            )}
          </div>
        ))}
      </section>

      <section className={MODEL_GAP} aria-labelledby="sec-c">
        <div className={SECTION}>
          <h2 id="sec-c" className={SECTION_TITLE}>C · Official subscriptions (local logs)</h2>
          <p className={NOTE}>
            Token counts and speeds come from this machine's Codex and Claude Code session logs, read only and aggregated. No session ids, paths or prompts are kept.
          </p>
        </div>
        <UnifiedTable testId="official" columns={officialTable(ds).columns} rows={officialTable(ds).rows} />
        <p className={SMALL_NOTE}>{dataset.official.source} · measured {dataset.official.measured_at}</p>
      </section>

      <SiteFooter />
    </main>
  );
}
