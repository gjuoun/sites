import * as React from "react";
import { Block } from "./_frame.tsx";

// Typography is the stock shadcn and Tailwind type scale. The business theme sets no font, size, leading or
// weight, so each row is the class the component ships with. The readout is read from the page after it loads.
// One alignment rule for every row: the label, the specimen and the readout share their FIRST BASELINE.

interface Role {
	name: string;
	cls: string;
	sample: string;
}

const ROLES: Role[] = [
	{ name: "Display", cls: "text-5xl font-bold tracking-tight", sample: "Build the catalogue" },
	{ name: "Heading 1", cls: "scroll-m-20 text-4xl font-bold tracking-tight", sample: "Heading one" },
	{ name: "Heading 2", cls: "scroll-m-20 text-3xl font-semibold tracking-tight", sample: "Heading two" },
	{ name: "Heading 3", cls: "scroll-m-20 text-2xl font-semibold tracking-tight", sample: "Heading three" },
	{ name: "Heading 4", cls: "scroll-m-20 text-xl font-semibold tracking-tight", sample: "Heading four" },
	{ name: "Lead", cls: "text-xl text-muted-foreground", sample: "A lead paragraph introduces the section." },
	{ name: "Large", cls: "text-lg font-semibold", sample: "Large text for emphasis" },
	{ name: "Body", cls: "leading-7", sample: "Body text is the default reading size on the canvas." },
	{ name: "Small", cls: "text-sm leading-none font-medium", sample: "Small label" },
	{ name: "Muted", cls: "text-sm text-muted-foreground", sample: "Muted text for secondary detail" },
	{ name: "Caption", cls: "text-xs text-muted-foreground", sample: "Caption under a figure" },
	{ name: "Code", cls: "rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold", sample: "bun add" },
];

// Label column 15rem (240px); the rest is the specimen, with its readout directly after it.
const ROW = "grid gap-2 py-4 md:grid-cols-[15rem_minmax(0,1fr)] md:items-baseline md:gap-6";
const SPEC = "flex min-w-0 flex-wrap items-baseline gap-x-6 gap-y-1";

/** The class string as one chip per class: it wraps between classes, never inside one. */
function ClassChips({ cls }: { cls: string }) {
	return (
		<div className="flex flex-wrap gap-1">
			{cls.split(" ").map((token) => (
				<code key={token} className="rounded bg-muted px-1 font-mono text-[0.7rem] whitespace-nowrap text-muted-foreground">
					{token}
				</code>
			))}
		</div>
	);
}

function ScaleRow({ name, cls, sample }: Role) {
	const ref = React.useRef<HTMLParagraphElement>(null);
	const [readout, setReadout] = React.useState("");
	React.useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const cs = getComputedStyle(el);
		setReadout(cs.fontSize + " / " + cs.lineHeight + " / " + cs.fontWeight);
	}, [cls]);
	return (
		<div className={"border-t " + ROW}>
			<div className="flex flex-col gap-1.5">
				<span className="text-sm font-medium">{name}</span>
				<ClassChips cls={cls} />
			</div>
			<div className={SPEC}>
				<p ref={ref} className={"max-w-full min-w-0 " + cls}>{sample}</p>
				<span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{readout}</span>
			</div>
		</div>
	);
}

/** One face, shown with its family, style and weight, all read from the page after it loads. */
function FaceRow({ name, cls, sample }: { name: string; cls: string; sample: string }) {
	const ref = React.useRef<HTMLParagraphElement>(null);
	const [readout, setReadout] = React.useState("");
	React.useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const cs = getComputedStyle(el);
		const family = cs.fontFamily.split(",")[0].replace(/"/g, "").trim();
		setReadout(family + " · " + cs.fontStyle + " · " + cs.fontWeight);
	}, [cls]);
	return (
		<div className={"border-t " + ROW}>
			<div className="flex flex-col gap-1.5">
				<span className="text-sm font-medium">{name}</span>
				<ClassChips cls={cls} />
			</div>
			<div className={SPEC}>
				<p ref={ref} className={"max-w-full min-w-0 text-xl " + cls}>{sample}</p>
				<span className="font-mono text-xs whitespace-nowrap text-muted-foreground">{readout}</span>
			</div>
		</div>
	);
}

