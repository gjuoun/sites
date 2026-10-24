import { Badge } from "@gjuoun/bigface-business-ui/components/ui/badge";
import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@gjuoun/bigface-business-ui/components/ui/card";
import { Input } from "@gjuoun/bigface-business-ui/components/ui/input";
import { Switch } from "@gjuoun/bigface-business-ui/components/ui/switch";
import { BGButton } from "@gjuoun/bigface-business-ui/components/bg/button";
import { BGThemeScope } from "@gjuoun/bigface-business-ui/components/bg/theme-scope";

// One theme, both modes. Every value here is a role from the business package: no colour is chosen in this
// file. The light panel is a paper surface, the dark panel the native dark one. Both are business.
function Specimen() {
	return (
		<Card className="min-w-0 gap-3 rounded-lg! p-4">
			<CardHeader className="gap-1 p-0">
				<CardTitle className="text-lg">Your workspace</CardTitle>
				<CardDescription className="text-sm">
					Quiet, light and in order. Nothing shouts unless it has to.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 p-0">
				<div className="flex flex-wrap items-center gap-2">
					<BGButton tone="glow">Get started</BGButton>
					<BGButton tone="ghost">Learn more</BGButton>
					<Button variant="secondary">Later</Button>
					<Badge variant="secondary" className="rounded-lg!">New</Badge>
				</div>
				<Input placeholder="Your email" className="text-sm" />
				<label className="flex items-center gap-2 text-sm">
					<Switch defaultChecked /> Send me product notes
				</label>
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-[var(--theme-radius,0.625rem)] bg-primary-tint px-3 py-1 text-xs text-primary-ink">
						Included
					</span>
					<span className="rounded-[var(--theme-radius,0.625rem)] bg-success-tint px-3 py-1 text-xs text-success">
						Active
					</span>
				</div>
			</CardContent>
		</Card>
	);
}

/** The business theme in both modes, one scope each. */
export function BusinessPanels() {
	return (
		<div className="grid min-w-0 gap-6 md:grid-cols-2">
			<BGThemeScope
				theme="business"
				mode="light"
				className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
			>
				<p className="m-0 font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
					business · light
				</p>
				<Specimen />
			</BGThemeScope>
			<BGThemeScope
				theme="business"
				mode="dark"
				className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
			>
				<p className="m-0 font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
					business · dark
				</p>
				<Specimen />
			</BGThemeScope>
		</div>
	);
}
