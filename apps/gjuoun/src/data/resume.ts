// Resume content. Every field is starter copy until Jun reviews it (starter: true drives the banner).

export interface Role {
	title: string;
	organization: string;
	start: string;
	end: string;
	highlights: string[];
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
	headline: "",
	summary: "",
	roles: [],
	education: [],
	skills: [],
	starter: true,
};
