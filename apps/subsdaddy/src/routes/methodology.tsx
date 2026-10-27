import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { UnifiedTable } from "@/components/unified-table";
import { MODEL_BLOCK, MODEL_TITLE, NOTE, PAGE_TITLE, SECTION_TITLE, SMALL_NOTE } from "@/components/layout";
import { dataset } from "@/lib/dataset";
import { SHAPES, summaryTable } from "@/lib/summary";
import { catalogTable, contextCompareTable, contextDistributionTable, dsRankingTable, measuredTable, messageTable, modelTables, officialTable, type DS } from "@/lib/sections";
import { contextLabel } from "@/data/context";
import { CONTEXTS, OUTPUT_TOKENS_PER_MESSAGE, WINDOWS_PER_DAY, monthlyTokens, tokensPerMessage, usdPerBOfTokens } from "@/data/messages";
import { hourWeighted } from "@/lib/official-prices";
import { na, value } from "@/lib/cells";
import { usd } from "@/lib/sections";
import { cacheShare } from "@/lib/summary";

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
        <p>Capacity is read per window from its own codexbar reading, not by a fixed conversion. Each window gives a cost over its used fraction and is scaled to the plan's billing cycle; the tightest usable window sets the allowance (see Usage allowance from quota windows). Saturated windows count; windows at 2% or less and windows with under 95% log coverage do not.</p>
      </section>
      <section className="space-y-2">
        <h2 className="text-lg font-medium">$/B</h2>
        <p>usd per billion tokens = fee ÷ (tokens per billing cycle the allowance buys) × 10⁹. For a measured lane the tokens are the binding window's tokens scaled to the cycle. No week is multiplied by a fixed factor.</p>
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
        <h2 className="text-lg font-medium">Model prices by prompt length</h2>
        <p>OpenRouter prices some models by prompt length. A request whose prompt is above a threshold is priced at that band's rates for the whole request; a prompt of exactly the threshold stays in the band below. Claude Haiku 5.5 moves to 5× the base input price above 100k prompt tokens; GPT-6 Luna moves to 2× above 272k. Estimates use two standard contexts, 100K and 350K (see Standard context below).</p>
        <p>Cache writes have their own price (1.25× input for Haiku and Luna). The measured traffic writes no cache, so this term is zero today; it is priced, not folded into input, so a future write share is counted.</p>
        <p>A plan with an offered model but no published dollar allowance shows N/A and its reason in the title. A third-party figure is used only with its link and date, labelled third-party. None is used on this site yet.</p>
      </section>
      <CacheShapeSection />
      <ShapeSection />
      <AllowanceColumnSection />
      <AllowanceSection />
      <ClaudeSection />
      <ContextSection />
      <OfficialPlansSection />
      <section className="space-y-2">
        <h2 className="text-lg font-medium">Speed on the front page</h2>
        <p>Model view: weighted median over endpoints by request volume, not the unweighted median or the best endpoint. Measured view: our own usage logs, p50. Every speed cell shows one value, rounded to two significant figures.</p>
        <p>weighted median over endpoints by request volume, not the unweighted median or the best endpoint</p>
        <p>Derived $/B (marked *): a lane with no usable window of its own may take a same-rate peer's figure, and the * says so. Each lane now has its own window, so none is derived today.</p>
      </section>
      <DetailTables />
      <SiteFooter />
    </main>
  );
}

