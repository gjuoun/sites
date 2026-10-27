#!/usr/bin/env bun
// Click matrix for the business catalogue (/ui/business/). Read-only on the page; it clicks.
//
// For every state-bearing specimen: each trigger inside it is clicked with a real pointer (CDP Input events), and the
// specimen's state is read before and after: state attributes (aria-expanded, aria-pressed, aria-checked, aria-selected,
// data-state, data-collapsible, data-orientation, data-open) and the geometry of every element in the specimen.
// A trigger PASSES when either changed. A specimen with a state but no trigger is STATIC: it passes only when its label
// says static. Before and after screenshots of each specimen go to <out>/<mode>/.
//
// Usage: bun run scripts/click-matrix.ts --dist apps/bigface/dist [--modes light,dark] [--out plan-shots/click]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { findChrome, launchChrome, openPage, serveDist, type Page } from "./theme-mode-probe.ts";

/** Sections whose components carry a state: open, expanded, collapsed, pressed, checked, selected or a sidebar state. */
export const STATE_SECTIONS = ["accordion", "alert-dialog", "carousel", "checkbox", "collapsible", "combobox", "context-menu", "dialog", "drawer", "dropdown-menu", "hover-card", "menubar", "navigation-menu", "popover", "radio-group", "resizable", "select", "sheet", "sidebar", "switch", "tabs", "toggle", "toggle-group", "tooltip"] as const;

export interface Item { k: number; cell: number; label: string; kind: string; disabled: boolean; trigger: string; mouse: "left" | "right" | "drag" }
export interface Static { cell: number; label: string; labelled: boolean }
export interface Index { items: Item[]; statics: Static[]; error?: string }

/** Runs in the page: assigns each state trigger and each specimen cell an index, and reports them. */
export function index(id: string): Index {
  const CELL = "td > span, [data-demo], [data-frame], div.flex.min-w-0.flex-wrap.items-center.gap-3, div.flex.min-w-0.flex-col.items-start.gap-1\\.5";
  const STATE = ["aria-expanded", "aria-pressed", "aria-checked", "aria-selected", "data-state", "data-collapsible", "data-orientation", "data-open"];
  const TRIG = "button, [role=tab], [role=switch], [role=checkbox], [role=radio], [role=combobox], [role=slider], [data-slot$=-trigger], [data-slot=carousel-next], [data-slot=carousel-previous], [data-sidebar=trigger], [data-slot=resizable-handle], [data-frame-trigger], [aria-expanded]";
  const sec = document.getElementById(id);
  if (!sec) return { items: [], statics: [], error: "no section " + id };
  const inDet = (e: Element) => e.closest("details") !== null;
  const stateTrig = (t: Element) => {
    const slot = t.getAttribute("data-slot") || "";
    const role = t.getAttribute("role") || "";
    return STATE.some((a) => t.hasAttribute(a)) || ["tab", "switch", "checkbox", "radio", "combobox", "slider"].includes(role) || /-trigger$/.test(slot) || ["carousel-next", "carousel-previous", "resizable-handle"].includes(slot) || t.getAttribute("data-sidebar") === "trigger" || t.hasAttribute("data-frame-trigger");
  };
  const cells = Array.from(sec.querySelectorAll(CELL)).filter((c) => !inDet(c));
  cells.forEach((c, i) => c.setAttribute("data-cmc", String(i)));
  const labelOf = (c: Element): string => {
    if (c.tagName === "FIGURE") return (c.querySelector("figcaption")?.textContent || "").trim();
    if (c.tagName === "SPAN" && c.parentElement?.tagName === "TD") {
      const td = c.parentElement as HTMLTableCellElement; const tr = td.parentElement as HTMLTableRowElement; const table = tr.closest("table");
      const rowHead = (tr.querySelector("th")?.textContent || "").trim();
      const colHead = table ? (table.querySelectorAll("thead th")[td.cellIndex]?.textContent || "").trim() : "";
      return rowHead + " / " + colHead;
    }
    const dd = c.getAttribute("data-demo"); if (dd) return "demo " + dd;
    const own = c.parentElement?.querySelector(":scope > span");
    if (own && own.textContent) return own.textContent.trim();
    const first = c.querySelector(":scope > span, :scope > figcaption");
    return (first?.textContent || c.getAttribute("data-frame") || id).trim();
  };
  const items: Item[] = []; const statics: Static[] = [];
  const triggers = Array.from(sec.querySelectorAll(TRIG)).filter((t) => !inDet(t) && stateTrig(t));
  triggers.forEach((t, k) => {
    t.setAttribute("data-cmt", String(k));
    const cell = t.closest("[data-cmc]") as Element | null; const ci = cell ? Number(cell.getAttribute("data-cmc")) : -1;
    const slot = t.getAttribute("data-slot") || "";
    const disabled = (t as HTMLButtonElement).disabled === true || t.getAttribute("aria-disabled") === "true";
    const mouse: Item["mouse"] = slot === "context-menu-trigger" ? "right" : slot === "resizable-handle" ? "drag" : "left";
    items.push({ k, cell: ci, label: cell ? labelOf(cell) : id, kind: slot || t.getAttribute("role") || t.tagName.toLowerCase(), disabled, trigger: ((t.textContent || "").trim() || t.getAttribute("aria-label") || slot || t.tagName.toLowerCase()).slice(0, 36), mouse });
  });
  cells.forEach((c, i) => {
    const hasState = STATE.some((a) => c.hasAttribute(a)) || Array.from(c.querySelectorAll("*")).some((e) => STATE.some((a) => e.hasAttribute(a)) && !(e.matches(TRIG) && stateTrig(e)));
    const hasTrig = Array.from(c.querySelectorAll(TRIG)).some((t) => !inDet(t) && stateTrig(t));
    if (hasState && !hasTrig) { const label = labelOf(c); statics.push({ cell: i, label, labelled: /static/i.test(label) }); }
  });
  return { items, statics };
}

