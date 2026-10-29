import { resume } from "../data/resume";
import { Link } from "./Link";

// Resume: dates sit in their own right-aligned column, one row per entry. Under 30rem the date sits above its entry.
const ENTRIES = "entries not-prose list-none";
const ENTRY =
	"entry grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 border-t border-border py-3 max-[30rem]:grid-cols-[minmax(0,1fr)]";
const DATE =
	"entry-date text-right whitespace-nowrap text-muted-foreground tabular-nums max-[30rem]:text-left";
const ROLE = "m-0 text-base font-bold text-foreground";

// The full facts live on /resume/. level is the heading that titles each section: 2 on the full page, 3 under a
// page heading. Roles sit one level below. "teaser" shows only the headline, contact and summary.
export function ResumeFacts({
	level,
	view = "full",
}: {
	level: 2 | 3;
	view?: "full" | "teaser";
}) {
	const Section = level === 2 ? "h2" : "h3";
	const Role = level === 2 ? "h3" : "h4";
	const c = resume.contact;
	return (
		<>
			<p className="headline not-prose text-[1.1rem] text-foreground">
				{resume.headline}
			</p>
			<p className="contact not-prose mt-6 mb-4">
				<Link href={`mailto:${c.email}`}>{c.email}</Link> ·{" "}
				<Link href={c.github}>github.com/gjuoun</Link> ·{" "}
				<Link href={c.linkedin}>linkedin.com/in/gjuoun</Link> · {c.location}
			</p>
			<p>{resume.summary}</p>
			{view === "full" && (
				<>
					<Section>Experience</Section>
					<ol className={ENTRIES}>
						{resume.roles.map((role) => (
							<li key={`${role.organization}-${role.start}`} className={ENTRY}>
								<div>
									<Role className={ROLE}>
										{role.title}, {role.organization}
									</Role>
									<p className="kicker text-[0.85rem] text-muted-foreground">
										{role.location}
									</p>
									<ul className="bullets mt-[0.2rem] list-disc pl-[1.1rem]">
										{role.bullets.map((b) => (
											<li key={b}>{b}</li>
										))}
									</ul>
								</div>
								<time className={DATE}>
									{role.start} – {role.end}
								</time>
							</li>
						))}
					</ol>
					<Section>Education</Section>
					<ol className={ENTRIES}>
						{resume.education.map((e) => (
							<li key={e.school} className={ENTRY}>
								<div>
									<Role className={ROLE}>{e.school}</Role>
									<p className="mt-[0.1rem]">{e.degree}</p>
								</div>
								<time className={DATE}>
									{e.start} – {e.end}
								</time>
							</li>
						))}
					</ol>
					<Section>Skills</Section>
					<p>{resume.skills.join(" · ")}</p>
				</>
			)}
		</>
	);
}
