/** Prefix an internal path with the configured Astro base ('/', so this is a no-op prefix). */
export function withBase(path: string) {
  const base = import.meta.env.BASE_URL.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
