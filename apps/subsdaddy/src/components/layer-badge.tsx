import { Badge } from "@gjuoun/bigface-shadcn-ui/components/ui/badge";

/** Every value on the page declares its layer: measured (our usage_logs), or (OpenRouter), or seed. */
export function LayerBadge({ layer }: { layer: "measured" | "or" | "seed" | "plan" | "window" }) {
  const label = { measured: "measured", or: "OR p50", seed: "seed", plan: "plan_spec", window: "window" }[layer];
  return (
    <Badge variant="outline" data-layer={layer}>
      {label}
    </Badge>
  );
}
