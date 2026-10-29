---

title: "Feed a layer with Layer.provide"
slug: "layer-provide"
summary: "Feed one layer's output into another layer."
date: "2026-10-27"
series: "Effect, one function at a time"
order: 4
tags: ["effect", "typescript"]
starter: true
---

A layer builds a service. `Layer.provide` feeds one layer's output into another layer that needs it, so the chain is wired in one place.

```ts
import { Context, Effect, Layer } from "effect";

class Clock extends Context.Service<Clock, { readonly now: () => number }>()(
	"Clock",
) {}

class Logger extends Context.Service<
	Logger,
	{ readonly log: (line: string) => void }
>()("Logger") {}

const ClockLive = Layer.succeed(Clock, { now: () => Date.now() });

const LoggerLive = Layer.effect(
	Logger,
	Effect.gen(function* () {
		const clock = yield* Clock;
		return { log: (line: string) => console.log(clock.now(), line) };
	}),
);

const AppLayer = LoggerLive.pipe(Layer.provide(ClockLive));

const program = Effect.gen(function* () {
	const logger = yield* Logger;
	logger.log("started");
});

Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
```

Three things to notice:
- `Logger` needs a `Clock`, and the layer type says so.
- `Layer.provide(ClockLive)` satisfies that need and leaves `Logger` as the output.
- The program names only `Logger`. It never sees `Clock`.

If you forget the provide step, the compiler stops you before the program runs. That is the point of putting dependencies in the types.
