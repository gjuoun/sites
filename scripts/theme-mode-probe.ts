// Theme mode probe (JW-304). Serves a built dist, opens it in headless Chrome over the DevTools protocol with the mode
// set the way a user sets it (localStorage bigface-mode), and reads each token as its USED value.
//
// A custom property's computed value is the light-dark(...) source text, not a colour. So each token is painted onto a
// probe element and that element's computed background-colour is read. A `cls:` entry paints a real utility class instead.
//
//   bun run scripts/theme-mode-probe.ts --dist apps/bigface/dist --page /ui/business/ --widths 1440,390 \
//     --props --theme-bg,--theme-fg,cls:bg-input-veil --expect-file expects.txt [--dump] [--shot DIR]
//
// Expect lines: `<mode>@<width>:<prop>=<value>`; a value starting with `~` is a regular expression. Exit 1 on any miss.
// Chrome: CHROME_PATH, else the first installed candidate. The module exports the browser helpers that
// the before/after snapshot run uses, so both measure the same way.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome(): string {
  const found = process.env.CHROME_PATH || CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("no Chrome found: set CHROME_PATH");
  return found;
}

type Json = any;

/** A DevTools connection on one websocket; sessions are flattened onto it. */
class Cdp {
  private id = 0;
  private pending = new Map<number, { res: (v: Json) => void; rej: (e: Error) => void }>();
  private constructor(private ws: WebSocket) {
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data));
      const p = m.id !== undefined ? this.pending.get(m.id) : undefined;
      if (!p) return;
      this.pending.delete(m.id);
      if (m.error) p.rej(new Error(JSON.stringify(m.error))); else p.res(m.result);
    };
  }
  static connect(url: string): Promise<Cdp> {
    return new Promise((res, rej) => {
      const ws = new WebSocket(url);
      ws.onopen = () => res(new Cdp(ws));
      ws.onerror = () => rej(new Error("DevTools websocket failed: " + url));
    });
  }
  send(method: string, params: Json = {}, sessionId?: string): Promise<Json> {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => this.pending.set(id, { res, rej }));
  }
  close() { this.ws.close(); }
}

export interface Browser { cdp: Cdp; stop: () => void }

export async function launchChrome(chrome: string): Promise<Browser> {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "theme-probe-"));
  const proc: ChildProcess = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "about:blank",
  ], { stdio: "ignore" });
  const version = await retry(async () => (await fetch(`http://127.0.0.1:${port}/json/version`)).json(), 15000);
  const cdp = await Cdp.connect(version.webSocketDebuggerUrl);
  return {
    cdp,
    stop: () => { cdp.close(); proc.kill(); rmSync(profile, { recursive: true, force: true }); },
  };
}

export interface Page {
  send: (method: string, params?: Json) => Promise<Json>;
  evaluate: <T = Json>(expression: string) => Promise<T>;
  close: () => Promise<void>;
}

/** Opens url at width x height in the given mode (set in localStorage before the page's own scripts run). */
export async function openPage(b: Browser, url: string, o: { width: number; height: number; mode: string }): Promise<Page> {
  const { targetId } = await b.cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await b.cdp.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method: string, params: Json = {}) => b.cdp.send(method, params, sessionId);
  const evaluate = async <T = Json>(expression: string): Promise<T> => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error("page script failed: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result.value as T;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: o.width, height: o.height, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `try { localStorage.setItem("bigface-mode", ${JSON.stringify(o.mode)}); } catch (e) {}`,
  });
  await send("Page.navigate", { url });
  await retry(async () => (await evaluate<string>("document.readyState")) === "complete" || (() => { throw new Error("loading"); })(), 20000);
  await new Promise((r) => setTimeout(r, 600));
  return { send, evaluate, close: async () => { await b.cdp.send("Target.closeTarget", { targetId }); } };
}

/** Turns off animation and transition so two captures of the same state are comparable. Injected, not in the DOM snapshot. */
export const QUIET_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";

/** Reads each prop as the used value: a probe element is painted with the token and its computed background is read. */
export function readUsed(page: Page, props: string[]): Promise<Record<string, string>> {
  const expression = `(${(ps: string[]) => {
    const out: Record<string, string> = {};
    for (const p of ps) {
      const el = document.createElement("div");
      if (p.startsWith("cls:")) el.className = p.slice(4); else el.style.backgroundColor = `var(${p})`;
      document.body.appendChild(el);
      out[p] = getComputedStyle(el).backgroundColor;
      el.remove();
    }
    return out;
  }})(${JSON.stringify(props)})`;
  return page.evaluate(expression);
}

const SNAP_PROPS = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "fill", "stroke", "box-shadow", "text-decoration-color", "caret-color"];

export interface Snapshot {
  /** One line per element: tag, sorted attributes except class, own text. */
  structure: string[];
  /** The class attribute per element, same order as structure. */
  classes: string[];
  /** Computed colour-bearing properties per element, same order. */
  styles: string[];
  /** Border-box geometry per element, rounded to 0.5px, same order. */
  rects: string[];
  mode: string | null;
}

