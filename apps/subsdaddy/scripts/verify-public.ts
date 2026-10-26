#!/usr/bin/env bun
/**
 * Public-hygiene gate: scans committed data/ (aggregates; raw exports are gitignored) and the
 * built dist/ HTML for keys, tokens, email addresses, IP literals, DB hostnames, and raw
 * gateway account ids. Prints secrets=<n> account_ids=<m>.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const APP = resolve(import.meta.dir, "..");
const roots = [join(APP, "data"), join(APP, "dist", "client")];
const secretPatterns: Array<[string, RegExp]> = [
  ["api-key", /sk-[A-Za-z0-9]{12,}/],
  ["1password", /op:\/\//],
  ["gateway-name", /SUB2API/],
  ["private-key", /PRIVATE KEY/],
  ["bearer", /Bearer\s+[A-Za-z0-9._-]{12,}/],
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/],
  ["ipv4", /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/],
];
const accountPatterns: Array<[string, RegExp]> = [
  ["account-id-field", /"account_id"\s*:/],
  ["account-id-text", /account_id/],
];
const exempt = new Set(["raw"]);

function files(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (exempt.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(json|html|txt|md)$/.test(name)) out.push(p);
  }
  return out;
}

let secrets = 0;
let accountIds = 0;
for (const root of roots) {
  for (const f of files(root)) {
    const text = readFileSync(f, "utf8");
    const rel = f.replace(APP + "/", "");
    for (const [name, re] of secretPatterns) {
      const m = text.match(re);
      if (m) { secrets++; console.error(`FAIL ${name} in ${rel}: ${m[0].slice(0, 40)}`); }
    }
    for (const [name, re] of accountPatterns) {
      if (re.test(text)) { accountIds++; console.error(`FAIL ${name} in ${rel}`); }
    }
  }
}
console.log(`secrets=${secrets} account_ids=${accountIds}`);
if (secrets || accountIds) process.exit(1);