/** The standard context: why 100K, the distribution behind it, and what the two standards change. */
function ContextSection() {
  const ds = dataset as unknown as DS;
  const c = dataset.context;
  const q = c.quantiles;
  const k = (n: number) => Math.round(n / 1000) + "K";
  const dist = contextDistributionTable(ds);
  const cmp = contextCompareTable(ds);
  const dsRef = ds.models.reference.find((r) => r.ref === "deepseek-v4.1-flash")!;
  const off = dsRef.official;
  const hw = off ? hourWeighted({ peak: off.peak, off_peak: off.off_peak, peak_hours_utc: off.peak_hours_utc }) : null;
  return (
    <section className="space-y-3" aria-labelledby="m-context">
      <h2 id="m-context" className={SECTION_TITLE}>Standard context</h2>
      <p>
        Model prices are read at two standard prompt lengths, fixed in code: {contextLabel("short")} and {contextLabel("long")}. {contextLabel("short")} is the median
        session-end context of our pi sessions ({k(q.p50)}, {c.sample_sessions.toLocaleString("en-US")} sessions in the last {c.window_days} days, measured at each session's last call).
        {contextLabel("long")} is their p90 ({k(q.p90)}). The p75 ({k(q.p75)}) is a sensitivity check, not a third standard. The median is the context a typical session ends at.
      </p>
      <p>Session-end distribution, prompt tokens (input + cache read + cache write):</p>
      <UnifiedTable testId="context-distribution" columns={dist.columns} rows={dist.rows} />
      <p className={SMALL_NOTE}>
        p50 {q.p50.toLocaleString("en-US")} · p75 {q.p75.toLocaleString("en-US")} · p90 {q.p90.toLocaleString("en-US")} · max {q.max.toLocaleString("en-US")} tokens. Method: {c.method}.
      </p>
      <p>$/B by standard context (agent shape). A value changes only where a prompt-length band is crossed, so a model with no band in the range does not move.</p>
      <UnifiedTable testId="context-compare" columns={cmp.columns} rows={cmp.rows} />
      <p className={SMALL_NOTE}>
        DeepSeek V4.1 Flash reference price in use: {"$"}{dsRef.in_per_m} in / {"$"}{dsRef.out_per_m} out / {"$"}{dsRef.cache_per_m} cache per M tokens (cache read); status {dsRef.price_status ?? "unknown"};
        last verified {dsRef.last_verified_at ?? "unknown"}. {dsRef.price_note ?? dsRef.price_anomaly ?? ""} Official: {dsRef.official_status ?? "not checked"}. Source priority: official above OpenRouter.
      </p>
      {off && hw && (
        <p className={SMALL_NOTE}>
          Price basis: each band weighted by the hours it covers. Peak is 35 of 168 hours (01:00-04:00 and 06:00-10:00 UTC, Monday to Friday; the page excludes Chinese public holidays,
          the weight does not). Result: {"$"}{hw.in_per_m.toFixed(5)} input, {"$"}{hw.cache_per_m.toFixed(6)} cache and {"$"}{hw.out_per_m.toFixed(3)} output per M tokens.
          Why not the arithmetic mean: it weights peak as half the day, but peak covers about a fifth of it. Peak hours (UTC): {off.peak_hours_utc}. Source: {off.source}, read {off.fetched_at.slice(0, 10)}.
        </p>
      )}
    </section>
  );
}

/** Official consumer plans: how a dollar allowance, a message limit and a window limit become $/B, and what stays N/A. */
function OfficialPlansSection() {
  const ds = dataset as unknown as DS;
  const msg = messageTable(ds);
  const ceilingTokens = monthlyTokens({ low: 350, high: 3000 }, CONTEXTS.short, WINDOWS_PER_DAY.ceiling, "low");
  const per = tokensPerMessage(CONTEXTS.short);
  return (
    <section className="space-y-3" aria-labelledby="m-official-plans">
      <h2 id="m-official-plans" className={SECTION_TITLE}>Official consumer plans</h2>
      <p>
        GitHub Copilot Pro and Pro+ publish a dollar allowance: base AI credits, where 1 AI credit = $0.01 USD (GitHub Docs, read 2026-10-26). Pro is $10 with 1,000 base credits;
        Pro+ is $39 with 3,900. The flex allotment on the plans table (500 and 3,100 more credits) is variable by GitHub's own text, so it is excluded. The estimate is fee ÷ allowance × the
        blended list cost of each model, as for any other plan. It assumes credits bill at list rates per model; per-model credit rates were not read.
      </p>
      <p>
        OpenAI Codex publishes messages per five-hour window, not tokens. The Codex pricing page (read 2026-10-26) lists GPT-6 Luna at 350-3,000 local messages per window on Plus, and says
        these are estimates, not fixed limits. It says Pro plans currently have no five-hour limit, so the Pro rows are N/A. Go is not in that table. The GPT-5.5 ranges in the research note
        are no longer on the page.
      </p>
      <p>
        Conversion, one convention (src/data/messages.ts): 1 message = {per.toLocaleString("en-US")} tokens = 100,000 standard context + {OUTPUT_TOKENS_PER_MESSAGE} output tokens, the median output
        of one assistant turn in our pi session logs. Monthly capacity = messages per window × windows a day × 30 × tokens per message. The vendor gives a range; the front page uses its
        lower bound, and the table shows both ends. Realistic is 3 active windows a day. The ceiling is 24 hours of continuous use, 24 ÷ 5 = 4.8 windows a day: at the lower bound, Plus on GPT-6 Luna
        would run {(ceilingTokens / 1e9).toFixed(2)}B tokens a month at 100K, which is {"$"}{usdPerBOfTokens(20, ceilingTokens).toFixed(2)} per billion tokens.
      </p>
      <p>
        Measured output constant: a recount on 2026-10-26 found 43,582 assistant turns with usage in 45 days and a median output of 462 tokens. It replaces the earlier 467. The per-turn
        median prompt is 192K tokens, not 100K; 100K per message is the standard context convention (the session-end median), so per-turn prompts would roughly double the token counts.
      </p>
      <UnifiedTable testId="messages" columns={msg.columns} rows={msg.rows} />
      <p>The Claude plans are converted from archived prompt counts; see the Claude section below.</p>
    </section>
  );
}

/** Why the traffic shape moves $/B: the same fee and allowance buy more tokens when more of them are cache reads. */
function CacheShapeSection() {
  const ds = dataset as unknown as DS;
  const cc = ds.catalog.rows.find((r) => r.plan_id === "commandcode-goat-published")!;
  const go = ds.catalog.rows.find((r) => r.plan_id === "opencode-go-go")!;
  const ccV = cc.estimate!.values.find((v) => v.ref === "deepseek-v4.1-flash" && v.shape === "agent")!;
  const goV = go.estimate!.values.find((v) => v.ref === "deepseek-v4.1-flash" && v.shape === "agent")!;
  const dsRef = ds.models.reference.find((r) => r.ref === "deepseek-v4.1-flash")!;
  const ccShare = Math.round(cacheShare(ds, "commandcode-goat").share * 100);
  const goShare = Math.round(cacheShare(ds, "opencode-go").share * 100);
  const ratio = Math.round(dsRef.in_per_m / dsRef.cache_per_m);
  return (
    <section className="space-y-2" aria-labelledby="m-cache-shape">
      <h2 id="m-cache-shape" className={SECTION_TITLE}>Why the traffic shape moves $/B</h2>
      <p>
        CommandCode GOAT and OpenCode Go both cost $10 a month, and each carries a measured allowance from its quota windows. Each model view uses the plan's own measured traffic shape, so they differ
        only because of what each one carries. CommandCode's own traffic is {ccShare}% cache read of prompt tokens; OpenCode Go's is {goShare}%. A cache read is priced at
        {" "}{"$"}{dsRef.cache_per_m} per M against {"$"}{dsRef.in_per_m} for an uncached input, about {ratio}×, so the same allowance buys more tokens when more of them are cache reads.
      </p>
      <p>
        At the list-price blend that gives {"$"}{ccV.blended_usd_per_b.toFixed(2)} per billion tokens for CommandCode's shape and {"$"}{goV.blended_usd_per_b.toFixed(2)} for OpenCode Go's.
        So on DeepSeek V4.1 Flash, CommandCode shows {"$"}{ccV.usd_per_b!.toFixed(2)} and OpenCode Go {"$"}{goV.usd_per_b!.toFixed(2)}. That gap is real, not a bug.
      </p>
      <p>
        Measured view: each lane's $/B is its fee over the tokens its binding quota window delivers per cycle. A lane's capacity tooltip lists its three windows and its model mix.
        Hover a $/B cell to see the cache share of the traffic it was computed from.
      </p>
    </section>
  );
}

/** The usage allowance: how each lane's dollars per cycle come from its quota windows, and what the tightest window means. */
function AllowanceSection() {
  const ds = dataset as unknown as DS;
  const rows = ds.lanes.lanes.map((l) => {
    const c = l.capacity;
    const usd = l.usd_per_b === null ? na(c.reason ?? "no usable window") : value("$" + l.usd_per_b.toFixed(2));
    return {
      key: l.lane,
      cells: {
        plan: value(l.label),
        window: value(c.window ?? "N/A"),
        allowance: c.allowance_usd_per_cycle === null ? na(c.reason ?? "no usable window") : value("$" + c.allowance_usd_per_cycle.toFixed(2) + " per " + c.cycle_days + "d"),
        tokens: c.tokens_per_cycle === null ? na(c.reason ?? "no usable window") : value((c.tokens_per_cycle / 1e9).toFixed(2) + "B per " + c.cycle_days + "d"),
        usd: usd,
        unpriced: c.unpriced_share === null ? na("no priced window") : value(Math.round(c.unpriced_share * 100) + "%", [], null, c.low_coverage ? "low coverage" : null),
      },
    };
  });
  const cols = [
    { key: "plan", label: "Plan", width: "26%" },
    { key: "window", label: "Binding window", width: "12%" },
    { key: "allowance", label: "Allowance per cycle", width: "18%", numeric: true },
    { key: "tokens", label: "Tokens per cycle", width: "16%", numeric: true },
    { key: "usd", label: "$/B", width: "12%", numeric: true },
    { key: "unpriced", label: "Unpriced", width: "16%", numeric: true },
  ];
  return (
    <section className="space-y-3" aria-labelledby="m-allowance">
      <h2 id="m-allowance" className={SECTION_TITLE}>Usage allowance from quota windows</h2>
      <p>
        A lane's allowance is taken from its own quota readings, not from a published figure. For each window codexbar reports, the window runs from its reset time back by its own length.
        Every usage row inside it is priced at its model's list price, banded by its own prompt length. The window's full-cycle allowance is its cost ÷ used fraction × (cycle ÷ window length).
        The cycle is the plan's monthly window length from the reading (43,200 minutes, 30 days), or, with no monthly window, the longest window's length. No week is multiplied by a fixed factor.
      </p>
      <p>
        The tightest usable window sets the derived allowance. A window at 100% used is usable: a full window is a ceiling. A window at 2% or less is low signal: it still counts, at low confidence, and the capacity is shown with a wide error bar. A window with no usage, or whose log covers less than 95% of its span, is left out.
        Rows whose model has no list price are counted as unpriced tokens, never zero cost; a lane above 5% unpriced is flagged low coverage.
      </p>
      <p>
        Example, from the readings: CommandCode's monthly window is 50% used after its first 105 hours, with its priced rows costing the amount the window shows. Its weekly window is 100% used, which is usable, but its
        cycle-scaled allowance is larger, so the monthly window binds. The brief's shortcut (the weekly token count divided by the monthly percentage) mixes two windows, and is not used.
      </p>
      <UnifiedTable testId="allowance" columns={cols} rows={rows} />
      <p>Z.ai's two readings are both 1% used: low signal. It is ranked at low confidence. Its weekly window binds, and its fee for that cycle is the annual price ($672) prorated to 7 days over 365; no monthly window is read for it.</p>
      <p>CommandCode publishes $80 of usage; our dashboard read on 2026-10-27 showed a $70 pool at 50% used. Both are recorded; the published figure is used.</p>
      <p>Where a plan publishes an allowance, that figure is the allowance (basis vendor_published). Where codexbar states a pool whose used share matches the monthly window, that pool is the allowance (vendor_reported). Otherwise the allowance is derived from the quota windows, and the derived figure is kept beside any other. OpenCode Go publishes no per-cycle figure and states no pool, so its allowance is derived. Model views use the allowance chosen; the Measured $/B does not depend on it.</p>
      <p>deepseek-v4.1-flash-fast has no public listing; it is priced at the same rate as deepseek-v4.1-flash (assumed_alias_rate).</p>
      <p>glm-5.3 is priced at the QwenCloud pricing page rate: $1.4 input, $4.4 output and $0.28 cache read per million tokens (read 2026-10-27). OpenRouter lists z-ai/glm-5.3 differently ($0.07 input, $1.40 output); the QwenCloud table is used as ruled. Its share of any window is small, and it is not an assumed rate.</p>
    </section>
  );
}

/** Claude Code prompt counts: the archived former limit text, converted with the same convention as Codex. */
function ClaudeSection() {
  const plans: Array<[string, string, { low: number; high: number }]> = [
    ["Claude Code - Pro", "claude-code-pro", { low: 10, high: 40 }],
    ["Claude Code - Max 5x", "claude-code-max-5x", { low: 50, high: 200 }],
    ["Claude Code - Max 20x", "claude-code-max-20x", { low: 200, high: 800 }],
  ];
  const B = (t: number) => (t / 1e9).toFixed(3) + "B";
  const rows = plans.map(([label, id, lim]) => {
    const fee = dataset.catalog.rows.find((r) => r.plan_id === id)!.price_month_usd ?? 0;
    const lower = monthlyTokens(lim, CONTEXTS.short, WINDOWS_PER_DAY.realistic, "low");
    const upper = monthlyTokens(lim, CONTEXTS.short, WINDOWS_PER_DAY.realistic, "high");
    const ceil = monthlyTokens(lim, CONTEXTS.short, WINDOWS_PER_DAY.ceiling, "low");
    return {
      key: id,
      cells: {
        plan: value(label),
        range: value(lim.low + "-" + lim.high + " per 5h"),
        lower: value(B(lower)),
        upper: value(B(upper)),
        ceiling: value(B(ceil)),
        usd: value(usd(fee / (lower / 1e9)) + "‡"),
      },
    };
  });
  const cols = [
    { key: "plan", label: "Plan", width: "24%" },
    { key: "range", label: "Prompts (archived)", width: "18%" },
    { key: "lower", label: "Lower, realistic", width: "16%", numeric: true },
    { key: "upper", label: "Upper, realistic", width: "16%", numeric: true },
    { key: "ceiling", label: "Lower, ceiling", width: "14%", numeric: true },
    { key: "usd", label: "$/B lower", width: "12%", numeric: true },
  ];
  return (
    <section className="space-y-3" aria-labelledby="m-claude">
      <h2 id="m-claude" className={SECTION_TITLE}>Claude Code prompt counts (archived)</h2>
      <p>
        The table shows N/A for all three plans. Anthropic's current help page states percentage limits only, and no sourced dollar allowance was found (checked 2026-10-27), so no dollar figure is shown.
        The prompt counts below are the former Anthropic text, quoted in anthropics/claude-code issue 6611 (created 2025-08-26): Pro 10-40, Max 5x 50-200 and Max 20x 200-800 prompts per five hours.
        They are converted with the Codex convention (1 prompt = 100,000 standard context + 462 output tokens), and they are a lower bound: one Claude Code prompt runs a tool loop of several model requests, each reading the context again, so a prompt is not one standard-context request.
        Lower bound, 3 windows a day; the ceiling is 24 hours of continuous use (4.8 windows a day). These are the old limits, not today's.
      </p>
      <p>
        A month of one's own Claude Code logs (ccusage-style, the same window method as the lanes above) would replace these conversions with a measured figure; that is the only change that should be made.
      </p>
      <UnifiedTable testId="claude-prompts" columns={cols} rows={rows} />
    </section>
  );
}

/** The Shape switch: one token mix for every plan, so the same fee and allowance give the same $/B. */
function ShapeSection() {
  const ds = dataset as unknown as DS;
  const tables = SHAPES.map((sh) => summaryTable(ds, "deepseek-v4.1-flash", "short", sh));
  const plans = tables[0].rows.map((r) => r.key);
  const rows = plans.map((key) => ({
    key,
    cells: {
      plan: value(tables[0].rows.find((r) => r.key === key)!.cells.plan.text),
      ...Object.fromEntries(SHAPES.map((sh, i) => [sh.id, tables[i].rows.find((r) => r.key === key)!.cells.usd])),
    },
  }));
  const cols = [
    { key: "plan", label: "Plan (DeepSeek V4.1 Flash, 100K)", width: "34%" },
    ...SHAPES.map((sh) => ({ key: sh.id, label: "$/B " + sh.label, width: "22%", numeric: true })),
  ];
  const cc = ds.lanes.lanes.find((l) => l.lane === "commandcode-goat")!;
  const go = ds.lanes.lanes.find((l) => l.lane === "opencode-go")!;
  const assumed = ds.lanes.lanes.filter((l) => (l.capacity.assumed_share ?? 0) > 0);
  return (
    <section className="space-y-3" aria-labelledby="m-shape">
      <h2 id="m-shape" className={SECTION_TITLE}>Shape: one token mix for every plan</h2>
      <p>
        Shape sets the token mix used to price every plan in the model views: the cache-read share of prompt tokens and the output share (data/shapes.json). Under one shape, a plan's $/B
        is its fee over the tokens its allowance buys at that mix, so two plans with the same fee and the same allowance show the same $/B. Measured uses each plan's own traffic and does not change with Shape.
      </p>
      <UnifiedTable testId="shape-compare" columns={cols} rows={rows} />
      <p>
        CommandCode carries a published {"$"}{cc.capacity.allowance_published_usd?.toFixed(2)} pool for every model. OpenCode Go has no pool: it publishes a monthly limit per model, so its allowance
        is the limit of the model being priced ({"$"}80 for DeepSeek V4.1 Flash, {"$"}15 for Claude Haiku 5.5). With the same fee and blend, CommandCode and Go are equal under every shape in the DeepSeek view;
        under Haiku or Luna, Go's limit is smaller, so they are not equal. Go's derived pool of {"$"}{go.capacity.allowance_derived_usd?.toFixed(2)} stays in the Measured view and in the allowance tooltip.
      </p>
      {assumed.map((l) => (
        <p key={l.lane} className={SMALL_NOTE}>
          {l.label}: {Math.round((l.capacity.assumed_share ?? 0) * 100)}% of its binding window is priced at an assumed alias rate (usage_prices, price_basis assumed_alias_rate), the same rate as deepseek-v4.1-flash.
        </p>
      ))}
      <p className={SMALL_NOTE}>
        Codex message rows convert a message count to tokens at a fixed 100,462 per message, with no blended price, so Shape does not apply to them.
      </p>
    </section>
  );
}

function AllowanceColumnSection() {
  return (
    <section className="space-y-3" aria-labelledby="m-allowance-column">
      <h2 id="m-allowance-column" className={SECTION_TITLE}>The Allowance column and its sources</h2>
      <p>
        Allowance is the usage dollars a plan pays for in one cycle, with the cycle length. Each value carries one source marker: p published by the vendor, r the vendor's dashboard reading,
        d derived from quota windows and list prices, c a credit value measured on the plan. Where a plan has more than one figure, the tooltip lists them all; the published figure is the one the model views price with.
      </p>
      <p>
        Source priority, first match wins: a per-model official limit (OpenCode Go and Go Plus, basis vendor_published_per_model), then the official pool (CommandCode, vendor_published),
        then the vendor's dashboard reading (vendor_reported), then a figure derived from quota windows (derived), or a credit value (credits). A plan with per-model limits has no pool, so a model it does not list has no allowance.
      </p>
      <p className={SMALL_NOTE}>
        The Measured view's Allowance does not depend on Shape or context. In a model view, the allowance is the same value under every shape: Shape changes only the price per token.
      </p>
      <p className={SMALL_NOTE}>
        Bring your own shape: a local collector is planned; the site will price every plan against your own cache share. Its contract is written, and the custom shape stays disabled until it ships.
      </p>
    </section>
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
