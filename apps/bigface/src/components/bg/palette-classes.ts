// Literal Tailwind class names per palette colour. They are spelled out (not built from strings) so
// Tailwind's scanner sees every one; anything that colours text by palette name goes through here.
export const bgTextClass: Record<string, string> = {
  bg: "text-bf-bg",
  paper: "text-bf-paper",
  fg: "text-bf-fg",
  fgDim: "text-bf-fg-dim",
  border: "text-bf-border",
  highlight: "text-bf-highlight",
  blue: "text-bf-blue",
  lightBlue: "text-bf-light-blue",
  paleBlue: "text-bf-pale-blue",
  cyan: "text-bf-cyan",
  green: "text-bf-green",
  lime: "text-bf-lime",
  yellow: "text-bf-yellow",
  brightYellow: "text-bf-bright-yellow",
  burntOrange: "text-bf-burnt-orange",
  purple: "text-bf-purple",
};