/** Runs in the page: the specimen's state (attributes and geometry), in document coordinates. */
export function snap(ci: number): { attrs: string[]; rects: string[]; box: number[] } | null {
  const STATE = ["aria-expanded", "aria-pressed", "aria-checked", "aria-selected", "data-state", "data-collapsible", "data-orientation", "data-open"];
  const cell = document.querySelector("[data-cmc='" + ci + "']"); if (!cell) return null;
  const all = [cell, ...Array.from(cell.querySelectorAll("*"))].slice(0, 700);
  const attrs: string[] = []; const rects: string[] = [];
  all.forEach((el, i) => { for (const a of STATE) if (el.hasAttribute(a)) attrs.push(i + ":" + a + "=" + el.getAttribute(a)); const r = el.getBoundingClientRect(); rects.push([Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join(",")); });
  const r = cell.getBoundingClientRect();
  return { attrs, rects, box: [Math.round(r.left + scrollX), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)] };
}

/** Runs in the page: brings a trigger into view and returns its centre in viewport coordinates. */
export function place(k: number): number[] | null {
  const t = document.querySelector("[data-cmt='" + k + "']") as HTMLElement | null; if (!t) return null;
  t.scrollIntoView({ block: "center", inline: "nearest" });
  const r = t.getBoundingClientRect();
  return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width), Math.round(r.height)];
}

const diff = (a: string[], b: string[]) => {
  const ma = new Map(a.map((s) => [s.split(":")[0] + ":" + s.split(":")[1]?.split("=")[0], s]));
  const mb = new Map(b.map((s) => [s.split(":")[0] + ":" + s.split(":")[1]?.split("=")[0], s]));
  const out: string[] = [];
  for (const [key, va] of ma) { const vb = mb.get(key); if (vb === undefined) out.push(va + " -> (gone)"); else if (vb !== va) out.push(va.split("=")[0] + " " + va.split("=").slice(1).join("=") + " -> " + vb.split("=").slice(1).join("=")); }
  for (const [key, vb] of mb) if (!ma.has(key)) out.push("(new) " + vb);
  return out;
};

