---

title: "Wrap a promise with Effect.tryPromise"
slug: "effect-try-promise"
summary: "Turn a promise that can fail into an Effect."
date: "2026-10-27"
series: "Effect, one function at a time"
order: 2
tags: ["effect", "typescript"]
starter: true
---

Many libraries hand you a promise. `Effect.tryPromise` turns that promise into an Effect, and you decide how a rejection should be shaped.

```ts
import { Effect } from "effect";

type FetchError = { readonly _tag: "FetchFailed"; readonly reason: string };

export const fetchText = (url: string) =>
	Effect.tryPromise({
		try: async () => {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res.text();
		},
		catch: (cause): FetchError => ({
			_tag: "FetchFailed",
			reason: String(cause),
		}),
	});
```

Two things to notice:
- `try` is the promise. Its resolved value becomes the success value.
- `catch` maps whatever was thrown into an error type you choose, so callers see a shape they can match on.

Without the `catch` mapping, the failure would be an unknown value, and every caller would have to guess what it is. Give the failure a tag from the start.

The promise is only started when the Effect runs, so building the value does not fetch anything.
