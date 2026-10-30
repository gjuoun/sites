#!/usr/bin/env bun
// Axis audit for the business catalogue (/ui/business/). Read-only.
//
// 1. DECLARED: each component file under components/ui declares its axes in source, per owning function: cva variants
//    (axis -> value -> classes, with the cva base string) and typed props named after an axis (variant, size, side, align,
//    orientation, collapsible) whose type is a string-literal union.
// 2. PASSED: the value is a quoted literal in the owner's specimen source: its catalogue Section body, its VARIANTS and STATES
//    entries, and any top-level constant those reference (e.g. BUTTON_SIZES).
// 3. EXHIBITED: in the rendered DOM of the section. cva values: a class token that only that value carries (not in the base,
//    not in another value of the same axis), with its variant prefix, is present. Typed values: data-<axis>="value" is present.
//    A typed value with no such attribute is DOM-unobservable (reported as static, not judged).
//
// Verdicts: EXHIBITED | PASSED-NOT-EXHIBITED (defect) | NOT-SHOWN (defect) | INDISTINCT-CLASSES | PASSED-DOM-UNOBSERVABLE.
//
// Usage: bun run scripts/axis-audit.ts [--dist apps/bigface/dist] [--out DIR]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import ts from "typescript";
import { findChrome, launchChrome, openPage, serveDist } from "./theme-mode-probe.ts";

const AXES = new Set(["variant", "size", "side", "align", "orientation", "collapsible"]);
const ROOT = resolve(import.meta.dir, "..");
const COMP = join(ROOT, "packages/bigface-shadcn-ui/src/components/ui");
const BIZ = join(ROOT, "apps/bigface/src/pages/ui/business");

export interface Declared { file: string; owner: string; axis: string; value: string; kind: "cva" | "typed"; classes: string; base: string }

const nameOf = (n: ts.PropertyName): string => (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) ? n.text : n.getText());
const strOf = (n: ts.Node): string => {
  if (ts.isStringLiteralLike(n)) return n.text;
  if (ts.isParenthesizedExpression(n)) return strOf(n.expression);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return strOf(n.left) + " " + strOf(n.right);
  return "";
};
const unionOf = (t: ts.TypeNode): string[] => {
  if (ts.isParenthesizedTypeNode(t)) return unionOf(t.type);
  if (ts.isUnionTypeNode(t)) return t.types.flatMap(unionOf);
  if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) return [t.literal.text];
  return [];
};
/** The name of the function or variable a node belongs to: the component (or cva constant) that owns the axis. */
const ownerOf = (node: ts.Node): string => {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if ((ts.isFunctionDeclaration(p) || ts.isFunctionExpression(p)) && p.name) return p.name.text;
    if (ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  }
  return "(module)";
};