/** Runs in the page, after a trigger opened something: the items now visible, with their variant (menus, menubars, context menus). */
export function observeItems(): string[] {
  return Array.from(document.querySelectorAll('[data-slot$="-item"][data-variant]'))
    .filter((e) => (e as HTMLElement).getBoundingClientRect().width > 0)
    .map((e) => (e.textContent || "").trim().slice(0, 24) + " (variant=" + e.getAttribute("data-variant") + ")");
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const opt = (k: string, d = "") => { const i = argv.indexOf(k); return i >= 0 ? (argv[i + 1] ?? d) : d; };
  const dist = resolve(opt("--dist", "apps/bigface/dist"));
  const modes = opt("--modes", "light,dark").split(",");
  const outRoot = resolve(opt("--out", "plan-shots/click"));
  const server = serveDist(dist);
  const browser = await launchChrome(findChrome());
  const matrix: Record<string, unknown>[] = [];
  const key = async (page: Page, k: string) => {
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: k, windowsVirtualKeyCode: 27 });
    await page.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: 27 });
  };
  const shot = async (page: Page, box: number[], path: string) => {
    const m = 140; const x = Math.max(0, box[0]! - m), y = Math.max(0, box[1]! - m);
    const s = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x, y, width: box[2]! + 2 * m, height: box[3]! + 2 * m, scale: 1 } });
    writeFileSync(path, Buffer.from(s.data, "base64"));
  };
  try {
    for (const mode of modes) {
      const dir = join(outRoot, mode); mkdirSync(dir, { recursive: true });
      for (const id of STATE_SECTIONS) {
        const page = await openPage(browser, server.url + "/ui/business/", { width: 1440, height: 900, mode });
        await page.evaluate("(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 250)); return true; })()");
        const idx = await page.evaluate<Index>("(" + index.toString() + ")(" + JSON.stringify(id) + ")");
        if (idx.error) { matrix.push({ mode, section: id, frame: "-", trigger: "-", change: idx.error, verdict: "FAIL" }); await page.close(); continue; }
        for (const s of idx.statics) matrix.push({ mode, section: id, frame: s.label, trigger: "(none)", change: "state with no trigger", verdict: s.labelled ? "STATIC-LABELLED" : "FAIL" });
        for (const it of idx.items) {
          if (it.disabled) { matrix.push({ mode, section: id, frame: it.label, trigger: it.trigger, change: "disabled by design", verdict: "DISABLED" }); continue; }
          const at = await page.evaluate<number[] | null>("(" + place.toString() + ")(" + it.k + ")");
          if (!at) { matrix.push({ mode, section: id, frame: it.label, trigger: it.trigger, change: "trigger not found", verdict: "FAIL" }); continue; }
          await new Promise((r) => setTimeout(r, 180));
          const before = await page.evaluate<ReturnType<typeof snap>>("(" + snap.toString() + ")(" + it.cell + ")");
          const [x, y] = [at[0]!, at[1]!];
          const stem = join(dir, id + "-" + String(it.k).padStart(2, "0"));
          if (before) await shot(page, before.box, stem + "-before.png");
          await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
          if (it.mouse === "drag") {
            await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
            for (let i = 1; i <= 8; i++) await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + i * 6, y, button: "left" });
            await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + 48, y, button: "left", clickCount: 1 });
          } else {
            await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: it.mouse, clickCount: 1 });
            await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: it.mouse, clickCount: 1 });
          }
          await new Promise((r) => setTimeout(r, 520));
          const after = await page.evaluate<ReturnType<typeof snap>>("(" + snap.toString() + ")(" + it.cell + ")");
          if (after) await shot(page, after.box, stem + "-after.png");
          const changedAttrs = before && after ? diff(before.attrs, after.attrs) : ["(no specimen)"];
          let moved = 0; if (before && after) for (let i = 0; i < Math.min(before.rects.length, after.rects.length); i++) if (before.rects[i] !== after.rects[i]) moved++;
          const changed = changedAttrs.length > 0 || moved > 0;
          const items = after ? await page.evaluate<string[]>("(" + observeItems.toString() + ")()") : [];
          const what = changedAttrs.slice(0, 2).join("; ") + (moved ? (changedAttrs.length ? "; " : "") + moved + " element(s) moved" : "");
          matrix.push({ mode, section: id, frame: it.label, trigger: it.trigger + " [" + it.kind + "]", change: (changed ? what : "no state change") + (items.length ? " | items: " + items.join(", ") : ""), verdict: changed ? "PASS" : "FAIL", items });
          await key(page, "Escape");
          await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
          await new Promise((r) => setTimeout(r, 250));
        }
        await page.close();
      }
    }
  } finally { browser.stop(); server.stop(); }
  writeFileSync(join(outRoot, "matrix.json"), JSON.stringify(matrix, null, 1));
  const tally = (v: string) => matrix.filter((m) => m.verdict === v).length;
  for (const r of matrix) console.log([r.mode, r.section, r.frame, r.trigger, r.verdict, String(r.change).slice(0, 150)].join(" | "));
  console.log("\nPASS " + tally("PASS") + "  FAIL " + tally("FAIL") + "  STATIC-LABELLED " + tally("STATIC-LABELLED") + "  DISABLED " + tally("DISABLED"));
}
