#!/usr/bin/env bun
// Specimen census for the business catalogue (/ui/business/). Read-only: it measures and reports, it changes nothing.
//
// Four defect classes, measured on every specimen of every section, in the rendered DOM (not by eye):
//   A  wrap      a word split across two or more lines (each word is measured with Range rects)
//   B  axis      an alignment (data-align start|end) that cannot be seen: its track has no free space on the axis,
//                or a child of an aligned message sits off its axis while its track has room
//   C  escape    an absolutely positioned decoration outside its specimen cell, or anchored outside its cell
//   D  fit       a specimen whose content overflows its cell (scrollWidth, or a descendant past the cell edge),
//                or an aligned specimen squeezed under half its track
//
// Usage:
//   bun run scripts/specimen-census.ts --dist apps/bigface/dist --page /ui/business/ --widths 1440,390 --modes light,dark --out DIR [--shots]
//   bun run scripts/specimen-census.ts --compare BEFORE.json AFTER.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	findChrome,
	launchChrome,
	openPage,
	QUIET_CSS,
	serveDist,
} from "./theme-mode-probe.ts";

export interface Finding {
	section: string;
	defect: "A" | "B" | "C" | "D";
	kind: string;
	detail: string;
}
export interface CensusResult {
	specimens: number;
	findings: Finding[];
}

