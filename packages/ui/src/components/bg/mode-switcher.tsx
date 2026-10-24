"use client";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@gjuoun/bigface-ui/components/ui/toggle-group";
import { cn } from "@gjuoun/bigface-ui/lib/utils";
import { useMode } from "../../hooks/use-theme.ts";

// Light/dark over useMode: writes data-mode on <html> and the storage key the init script reads.
export interface BGModeSwitcherProps {
	className?: string;
}

export function BGModeSwitcher({ className }: BGModeSwitcherProps) {
	const { mode, setMode, modes } = useMode();
	return (
		<ToggleGroup
			type="single"
			size="sm"
			variant="outline"
			value={mode}
			aria-label="Colour mode"
			data-slot="mode-switcher"
			className={cn("w-fit", className)}
			onValueChange={(next) => {
				if (next === "light" || next === "dark") setMode(next);
			}}
		>
			{modes.map((m) => (
				<ToggleGroupItem key={m} value={m} aria-label={m}>
					{m === "light" ? "Light" : "Dark"}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
