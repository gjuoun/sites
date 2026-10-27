// Resume content. Sources: the 2026-10 profile (current title) and ~/code/gjuoun/blog/src/pages/about.md (older roles).
// Facts that no source gives are "[...]" placeholders: the page marks them, and smoke counts them.
// Bullets are starter copy, drawn only from about.md, and the page tags them as starter.

export interface Role {
	title: string;
	organization: string;
	start: string;
	end: string;
	bullets: string[];
}

export interface Education {
	school: string;
	degree: string;
	start: string;
	end: string;
}

export interface Resume {
	name: string;
	headline: string;
	summary: string;
	contact: { email: string; github: string; site: string };
	roles: Role[];
	education: Education[];
	skills: string[];
}

// Dates are one format everywhere: "Mon YYYY", or "Present" for a role still held.
export const resume: Resume = {
	name: "Jun Guo",
	headline: "Software engineer focused on backend systems and AI features",
	summary:
		"About five years building scalable web applications in JavaScript and TypeScript. Integrates AI features into backend systems and applies large language models to everyday work processes.",
	contact: {
		email: "[email to add]",
		github: "https://github.com/gjuoun",
		site: "https://jun.qqntt.com/",
	},
	roles: [
		{
			title: "Software Engineer",
			organization: "Mistplay",
			start: "Feb 2022",
			end: "Present",
			bullets: [
				"Builds scalable web applications in TypeScript and JavaScript.",
				"Integrates AI features into backend systems, working with data teams.",
				"Applies large language models to improve work processes.",
			],
		},
		{
			title: "Senior Developer",
			organization: "Curbie Cars",
			start: "May 2021",
			end: "Feb 2022",
			bullets: ["[what was built: to add]", "[result or scope: to add]"],
		},
		{
			title: "Full-stack Developer",
			organization: "Affinio",
			start: "Jul 2020",
			end: "May 2021",
			bullets: [],
		},
		{
			title: "[title to confirm]",
			organization: "IBM Canada",
			start: "Jun 2019",
			end: "Oct 2019",
			bullets: [],
		},
	],
	education: [
		{
			school: "Dalhousie University",
			degree: "[degree to confirm]",
			start: "[Mon] 2014",
			end: "[Mon] 2019",
		},
	],
	skills: [
		"TypeScript",
		"JavaScript",
		"Bun",
		"Effect",
		"Astro",
		"LLM integration",
	],
};
