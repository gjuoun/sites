import { z } from "zod";

/** The token shapes the Shape switch prices every plan at. Read from data/shapes.json. */
export const shapeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    cache_read_share_of_prompt: z.number().min(0).max(1),
    input_share_of_prompt: z.number().min(0).max(1),
    output_share_of_all: z.number().min(0).max(1),
  })
  .refine((s) => Math.abs(s.cache_read_share_of_prompt + s.input_share_of_prompt - 1) < 1e-9, "prompt shares must sum to 1");

export const shapesFileSchema = z.object({
  source: z.string().min(1),
  default: z.string().min(1),
  shapes: z.array(shapeSchema).min(1),
});
export type ShapeDef = z.infer<typeof shapeSchema>;

/** The mix blendedUsdPerB takes: output share of all tokens, cache-read share of prompt tokens, no cache writes. */
export function mixOf(s: ShapeDef): { output_share: number; cache_share: number; cache_write_share: number } {
  return { output_share: s.output_share_of_all, cache_share: s.cache_read_share_of_prompt, cache_write_share: 0 };
}
