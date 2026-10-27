// Resume content. Every fact comes from Jun's resume (notebook: Private/resume/jun-guo-2025.md).
// The phone number is deliberately not here: the public site never carries it.
// The source has no Skills section; the skills line names the technologies its bullets name.

export interface Role {
	title: string;
	organization: string;
	location: string;
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
	contact: {
		email: string;
		github: string;
		linkedin: string;
		location: string;
	};
	roles: Role[];
	education: Education[];
	skills: string[];
}

// Dates are one format everywhere: "Mon YYYY", or "Present" for a role still held.
export const resume: Resume = {
	name: "Jun Guo",
	headline: "Senior Software Engineer",
	summary:
		"Jun Guo is a team player and open-source contributor with 5 years of experience building scalable web applications in JavaScript and TypeScript, leading teams to deliver complex projects from ideation to completion. He works closely with data teams and diverse stakeholders to integrate AI features into backend systems, learns new technologies quickly through hands-on work, and applies large language models to enhance work processes.",
	contact: {
		email: "gjuoun@gmail.com",
		github: "https://github.com/gjuoun",
		linkedin: "https://linkedin.com/in/gjuoun",
		location: "Montreal, Canada",
	},
	roles: [
		{
			title: "Lead Software Developer",
			organization: "Mistplay",
			location: "On-site · Montreal, QC, Canada",
			start: "Feb 2024",
			end: "Aug 2024",
			bullets: [
				"Delivered a mobile loyalty platform on IOS.",
				"Lead and build an internal facing admin panel.",
			],
		},
		{
			title: "Senior Developer II",
			organization: "Mistplay",
			location: "On-site · Montreal, QC, Canada",
			start: "Aug 2024",
			end: "Present",
			bullets: [
				"Developed a backend-driven notification system that serves over 1 million active users in real time.",
				"Collaborate with the data team to integrate AI features into the backend, driving significant revenue impact for the company.",
				"Created an innovative approach to analyze Google Play reviews using large language models (LLMs), enhancing user sentiment analysis.",
			],
		},
		{
			title: "Senior Developer",
			organization: "Curbie Cars",
			location: "Remote · Saskatoon, SK, Canada",
			start: "May 2021",
			end: "Feb 2022",
			bullets: [
				"Lead building core product with modern web technologies (React & TypeScript).",
				"Design and implement DevOps workflows using AWS codebuild, ECS, ECR.",
				"Use cloudflare workers as an innovative way for web traffic control and routing.",
			],
		},
		{
			title: "Full-stack Developer",
			organization: "Affinio",
			location: "Remote · Halifax, NS, Canada",
			start: "Jul 2020",
			end: "May 2021",
			bullets: [
				"Develop core product with React.js and Node.js (Typescript).",
				"Building Restful API and GraphQL microservices (Scala, Java, Node.js).",
				"Maintain Kubernetes (K8S) clusters on Azure.",
				"Migrated CI platform from Jenkins to Github Actions, CD platform from DC/OS to Kubernetes.",
			],
		},
		{
			title: "Software Engineer",
			organization: "IBM",
			location: "On-site · Halifax, NS, Canada",
			start: "Jun 2019",
			end: "Oct 2019",
			bullets: [
				"Develop and maintain a CURAM (Java) application for the public sector.",
				"Work with large datasets (Db2) and troubleshooting.",
			],
		},
	],
	education: [
		{
			school: "Dalhousie University",
			degree: "Bachelor's Degree, Computer Science",
			start: "2014",
			end: "2019",
		},
	],
	skills: [
		"React",
		"TypeScript",
		"JavaScript",
		"Node.js",
		"GraphQL",
		"Kubernetes",
		"AWS",
		"Cloudflare Workers",
		"Java",
		"Scala",
		"Db2",
		"Large language models",
	],
};
