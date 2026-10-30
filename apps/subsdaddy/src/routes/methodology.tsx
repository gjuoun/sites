import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { NOTE, PAGE, PAGE_TITLE, SECTION, SECTION_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset, formatReset } from "@/lib/own-data";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
});

function MethodologyPage() {
  const recent = dataset.usage.recent;
  return (
    <main className={PAGE}>
      <header className="space-y-2">
        <h1 className={PAGE_TITLE}>Methodology and limits</h1>
        <p className={NOTE}>
          Every number on this site comes from my own gateway's logs, from codexbar's quota readings, or from a fee I pay and confirmed
          myself. There are four lanes and no other plan appears here.
        </p>
        <p className={SMALL_NOTE}>as of {formatReset(dataset.lanes.measured_at)}</p>
      </header>

      <section data-section="tokens" className={SECTION}>
        <h2 className={SECTION_TITLE}>Token accounting</h2>
        <p className={NOTE}>
          One request's tokens are <code>input + cache_creation + cache_read + output</code>. Every total, share and speed on this page uses
          that sum, and the cache share is <code>cache_read / (input + cache_creation + cache_read)</code>, so a share is always a fraction of
          prompt tokens.
        </p>
        <p className={NOTE}>
          The full export reaches back {dataset.usage.window_days} days, which is longer than the longest quota window (monthly). The model
          tables use the recent {recent.window_days}-day slice of the same pull: {formatReset(recent.coverage_start)} to{" "}
          {formatReset(recent.coverage_end)}.
        </p>
      </section>

      <section data-section="capacity" className={SECTION}>
        <h2 className={SECTION_TITLE}>Capacity and $/B</h2>
        <p className={NOTE}>
          Each codexbar window (5h, weekly, monthly) runs from its reset time minus its own length to the reading. The usage rows inside that
          span are priced at list, so the window has a cost and a token count. Its full-cycle allowance is{" "}
          <code>cost / used% × (cycle / window)</code>. The cycle is the monthly window when the plan has one, otherwise the longest window.
        </p>
        <p className={NOTE}>
          The binding window is the tightest usable one. A window is not usable when the log covers under 95% of its span, when it is unused, or
          when none of its tokens has a list price; a window at or under 2% used is usable but carries low confidence. The lane's{" "}
          <code>tokens per cycle</code> is its allowance divided by the measured blended list cost per token, and{" "}
          <code>$/B = fee per cycle / (tokens per cycle / 1e9)</code>.
        </p>
        <p className={NOTE}>
          The fee is the monthly price I pay. When the binding cycle is not the billed month (Z.ai's weekly window), the monthly fee is prorated
          over the cycle: <code>price × cycle days / 30</code>. A lane whose current windows are all under 2% used keeps its last stable reading
          instead of dividing by a very small number, and says so.
        </p>
        <p className={NOTE}>
          The allowance has an order of trust: a figure the vendor publishes is the headline, then the vendor dashboard's own reading, then the
          figure derived from the windows and list prices. CommandCode publishes $80 a month of usage, so $80 is what its capacity and $/B use;
          the dashboard reading recorded beside it ($35.02 of $70.00, read 2026-10-30) is there for comparison and never replaces the published
          figure. At a published allowance the capacity uses the vendor's own dollars per token from that reading, so $80 buys 3.83B tokens at
          CommandCode's rate rather than at my list prices.
        </p>
      </section>

      <section data-section="models" className={SECTION}>
        <h2 className={SECTION_TITLE}>The model table</h2>
        <p className={NOTE}>
          Rows are the upstream models this lane actually ran in the recent window, sorted by tokens. {" "}
          <code>Share</code> is the model's tokens over the lane's tokens; models under 1% of the lane fold into one "other models" row that
          carries their count and volume but no p50, because a mixed row has no single one.
        </p>
        <p className={NOTE}>
          A monthly limit is shown only where the plan publishes per-model limits (OpenCode Go: $80 on DeepSeek V4.1 Flash, $60 on MiMo v2.6
          Flash). Every other lane shows N/A: it publishes no per-model limit, and a limit is a plan spec rather than a measurement.
        </p>
      </section>

      <section data-section="sources" className={SECTION}>
        <h2 className={SECTION_TITLE}>Sources</h2>
        <p className={NOTE}>
          Traffic and speed: <code>usage_logs</code> on my sub2api gateway, read with a fixed read-only <code>SELECT</code> (columns: account,
          upstream model, input/cache tokens, output tokens, cost, first-token ms, duration ms, created_at). Account ids are mapped to lane ids at
          collection time and never reach the data files or the page.
        </p>
        <p className={NOTE}>
          Quota: <code>codexbar usage --provider &lt;name&gt; --format json</code> for CommandCode, OpenCode Go, Z.ai and QwenCloud. Only the
          window percentages, lengths and reset times are kept. Fees: the four prices I pay and confirmed (CommandCode GOAT $10/mo, OpenCode Go
          $10/mo, Z.ai Max Legacy v2 $56/mo, QwenCloud Token Plan Individual $10/mo).
        </p>
      </section>

      <section data-section="limits" className={SECTION}>
        <h2 className={SECTION_TITLE}>Known limits of the readings</h2>
        <p className={NOTE}>
          OpenCode Go is two subscriptions merged into one lane, but its codexbar reading comes from one of the two accounts, so its window
          covers part of the lane's traffic. Its block carries the "single account reading" badge.
        </p>
        <p className={NOTE}>
          Z.ai reports whole percentages, so its used fraction and its capacity carry a wide error bar; when the reading is at or under 2% the
          lane keeps a stable earlier reading and is badged "stale reading". CommandCode's session can expire: the lane then shows{" "}
          <code>quota unavailable</code> with the provider's message, and keeps its traffic and speed.
        </p>
      </section>

      <section data-section="not-claimed" className={SECTION}>
        <h2 className={SECTION_TITLE}>What this site does not claim</h2>
        <p className={NOTE}>
          No vendor allowance it could not read, no quality score, no third-party plan, no benchmark of providers. It shows no per-model $/B:
          the fee is per lane, and splitting it across models would need an allocation rule this data does not have. Speeds are my own p50s from
          production traffic, not a synthetic probe.
        </p>
        <p className={SMALL_NOTE}>
          Full data files and the refresh loop: see <code>apps/subsdaddy/README.md</code> in the repository. Back to <Link to="/" className="underline">the lanes</Link>.
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}