/** The weight axis of QuBlack Sans (400 to 700), one sample per step. The readout is the computed weight. */
const WEIGHTS = [
	{ cls: "font-normal", label: "400" },
	{ cls: "font-medium", label: "500" },
	{ cls: "font-semibold", label: "600" },
	{ cls: "font-bold", label: "700" },
];
function WeightRow() {
	const refs = React.useRef<(HTMLSpanElement | null)[]>([]);
	const [read, setRead] = React.useState<string[]>([]);
	React.useLayoutEffect(() => {
		setRead(refs.current.map((el) => (el ? getComputedStyle(el).fontWeight : "")));
	}, []);
	return (
		<div className={"border-t " + ROW}>
			<div className="flex flex-col gap-1.5">
				<span className="text-sm font-medium">Weight axis</span>
				<ClassChips cls="font-normal font-medium font-semibold font-bold" />
			</div>
			<div className={SPEC + " gap-x-8"}>
				{WEIGHTS.map((w, i) => (
					<span key={w.cls} className="flex flex-col gap-0.5">
						<span ref={(el) => { refs.current[i] = el; }} className={"text-xl " + w.cls}>QuBlack Sans</span>
						<span className="font-mono text-xs text-muted-foreground">{w.cls} · {read[i] ?? w.label}</span>
					</span>
				))}
			</div>
		</div>
	);
}

/** One article in the same classes, as it reads on a docs page. */
function Prose() {
	const cell = "border px-4 py-2 text-left";
	return (
		<article className="flex max-w-[62ch] flex-col gap-4">
			<h1 className="scroll-m-20 text-4xl font-bold tracking-tight text-balance">Business components</h1>
			<p className="text-xl text-muted-foreground">Stock shadcn components, in the business colours.</p>
			<p className="leading-7">
				Body text sits on the canvas, and <strong className="font-semibold">strong</strong> text keeps the ink. Inline{" "}
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm font-semibold">code</code> takes the muted surface.
			</p>
			<h2 className="mt-4 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">Using the package</h2>
			<p className="leading-7">Install it, then import the components you need.</p>
			<pre className="overflow-x-auto rounded-md bg-muted p-4 font-mono text-sm"><code>bun add @gjuoun/bigface-business-ui</code></pre>
			<ul className="my-2 ml-6 list-disc [&>li]:mt-2">
				<li>Colour is the only theme.</li>
				<li>Radius, type and motion are shadcn's own.</li>
			</ul>
			<blockquote className="mt-4 border-l-2 pl-6 italic">The component is unchanged; only its colour is the theme's.</blockquote>
			<div className="my-2 w-full overflow-x-auto">
				<table className="w-full">
					<thead>
						<tr className="m-0 border-t p-0 even:bg-muted">
							<th className={cell + " font-bold"}>Role</th>
							<th className={cell + " font-bold"}>Use</th>
						</tr>
					</thead>
					<tbody>
						<tr className="m-0 border-t p-0 even:bg-muted"><td className={cell}>Canvas</td><td className={cell}>The page</td></tr>
						<tr className="m-0 border-t p-0 even:bg-muted"><td className={cell}>Primary</td><td className={cell}>Fills of the main action</td></tr>
						<tr className="m-0 border-t p-0 even:bg-muted"><td className={cell}>Muted</td><td className={cell}>Secondary detail</td></tr>
					</tbody>
				</table>
			</div>
		</article>
	);
}

export function TypographySection() {
	return (
		<Block id="typography" title="Typography" source="stock Tailwind and shadcn type classes; the business theme sets no font, size, leading or weight">
			<p className="max-w-[62ch] text-sm text-muted-foreground">
				Every size, leading and weight below is shadcn's own. The faces are QuBlack, served from this site: Latin cuts of the v1.2.0 release, about 50 KB each. The weight axis stops at 700, so font-extrabold and font-black render at 700. The readout is measured from the page after it loads, so it cannot drift from what the classes produce.
			</p>
			<div className="flex max-w-5xl flex-col">
				<h3 className="pb-2 text-base font-semibold">Families</h3>
				<FaceRow name="QuBlack Sans, UI text (font-sans)" cls="font-sans" sample="Aa Bb Cc 0123456789" />
				<FaceRow name="QuBlack Sans, italic" cls="font-sans italic" sample="The quick brown fox, in italic." />
				<WeightRow />
				<FaceRow name="QuBlack Mono, code (font-mono)" cls="font-mono" sample="const build = 42;" />
			</div>
			<div className="flex max-w-5xl flex-col">
				<div className="hidden pb-2 md:grid md:grid-cols-[15rem_minmax(0,1fr)] md:gap-6">
					<h3 className="text-base font-semibold">Scale</h3>
					<div className="flex gap-6 text-xs text-muted-foreground">
						<span>specimen</span>
						<span className="font-mono">size / line / weight</span>
					</div>
				</div>
				<h3 className="pb-2 text-base font-semibold md:hidden">Scale</h3>
				{ROLES.map((role) => (
					<ScaleRow key={role.name} {...role} />
				))}
			</div>
			<div className="flex flex-col gap-3 border-t pt-8">
				<div className="flex flex-col gap-1">
					<h3 className="text-base font-semibold">Prose</h3>
					<p className="text-sm text-muted-foreground">The same scale on a docs page: a heading, a lead, body text, a list, a table.</p>
				</div>
				<div className="rounded-lg border bg-background p-6">
					<Prose />
				</div>
			</div>
		</Block>
	);
}
