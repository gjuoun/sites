// Page metadata: titles, descriptions, canonical urls and Open Graph fields. No og:image in v1.

export const SITE_NAME = "Jun Guo";
export const HOME_TITLE = "Jun Guo — portfolio, resume and posts";
export const MAX_DESCRIPTION = 160;

export type PageType = "website" | "article";

export interface MetaInput {
	site: URL;
	path: string;
	title?: string;
	description: string;
	type: PageType;
}

export interface Meta {
	title: string;
	description: string;
	canonical: string;
	og: {
		type: PageType;
		title: string;
		description: string;
		url: string;
		site_name: string;
	};
}

/** Home gets the full portfolio line; other pages read "<Page> — Jun Guo". */
export function pageTitle(title: string | undefined): string {
	return title === undefined ? HOME_TITLE : `${title} — ${SITE_NAME}`;
}

/** The configured site origin (astro.config.mjs `site`). Missing config is an error, never a guessed host. */
export function siteOrigin(site: URL | undefined): URL {
	if (site === undefined) throw new Error("astro.config.mjs must set site");
	return site;
}

/** Absolute url for the page, with a trailing slash on routes (trailingSlash is "always"). */
export function canonicalFor(site: URL, path: string): string {
	const url = new URL(path, site);
	url.search = "";
	url.hash = "";
	if (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname))
		url.pathname += "/";
	return url.href;
}

/** Clips at a word-safe length and marks the cut with an ellipsis. */
export function clipDescription(text: string): string {
	if (text.length <= MAX_DESCRIPTION) return text;
	return `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
}

export function buildMeta(input: MetaInput): Meta {
	const title = pageTitle(input.title);
	const description = clipDescription(input.description);
	const canonical = canonicalFor(input.site, input.path);
	return {
		title,
		description,
		canonical,
		og: {
			type: input.type,
			title,
			description,
			url: canonical,
			site_name: SITE_NAME,
		},
	};
}
