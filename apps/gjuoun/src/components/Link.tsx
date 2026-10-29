import { cn } from "cn";
import type * as React from "react";

// Text links. "plain" is the site chrome (footer); "content" is a link inside the page content, heavier and tinted
// on hover so it reads as interactive. Both use the theme ink, a primary underline and the visible focus outline.
const BASE =
	"text-foreground underline decoration-primary decoration-2 underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-foreground";
const CONTENT = "font-semibold decoration-[3px] hover:bg-accent";

export function Link({
	variant = "content",
	className,
	...props
}: React.ComponentProps<"a"> & { variant?: "plain" | "content" }) {
	return (
		<a
			className={cn(BASE, variant === "content" && CONTENT, className)}
			{...props}
		/>
	);
}
