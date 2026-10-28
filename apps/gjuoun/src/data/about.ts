// The intro at the top of the home page. First person, plain facts: who he is, what this site is,
// and what is in it. Nothing here claims a fact the resume or the projects do not already show.
export const about = {
	greeting: "Jun Guo",
	lead: "I am a software engineer in Montreal. I build web applications in TypeScript, and lately most of my work is about making agents and tooling that hold up when nobody is watching them.",
	paragraphs: [
		"I like small tools that do one thing properly. A font family with its own drawing rules, a theme that is only a palette plus roles, a page that is static HTML until it genuinely is not. Most of what is on this site started as a question I could not answer quickly enough, and ended up as software I use every day.",
		"I work in the open where I can and self-host where it makes sense: a small Proxmox box, a tunnel instead of a port forward, plain text over a database when plain text will do. I would rather read the code than trust a README, and I would rather ship the small version now than describe the big one.",
	],
	whatThisIs: {
		title: "What this site is",
		body: "Three things, kept short on purpose: what I have built, a numbered set of lessons where each post teaches exactly one idea, and my resume.",
	},
	sections: [
		{
			href: "/projects/",
			label: "Portfolio",
			body: "The projects worth showing, with the stack each one actually uses.",
		},
		{
			href: "/posts/",
			label: "Posts",
			body: "Short numbered lessons, one idea per post, in the order I would teach them to a colleague.",
		},
		{
			href: "/resume/",
			label: "Resume",
			body: "The one-page version: roles, dates, and what I built in each.",
		},
	],
};
