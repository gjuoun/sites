"use client";
import { cn } from "@gjuoun/bigface-business-ui/lib/utils";
import type * as React from "react";
import type { Mode, ThemeId } from "../../lib/themes.ts";

// A subtree with its own theme and (optionally) its own mode. The base classes are required: colour
// and font-family are inherited already-resolved from <html>, so without them the scope keeps the
// outer theme's ink; the attributes re-resolve every [data-theme] mapping inside.
export interface BGThemeScopeProps extends React.ComponentProps<"div"> {
	theme: ThemeId;
	mode?: Mode;
}

export function BGThemeScope({
	theme,
	mode,
	className,
	...props
}: BGThemeScopeProps) {
	return (
		<div
			data-theme={theme}
			data-mode={mode}
			data-slot="theme-scope"
			className={cn("bg-background font-sans text-foreground", className)}
			{...props}
		/>
	);
}
