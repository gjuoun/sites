// Bright plates must carry dark ink.
//
// Two bugs of this shape shipped before Tailwind: cream text on lime swatches (1.2:1) and on the
// selected filter chip (1.7:1). With utility classes the fill and the ink are separate tokens, so the
// check is per element: every opaque bright fill class needs an ink class under the same variant
// (or an unconditional one).

const BRIGHT = new Set([
  "primary",
  "bf-blue",
  "bf-light-blue",
  "bf-pale-blue",
  "bf-cyan",
  "bf-lime",
  "bf-yellow",
  "bf-bright-yellow",
  "bf-ansi-blue",
  "bf-ansi-bright-blue",
  "bf-ansi-cyan",
  "bf-ansi-bright-cyan",
  "bf-ansi-bright-green",
  "bf-ansi-yellow",
  "bf-ansi-bright-yellow",
]);
const INK = new Set(["text-primary-foreground", "text-ink-on-bright"]);

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
    const tokens = (m[1] as string).split(/\s+/).filter(Boolean).map(splitVariant);
    // The site is permanently dark (`<html class="dark">` is static), so a `dark:`-prefixed
    // variant is the same state as the un-prefixed one: normalise it away before matching.
    const norm = (v: string) => v.replace(/(^|:)dark:/g, "$1");
    const inks = new Set(tokens.filter(([, u]) => INK.has(u)).map(([v]) => norm(v)));
    // a ::before/::after with empty content is a decorative dot or rim: there is no text to ink
    // a gradient clipped to the text is the text's own paint, not a plate behind it
    if (tokens.some(([v, u]) => v === "" && u === "bg-clip-text")) continue;
    const empty = new Set(tokens.filter(([, u]) => u === "content-['']").map(([v]) => v));
    for (const [variant, utility] of tokens) {
      // a solid fill (bg-x) or a gradient stop (from-x / via-x / to-x) of a bright colour
      const fill = /^(?:bg|from|via|to)-(.+)$/.exec(utility)?.[1];
      if (!fill || !BRIGHT.has(fill)) continue; // bg-x/20 (translucent tint) never matches
      if (/(?:^|:)(?:before|after):$/.test(variant) && empty.has(variant)) continue;
      const v = norm(variant);
      if (!inks.has(v) && !inks.has("")) offenders.push(m[1] as string);
    }
  }
  return offenders;
}

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
