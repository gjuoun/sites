import { expect, test } from "bun:test";
import { assessDiff, blocks } from "./ui-drift.ts";

// Fixtures are the real shapes `bunx --bun shadcn add <name> --diff` printed on 2026-10-21
// (/tmp/jun/native-full-set/diff-*), trimmed to the lines this parser keys on.

const run = (files: string) =>
  `- Resolving items.\n┌ shadcn add x (dry run)\n│\n${files}│\n└ Run without --dry-run to apply.\n`;

test("the component's own file skipped is clean", () => {
  const out = run("├ src/components/ui/button.tsx (skip)\n│ No changes.\n");
  expect(assessDiff(out, "button", 0)).toMatchObject({
    ok: true,
    ownStatus: "skip",
    ownChanges: [],
  });
});

test("a dependency drifting does not fail the component (registry contradicts itself)", () => {
  const out = run(
    "├ src/components/ui/input-group.tsx (skip)\n│ No changes.\n" +
      '├ src/components/ui/input.tsx (overwrite)\n│ ┌───\n│ │ -import { cn } from "cn"\n│ │ +import { cn } from "@/lib/utils"\n│ └───\n',
  );
  expect(assessDiff(out, "input-group", 0)).toMatchObject({ ok: true, ownStatus: "skip" });
  // and the file that does own that block is drift
  expect(assessDiff(out, "input", 0)).toMatchObject({ ok: false, ownStatus: "overwrite" });
});

test("the component's own file overwritten is drift, with its lines kept", () => {
  const out = run(
    '├ src/components/ui/tooltip.tsx (overwrite)\n│ ┌───\n│ │ -"use client"\n│ │ +import * as React from "react"\n│ └───\n',
  );
  const verdict = assessDiff(out, "tooltip", 0);
  expect(verdict.ok).toBe(false);
  expect(verdict.why).toBe("own file differs from the registry");
  expect(verdict.ownChanges).toEqual(['-"use client"', '+import * as React from "react"']);
});

test("a skip that still carries diff lines for the own file is drift", () => {
  const out = run("├ src/components/ui/label.tsx (skip)\n│ │ -x\n│ │ +y\n");
  expect(assessDiff(out, "label", 0)).toMatchObject({
    ok: false,
    why: "own file marked skip yet carries diff lines",
    ownChanges: ["-x", "+y"],
  });
});

test("no block at all is clean only when the run says No changes.", () => {
  expect(assessDiff("│ No changes.\n", "sidebar", 0).ok).toBe(true);
  const unknown = assessDiff("│ something new the parser has never seen\n", "sidebar", 0);
  expect(unknown.ok).toBe(false);
  expect(unknown.why).toContain("own block missing");
});

test("a create is drift: ui:drift runs against an installed tree", () => {
  const out = run("├ src/components/ui/separator.tsx (create)\n│ │ +export { Separator }\n");
  expect(assessDiff(out, "separator", 0)).toMatchObject({
    ok: false,
    why: "own file would be created",
  });
});

test("a non-zero exit fails even when the text looks clean", () => {
  const out = run("├ src/components/ui/button.tsx (skip)\n│ No changes.\n");
  expect(assessDiff(out, "button", 1)).toMatchObject({ ok: false, why: "cli exited 1" });
});

test("block headers are read in order, own path exact", () => {
  const out = run(
    "├ src/components/ui/button.tsx (skip)\n│ No changes.\n" +
      "├ src/hooks/use-mobile.ts (create)\n│ │ +export function useIsMobile() {}\n" +
      "├ src/components/ui/button-group.tsx (skip)\n│ No changes.\n",
  );
  expect(blocks(out).map((b) => `${b.path}:${b.status}`)).toEqual([
    "src/components/ui/button.tsx:skip",
    "src/hooks/use-mobile.ts:create",
    "src/components/ui/button-group.tsx:skip",
  ]);
  // `button` must not be satisfied by `button-group`, and vice versa
  expect(assessDiff(out, "button", 0).ok).toBe(true);
  expect(assessDiff(out, "button-group", 0).ok).toBe(true);
});
