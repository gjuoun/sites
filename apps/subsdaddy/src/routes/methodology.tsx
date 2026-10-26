import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6 text-sm leading-6">
      <Link to="/" className="underline">← ranking</Link>
      <h1 className="text-2xl font-semibold">Methodology</h1>
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
        <p>Estimated $/B = (monthly fee ÷ published usage-dollar allowance) × blended $/B. The allowance is a dollar amount the vendor publishes, such as $80 of usage, or a per-model monthly limit. The blended $/B is the OpenRouter list-price cost of one billion tokens for a reference model: DeepSeek V4.1 Flash, Gemini 3.8 Flash, Claude Haiku 5.5 or GPT-6 Luna. Its token mix is measured on this site: output share pooled across the four plans; cache share 0% (interactive), the measured pooled agent share, or 94% (cache-heavy). The column shows the range across the three reference models, with each model listed.</p>
        <p>Limits: the allowance is in the vendor's own dollars, while the blended cost uses OpenRouter list prices, so the result is an order-of-magnitude estimate. A row with no published usage-dollar allowance (token, credit or window allowance only) shows a reason instead of a number. Estimated values never enter the ranking.</p>
        <p>Assumption: each estimate assumes the whole allowance is spent on one model. The same plan therefore gives a different $/B for each model, and the four model lines are alternatives, not additive. Dollar allowances come from the vendor's own usage values. Credit plans are not assumed to convert at any fixed rate. For QwenCloud, the usage value of one credit is measured from the same quota window: the tokens in that window are priced at their models' OpenRouter list prices and divided by the credits used in the same reading. If a model in the window has no unambiguous list price, the value is withheld and the row shows —, with the measured lower bound in the reason. A plan that does not publish a model's limit gets no estimate for that model (for example OpenCode Go and Gemini 3.8 Flash), shown as —.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Limits</h2>
        <ul className="list-disc pl-5">
          <li>Unpriced rows (total_cost = 0) are excluded from the price fit and counted.</li>
          <li>Seed allowances are badged and kept out of the measured ranking.</li>
          <li>OpenRouter's stats payload is unofficial and can change; rows with missing stats are stale and excluded, never zero.</li>
          <li>No quality score is published; the dataset has no quality field.</li>
        </ul>
      </section>
    </main>
  );
}
