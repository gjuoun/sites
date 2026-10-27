import type { APIContext } from "astro";
import { siteOrigin } from "../lib/seo";

export function GET(context: APIContext) {
	const site = siteOrigin(context.site);
	const body = `User-agent: *\nAllow: /\n\nSitemap: ${new URL("sitemap.xml", site).href}\n`;
	return new Response(body, {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
