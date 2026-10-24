import { BGModeSwitcher } from "@gjuoun/bigface-ui/components/bg/mode-switcher";
import { BGThemeScope } from "@gjuoun/bigface-ui/components/bg/theme-scope";
import { BGThemeSwitcher } from "@gjuoun/bigface-ui/components/bg/theme-switcher";
import { BGButton } from "@gjuoun/bigface-ui/components/bg/button";
import { Badge } from "@gjuoun/bigface-ui/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@gjuoun/bigface-ui/components/ui/card";
import { Input } from "@gjuoun/bigface-ui/components/ui/input";
import { Switch } from "@gjuoun/bigface-ui/components/ui/switch";
import { MODES, THEMES } from "@gjuoun/bigface-ui/lib/themes";

// The six panels share one colour system and differ only in feel. Everything below therefore uses the
// theme's own tokens for spacing, type, radius, elevation and motion — text-sm, p-4, gap-3, rounded-lg,
// shadow-sm and the BG buttons' press all read --theme-*, so the same markup is airy, dense or bold
// depending on the scope it sits in. No colour is chosen here: the palette does that.
function Panel() {
	return (
		<Card className="min-w-0 flex-1 gap-3 rounded-lg p-4 shadow-sm">
			<CardHeader className="gap-1 p-0">
				<CardTitle className="text-lg">Rewards</CardTitle>
				<CardDescription className="text-sm">
					Claim 250 coins for today&rsquo;s streak.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 p-0">
				<div className="flex flex-wrap items-center gap-2">
					<BGButton tone="glow">Claim</BGButton>
					<BGButton tone="ghost">Later</BGButton>
					<Badge variant="secondary" className="text-xs">
						Live
					</Badge>
				</div>
				<Input placeholder="Search offers" className="text-sm" />
				<label className="flex items-center gap-2 text-sm">
					<Switch defaultChecked /> Email me new offers
				</label>
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-lg bg-primary px-3 py-1 text-xs text-primary-foreground">
						radius specimen
					</span>
					<span className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground shadow-sm">
						shadow specimen
					</span>
				</div>
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
						// The panel chrome itself is dressed in the theme: its padding and corners are the
						// theme's spacing unit and radius, so the row reads as three different systems.
						className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-bf-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
					>
						<div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<p className="m-0 font-code text-xs tracking-[0.06em] uppercase text-bf-fg-muted">
								{theme.id} · {mode}
							</p>
							<p className="m-0 font-code text-xs text-bf-dim">{theme.feel}</p>
						</div>
						<p className="m-0 text-sm leading-snug text-bf-fg-muted">{theme.purpose}</p>
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
			<span className="font-code text-xs text-bf-fg-muted">
				the page itself switches; each panel above keeps its own pair
			</span>
		</div>
	);
}
