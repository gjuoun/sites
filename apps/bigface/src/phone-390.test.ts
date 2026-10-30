import { beforeAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findChrome, measurePage } from "./panel-overflow.ts";

// The site at a phone width: 390x844 is the narrowest tier the pages were designed on. The page must
// fit: its main column inside the viewport, no horizontal scroll when the reader swipes, a visible
// headline, and the canvas it promises (the marketing pages are dark by design; the catalogue opens
// in its own default, light).
//
// The document's scrollWidth still exceeds the viewport on / and /palette/ by the same amount as the
// pre-migration build did (the syntax specimen's long lines inside its own scroller); the body clips
// that, so the user never scrolls sideways. This test pins what the reader experiences, and the
// baseline parity check keeps the clipped excess from growing into a layout change.
const siteDir = join(import.meta.dir, "..");
const dist = join(siteDir, "dist");
// Captures land in the temp dir; they are review evidence, not repository content.
const evidence = join(tmpdir(), "bigface-evidence");

interface Page {
  path: string;
  file: string;
  /** The canvas the page promises to open in. */
  canvas: string;
  /** Marketing pages carry the skip-link target; the catalogue's layout has its own main. */
  skipTarget: boolean;
}

const PAGES: Page[] = [
  { path: "/", file: "home-390.png", canvas: "rgb(37, 41, 37)", skipTarget: true },
  { path: "/palette/", file: "palette-390.png", canvas: "rgb(37, 41, 37)", skipTarget: true },
  { path: "/apps/pi/", file: "app-pi-390.png", canvas: "rgb(37, 41, 37)", skipTarget: true },
  { path: "/ui/business/", file: "ui-business-390.png", canvas: "rgb(248, 248, 240)", skipTarget: false },
];

// One expression, evaluated after the page is complete: the column's right edge, what a horizontal
// swipe does, the headline box, and the colours the theme actually painted.
const PROBE = [
  "(() => {",
  "  const main = document.querySelector('main');",
  "  const box = main ? main.getBoundingClientRect() : null;",
  "  const h1 = document.querySelector('h1');",
  "  const h1Box = h1 ? h1.getBoundingClientRect() : null;",
  "  window.scrollTo(1000, 0);",
  "  const scrollX = window.scrollX;",
  "  window.scrollTo(0, 0);",
  "  return {",
  "    cw: document.documentElement.clientWidth,",
  "    mainRight: box ? Math.round(box.right) : -1,",
  "    scrollX,",
  "    hasMain: !!box,",
  "    hasSkipTarget: !!document.getElementById('main'),",
  "    h1Visible: !!h1Box && h1Box.width > 40 && h1Box.height > 10,",
  "    canvas: getComputedStyle(document.body).backgroundColor,",
  "    mode: document.documentElement.dataset.mode,",
  "  };",
  "})()",
].join("\n");

interface Reading {
  cw: number;
  mainRight: number;
  scrollX: number;
  hasMain: boolean;
  hasSkipTarget: boolean;
  h1Visible: boolean;
  canvas: string;
  mode: string;
}

beforeAll(async () => {
  if (!existsSync(join(dist, "index.html")) || !existsSync(join(dist, "ui/business/index.html"))) {
    const build = Bun.spawn(["bun", "run", "build"], {
      cwd: siteDir,
      stdout: "ignore",
      stderr: "pipe",
    });
    if ((await build.exited) !== 0) {
      throw new Error("site build failed:\n" + (await new Response(build.stderr).text()));
    }
  }
  mkdirSync(evidence, { recursive: true });
}, 120_000);

for (const page of PAGES) {
  test.skipIf(!findChrome())(
    page.path + " holds at 390px: the column fits, a swipe does not scroll sideways, the headline shows",
    async () => {
      const m = await measurePage<Reading>(dist, page.path, 390, PROBE);
      expect(m.hasMain, "a main element").toBe(true);
      expect(m.mainRight, "main's right edge inside the viewport").toBeLessThanOrEqual(m.cw);
      expect(m.scrollX, "horizontal scroll after a 1000px swipe").toBe(0);
      expect(m.hasSkipTarget, "the skip-link target").toBe(page.skipTarget);
      expect(m.h1Visible, "headline box").toBe(true);
      expect(m.canvas, "the page's canvas").toBe(page.canvas);
      expect(m.mode, "the page's mode").toBe(page.path === "/ui/business/" ? "light" : "dark");
    },
    120_000,
  );
}

test.skipIf(!findChrome())("the 390px screenshots are captured for the four pages", async () => {
  const chrome = findChrome() as string;
  const server = Bun.serve({
    port: 0,
    fetch: async (req) => {
      const url = new URL(req.url);
      let file = join(dist, decodeURIComponent(url.pathname));
      if (url.pathname.endsWith("/")) file = join(file, "index.html");
      const f = Bun.file(file);
      return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
    },
  });
  try {
    for (const page of PAGES) {
      const out = join(evidence, page.file);
      rmSync(out, { force: true });
      const proc = Bun.spawn(
        [
          chrome,
          "--headless=new",
          "--disable-gpu",
          "--hide-scrollbars",
          "--virtual-time-budget=4000",
          "--window-size=390,844",
          "--screenshot=" + out,
          "http://127.0.0.1:" + server.port + page.path,
        ],
        { stdout: "ignore", stderr: "ignore" },
      );
      expect(await proc.exited, page.file).toBe(0);
      expect(existsSync(out), page.file).toBe(true);
      const png = readFileSync(out);
      expect(png.subarray(1, 4).toString(), page.file + " is a PNG").toBe("PNG");
      expect(png.length, page.file + " is a real capture").toBeGreaterThan(10_000);
    }
  } finally {
    server.stop(true);
  }
}, 120_000);
