---

title: "Recover one error with Effect.catchTag"
slug: "effect-catch-tag"
summary: "Recover from one tagged error and leave the others alone."
date: "2026-10-27"
series: "effect-one-function"
order: 3
tags: ["effect", "typescript"]
starter: true
---

Once an effect can fail with several tagged errors, `Effect.catchTag` lets you handle exactly one of them and let the rest continue.

```ts
import { Effect } from "effect";

type ModelError =
	| { readonly _tag: "RateLimited"; readonly retryAfter: number }
	| { readonly _tag: "Network"; readonly detail: string };

const callModel = (ok: boolean): Effect.Effect<string, ModelError> =>
	ok
		? Effect.succeed("answer")
		: Effect.fail({ _tag: "RateLimited", retryAfter: 2 });

export const answer = (ok: boolean) =>
	callModel(ok).pipe(
		Effect.catchTag("RateLimited", (e) =>
			Effect.succeed(`wait ${e.retryAfter}s`),
		),
	);
```

Three things to notice:
- The handler receives only the matching error, with its type narrowed.
- A `Network` failure passes through unchanged and stays in the error type.
- The result type still lists what is left, so nothing is silently dropped.

Use it instead of a catch-all when only one failure has a sensible fallback. A catch-all hides the cases you did not think about.
