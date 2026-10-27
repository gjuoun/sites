---
title: "Try again with Effect.retry"
slug: "effect-retry"
summary: "Run the effect again after a failure."
date: "2026-10-27"
series: "effect-one-function"
order: 6
tags: ["effect", "typescript"]
starter: true
---
Some failures go away if you try again. `Effect.retry` runs the effect again after a failure, and a schedule decides how long to wait between attempts and when to stop.

```ts
import { Effect, Schedule } from "effect";

let attempts = 0;

const flaky = Effect.sync(() => {
  attempts++;
}).pipe(Effect.andThen(Effect.fail("unavailable" as const)));

const schedule = Schedule.exponential(100).pipe(
  Schedule.setInputType<"unavailable">(),
  Schedule.upTo({ times: 3 }),
);

export const retried = Effect.retry(flaky, { schedule });
```

Three things to notice:

- `upTo({ times: 3 })` means three retries after the first attempt, so four runs in total.
- The wait starts at 100 ms and doubles each time.
- The error type stays in the signature, so a retry that gives up still reports the failure.

Retry only the failures that are worth another try. A rejected request with bad input will fail the same way every time, so it should not be retried.
