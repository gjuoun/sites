// Resume content. Starter copy: Jun corrects it before launch. starter: true drives the banner.
// Sources: the 2026-10 profile (current title) and ~/code/gjuoun/blog/src/pages/about.md (older roles).

export interface Role {
	title?: string;
	organization: string;
	start: string;
	end: string;
}

export interface Education {
	school: string;
	years: string;
}

export interface Resume {
	name: string;
	headline: string;
	summary: string;
	roles: Role[];
	education: Education[];
	skills: string[];
	starter: true;
}

export const resume: Resume = {
	name: "Jun Guo",
	headline: "Software Engineer, Mistplay",
	summary:
		"Software engineer with about five years building scalable web applications in TypeScript. Works on AI features in backend systems and on typed services built with Effect.",
	roles: [
		{ title: "Software Engineer", organization: "Mistplay", start: "Feb 2022", end: "Present" },
		{ title: "Senior Developer", organization: "Curbie Cars", start: "May 2021", end: "Feb 2022" },
		{ title: "Full-stack Developer", organization: "Affinio", start: "Jul 2020", end: "May 2021" },
		{ organization: "IBM Canada", start: "Jun 2019", end: "Oct 2019" },
	],
	education: [{ school: "Dalhousie University", years: "2014–2019" }],
	skills: ["TypeScript", "JavaScript", "Bun", "Effect", "Astro", "LLM integration"],
	starter: true,
};
