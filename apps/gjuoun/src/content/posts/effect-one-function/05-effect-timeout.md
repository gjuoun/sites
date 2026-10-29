---

title: "Stop waiting with Effect.timeout"
slug: "effect-timeout"
summary: "Stop waiting after a deadline."
date: "2026-10-27"
series: "Effect, one function at a time"
order: 5
tags: ["effect", "typescript"]
starter: true
---

A call to a slow service can hang. `Effect.timeout` gives it a deadline, so the caller stops waiting instead of blocking forever.

```ts
import { Duration, Effect } from "effect";

const slowLookup = Effect.promise(
	() =>
		new Promise<string>((resolve) => setTimeout(() => resolve("found"), 5000)),
);

export const lookupWithDeadline = slowLookup.pipe(
	Effect.timeout(Duration.seconds(2)),
);
```

Three things to notice:
- The deadline is a `Duration`, so the unit is part of the value.
- When the deadline passes, the effect fails with a timeout error that the caller can match.
- Effect stops waiting. It cannot cancel a promise that ignores interruption, so keep the underlying work bounded too.

Pick the deadline from what the caller can afford to wait, not from the slowest case you happen to have seen.
