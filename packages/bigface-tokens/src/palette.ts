// The `Palette` type, and nothing else.
//
// bigface-theme/src/palette.ts infers this type from a zod schema, because that file's job is to
// validate the JSON. The site only needs the shape, and pulling zod in to get it would be a
// dependency the site never uses. This declaration mirrors the zod-inferred type exactly
// (`PaletteSchema` in bigface-theme/src/palette.ts); if the schema grows a field, this must too.

export interface Color {
  hex: string;
  /** `jetbrains:<OPTION>#<FIELD>` | `jetbrains:colors#<KEY>` | `alias:<colour>` */
  source: string;
}

export interface Palette {
  name: string;
  appearance: string;
  colors: Record<string, Color>;
  ansi: Record<string, Color>;
  syntax: Record<string, string>;
}
