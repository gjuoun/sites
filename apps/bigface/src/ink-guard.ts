// Bright plates must carry dark ink.
//
// Two bugs of this shape shipped before Tailwind: cream text on lime swatches (1.2:1) and on the
// selected filter chip (1.7:1). With utility classes the fill and the ink are separate tokens, so the
// check is per element: every opaque bright fill class needs an ink class under the same variant
// (or an unconditional one).

// The business theme's bright fills: the primary plate, the chart ramp the accents live on, and the
// theme's one yellow. The ink on all of them is the canvas colour (--primary-foreground).
const BRIGHT = new Set([
  "primary",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "yellow",
]);
const INK = new Set(["text-primary-foreground", "text-background"]);

/** Split "hover:aria-pressed:bg-primary" into ["hover:aria-pressed:", "bg-primary"], bracket-aware. */
export const splitVariant = (token: string): [string, string] => {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < token.length; i++) {
    const c = token[i];
    if (c === "[" || c === "(") depth++;
    else if (c === "]" || c === ")") depth--;
    else if (c === ":" && depth === 0) cut = i;
  }
  return [token.slice(0, cut + 1), token.slice(cut + 1).replace(/^!|!$/g, "")];
};

/** Elements (by class string) that paint an opaque bright fill without the dark ink. */
export function findInklessBrightPlates(html: string): string[] {
  const offenders: string[] = [];
  for (const m of html.matchAll(/\sclass(?:Name)?="([^"]*)"/g)) {
    const at = m.index ?? 0;
    // The element's own tag carries its data-slot: shadcn marks indicator/track/thumb parts with
    // it. Those parts hold no text — the ink rule protects text, and a filled dot or track has
    // none — so they are exempt. Everything else must still pair fill with ink.
    const slot = /data-slot="([\w-]+)"/.exec(tagAt(html, at))?.[1] ?? "";
    if (TEXTLESS.has(slot)) continue;
    // An empty phrasing element paints no text: the status dot in a card, the traffic lights in the
    // fake window. It cannot carry an ink, so it is exempt. A dot that holds text still needs one.
    if (emptyPhrasing(html, at)) continue;
    const tokens = (m[1] as string).split(/\s+/).filter(Boolean).map(splitVariant);
    // A fill and its ink share the same variant string. A stock dark: fill (dark:data-checked:bg-primary)
    // repeats a light fill in dark mode, so the ink of the same variant without dark: covers it.
    const inks = new Set(tokens.filter(([, u]) => INK.has(u)).map(([v]) => v));
    // a ::before/::after with empty content is a decorative dot or rim: there is no text to ink
    // a gradient clipped to the text is the text's own paint, not a plate behind it
    if (tokens.some(([v, u]) => v === "" && u === "bg-clip-text")) continue;
    const empty = new Set(tokens.filter(([, u]) => u === "content-['']").map(([v]) => v));
    for (const [variant, utility] of tokens) {
      // a solid fill (bg-x) or a gradient stop (from-x / via-x / to-x) of a bright colour
      const fill = /^(?:bg|from|via|to)-(.+)$/.exec(utility)?.[1];
      if (!fill || !BRIGHT.has(fill)) continue; // bg-x/20 (translucent tint) never matches
      if (/(?:^|:)(?:before|after):$/.test(variant) && empty.has(variant)) continue;
      const light = variant.replace(/(^|:)dark:/, "$1");
      if (!inks.has(variant) && !inks.has(light) && !inks.has("")) offenders.push(m[1] as string);
    }
  }
  return offenders;
}

/** True for an <i>/<span> with nothing between its tags: a decorative dot, not a plate. */
const emptyPhrasing = (html: string, at: number): boolean => {
  const start = html.lastIndexOf("<", at);
  const tag = /^<([a-zA-Z][\w-]*)/.exec(html.slice(start))?.[1] ?? "";
  if (tag !== "i" && tag !== "span") return false;
  const open = html.indexOf(">", at);
  if (open === -1) return false;
  if (html[open - 1] === "/") return true;
  const next = html.indexOf("<", open + 1);
  if (next === -1) return false;
  return html.slice(open + 1, next).trim() === "" && html.startsWith("</" + tag, next);
};

/** The opening tag that contains `at`, quoted attribute values included. */
const tagAt = (html: string, at: number): string => {
  const start = html.lastIndexOf("<", at);
  if (start === -1) return "";
  let quote = "";
  for (let i = at; i < html.length; i++) {
    const c = html[i] as string;
    if (quote) {
      if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === ">") return html.slice(start, i + 1);
  }
  return html.slice(start);
};

/** shadcn slots that are pure indicators/tracks/thumbs — no text ever sits inside them. */
const TEXTLESS = new Set([
  "progress-indicator",
  "slider-range",
  "radio-group-item",
  "radio-group-indicator",
  "switch",
  "switch-thumb",
]);
