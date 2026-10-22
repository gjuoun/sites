import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { BGBadge } from "./badge.tsx";
import { BGButton } from "./button.tsx";
import { BGCard } from "./card.tsx";

const classes = (html: string) => (/class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");

test("BGButton tone=glow paints the blue plate with dark ink and drops shadcn's bg-primary", () => {
  const c = classes(renderToStaticMarkup(<BGButton tone="glow">Install</BGButton>));
  expect(c).toContain("from-bf-blue");
  expect(c).toContain("text-ink-on-bright");
  expect(c).not.toContain("bg-primary");
  expect(c).not.toContain("text-primary-foreground");
});

test("BGButton href renders a link, keeps data-* attributes and shadcn's slot", () => {
  const html = renderToStaticMarkup(
    <BGButton tone="ghost" href="/palette/" data-x="1">
      See
    </BGButton>,
  );
  expect(html).toMatch(/^<a /);
  expect(html).toContain('href="/palette/"');
  expect(html).toContain('data-slot="button"');
  expect(html).toContain('data-x="1"');
});

test("BGButton tone=chip fills only when pressed, with the dark ink", () => {
  const c = classes(
    renderToStaticMarkup(
      <BGButton tone="chip" aria-pressed="true">
        All
      </BGButton>,
    ),
  );
  expect(c).toContain("aria-pressed:bg-bf-blue");
  expect(c).toContain("aria-pressed:text-ink-on-bright");
});

test("BGButton without a tone is plain shadcn", () => {
  const c = classes(renderToStaticMarkup(<BGButton>x</BGButton>));
  expect(c).toContain("bg-primary");
  expect(c).toContain("text-primary-foreground");
});

test("BGBadge tone=tool is the green pill", () => {
  const c = classes(renderToStaticMarkup(<BGBadge tone="tool">tool</BGBadge>));
  expect(c).toContain("text-bf-green");
  expect(c).not.toContain("bg-primary");
});

test("BGCard tone=plate + glow keeps shadcn's data-slot", () => {
  const html = renderToStaticMarkup(
    <BGCard tone="plate" glow>
      x
    </BGCard>,
  );
  expect(html).toContain('data-slot="card"');
  expect(classes(html)).toContain("before:from-bf-blue/55");
});