/** Runs inside the page. Returns every finding; reads layout only. */
export function census(): CensusResult {
	// Specimen scaffolding only: matrix cells, demo boxes, labelled-row and state containers. Component internals are not cells.
	const CELL =
		"td > span, [data-demo], [data-frame], div.flex.min-w-0.flex-wrap.items-center.gap-3, div.flex.min-w-0.flex-col.items-start.gap-1\\.5";
	const findings: Finding[] = [];
	const inSec = (el: Element) =>
		el.closest("section[id]") !== null && el.closest("details") === null;
	const secId = (el: Element) => (el.closest("section[id]") as HTMLElement).id;
	const name = (el: Element | null): string => {
		if (!el) return "(none)";
		const d =
			el.getAttribute("data-slot") || el.getAttribute("data-demo") || "";
		const t = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 26);
		return (
			el.tagName.toLowerCase() +
			(d ? "[" + d + "]" : "") +
			(t ? " '" + t + "'" : "")
		);
	};
	const pad = (el: Element) => {
		const s = getComputedStyle(el);
		return {
			l: parseFloat(s.paddingLeft) || 0,
			r: parseFloat(s.paddingRight) || 0,
		};
	};
	const add = (
		el: Element,
		defect: Finding["defect"],
		kind: string,
		detail: string,
	) => findings.push({ section: secId(el), defect, kind, detail });
	const lines = (rects: DOMRect[]) => {
		const tops = rects
			.filter((q) => q.width > 0.5 && q.height > 0.5)
			.map((q) => q.top)
			.sort((a, b) => a - b);
		let n = tops.length ? 1 : 0;
		for (let i = 1; i < tops.length; i++) if (tops[i]! - tops[i - 1]! > 4) n++;
		return n;
	};

	// A — a word split across lines, anywhere in a section outside <details>.
	const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const t = n as Text;
		const p = t.parentElement;
		if (!p || !inSec(p) || !(t.textContent || "").trim()) continue;
		const re = /\S+/g;
		let m: RegExpExecArray | null;
		while ((m = re.exec(t.textContent || ""))) {
			const r = document.createRange();
			r.setStart(t, m.index);
			r.setEnd(t, m.index + m[0].length);
			if (lines([...r.getClientRects()]) <= 1) continue;
			// A word split across lines is mid-word unless every break falls on a separator (- / . @ =), which is a legal break.
			const s0 = m.index,
				e0 = m.index + m[0].length;
			const data = t.data;
			const breaks: number[] = [];
			let prev: number | null = null;
			for (let i = s0; i < e0; i++) {
				const c = document.createRange();
				c.setStart(t, i);
				c.setEnd(t, i + 1);
				const q = Array.from(c.getClientRects()).find((x) => x.width > 0.5);
				if (!q) continue;
				if (prev !== null && q.top - prev > 4) breaks.push(i);
				prev = q.top;
			}
			const sep = (ch: string | undefined) =>
				ch !== undefined && /[-/.@=]/.test(ch);
			if (breaks.every((i) => sep(data[i - 1]) || sep(data[i]))) continue;
			add(
				p,
				"A",
				"mid-word",
				"'" + m[0] + "' in " + name(p.closest(CELL) ?? p),
			);
		}
	}

	// B — alignment axis. Own-box check for elements; child check for an aligned message's content.
	for (const el of Array.from(document.querySelectorAll("[data-align]"))) {
		if (!inSec(el) || getComputedStyle(el).position === "absolute") continue;
		const align = el.getAttribute("data-align") ?? "";
		// Horizontal axes only: start/end and their logical forms. Block axes (block-start/end) are vertical, not checked here.
		if (!["start", "end", "inline-start", "inline-end"].includes(align))
			continue;
		const atEnd = align === "end" || align === "inline-end";
		if (el.getAttribute("data-slot") === "message") {
			const content = el.querySelector('[data-slot="message-content"]');
			if (!content) continue;
			const cr = content.getBoundingClientRect();
			const cp = pad(content);
			const inner = cr.width - cp.l - cp.r;
			for (const child of Array.from(content.childNodes)) {
				let r: DOMRect | null = null;
				let what = "";
				if (child.nodeType === 1) {
					r = (child as Element).getBoundingClientRect();
					what = name(child as Element);
				} else if (child.nodeType === 3 && (child.textContent || "").trim()) {
					const rg = document.createRange();
					rg.selectNodeContents(child);
					r = rg.getBoundingClientRect();
					what = "text '" + (child.textContent || "").trim().slice(0, 22) + "'";
				}
				if (!r || r.width < 1) continue;
				if (inner - r.width < 8) continue;
				const pinned = atEnd
					? r.right >= cr.right - cp.r - 2
					: r.left <= cr.left + cp.l + 2;
				if (!pinned)
					add(
						el,
						"B",
						"off-axis child",
						align +
							": " +
							what +
							" sits " +
							Math.round(atEnd ? cr.right - r.right : r.left - cr.left) +
							"px from its edge, room " +
							Math.round(inner - r.width) +
							"px",
					);
			}
			continue;
		}
		const track = el.parentElement;
		if (!track) continue;
		const tp = pad(track);
		const er = el.getBoundingClientRect();
		const free = track.clientWidth - tp.l - tp.r - er.width;
		if (free < 8) {
			add(
				el,
				"B",
				"axis has no room",
				align +
					" " +
					name(el) +
					": track " +
					track.clientWidth +
					"px, box " +
					Math.round(er.width) +
					"px",
			);
			add(
				el,
				"D",
				"squeezed",
				align +
					" box " +
					Math.round(er.width) +
					"px in track " +
					track.clientWidth +
					"px",
			);
			continue;
		}
		// The track must span its specimen: an axis inside a box far narrower than its cell reads as centred, not as an edge.
		const cell = el.closest(CELL);
		// Only axis specimens: bubbles and messages, and rows labelled align=... (an icon addon is not an axis demonstration).
		const axisRow = el.closest("div.grid")?.querySelector(":scope > span")?.textContent?.startsWith("align=") ?? false;
		if (cell && cell !== track && (el.getAttribute("data-slot") === "bubble" || axisRow)) {
			const cp = pad(cell);
			const inner = cell.clientWidth - cp.l - cp.r;
			if (track.clientWidth < inner * 0.6)
				add(el, "B", "track does not span its specimen", align + " " + name(el) + ": track " + track.clientWidth + "px of a " + Math.round(inner) + "px cell");
		}
		const tr = track.getBoundingClientRect();
		const pinned = atEnd
			? er.right >= tr.right - tp.r - 2
			: er.left <= tr.left + tp.l + 2;
		if (!pinned)
			add(
				el,
				"B",
				"not pinned to axis",
				align +
					" " +
					name(el) +
					" has " +
					Math.round(free) +
					"px room but is not at its edge",
			);
	}

	// C — absolutely positioned decorations: outside their cell, or anchored outside it.
	for (const el of Array.from(document.querySelectorAll("section[id] *"))) {
		if (!inSec(el) || getComputedStyle(el).position !== "absolute") continue;
		const er = el.getBoundingClientRect();
		if (er.width <= 2 && er.height <= 2) continue; // screen-reader-only text: a 1px clip, not a decoration
		const cell = el.closest(CELL) ?? (el.closest("section[id]") as Element);
		const cr = cell.getBoundingClientRect();
		if (
			er.left < cr.left - 1 ||
			er.right > cr.right + 1 ||
			er.top < cr.top - 1 ||
			er.bottom > cr.bottom + 1
		)
			add(
				el,
				"C",
				"escapes cell",
				name(el) +
					" box " +
					Math.round(er.left) +
					"," +
					Math.round(er.top) +
					"-" +
					Math.round(er.right) +
					"," +
					Math.round(er.bottom) +
					" vs cell " +
					Math.round(cr.left) +
					"," +
					Math.round(cr.top) +
					"-" +
					Math.round(cr.right) +
					"," +
					Math.round(cr.bottom),
			);
		// Nearest positioned ancestor (offsetParent is undefined for SVG, so it is not used).
		let anchor: Element | null = el.parentElement;
		while (
			anchor &&
			anchor !== document.body &&
			getComputedStyle(anchor).position === "static"
		)
			anchor = anchor.parentElement;
		if (!anchor || !cell.contains(anchor))
			add(
				el,
				"C",
				"anchored outside cell",
				name(el) + " anchored to " + name(anchor),
			);
	}

	// D — overflow: a cell whose content runs past it, or a section wider than its frame.
	const cells = Array.from(document.querySelectorAll(CELL)).filter((c) =>
		inSec(c),
	);
	const cellSet = new Set<Element>(cells);
	for (const cell of cells) {
		const cr = cell.getBoundingClientRect();
		if (cell.scrollWidth > cell.clientWidth + 1)
			add(
				cell,
				"D",
				"overflows cell",
				name(cell) + " scroll " + cell.scrollWidth + " > " + cell.clientWidth,
			);
		for (const d of Array.from(cell.querySelectorAll("*"))) {
			if (getComputedStyle(d).position === "absolute") continue;
			const r = d.getBoundingClientRect();
			if (r.width <= 2 || r.height <= 2) continue; // 1px focus guards and screen-reader text
			// Clipped by a scrolling or hidden ancestor between it and the cell: contained by design, not a defect.
			let clipped = false;
			for (let p = d.parentElement; p && p !== cell; p = p.parentElement) {
				const o = getComputedStyle(p).overflowX;
				if (o !== "visible" && o !== "clip") {
					clipped = true;
					break;
				}
			}
			if (clipped) continue;
			if (r.right > cr.right + 1 || r.left < cr.left - 1) {
				add(
					cell,
					"D",
					"descendant past cell edge",
					name(d) +
						" by " +
						Math.round(Math.max(r.right - cr.right, cr.left - r.left)) +
						"px",
				);
				break;
			}
		}
	}
	for (const s of Array.from(document.querySelectorAll("section[id]"))) {
		if (s.scrollWidth > s.clientWidth + 1)
			add(
				s,
				"D",
				"section overflows frame",
				"scroll " + s.scrollWidth + " > " + s.clientWidth,
			);
	}

	// Dedupe identical findings (nested cells report the same node twice).
	const seen = new Set<string>();
	const unique = findings.filter((f) => {
		const k = f.section + "|" + f.defect + "|" + f.kind + "|" + f.detail;
		if (seen.has(k)) return false;
		seen.add(k);
		return true;
	});
	return {
		specimens: cells.filter((c) => !c.matches("th, td")).length,
		findings: unique,
	};
}

