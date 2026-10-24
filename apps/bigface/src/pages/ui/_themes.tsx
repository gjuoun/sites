import { BGModeSwitcher } from "@gjuoun/bigface-ui/components/bg/mode-switcher";
import { BGThemeScope } from "@gjuoun/bigface-ui/components/bg/theme-scope";
import { BGThemeSwitcher } from "@gjuoun/bigface-ui/components/bg/theme-switcher";
import { Badge } from "@gjuoun/bigface-ui/components/ui/badge";
import { Button } from "@gjuoun/bigface-ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-ui/components/ui/card";
import { Input } from "@gjuoun/bigface-ui/components/ui/input";
import { Switch } from "@gjuoun/bigface-ui/components/ui/switch";
import { MODES, THEMES } from "@gjuoun/bigface-ui/lib/themes";

// The same small primitive set inside every theme x mode scope: the cheapest honest way to see what a
// theme does — surfaces, ink, primary plate, tints, borders and the focus ring, side by side.
// No h-full on the card: inside a padded panel that also holds a label, height:100% is measured
// against the panel's content box and the card then overflows by exactly the label's height (44.5px
// below the panel, measured). The panel is a flex column instead, and the card grows into what is
// left — flex-1 on a min-w-0 child, so a long word can never widen the panel either.
function Panel() {
	return (
		<Card className="min-w-0 flex-1">
			<CardHeader>
				<CardTitle className="text-base">Rewards</CardTitle>
				<CardDescription>Claim 250 coins for today's streak.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3">
				<div className="flex flex-wrap items-center gap-2">
					<Button size="sm">Claim</Button>
					<Button size="sm" variant="secondary">
						Later
					</Button>
					<Button size="sm" variant="outline">
						Details
					</Button>
					<Badge variant="secondary">Live</Badge>
				</div>
				<Input placeholder="Search offers" />
				<label className="flex items-center gap-2 text-sm">
					<Switch defaultChecked /> Email me new offers
				</label>
			</CardContent>
		</Card>
	);
}

/** Six scopes, no client JS: the matrix is static markup, only the switchers hydrate. */
export function ThemeMatrix() {
	return (
		<div className="grid min-w-0 gap-4 md:grid-cols-2">
			{THEMES.flatMap((theme) =>
				MODES.map((mode) => (
					<BGThemeScope
						key={theme.id + "-" + mode}
						theme={theme.id}
						mode={mode}
						className="flex min-w-0 flex-col gap-3 rounded-[16px] border border-bf-border p-4 text-foreground"
					>
						<div className="min-w-0">
							<p className="m-0 font-code text-[0.74rem] tracking-[0.06em] uppercase text-bf-fg-muted">
								{theme.id} · {mode}
							</p>
							<p className="m-0 mt-1 text-[0.78rem] leading-snug text-bf-fg-muted">
								{theme.purpose}
							</p>
						</div>
						<Panel />
					</BGThemeScope>
				)),
			)}
		</div>
	);
}

/** The live controls: switching writes data-theme/data-mode on <html>, so the whole page follows. */
export function ThemeControls() {
	return (
		<div className="flex flex-wrap items-center gap-3">
			<BGThemeSwitcher />
			<BGModeSwitcher />
			<span className="font-code text-[0.72rem] text-bf-fg-muted">
				the page itself switches; each panel above keeps its own pair
			</span>
		</div>
	);
}
