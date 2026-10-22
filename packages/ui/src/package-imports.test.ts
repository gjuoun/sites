import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Packaging correctness is a manifest question, not a bundler question: every package the shipped
// sources import must be declared, or a consumer gets "Cannot find module" only when they happen to
// import that one component. This walks the sources and holds package.json to it.
const here = import.meta.dir;
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.includes(".test.")) files.push(p);
  }
};
walk(join(here, "components"));
walk(join(here, "hooks"));
walk(join(here, "lib"));

const bare = (spec: string): string | null => {
  if (spec.startsWith(".") || spec.startsWith("@gjuoun/bigface-ui")) return null;
  return spec.startsWith("@")
    ? spec.split("/").slice(0, 2).join("/")
    : (spec.split("/")[0] as string);
};

const imported = new Set<string>();
for (const file of files)
  for (const m of readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g)) {
    const name = bare(m[1] as string);
    if (name) imported.add(name);
  }

const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

test("every package the sources import is declared as a dependency or peer", () => {
  const missing = [...imported].filter((n) => !declared.has(n));
  expect(missing).toEqual([]);
});

test("react, react-dom and tailwindcss are required peers; the rest are optional", () => {
  const peers = pkg.peerDependencies ?? {};
  for (const required of ["react", "react-dom", "tailwindcss"])
    expect(peers[required]).toBeTruthy();
  const meta = pkg.peerDependenciesMeta ?? {};
  for (const [name, entry] of Object.entries(meta))
    expect(peers[name], `${name} is optional but not a peer`).toBeTruthy();
  // Everything imported except react and the package's own dependency (cn) is optional: a consumer
  // using only Card should not be made to install recharts.
  for (const name of imported)
    if (name !== "react" && !pkg.dependencies?.[name])
      expect(meta[name]?.optional, name).toBe(true);
});

test("control: the audit notices an undeclared import", () => {
  const sample = 'import { thing } from "@left-pad/thing";\nimport * as React from "react";';
  const found = new Set<string>();
  for (const m of sample.matchAll(/from "([^"]+)"/g)) {
    const name = bare(m[1] as string);
    if (name) found.add(name);
  }
  expect([...found].filter((n) => !declared.has(n))).toEqual(["@left-pad/thing"]);
});