// ---- runner (outside the page) ------------------------------------------------------------------

const DEFECTS = ["A", "B", "C", "D"] as const;

function summarise(res: CensusResult): Map<string, Record<string, number>> {
	const by = new Map<string, Record<string, number>>();
	for (const f of res.findings) {
		const row = by.get(f.section) ?? { A: 0, B: 0, C: 0, D: 0 };
		row[f.defect] = (row[f.defect] ?? 0) + 1;
		by.set(f.section, row);
	}
	return by;
}

function printTable(label: string, res: CensusResult) {
	const by = summarise(res);
	const total = { A: 0, B: 0, C: 0, D: 0 };
	console.log("\n" + label + "  specimens=" + res.specimens);
	console.log("  section                     A     B     C     D");
	for (const [sec, row] of [...by.entries()].sort()) {
		for (const d of DEFECTS) total[d] += row[d] ?? 0;
		console.log(
			"  " +
				sec.padEnd(26) +
				DEFECTS.map((d) => String(row[d] ?? 0).padStart(5)).join(""),
		);
	}
	console.log(
		"  " +
			"TOTAL".padEnd(26) +
			DEFECTS.map((d) => String(total[d]).padStart(5)).join(""),
	);
}

function compare(beforePath: string, afterPath: string) {
	const b = JSON.parse(readFileSync(beforePath, "utf8")) as Record<
		string,
		CensusResult
	>;
	const a = JSON.parse(readFileSync(afterPath, "utf8")) as Record<
		string,
		CensusResult
	>;
	for (const key of Object.keys(b)) {
		const bb = summarise(b[key]!),
			aa = summarise(a[key] ?? { specimens: 0, findings: [] });
		const secs = [...new Set([...bb.keys(), ...aa.keys()])].sort();
		console.log(
			"\n" +
				key +
				"   specimens before=" +
				b[key]!.specimens +
				" after=" +
				(a[key]?.specimens ?? "n/a"),
		);
		console.log(
			"  section                     A before→after   B before→after   C before→after   D before→after",
		);
		const tot = {
			before: { A: 0, B: 0, C: 0, D: 0 },
			after: { A: 0, B: 0, C: 0, D: 0 },
		};
		for (const s of secs) {
			const x = bb.get(s) ?? { A: 0, B: 0, C: 0, D: 0 },
				y = aa.get(s) ?? { A: 0, B: 0, C: 0, D: 0 };
			for (const d of DEFECTS) {
				tot.before[d] += x[d] ?? 0;
				tot.after[d] += y[d] ?? 0;
			}
			console.log(
				"  " +
					s.padEnd(26) +
					DEFECTS.map((d) =>
						(String(x[d] ?? 0) + "→" + (y[d] ?? 0)).padStart(16),
					).join(""),
			);
		}
		console.log(
			"  " +
				"TOTAL".padEnd(26) +
				DEFECTS.map((d) =>
					(tot.before[d] + "→" + tot.after[d]).padStart(16),
				).join(""),
		);
	}
}

