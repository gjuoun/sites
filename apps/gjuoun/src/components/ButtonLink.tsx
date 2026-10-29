import { Button } from "@gjuoun/bigface-business-ui/components/ui/button";

// The stock Button as a link, for the Astro pages (an Astro slot cannot be the asChild child, so the label is a prop).
export function ButtonLink({
	href,
	label,
	variant = "default",
}: {
	href: string;
	label: string;
	variant?: "default" | "outline";
}) {
	return (
		<Button asChild variant={variant}>
			<a href={href}>{label}</a>
		</Button>
	);
}