export function declaredAxes(file: string): Declared[] {
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Declared[] = [];
  const fileName = file.split("/").pop()!.replace(/\.tsx$/, "");
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "cva") {
      const base = strOf(node.arguments[0] ?? node);
      const cfg = node.arguments[1];
      const variants = cfg && ts.isObjectLiteralExpression(cfg) ? cfg.properties.find((p) => ts.isPropertyAssignment(p) && nameOf(p.name) === "variants") : undefined;
      if (variants && ts.isPropertyAssignment(variants) && ts.isObjectLiteralExpression(variants.initializer)) {
        for (const axis of variants.initializer.properties) {
          if (!ts.isPropertyAssignment(axis) || !ts.isObjectLiteralExpression(axis.initializer)) continue;
          const axisName = nameOf(axis.name);
          if (!AXES.has(axisName)) continue;
          for (const v of axis.initializer.properties) if (ts.isPropertyAssignment(v)) out.push({ file: fileName, owner: ownerOf(node), axis: axisName, value: nameOf(v.name), kind: "cva", classes: strOf(v.initializer), base });
        }
      }
    }
    if (ts.isPropertySignature(node) && node.type && AXES.has(nameOf(node.name))) {
      for (const v of unionOf(node.type)) out.push({ file: fileName, owner: ownerOf(node), axis: nameOf(node.name), value: v, kind: "typed", classes: "", base: "" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out.filter((d, i, all) => all.findIndex((e) => e.file === d.file && e.owner === d.owner && e.axis === d.axis && e.value === d.value && e.kind === d.kind) === i);
}

const catSrc = readFileSync(join(BIZ, "_catalog.tsx"), "utf8");
const varSrc = readFileSync(join(BIZ, "_variants.tsx"), "utf8");
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

/** Top-level constants of the variants module, by name, so an entry that uses BUTTON_SIZES counts the sizes it passes. */
const constants = new Map<string, string>();
for (const m of varSrc.matchAll(/^const ([A-Z_]+) = [^\n]*$/gm)) constants.set(m[1]!, m[0]);

/** The text a section's specimens are written in. */
export function specimenSource(id: string): string {
  const start = catSrc.indexOf("<Section id=\"" + id + "\"");
  const after = start < 0 ? -1 : catSrc.indexOf("<Section id=", start + 10);
  const sectionText = start < 0 ? "" : catSrc.slice(start, after < 0 ? undefined : after);
  const entry = new RegExp("\\n\\t(\"" + esc(id) + "\"|" + esc(id) + "): \\(", "g");
  const next = /\n\t(?:"[^"]+"|[\w-]+): \(/g;
  let entries = "";
  for (let m = entry.exec(varSrc); m; m = entry.exec(varSrc)) {
    next.lastIndex = m.index + 1;
    const n = next.exec(varSrc);
    entries += varSrc.slice(m.index, n ? n.index : varSrc.length);
  }
  let text = sectionText + entries;
  for (const [name, def] of constants) if (text.includes(name)) text += "\n" + def;
  // Helper functions a specimen calls (SidebarFrame, Row, Matrix) carry their own axis literals.
  for (const m of varSrc.matchAll(/^function (\w+)\(/gm)) {
    const name = m[1]!;
    if (!new RegExp("\\b" + name + "\\b").test(text)) continue;
    const end = varSrc.indexOf("\n}\n", m.index!);
    if (end > 0) text += "\n" + varSrc.slice(m.index!, end + 3);
  }
  return text;
}

const LITERAL = (value: string) => new RegExp("[\"'\\s=]" + esc(value) + "[\"']");
const tokens = (c: string) => c.split(/\s+/).filter(Boolean);

const VERDICT_LABEL: Record<string, string> = { EXHIBITED: "ok", "PASSED-NOT-EXHIBITED": "PASSED-NOT-EXHIBITED", "NOT-SHOWN": "MISSING", INDISTINCT: "indistinct", "INDISTINCT-CLASSES": "indistinct", "PASSED-DOM-UNOBSERVABLE": "static" };

// ---- runner -------------------------------------------------------------------------------------

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const opt = (k: string, d = "") => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d; };
  const dist = resolve(opt("--dist", join(ROOT, "apps/bigface/dist")));
  const outDir = opt("--out", "");
  const files = readdirSync(COMP).filter((f) => f.endsWith(".tsx")).map((f) => join(COMP, f));
  const declared = files.flatMap(declaredAxes);
  const sections = [...new Set(declared.map((d) => d.file))].sort();
  const server = serveDist(dist);
  const browser = await launchChrome(findChrome());
  const dom = new Map<string, { tokens: string[]; data: string[] }>();
  try {
    const page = await openPage(browser, server.url + "/ui/business/", { width: 1440, height: 900, mode: "light" });
    await page.evaluate("(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 300)); return true; })()");
    const got = await page.evaluate<Record<string, { tokens: string[]; data: string[] } | null>>("(" + ((ids: string[]) => { const out: Record<string, unknown> = {}; for (const id of ids) { const sec = document.getElementById(id); if (!sec) { out[id] = null; continue; } const tokens = new Set<string>(); const data = new Set<string>(); for (const el of Array.from(sec.querySelectorAll("*"))) { const c = el.getAttribute("class"); if (c) for (const t of c.split(/\s+/)) if (t) tokens.add(t); for (const a of Array.from(el.attributes)) if (a.name.startsWith("data-")) data.add(a.name + "=" + a.value); } out[id] = { tokens: [...tokens], data: [...data] }; } return out; }).toString() + ")(" + JSON.stringify(sections) + ")");
    for (const [k, v] of Object.entries(got)) if (v) dom.set(k, v);
    await page.close();
  } finally { browser.stop(); server.stop(); }

  type Row = { section: string; owner: string; axis: string; value: string; kind: string; shown: boolean; verdict: string };
  const rows: Row[] = [];
  for (const d of declared) {
    const spec = specimenSource(d.file);
    const shown = LITERAL(d.value).test(spec);
    const dm = dom.get(d.file);
    let verdict: string;
    if (d.kind === "cva") {
      const sameOwner = declared.filter((y) => y.file === d.file && y.owner === d.owner && y.axis === d.axis && y.kind === "cva");
      const shared = new Set([...tokens(d.base), ...sameOwner.filter((y) => y.value !== d.value).flatMap((y) => tokens(y.classes))]);
      const distinct = tokens(d.classes).filter((t) => !shared.has(t));
      const seen = dm ? distinct.some((t) => dm.tokens.includes(t)) : false;
      verdict = !shown ? "NOT-SHOWN" : distinct.length === 0 ? "INDISTINCT-CLASSES" : seen ? "EXHIBITED" : "PASSED-NOT-EXHIBITED";
    } else {
      const observable = dm ? dm.data.includes("data-" + d.axis + "=" + d.value) : false;
      verdict = !shown ? "NOT-SHOWN" : observable ? "EXHIBITED" : "PASSED-DOM-UNOBSERVABLE";
    }
    rows.push({ section: d.file, owner: d.owner, axis: d.axis, value: d.value, kind: d.kind, shown, verdict });
  }
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = r.section + " · " + r.owner + " · " + r.axis; groups.set(k, [...(groups.get(k) ?? []), r]); }
  let defects = 0;
  for (const [k, rs] of groups) {
    defects += rs.filter((r) => r.verdict === "NOT-SHOWN" || r.verdict === "PASSED-NOT-EXHIBITED").length;
    console.log(k.padEnd(52) + " " + rs.map((r) => r.value + ":" + (VERDICT_LABEL[r.verdict] ?? r.verdict)).join("  "));
  }
  console.log("\nAXES " + groups.size + "  VALUES " + rows.length + "  DEFECTS " + defects);
  if (outDir) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, "axis-audit.json"), JSON.stringify(rows, null, 1)); }
}
