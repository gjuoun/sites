import { expect, test } from "bun:test";
import palette from "@gjuoun/bigface-tokens/palette.json";
import {
  findForeignInCss,
  findForeignInHtml,
  paletteHexes,
  ringOffsetOffenders,
} from "./color-guard.ts";

const known = paletteHexes(palette);

// Fixtures are taken from what Tailwind v4 + shadcn (radix-nova, neutral) actually shipped in the
// 2026-10-20 probe (plan: shadcn-tailwind-rewrite).

test("oklch greys from shadcn's neutral baseColor are rejected", () => {
  expect(findForeignInCss(":root{--background:oklch(.205 0 0)}", known)).toEqual([
    "oklch(.205 0 0)",
  ]);
  expect(findForeignInCss(".x{color:oklch(57.7% .245 27.325)}", known)).toHaveLength(1);
});

test("Tailwind's black and white are accepted at any alpha: stock shadows, overlays and thumb", () => {
  expect(
    findForeignInCss(".s{--tw-shadow:0 1px 3px 0 var(--tw-shadow-color,#0000001a)}", known),
  ).toEqual([]);
  expect(findForeignInCss(".o{background-color:#0000001a;color:#fff;fill:rgb(0 0 0/.1)}", known)).toEqual([]);
  expect(findForeignInCss(".n{color:black;background:white}", known)).toEqual([]);
});

test("short hex is expanded: #000 is black; #333 (a neutral the collapse removed) is rejected", () => {
  expect(findForeignInCss(".a{color:#000}", known)).toEqual([]);
  // The neutral collapse removed #333333: the expansion is checked against the palette, so #333 is foreign now.
  expect(findForeignInCss(".a{color:#333}", known)).toEqual(["#333"]);
});

test("alpha-zero hex (Tailwind's transparent) is accepted", () => {
  expect(findForeignInCss(".a{background-color:#0000;box-shadow:0 0 #00000000}", known)).toEqual(
    [],
  );
});

test("feature queries inside @supports are accepted", () => {
  const css =
    "@supports (color:color-mix(in lab, red, red)){.b{color:var(--x)}}" +
    "@supports ((-webkit-hyphens:none) and (not (color:rgb(from red r g b)))){:root{--y:0}}";
  expect(findForeignInCss(css, known)).toEqual([]);
});

test("a named colour in a declaration is rejected, but not in property names or variables", () => {
  expect(findForeignInCss(".r{color: red}", known)).toEqual(["color: red"]);
  expect(findForeignInCss(".w{white-space:nowrap;color:var(--color-red)}", known)).toEqual([]);
  expect(findForeignInCss(".t{background:transparent;color:currentcolor}", known)).toEqual([]);
});

test("mask layers only read alpha, so their colours are accepted", () => {
  const css =
    ".m{mask-image:linear-gradient(90deg,#0000,#000 8% 92%,#0000);-webkit-mask-image:linear-gradient(#000 0 0)}";
  expect(findForeignInCss(css, known)).toEqual([]);
  expect(findForeignInCss(".m{mask-image:none;box-shadow:0 30px 60px -40px #333}", known)).toEqual([
    "#333",
  ]);
});

test("#fff is accepted, as Tailwind's ring-offset initial value and as white", () => {
  const ok =
    '@property --tw-ring-offset-color{syntax:"*";inherits:false;initial-value:#fff}' +
    "*{--tw-ring-offset-color:#fff}";
  expect(findForeignInCss(ok, known)).toEqual([]);
  expect(findForeignInCss(".b{background:#fff}", known)).toEqual([]);
});

test("palette hex in any length/case and palette rgb triples are accepted", () => {
  expect(
    findForeignInCss(".a{color:#00B0FF;border-color:#00b0ff80;fill:rgba(0, 176, 255, .5)}", known),
  ).toEqual([]);
  expect(findForeignInCss(".a{color:rgba(5,13,27,.4)}", known)).toEqual(["rgb(5,13,27)"]);
});

test("HTML: style attributes and <style> blocks are scanned, URL fragments are not colours", () => {
  const html =
    '<a href="#add">x</a><html style="--bf-bg:#252925;--x:oklch(1 0 0)"><style>.q{color:#123456}</style>' +
    '<svg fill="#252925"></svg><i data-x="#abcdef"></i>';
  expect(findForeignInHtml(html, known)).toEqual(["#123456", "oklch(1 0 0)", "#abcdef"]);
});

// Added for the full native set (JW-237). Each case is forced by one registry file; the narrowing
// is the smallest one that keeps a non-palette colour from shipping.

test("scroll-fade custom properties feed a mask, so their colours are accepted", () => {
  const css = ".f{--scroll-fade-x:linear-gradient(90deg,#123456,#123456)}";
  expect(findForeignInCss(css, known)).toEqual([]);
  // the same colour painted directly is still rejected
  expect(findForeignInCss(".f{background-color:#123456}", known)).toEqual(["#123456"]);
});

test("the dead Canvas/CanvasText rules are dropped, the same names elsewhere are not", () => {
  const css = ".bg-\\[Canvas\\]{background-color:Canvas}.text-\\[CanvasText\\]{color:CanvasText}";
  expect(findForeignInCss(css, known)).toEqual([]);
  expect(findForeignInCss(".x{color:Canvas;border-color:CanvasText}", known)).toHaveLength(2);
});

test("<noscript> fallbacks are not painted in a JS browser; outside them the same rule fails", () => {
  const inside = "<noscript><style>.q{color:#123456;background:#000}</style></noscript>";
  expect(findForeignInHtml(inside, known)).toEqual([]);
  expect(findForeignInHtml("<style>.q{color:#123456}</style>", known)).toEqual(["#123456"]);
});

// resizable.tsx ships ring-offset-background; the #fff initial value must still never paint.

test("a ring-offset on a palette-mapped semantic token is allowed", () => {
  expect(
    ringOffsetOffenders(".ring-offset-background{--tw-ring-offset-color:var(--background)}"),
  ).toEqual([]);
});

test("ring-offset-white and an arbitrary ring-offset value fail", () => {
  expect(ringOffsetOffenders(".ring-offset-white{--tw-ring-offset-color:#fff}")).toEqual([
    "ring-offset-white",
  ]);
  expect(ringOffsetOffenders(".ring-offset-\\[3px\\]{--tw-ring-offset-width:3px}")).toEqual([
    "ring-offset-[3px]",
  ]);
});

test("a bare ring-offset width fails: it would pair with the #fff default", () => {
  expect(ringOffsetOffenders(".ring-offset-2{--tw-ring-offset-width:2px}")).toEqual([
    "ring-offset-2",
  ]);
});

// attachment.tsx and trace.tsx ship the shimmer's fallback highlight as a relative colour whose
// base is the element's own text colour. Jun: A, 2026-10-21.

test("relative colours pass only on a palette var or the element's own colour", () => {
  const css =
    ".a{--_highlight:oklch(from currentColor l c h / calc(alpha * .2))}" +
    ".b{color:oklch(from var(--bf-blue) 0.7 c h)}";
  expect(findForeignInCss(css, known)).toEqual([]);
  // not relative: an invented grey is still an invented grey
  expect(findForeignInCss(".c{color:oklch(.2 0 0)}", known)).toHaveLength(1);
  // relative on a literal base: the literal is still caught, and so is the relative call
  expect(findForeignInCss(".d{color:oklch(from #123456 l c h)}", known)).toContain("#123456");
});
