// Proves site/src/components/ui/* is still exactly what `shadcn add` writes, so an upgrade is just
// `bunx shadcn add <name> --overwrite`. Runs the project's own shadcn (lockfile version) with --diff
// per component and judges each run with site/src/ui-drift.ts: the component's OWN file must come
// back `(skip)` with no diff lines. Dependency files are listed in the same run and this registry
// contradicts itself about their "use client" prologue, so they are not the gate's business — an
// upgrade would overwrite the component's file, not the one we did not ask about.
// `--diff` exits 0 whether or not a file drifted, so the text is what counts; unrecognised output
// fails closed. Needs the network; not part of CI `check` — run it in build rounds:
//   bun run --cwd site ui:drift
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";
import { assessDiff, diffLines } from "../src/ui-drift.ts";

const site = join(import.meta.dir, "..");
const uiDir = join(site, "src/components/ui");
const version = (await $`bunx --bun shadcn --version`.cwd(site).nothrow().quiet()).stdout
  .toString()
  .trim();

let names: string[] = [];
try {
  names = readdirSync(uiDir)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.replace(/\.tsx$/, ""))
    .sort();
} catch {
  names = [];
}

console.log(`ui-drift: shadcn ${version || "unknown"}, ${names.length} components`);

const drifted: string[] = [];
for (const name of names) {
  const r = await $`bunx --bun shadcn add ${name} --diff`.cwd(site).nothrow().quiet();
  const text = r.stdout.toString() + r.stderr.toString();
  const verdict = assessDiff(text, name, r.exitCode);
  if (verdict.ok) {
    console.log(`${name}: No changes.`);
    continue;
  }
  drifted.push(name);
  console.log(`${name}: DRIFT (${verdict.why})`);
  const shown = verdict.ownChanges.length ? verdict.ownChanges : diffLines(text);
  for (const line of shown.slice(0, 30)) console.log(`  ${line}`);
}

if (drifted.length) {
  console.log(`ui-drift: FAIL (${drifted.length}/${names.length}): ${drifted.join(", ")}`);
  process.exit(1);
}
console.log(`ui-drift: ok (${names.length})`);
