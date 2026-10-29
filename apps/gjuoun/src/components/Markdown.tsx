// A content entry's rendered Markdown (Astro's entry.rendered.html: the HTML Astro built at sync time, code blocks
// already highlighted). It is the site's own content, so it is trusted. display:contents keeps the wrapper out of
// the layout, so the prose rules see the Markdown's elements as the page's own.
export function Markdown({ html }: { html: string }) {
	const content = { __html: html };
	// biome-ignore lint/security/noDangerouslySetInnerHtml: the site's own Markdown, rendered at build time
	return <div className="contents" dangerouslySetInnerHTML={content} />;
}
