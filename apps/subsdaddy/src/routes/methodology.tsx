import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { UnifiedTable } from "@/components/unified-table";
import { MODEL_BLOCK, MODEL_TITLE, NOTE, PAGE_TITLE, SECTION_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset } from "@/lib/dataset";
import { catalogTable, dsRankingTable, measuredTable, modelTables, officialTable, type DS } from "@/lib/sections";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6 text-sm leading-6">
      <Link to="/" className="underline">← ranking</Link>
      <h1 className={PAGE_TITLE}>Methodology</h1>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Tokens</h2>
        <p>tokens = input + cache creation + cache read + output, per row. Cache share = cache read ÷ (input + cache creation + cache read).</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Capacity</h2>
        <p>window_snapshot: tokens delivered in the current quota window ÷ used fraction, normalized to a week. Requires ≥95% log coverage of the elapsed window. A saturated (100%) or unused window is refused, not extrapolated. Delta pairs (two readings ≥1 h apart) are the fallback. The 5-hour window is never used for capacity.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">$/B</h2>
        <p>usd per billion tokens = monthly fee ÷ (weekly tokens × 4.348) × 10⁹. Ranking key is the measured mix.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Two speed layers</h2>
        <p>The measured layer comes only from our usage_logs (lane p50 TTFT, p90 TTFT, output tok/s). The OR p50 layer comes only from OpenRouter's public model page. No value is computed from both, and the two are never averaged or calibrated against each other.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Plans catalog</h2>
        <p>The catalog lists published prices and published allowance models for plans we have not measured. A catalog row has no local token count, so it is not ranked and carries no $/B. Unverified prices show as "unverified", never as zero. Where a plan's allowance is in credits and the dollar value per credit is published, the derivation is shown (example: CommandCode GOAT, $10 for $80 of usage, so $0.125 per credit). Excluded rows (pay-as-you-go, or monthly plans no longer sold) stay listed with the reason.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Catalog estimate (Est. $/B)</h2>
        <p>Estimated $/B = (monthly fee ÷ published usage-dollar allowance) × blended $/B. The allowance is a dollar amount the vendor publishes, such as $80 of usage, or a per-model monthly limit. The blended $/B is the OpenRouter list-price cost of one billion tokens for a reference model: DeepSeek V4.1 Flash, Gemini 3.8 Flash, Claude Haiku 5.5, GPT-6 Luna or GLM-5.3-Flash. Its token mix is measured on this site: output share pooled across the four plans; cache share 0% (interactive), the measured pooled agent share, or 94% (cache-heavy). The column shows the range across the three reference models, with each model listed.</p>
        <p>Limits: the allowance is in the vendor's own dollars, while the blended cost uses OpenRouter list prices, so the result is an order-of-magnitude estimate. A row with no published usage-dollar allowance (token, credit or window allowance only) shows a reason instead of a number. Estimated values never enter the ranking.</p>
        <p>Assumption: each estimate assumes the whole allowance is spent on one model. The same plan therefore gives a different $/B for each model, and the model lines are alternatives, not additive. Dollar allowances come from the vendor's own usage values. Credit plans are not assumed to convert at any fixed rate. For QwenCloud, the usage value of one credit is measured from the same quota window: the tokens in that window are priced at their models' OpenRouter list prices and divided by the credits used in the same reading. If a model in the window has no unambiguous list price, the value is withheld and the row shows N/A, with the measured lower bound in the reason. A plan that does not publish a model's limit gets no estimate for that model (for example OpenCode Go and Gemini 3.8 Flash), shown as N/A.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Est. $/B and measured $/B differ on purpose</h2>
        <p>Est. $/B (per-model estimates below) is fee ÷ allowance × the list-price cost per billion tokens of one model: what a billion tokens of that model would cost if the whole allowance were spent on it. Measured $/B (section A) is fee ÷ the tokens actually delivered in our traffic. The vs measured column shows the gap. It is mostly model mix: the estimate prices a whole allowance at one model's list cost, while measured traffic also carries cheaper models, so a costly model such as Claude Haiku 5.5 shows a large positive gap. Each plan uses its own measured mix for the cache and output shares when it has one, and the pooled mix otherwise.</p>
        <p>Each plan appears only under the models its official model list names (offered_models). A model no plan lists has no table. A missing value says N/A with its reason; a model we could not read is never filled in.</p>
        <p>When a provider publishes a time-of-day discount without naming the band, the DeepSeek band is used.</p>
        <h2 className="text-lg font-medium">Official subscriptions (table below)</h2>
        <p>Codex and Claude Code token counts are read from this machine's session logs, read only, and reduced to counts, call numbers and per-turn speed. Session ids, paths, prompts and account details are never kept. The plan fee is shown as unverified unless a confirmed source names it.</p>
        <h2 className="text-lg font-medium">Limits</h2>
        <ul className="list-disc pl-5">
          <li>Unpriced rows (total_cost = 0) are excluded from the price fit and counted.</li>
          <li>Seed allowances are badged and kept out of the measured ranking.</li>
          <li>OpenRouter's stats payload is unofficial and can change; rows with missing stats are stale and excluded, never zero.</li>
          <li>No quality score is published; the dataset has no quality field.</li>
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Speed on the front page</h2>
        <p>Model view: weighted median over endpoints by request volume, not the unweighted median or the best endpoint. Measured view: our own usage logs, p50. Every speed cell shows one value, rounded to two significant figures.</p>
        <p>weighted median over endpoints by request volume, not the unweighted median or the best endpoint</p>
        <p>Derived $/B (marked *): a plan whose own window is saturated takes the $/B of a same-rate peer plan, and says so on the front page.</p>
      </section>
      <DetailTables />
      <SiteFooter />
    </main>
  );
}