const argv = Bun.argv.slice(2);
const opt = (k: string, d = "") => {
	const i = argv.indexOf(k);
	return i >= 0 ? (argv[i + 1] ?? d) : d;
};

if (argv.includes("--compare")) {
	compare(
		argv[argv.indexOf("--compare") + 1]!,
		argv[argv.indexOf("--compare") + 2]!,
	);
} else if (import.meta.main) {
	const dist = resolve(opt("--dist"));
	const pagePath = opt("--page", "/ui/business/");
	const widths = opt("--widths", "1440,390").split(",").map(Number);
	const modes = opt("--modes", "light,dark").split(",");
	const outDir = opt("--out", "");
	const shots = argv.includes("--shots");
	if (outDir) mkdirSync(join(outDir, "shots"), { recursive: true });
	const server = serveDist(dist);
	const browser = await launchChrome(findChrome());
	const results: Record<string, CensusResult> = {};
	try {
		for (const mode of modes)
			for (const width of widths) {
				const page = await openPage(browser, server.url + pagePath, {
					width,
					height: 900,
					mode,
				});
				// Sweep the page so every island hydrates and every lazily rendered specimen is in the DOM.
				await page.evaluate(
					"(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400)); return true; })()",
				);
				const key = mode + "@" + width;
				const res = await page.evaluate<CensusResult>(
					"(" + census.toString() + ")()",
				);
				results[key] = res;
				printTable(key, res);
				if (shots && outDir) {
					await page.evaluate(
						"(() => { const s = document.createElement('style'); s.setAttribute('data-probe', ''); s.textContent = " +
							JSON.stringify(QUIET_CSS) +
							"; document.head.appendChild(s); })()",
					);
					const rects = await page.evaluate<
						{ id: string; x: number; y: number; w: number; h: number }[]
					>(
						"Array.from(document.querySelectorAll('section[id]')).map((s) => { const r = s.getBoundingClientRect(); return { id: s.id, x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; })",
					);
					for (const r of rects) {
						const shot = await page.send("Page.captureScreenshot", {
							format: "png",
							captureBeyondViewport: true,
							clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 },
						});
						writeFileSync(
							join(outDir, "shots", mode + "-" + width + "-" + r.id + ".png"),
							Buffer.from(shot.data, "base64"),
						);
					}
				}
				await page.close();
			}
	} finally {
		browser.stop();
		server.stop();
	}
	if (outDir)
		writeFileSync(
			join(outDir, "census.json"),
			JSON.stringify(results, null, 1),
		);
}
