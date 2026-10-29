// Shared utility strings for the site's own markup. Tailwind utilities only, shadcn colour names only: the
// theme package owns every colour, and the site carries no stylesheet of its own.

/** A text link: theme ink, a primary underline, and the visible focus outline. */
export const LINK =
	"text-foreground underline decoration-primary decoration-2 underline-offset-[0.2em] focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-solid focus-visible:outline-foreground";

/** A link inside the page content: heavier, and tinted on hover, so it reads as interactive. */
export const CONTENT_LINK = `${LINK} font-semibold decoration-[3px] hover:bg-accent`;

/** The page body: typography for headings, paragraphs, lists and Markdown, in the theme's colours. */
export const PROSE = [
	"prose",
	"[--tw-prose-body:var(--foreground)] [--tw-prose-headings:var(--foreground)] [--tw-prose-lead:var(--muted-foreground)]",
	"[--tw-prose-links:var(--foreground)] [--tw-prose-bold:var(--foreground)] [--tw-prose-counters:var(--muted-foreground)]",
	"[--tw-prose-bullets:var(--muted-foreground)] [--tw-prose-hr:var(--border)] [--tw-prose-quotes:var(--foreground)]",
	"[--tw-prose-quote-borders:var(--border)] [--tw-prose-captions:var(--muted-foreground)] [--tw-prose-kbd:var(--foreground)]",
	"[--tw-prose-code:var(--foreground)] [--tw-prose-pre-code:var(--foreground)] [--tw-prose-pre-bg:var(--card)]",
	"[--tw-prose-th-borders:var(--border)] [--tw-prose-td-borders:var(--border)]",
	// links: the content link look
	"prose-a:decoration-primary prose-a:decoration-[3px] prose-a:underline-offset-[0.2em] prose-a:font-semibold prose-a:hover:bg-accent",
	"prose-a:focus-visible:outline-2 prose-a:focus-visible:outline-offset-[3px] prose-a:focus-visible:outline-solid prose-a:focus-visible:outline-foreground",
	// inline code: a small muted chip, no backticks
	"prose-code:font-normal prose-code:before:content-none prose-code:after:content-none",
	"[&_:not(pre)>code]:rounded-[4px] [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-[0.3em] [&_:not(pre)>code]:py-[0.05em] [&_:not(pre)>code]:text-[0.9em]",
	// code blocks: the bigface editor theme carries the colours; the site sets the metrics (13px, 12px on phones, two-space tabs)
	"prose-pre:rounded-[6px] prose-pre:border prose-pre:border-border prose-pre:px-4 prose-pre:py-[0.85rem] prose-pre:text-[13px] prose-pre:leading-[1.55] prose-pre:[tab-size:2] max-sm:prose-pre:text-[12px]",
].join(" ");
