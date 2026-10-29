import { ButtonLink } from "./ButtonLink";

export interface LessonLink {
	href: string;
	label: string;
}

// Previous/next navigation under a series or a lesson: the way back as an outline button, the way on as the primary.
export function LessonNav({
	label,
	back,
	forward,
}: {
	label: string;
	back?: LessonLink;
	forward?: LessonLink;
}) {
	return (
		<nav
			className="lesson-nav not-prose mt-8 flex flex-wrap justify-between gap-3"
			aria-label={label}
		>
			{back && (
				<ButtonLink variant="outline" href={back.href} label={back.label} />
			)}
			{forward && <ButtonLink href={forward.href} label={forward.label} />}
		</nav>
	);
}
