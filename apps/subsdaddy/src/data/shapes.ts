import { z } from "zod";

/**
 * A token shape the Shape switch prices every plan at (data/shapes.json). A disabled shape is data only:
 * it has no values yet and is not offered in the UI (the local collector's shape is one of these).
 */
export const shapeSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    enabled: z.boolean(),
    cache_read_share_of_prompt: z.number().min(0).max(1).nullable(),
    input_share_of_prompt: z.number().min(0).max(1).nullable(),
    output_share_of_all: z.number().min(0).max(1).nullable(),
    source: z.string().min(1).optional(),
  })
  .superRefine((s, ctx) => {
    if (!s.enabled) return;
    if (s.cache_read_share_of_prompt === null || s.input_share_of_prompt === null || s.output_share_of_all === null) {
      ctx.addIssue({ code: "custom", message: "an enabled shape needs its three shares" });
    } else if (Math.abs(s.cache_read_share_of_prompt + s.input_share_of_prompt - 1) > 1e-9) {
      ctx.addIssue({ code: "custom", message: "prompt shares must sum to 1" });
    }
  });

export const shapesFileSchema = z.object({
  source: z.string().min(1),
  default: z.string().min(1),
  shapes: z.array(shapeSchema).min(1),
});
export type ShapeDef = z.infer<typeof shapeSchema>;

/** The mix blendedUsdPerB takes: output share of all tokens, cache-read share of prompt tokens, no cache writes. */
export function mixOf(s: ShapeDef): { output_share: number; cache_share: number; cache_write_share: number } {
  return { output_share: s.output_share_of_all ?? 0, cache_share: s.cache_read_share_of_prompt ?? 0, cache_write_share: 0 };
}