/** Every table the front page used to carry, kept here with its full columns and sources. */
function DetailTables() {
  const ds = dataset as unknown as DS;
  const measured = measuredTable(ds);
  const models = modelTables(ds);
  const dsRank = dsRankingTable(ds);
  const official = officialTable(ds);
  const catalog = catalogTable(ds);
  return (
    <>
      <section className="space-y-3" aria-labelledby="m-measured">
        <h2 id="m-measured" className={SECTION_TITLE}>Measured lanes, with OpenRouter p50</h2>
        <p className={NOTE}>Our own traffic beside OpenRouter's p50 for each plan's lane model.</p>
        <UnifiedTable testId="measured-full" columns={measured.columns} rows={measured.rows} />
        <p className={SMALL_NOTE}>{measured.footnote}</p>
      </section>
      <section className="space-y-3" aria-labelledby="m-ds">
        <h2 id="m-ds" className={SECTION_TITLE}>DeepSeek value ranking</h2>
        <p className={NOTE}>{dsRank.subtitle}</p>
        <UnifiedTable testId="ds-ranking" columns={dsRank.columns} rows={dsRank.rows} />
        {dsRank.excludedLines.map((l) => (
          <p key={l} className={SMALL_NOTE}>{l}</p>
        ))}
      </section>
      <section className="space-y-6" aria-labelledby="m-models">
        <h2 id="m-models" className={SECTION_TITLE}>Per-model estimates</h2>
        {models.map((m) => (
          <div key={m.ref} className={MODEL_BLOCK} data-model={m.ref}>
            <h3 className={MODEL_TITLE}>{m.name}</h3>
            {m.table.rows.length === 0 ? (
              <p className={NOTE} data-no-plan={m.ref}>No plan on this site lists {m.name} on its published model list, so there is no table for it.</p>
            ) : (
              <>
                <p className={NOTE}>{m.table.subtitle}</p>
                <UnifiedTable testId={"model-" + m.ref} columns={m.table.columns} rows={m.table.rows} />
                <p className={SMALL_NOTE}>{m.table.orNote}</p>
                {m.table.tierNote && <p className={SMALL_NOTE} data-tier-note="yes">{m.table.tierNote}</p>}
              </>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3" aria-labelledby="m-official">
        <h2 id="m-official" className={SECTION_TITLE}>Official subscriptions (local logs)</h2>
        <p className={NOTE}>Token counts and speeds from this machine's Codex and Claude Code session logs, read only and aggregated. No session ids, paths or prompts are kept.</p>
        <UnifiedTable testId="official" columns={official.columns} rows={official.rows} />
        <p className={SMALL_NOTE}>{dataset.official.source} · measured {dataset.official.measured_at}</p>
      </section>
      <section className="space-y-3" aria-labelledby="m-catalog">
        <h2 id="m-catalog" className={SECTION_TITLE}>Plans catalog: allowances and sources</h2>
        <UnifiedTable testId="catalog-full" columns={catalog.columns} rows={catalog.rows} />
      </section>
    </>
  );
}
