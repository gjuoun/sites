import { expect, test } from "bun:test";
import { findInklessBrightPlates, splitVariant } from "./ink-guard.ts";

test("a bright fill with the page's cream ink is flagged", () => {
  expect(
    findInklessBrightPlates('<button class="bg-bf-lime text-foreground">x</button>'),
  ).toHaveLength(1);
});

test("a state fill needs the ink under the same state", () => {
  expect(
    findInklessBrightPlates('<button class="bg-muted aria-pressed:bg-primary">x</button>'),
  ).toHaveLength(1);
  expect(
    findInklessBrightPlates(
      '<button class="bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground">x</button>',
    ),
  ).toEqual([]);
});

test("a bright gradient plate needs the ink too", () => {
  expect(
    findInklessBrightPlates(
      '<a class="bg-linear-135 from-bf-blue to-bf-light-blue text-foreground"></a>',
    ),
  ).toHaveLength(2);
  expect(
    findInklessBrightPlates(
      '<a class="bg-linear-135 from-bf-blue to-bf-light-blue text-ink-on-bright"></a>',
    ),
  ).toEqual([]);
});

test("an empty ::before dot has no text to ink, a ::before with text does", () => {
  expect(
    findInklessBrightPlates(
      "<p class=\"text-foreground before:bg-bf-blue before:content-['']\">x</p>",
    ),
  ).toEqual([]);
  expect(
    findInklessBrightPlates(
      "<p class=\"text-foreground before:bg-bf-blue before:content-['new']\">x</p>",
    ),
  ).toHaveLength(1);
});

test("gradient-clipped text is not a plate", () => {
  expect(
    findInklessBrightPlates(
      '<b class="bg-linear-120 from-bf-caret to-bf-blue bg-clip-text text-transparent">7</b>',
    ),
  ).toEqual([]);
});

test("translucent tints and paired fills are not flagged", () => {
  expect(findInklessBrightPlates('<i class="bg-bf-blue/20 text-foreground"></i>')).toEqual([]);
  expect(findInklessBrightPlates('<b class="bg-primary text-primary-foreground"></b>')).toEqual([]);
  expect(
    findInklessBrightPlates('<b class="bg-bf-lime text-ink-on-bright hover:bg-bf-lime"></b>'),
  ).toEqual([]);
});

test("variant split ignores colons inside arbitrary selectors", () => {
  expect(splitVariant("[&_svg:not([class*='size-'])]:size-4")).toEqual([
    "[&_svg:not([class*='size-'])]:",
    "size-4",
  ]);
  expect(splitVariant("hover:bg-primary")).toEqual(["hover:", "bg-primary"]);
});

// Added for the full native set (JW-237). The site is dark-only and shadcn marks its textless
// indicator parts with data-slot, so both have to be understood or a correct component fails.

test("a dark: fill and a dark: ink are the same state: normalised before matching", () => {
  expect(
    findInklessBrightPlates('<div class="dark:bg-primary dark:text-primary-foreground">x</div>'),
  ).toEqual([]);
  // the ink one state away is still missing
  expect(
    findInklessBrightPlates('<div class="dark:bg-primary text-foreground">x</div>'),
  ).toHaveLength(1);
});

test("a textless indicator slot is exempt: an indicator carries no text to ink", () => {
  expect(
    findInklessBrightPlates('<span data-slot="slider-range" class="bg-primary"></span>'),
  ).toEqual([]);
  expect(
    findInklessBrightPlates('<span data-slot="progress-indicator" class="bg-primary"></span>'),
  ).toEqual([]);
  // the same class on an ordinary element still needs the ink
  expect(findInklessBrightPlates('<div class="bg-primary"></div>')).toHaveLength(1);
});

test("the slot is read from the element's own tag, not a neighbour's", () => {
  expect(
    findInklessBrightPlates(
      '<div data-slot="slider-range"><span class="bg-primary">text</span></div>',
    ),
  ).toHaveLength(1);
});