/** Snapshots the rendered page: structure, classes, computed colours and geometry, element by element. */
export function snapshot(page: Page): Promise<Snapshot> {
  const expression = `(${(props: string[]) => {
    const structure: string[] = [], classes: string[] = [], styles: string[] = [], rects: string[] = [];
    const els = [document.documentElement, ...document.querySelectorAll("body, body *")];
    for (const el of els) {
      if (el.hasAttribute("data-probe")) continue;
      const attrs = [...el.attributes].filter((a) => a.name !== "class").map((a) => a.name + "=" + a.value).sort().join(" ");
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => (n.textContent ?? "").trim()).filter(Boolean).join(" ");
      const tag = el.tagName.toLowerCase();
      const body = tag === "script" || tag === "style" ? "len=" + (el.textContent ?? "").length : own;
      structure.push(tag + " [" + attrs + "] " + body);
      classes.push(el.getAttribute("class") ?? "");
      const cs = getComputedStyle(el);
      styles.push(props.map((p) => cs.getPropertyValue(p)).join("|"));
      const r = el.getBoundingClientRect();
      const q = (v: number) => Math.round(v * 2) / 2;
      rects.push([q(r.x), q(r.y), q(r.width), q(r.height)].join(","));
    }
    return { structure, classes, styles, rects, mode: document.documentElement.getAttribute("data-mode") };
  }})(${JSON.stringify(SNAP_PROPS)})`;
  return page.evaluate<Snapshot>(expression);
}

/** Full-page PNG at device scale 1, after QUIET_CSS is applied. */
export async function fullPagePng(page: Page): Promise<Buffer> {
  await page.evaluate(`(() => { const s = document.createElement("style"); s.setAttribute("data-probe", ""); s.textContent = ${JSON.stringify(QUIET_CSS)}; document.head.appendChild(s); })()`);
  await new Promise((r) => setTimeout(r, 250));
  const height = await page.evaluate<number>("Math.max(document.documentElement.scrollHeight, innerHeight)");
  const width = await page.evaluate<number>("innerWidth");
  const shot = await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
  return Buffer.from(shot.data, "base64");
}

/** Serves a built dist directory on a free localhost port. */
export function serveDist(dist: string): { url: string; stop: () => void } {
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = Bun.file(join(dist, p));
      return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
    },
  });
  return { url: `http://localhost:${server.port}`, stop: () => server.stop(true) };
}

function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, () => { const port = (s.address() as { port: number }).port; s.close(() => res(port)); });
    s.on("error", rej);
  });
}

async function retry<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  const end = Date.now() + ms;
  let last: unknown;
  while (Date.now() < end) {
    try { return await fn(); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 150)); }
  }
  throw last instanceof Error ? last : new Error("timed out");
}

// ---- CLI ---------------------------------------------------------------------------------------------

if (import.meta.main) {
  const a = Bun.argv.slice(2);
  const opt = (k: string, d = "") => { const i = a.indexOf(k); return i >= 0 ? (a[i + 1] ?? d) : d; };
  const all = (k: string) => a.flatMap((x, i) => (x === k ? [a[i + 1] as string] : []));
  const dist = resolve(opt("--dist"));
  const pagePath = opt("--page", "/");
  const props = opt("--props").split(",").filter(Boolean);
  const widths = [...new Set(opt("--widths", "1440").split(",").map(Number))];
  const shotDir = opt("--shot");
  const dump = a.includes("--dump");
  const fileLines = opt("--expect-file") ? readFileSync(opt("--expect-file"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")) : [];
  const expects = [...all("--expect"), ...fileLines].map((e) => {
    const m = /^(\w+)@(\d+):((?:--|cls:)[\w\/-]+)=(.*)$/.exec(e);
    if (!m) throw new Error("bad expect: " + e);
    return { mode: m[1]!, width: Number(m[2]), prop: m[3]!, want: m[4]! };
  });
  if (!existsSync(dist)) throw new Error("no dist at " + dist);
  if (shotDir) mkdirSync(shotDir, { recursive: true });
  const server = serveDist(dist);
  const browser = await launchChrome(findChrome());
  const got = new Map<string, string>();
  try {
    for (const mode of [...new Set(expects.map((e) => e.mode))]) for (const width of widths) {
      const page = await openPage(browser, server.url + pagePath, { width, height: 900, mode });
      const r = await readUsed(page, props);
      const seen = await page.evaluate<string | null>("document.documentElement.getAttribute('data-mode')");
      got.set(`${mode}@${width}:__mode`, seen ?? "");
      for (const p of props) got.set(`${mode}@${width}:${p}`, r[p] ?? "");
      if (shotDir) writeFileSync(join(shotDir, `${mode}-${width}.png`), await fullPagePng(page));
      await page.close();
    }
  } finally {
    browser.stop();
    server.stop();
  }
  if (dump) for (const [k, v] of got) console.log(`DUMP ${k} = ${v}`);
  let fail = 0;
  for (const e of expects) {
    const key = `${e.mode}@${e.width}:${e.prop}`;
    const v = got.get(key) ?? "<unread>";
    const mode = got.get(`${e.mode}@${e.width}:__mode`);
    const ok = mode === e.mode && (e.want.startsWith("~") ? new RegExp(e.want.slice(1)).test(v) : v === e.want);
    if (!ok) { fail++; console.log(`FAIL ${key}: got ${v} (data-mode=${mode}) want ${e.want}`); }
  }
  if (fail) { console.log(`PROBE FAIL ${fail}/${expects.length}`); process.exit(1); }
  console.log(`PROBE OK n=${expects.length}`);
}
