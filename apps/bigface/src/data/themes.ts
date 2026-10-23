// Generated theme files, read at build time so the page shows exactly what is downloadable.
const files = import.meta.glob("../../../../packages/bigface-tokens/themes/**/*", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function themeFile(id: string, path: string): string {
  const key = `../../../../packages/bigface-tokens/themes/${id}/${path}`;
  const text = files[key];
  if (text === undefined) throw new Error(`missing theme file ${id}/${path}`);
  return text;
}

export const themeFilePaths = (): string[] =>
  Object.keys(files).map((k) => k.replace("../../../../packages/bigface-tokens/themes/", ""));
