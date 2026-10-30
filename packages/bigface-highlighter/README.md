# @gjuoun/bigface-highlighter

Shiki syntax highlighting for React, moved out of `@gjuoun/bigface-shadcn-ui` (which is a Tailwind/shadcn theme only).

- `@gjuoun/bigface-highlighter/highlighter`: `loadHighlighter(language)` and `highlightCode(code, language)`. Languages
  load lazily the first time they are used; an unlisted language returns `null`. Each line is a React node of token
  spans coloured with Shiki's `github-light` / `github-dark` pair.
- `@gjuoun/bigface-highlighter/use-highlighted-code`: `useHighlightedCode(value, language)`, which keeps the grammar
  state so streamed code re-tokenizes only its new tail.

The token colour is `light-dark(var(--shiki-light), var(--shiki-dark))`, so it follows the page's `color-scheme`.

    bun run --cwd packages/bigface-highlighter test
