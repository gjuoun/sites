"use client";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@gjuoun/bigface-ui/components/ui/toggle-group";
import { cn } from "@gjuoun/bigface-ui/lib/utils";
import { useTheme } from "../../hooks/use-theme.ts";

// Theme picker over the registry: adding a theme needs no change here, and the only prop is layout.
export interface BGThemeSwitcherProps {
	className?: string;
}

export function BGThemeSwitcher({ className }: BGThemeSwitcherProps) {
	const { theme, setTheme, themes } = useTheme();
	return (
		<ToggleGroup
			type="single"
			size="sm"
			variant="outline"
			value={theme}
			aria-label="Theme"
			data-slot="theme-switcher"
			className={cn("w-fit", className)}
			onValueChange={(next) => {
				if (typeof next === "string" && next) setTheme(next as typeof theme);
			}}
		>
			{themes.map((t) => (
				<ToggleGroupItem key={t.id} value={t.id} aria-label={t.label}>
					{t.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
