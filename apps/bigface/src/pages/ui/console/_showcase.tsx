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
import { BGButton } from "@gjuoun/bigface-ui/components/bg/button";
import { BGThemeScope } from "@gjuoun/bigface-ui/components/bg/theme-scope";

// The console theme in both modes: the library's own look, the dense developer workspace. Every value here
// is a role from the console theme; no colour is chosen in this file.
function Specimen() {
	return (
		<Card className="min-w-0 gap-3 rounded-lg! p-4">
			<CardHeader className="gap-1 p-0">
				<CardTitle className="text-lg">Build status</CardTitle>
				<CardDescription className="text-sm">
					Compact, flat and exact. Every row says what it is.
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 p-0">
				<div className="flex flex-wrap items-center gap-2">
					<BGButton tone="glow">Deploy</BGButton>
					<BGButton tone="ghost">Logs</BGButton>
					<Button variant="secondary">Retry</Button>
					<Badge variant="secondary" className="rounded-lg!">Live</Badge>
				</div>
				<Input placeholder="Search runs" className="text-sm" />
				<label className="flex items-center gap-2 text-sm">
					<Switch defaultChecked /> Notify on failure
				</label>
			</CardContent>
		</Card>
	);
}

/** The console theme in both modes, one scope each. */
export function ConsolePanels() {
	return (
		<div className="grid min-w-0 gap-6 md:grid-cols-2">
			<BGThemeScope
				theme="console"
				mode="light"
				className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
			>
				<p className="m-0 font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
					console · light
				</p>
				<Specimen />
			</BGThemeScope>
			<BGThemeScope
				theme="console"
				mode="dark"
				className="flex min-w-0 flex-col gap-3 rounded-[var(--theme-radius,0.625rem)] border border-border p-[calc(var(--theme-space,0.25rem)*4)] text-foreground"
			>
				<p className="m-0 font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
					console · dark
				</p>
				<Specimen />
			</BGThemeScope>
		</div>
	);
}
