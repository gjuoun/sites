/**
 * Asset URLs that work at any Astro `base`.
 *
 * `import.meta.env.BASE_URL` always ends with a slash ("/" at the root), so the
 * old `${BASE_URL}/img/x.png` form produced `//img/x.png` — a protocol-relative
 * URL that silently resolved to https://img/x.png and rendered a broken image.
 * The site is deployed at the root of bundant.qqntt.com, so the prefix is empty;
 * compose through here instead of concatenating.
 */
export const basePath = import.meta.env.BASE_URL.replace(/\/+$/, "");

export function asset(path: string): string {
  return `${basePath}/${path.replace(/^\/+/, "")}`;
}
