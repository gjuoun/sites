---

title: "Sequence steps with Effect.gen"
slug: "effect-gen"
summary: "Write sequential Effect code with yield*."
date: "2026-10-27"
series: "effect-one-function"
order: 1
tags: ["effect", "typescript"]
starter: true
---

Start with `Effect.gen`. It lets you write steps in order, the way you would write `async` code, and each `yield*` waits for one effect and hands back its value.

```ts
import { Effect } from "effect";

const double = (n: number) => Effect.succeed(n * 2);

const program = Effect.gen(function* () {
	const a = yield* double(2);
	const b = yield* double(a);
	return a + b;
});

Effect.runPromise(program).then((n) => console.log(n)); // 12
```

Three things to notice:
- Each `yield*` runs one effect and gives you its success value.
- The value you `return` becomes the success value of the whole program.
- Nothing runs until a runner such as `Effect.runPromise` is called.

Reach for `Effect.gen` whenever a step depends on the one before it. A chain of `.then` calls reads backwards once the steps get long, and this form keeps the order visible.

Errors and dependencies come in later lessons. This one only covers sequencing.
