import { BGButton } from "@gjuoun/bigface-ui/components/bg/button";
import { BGModeSwitcher } from "@gjuoun/bigface-ui/components/bg/mode-switcher";
import { BGThemeScope } from "@gjuoun/bigface-ui/components/bg/theme-scope";
import { BGThemeSwitcher } from "@gjuoun/bigface-ui/components/bg/theme-switcher";
import { Badge } from "@gjuoun/bigface-ui/components/ui/badge";
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

// Six panels, one colour system, three feels. Everything here is dressed by the theme's own tokens —
// spacing, type scale, radius, elevation, motion and weight — so the same markup reads airy, taped-down
// or bouncy depending on the scope. Colour comes only from roles (primary, success-tint, …): no hue is
// chosen in this file.
//
// The hover and press beats are real CSS, not a caption: the buttons scale by --theme-hover on hover and
// --theme-press on :active, with the theme's own duration and easing (game overshoots, business glides,
// console snaps). Point at one and click it to feel the difference.
function Panel({
	feel,
}: {
	feel: { radius: string; space: string; hover: string; press: string };
}) {
	return (
		<Card className="min-w-0 flex-1 gap-3 rounded-lg p-4 shadow-sm">
			<CardHeader className="gap-1 p-0">
				<CardTitle className="text-lg font-[var(--theme-weight,600)]">
					Rewards
				</CardTitle>
				<CardDescription className="text-sm">
					Claim 250 coins for today&rsquo;s streak.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 p-0">
				<div className="flex flex-wrap items-center gap-2">
					<BGButton tone="glow">Claim</BGButton>
					<BGButton tone="ghost">Later</BGButton>
					<Badge variant="secondary" className="rounded-[var(--theme-radius,0.625rem)] text-xs">
						Live
					</Badge>
				</div>
				<Input placeholder="Search offers" className="text-sm" />
				<label className="flex items-center gap-2 text-sm">
					<Switch defaultChecked /> Email me new offers
				</label>
				{/* Tints, pills and the press beat: the playful vocabulary, built from native roles only. */}
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-[var(--theme-radius,0.625rem)] bg-primary-tint px-3 py-1 text-xs text-primary-ink">
						+40 coins
					</span>
					<span className="rounded-[var(--theme-radius,0.625rem)] bg-success-tint px-3 py-1 text-xs text-success">
						streak 3
					</span>
					<span className="rounded-[var(--theme-radius,0.625rem)] bg-highlight-tint px-3 py-1 text-xs text-highlight">
						booster
					</span>
				</div>
				<div className="flex flex-wrap items-center gap-3">
					<BGButton tone="chip" className="px-4">
						Press me
					</BGButton>
					<span className="font-code text-xs text-muted-foreground">
						radius <span className="text-foreground">{feel.radius}</span> ·
						space <span className="text-foreground">{feel.space}</span> · hover{" "}
						<span className="text-foreground">{feel.hover}</span> × press{" "}
						<span className="text-foreground">{feel.press}</span>
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
						className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
					>
						<div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
							<p className="m-0 font-code text-xs tracking-[0.06em] uppercase text-muted-foreground">
								{theme.id} · {mode}
							</p>
							<p className="m-0 font-code text-xs text-gray-500">{theme.feel}</p>
						</div>
						<p className="m-0 text-sm leading-snug text-muted-foreground">
							{theme.purpose}
						</p>
						<Panel
							feel={{
								radius: String(theme.roles.radius),
								space: String(theme.roles.space),
								hover: String(theme.roles.hover),
								press: String(theme.roles.press),
							}}
						/>
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
			<span className="font-code text-xs text-muted-foreground">
				the page itself switches; each panel above keeps its own pair
			</span>
		</div>
	);
}
