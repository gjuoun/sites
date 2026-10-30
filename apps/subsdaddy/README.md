# subsdaddy

The four LLM subscriptions I pay for, with what each one actually runs and what it costs per billion
tokens. Only my own data is on the page: the gateway's request logs, codexbar's quota readings, and the
fees I pay.

| Lane | Fee | What it is |
| --- | --- | --- |
| CommandCode - GOAT | $10/mo | the GOAT tier, DeepSeek-led |
| OpenCode Go | $10/mo | two subscriptions (jun1 + jun2) counted as one lane |
| Z.ai Coding Plan - Max (Legacy v2) | $56/mo | GLM-5.3 / GLM-5.3-Flash |
| QwenCloud - Token Plan Individual | $10/mo | the credit plan, Qwen and DeepSeek models |

Two pages, prerendered to `dist/client`: `/` (a four-row ranking, then one block per lane with its model
table) and `/methodology` (formulas, sources, limits).

## Data

```text
data/plans.json              the four fees (owner-confirmed) + which plan publishes per-model limits
data/models.json             list prices of the models the lanes run (curated, dated; never fetched here)
data/opencode-go.json        OpenCode Go's own published per-model monthly limits
data/quota.json              latest codexbar reading per lane (windows, used %, resets)
data/usage.json              the 31-day window + the recent 7-day slice, per lane and per model
data/allowance.json          each lane's window-derived allowance, coverage and confidence
data/lanes.json              the join: capacity, $/B, speed, 7-day traffic and the model rows
data/published-snapshot.json last stable capacity per lane, used when every window is under 2% used
data/raw/usage/*.json        per-row export (gitignored: lane ids, no account ids)
data/raw/quota/*.json        quota history, appended per run (committed)
```

## Formulas

- tokens: `input + cache_creation + cache_read + output`; cache share is `cache_read / (input + cache_creation + cache_read)`.
- a codexbar window runs from `resets_at − window length` to the reading; usage rows inside it are priced at list.
- cycle allowance: `cost / used% × (cycle / window)`; the cycle is the monthly window, else the longest one.
- binding window: the tightest usable one (≥95% log coverage, used > 0, priced tokens); ≤2% used is usable with low confidence.
- `tokens_per_cycle = allowance / blended list cost per token`; `$/B = fee_per_cycle / (tokens_per_cycle / 1e9)`.
- fee: the monthly fee; a non-monthly cycle prorates it: `price × cycle_days / 30`.
- model rows: the recent 7-day slice; share is over the lane's tokens; models under 1% fold into one row.

## Commands

```sh
bun run dev                 # vite dev server
bun run build               # vite build + prerender → dist/client
bun test src                # unit tests (pure math, parsers, data gates)
bun run refresh             # usage → quota → allowance → dataset → build → verify:site → verify:all
bun run verify:all          # provenance + public-hygiene gates
```

`refresh` reads two live sources and nothing else: the gateway's postgres through a fixed read-only
`SELECT` (`SUBSDADDY_PSQL` overrides the transport; default `ssh qinglong → podman exec psql`) and
codexbar (`opk get ZAI_API_KEY -- …` supplies Z.ai's key to the child process only). A frozen log of the
last run is at `/tmp/jun/subsdaddy/refresh.log`.

## Known limits

- OpenCode Go's quota reading covers one of its two accounts; the lane's traffic covers both, so its block
  carries a "single account reading" badge.
- Z.ai reports whole percentages, so its capacity has a wide error bar; a reading at or under 2% used makes
  the lane hold its last stable capacity and say "stale reading".
- CommandCode's session can expire: that lane then shows `quota unavailable` with the provider's message,
  keeps its traffic and speed, and publishes no $/B.
- No per-model $/B: the fee is per lane, and splitting it across models needs an allocation rule this data
  does not have.

## Deploy

`.github/workflows/deploy.yml` builds with turbo and deploys `dist/client` to the Cloudflare Pages project
`subsdaddy`. CI never runs `refresh`; the committed `data/*.json` is what ships.
