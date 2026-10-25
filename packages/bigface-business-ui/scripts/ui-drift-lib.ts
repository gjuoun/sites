// Judge one `shadcn add <name> --diff` run.
//
// The gate asserts the component's OWN file only. This registry snapshot is internally inconsistent:
// the same file is written with a leading "use client" when it is the direct add target and without
// it when it arrives as another item's dependency, so `add <name> --diff` also lists the
// dependencies and can show a diff in a file that is not the one we asked about. What an upgrade
// (`add <name> --overwrite`) actually rewrites is `src/components/ui/<name>.tsx`, so that block is
// the only thing this gate trusts. Anything it cannot read fails closed.

export type OwnStatus = "skip" | "create" | "overwrite" | "";

export interface Assessment {
  ok: boolean;
  /** Human-readable reason, printed next to DRIFT. */
  why: string;
  /** Status the CLI reported for the component's own file, `""` when it did not mention it. */
  ownStatus: OwnStatus;
  /** Diff lines (`-…` / `+…`) inside the component's own block. */
  ownChanges: string[];
}

interface Block {
  path: string;
  status: "skip" | "create" | "overwrite";
  body: string;
}

const header = /^[├└] (\S+) \((skip|create|overwrite)\)$/gm;

/** `│ │ -x` / `│ │ +x` lines of a block, without the tree gutter. */
export const diffLines = (body: string): string[] =>
  body
    .split("\n")
    .filter((l) => /^│ │ [-+](?![-+])/.test(l))
    .map((l) => l.replace(/^│ │ /, ""));

/** Every `path (status)` block in a `--diff` run, in output order. */
export function blocks(output: string): Block[] {
  const heads = [...output.matchAll(header)];
  return heads.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < heads.length ? (heads[i + 1]?.index ?? output.length) : output.length;
    return {
      path: m[1] as string,
      status: m[2] as Block["status"],
      body: output.slice(start, end),
    };
  });
}

export function assessDiff(output: string, name: string, exitCode: number): Assessment {
  const ownPath = `src/components/ui/${name}.tsx`;
  const own = blocks(output).find((b) => b.path === ownPath);
  const ownChanges = own ? diffLines(own.body) : [];
  const base = { ownStatus: (own?.status ?? "") as OwnStatus, ownChanges };

  if (exitCode !== 0) return { ...base, ok: false, why: `cli exited ${exitCode}` };

  // The CLI omits a file entirely when it has nothing to say about it. With exit 0 that is only
  // trustworthy when the run as a whole says so; otherwise it is output this parser does not know.
  if (!own) {
    return /No changes\./.test(output)
      ? { ...base, ok: true, why: "no own block, no changes" }
      : { ...base, ok: false, why: "own block missing from unrecognised --diff output" };
  }

  if (own.status === "skip" && ownChanges.length === 0)
    return { ...base, ok: true, why: "own file skipped" };
  if (own.status === "skip")
    return { ...base, ok: false, why: "own file marked skip yet carries diff lines" };
  if (own.status === "create") return { ...base, ok: false, why: "own file would be created" };
  return { ...base, ok: false, why: "own file differs from the registry" };
}
