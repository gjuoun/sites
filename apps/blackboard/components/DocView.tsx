"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { anchor, makeSelector, type QuoteSelector, type TextRange } from "@/lib/anchor";
import type { Comment } from "@/lib/comments-store";
import { cn } from "@/lib/utils";
import { buildTextMap, offsetOf, rangeOf } from "@/lib/text-map";
import { patchDoc, setChrome, useChrome, useIsDesktop } from "./chrome";
import { CommentPanel, type PanelComment } from "./CommentPanel";
import { DocBody } from "./DocBody";
import { useComments } from "./useComments";
import { useLiveDoc } from "./useLiveDoc";

const AUTHOR_KEY = "bb-author";
type Draft = { selector: QuoteSelector; top: number; left: number };

// CSS Custom Highlight API: Chrome 105+, Safari 17.2+. Absent elsewhere; comments still list.
const highlights = () => (typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : null);

/**
 * The doc plus its comments. Selection becomes a QuoteSelector over the doc's plain text; each
 * stored selector is anchored back to text offsets and drawn with the CSS Custom Highlight API,
 * which leaves the page DOM untouched.
 */
export function DocView({ session, title, path, html, initialComments, header, toc }: { session: string; title: string; path: string; html: string; initialComments: Comment[]; header: ReactNode; toc: ReactNode }) {
  const bodyRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLDetailsElement>(null);
  const commentsRef = useRef<HTMLElement>(null);
  const [author, setAuthor] = useState("jun");
  useEffect(() => {
    const saved = localStorage.getItem(AUTHOR_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    if (saved) setAuthor(saved);
  }, []);
  const changeAuthor = (v: string) => {
    setAuthor(v);
    localStorage.setItem(AUTHOR_KEY, v.trim() || "jun");
  };

  const { comments, error, add, reply, setResolved, reload, edit, remove, editReply, removeReply } = useComments(session, initialComments, author.trim() || "jun");
  const chrome = useChrome();
  const desktop = useIsDesktop();
  useLiveDoc(session, reload);
  const openCount = comments.filter((c) => c.status === "open").length;
  useEffect(() => patchDoc({ open: openCount }), [openCount, chrome.doc?.id]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [composing, setComposing] = useState<QuoteSelector | null>(null);
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const showResolved = chrome.showResolved;
  const setShowResolved = (v: boolean) => setChrome({ showResolved: v });
  const [anchors, setAnchors] = useState<Record<string, TextRange | null>>({});

  // Below md the panels are part of the page: Contents is a disclosure above the doc, Comments sit
  // under it. The top-bar buttons therefore scroll to one and open it — no sheet, and nothing that
  // depends on hydration to be usable.
  useEffect(() => {
    if (!chrome.sheet) return;
    if (chrome.sheet === "toc") {
      if (tocRef.current) tocRef.current.open = true;
      tocRef.current?.scrollIntoView({ block: "start" });
    } else {
      commentsRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    setChrome({ sheet: null });
  }, [chrome.sheet]);

  // Anchor every comment against the current text and draw the highlights.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const map = buildTextMap(body);
    const next: Record<string, TextRange | null> = {};
    const open: Range[] = [];
    const active: Range[] = [];
    const hover: Range[] = [];
    for (const c of comments) {
      const r = anchor(map.text, c.quote);
      next[c.id] = r;
      const range = r && rangeOf(map, r.start, r.end);
      if (!range) continue;
      if (c.id === activeId) active.push(range);
      else if (c.id === hoverId) hover.push(range);
      else if (c.status === "open") open.push(range);
    }
    const hl = highlights();
    if (hl) {
      hl.set("bb-comment", new Highlight(...open));
      hl.set("bb-comment-hover", new Highlight(...hover));
      hl.set("bb-comment-active", new Highlight(...active));
    }
    setAnchors((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [comments, html, activeId, hoverId]);
  useEffect(() => () => highlights()?.clear(), []);

  // Track the reader's selection inside the doc and offer a Comment button next to it.
  useEffect(() => {
    const onChange = () => {
      const body = bodyRef.current;
      const main = mainRef.current;
      const sel = getSelection();
      if (!body || !main || !sel || sel.rangeCount === 0 || sel.isCollapsed) return setDraft(null);
      const range = sel.getRangeAt(0);
      if (!body.contains(range.commonAncestorContainer)) return setDraft(null);
      const map = buildTextMap(body);
      const start = offsetOf(map, range.startContainer, range.startOffset);
      const end = offsetOf(map, range.endContainer, range.endOffset);
      if (end <= start || !map.text.slice(start, end).trim()) return setDraft(null);
      const rect = range.getBoundingClientRect();
      const box = main.getBoundingClientRect();
      setDraft({ selector: makeSelector(map.text, start, end), top: rect.bottom - box.top + 6, left: Math.max(0, rect.left - box.left) });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  const startComment = () => {
    if (!draft) return;
    setComposing(draft.selector);
    setDraft(null);
    setChrome(desktop ? { cmOpen: true } : { sheet: "cm" });
  };

  const save = async () => {
    if (!composing || !note.trim()) return;
    await add(composing, note.trim());
    setComposing(null);
    setNote("");
    getSelection()?.removeAllRanges();
  };

  // Which open comment's passage is under a point, if any (the shortest one when they overlap).
  const hitAt = useCallback(
    (x: number, y: number): string | null => {
      const body = bodyRef.current;
      if (!body) return null;
      const d = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
      const pos = d.caretPositionFromPoint?.(x, y);
      const r = pos ? null : d.caretRangeFromPoint?.(x, y);
      const node = pos?.offsetNode ?? r?.startContainer;
      if (!node || !body.contains(node)) return null;
      const at = offsetOf(buildTextMap(body), node, pos?.offset ?? r?.startOffset ?? 0);
      let best: { id: string; len: number } | null = null;
      for (const c of comments) {
        const range = anchors[c.id];
        if (!range || c.status !== "open" || at < range.start || at >= range.end) continue;
        const len = range.end - range.start;
        if (!best || len < best.len) best = { id: c.id, len };
      }
      return best?.id ?? null;
    },
    [anchors, comments],
  );

  // Hovering a highlight shows a pointer and a stronger highlight, so it reads as clickable.
  const frame = useRef(0);
  const onDocMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const { clientX, clientY } = e;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const id = hitAt(clientX, clientY);
        if (bodyRef.current) bodyRef.current.style.cursor = id ? "pointer" : "";
        setHoverId(id);
      });
    },
    [hitAt],
  );
  const onDocLeave = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setHoverId(null);
  }, []);

  // Clicking highlighted text focuses its comment; clicking plain text clears the focus.
  const [flashId, setFlashId] = useState<string | null>(null);
  const onDocClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!getSelection()?.isCollapsed) return;
      const id = hitAt(e.clientX, e.clientY);
      setActiveId(id);
      if (!id) return;
      const item = document.querySelector<HTMLElement>(`[data-testid=comment-item][data-id="${id}"]`);
      item?.scrollIntoView({ block: "center", behavior: "smooth" });
      item?.focus({ preventScroll: true });
      setFlashId(id);
      setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 900);
    },
    [hitAt],
  );

  // Selecting a comment scrolls its passage into view.
  const activate = (id: string) => {
    setActiveId(id);
    const body = bodyRef.current;
    const r = anchors[id];
    if (!body || !r) return;
    const range = rangeOf(buildTextMap(body), r.start, r.end);
    const rect = range?.getBoundingClientRect();
    if (rect && (rect.top < 100 || rect.bottom > innerHeight)) scrollBy({ top: rect.top - innerHeight / 3, behavior: "smooth" });
  };

  const panelComments: PanelComment[] = useMemo(() => {
    const withPos = comments.map((c) => ({ ...c, orphaned: c.id in anchors && anchors[c.id] === null, pos: anchors[c.id]?.start ?? Infinity }));
    return withPos.sort((a, b) => a.pos - b.pos);
  }, [comments, anchors]);

  const composer = composing ? (
    <div className="border-primary mb-3 rounded-xl border p-2.5">
      <blockquote className="bg-background text-muted-foreground m-0 mb-2 line-clamp-3 rounded-lg px-2.5 py-1 text-[12.5px]">{composing.exact.replace(/\s+/g, " ").trim()}</blockquote>
      <textarea
        className="border-input bg-background focus-visible:ring-ring/40 w-full resize-y rounded-lg border p-2 text-[13.5px] outline-none focus-visible:ring-[3px]"
        data-testid="comment-input"
        autoFocus
        rows={3}
        placeholder="Comment…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
          if (e.key === "Escape") setComposing(null);
        }}
      />
      <div className="mt-1.5 flex justify-end gap-1.5">
        <Button size="xs" variant="outline" onClick={() => setComposing(null)}>
          Cancel
        </Button>
        <Button size="xs" data-testid="comment-save" onClick={save} disabled={!note.trim()}>
          Comment
        </Button>
      </div>
    </div>
  ) : null;

  const panel = (
    <CommentPanel
      title={title}
      path={path}
      comments={panelComments}
      activeId={activeId}
      flashId={flashId}
      onActivate={activate}
      onReply={reply}
      onResolve={setResolved}
      onEdit={edit}
      onDelete={remove}
      onEditReply={editReply}
      onDeleteReply={removeReply}
      showResolved={showResolved}
      onShowResolved={setShowResolved}
      author={author}
      onAuthor={changeAuthor}
      composer={composer}
      error={error}
    />
  );

  // Layout is CSS-first and phone-first: one column, TOC as a disclosure above the doc, comments
  // under it. From md up the same nodes become the three-column reading layout. This used to be
  // decided in JS from a media query, so the server painted the 240px/1fr/340px split on phones and
  // the content column collapsed to 0 px wide — an h1 that wrapped one letter per line — until
  // hydration replaced it.
  const vars = { "--toc-w": chrome.tocOpen && toc ? "240px" : "0px", "--cm-w": chrome.cmOpen ? "340px" : "0px" } as React.CSSProperties;
  return (
    <div>
      {toc ? (
        <details
          ref={tocRef}
          data-testid="toc-disclosure"
          className="border-border bg-card/50 mx-4 mt-4 rounded-xl border px-3 py-2 md:hidden"
        >
          <summary className="cursor-pointer text-[13px] font-semibold marker:text-muted-foreground">Contents</summary>
          <div className="pt-2">{toc}</div>
        </details>
      ) : null}
      <div
        className="grid min-h-[calc(100vh-var(--bar-h))] grid-cols-1 transition-[grid-template-columns] duration-200 md:grid-cols-[var(--toc-w)_minmax(0,1fr)_var(--cm-w)]"
        style={vars}
      >
        {toc ? (
          <aside
            className={cn("border-border hidden overflow-x-clip border-r md:block", !chrome.tocOpen && "md:invisible")}
            aria-hidden={!chrome.tocOpen}
            data-testid="toc-panel"
          >
            <div className="sticky top-[var(--bar-h)] max-h-[calc(100vh-var(--bar-h))] overflow-y-auto p-3">{toc}</div>
          </aside>
        ) : null}
        <main className="relative min-w-0 px-4 pt-6 pb-24 md:px-10 md:pt-8" ref={mainRef}>
          <div className="mx-auto min-w-0 max-w-[760px]">
            {header}
            <DocBody html={html} ref={bodyRef} onClick={onDocClick} onMouseMove={onDocMove} onMouseLeave={onDocLeave} />
          </div>
          {draft ? (
            <Button
              size="sm"
              data-testid="comment-button"
              className="absolute z-5 shadow-md"
              style={{ top: draft.top, left: draft.left }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={startComment}
            >
              Comment
            </Button>
          ) : null}
        </main>
        <aside
          ref={commentsRef}
          data-testid="comments-panel"
          className={cn("border-border bg-background scroll-mt-[var(--bar-h)] border-t md:border-t-0 md:border-l", !chrome.cmOpen && "md:invisible")}
        >
          <div className="p-3.5 md:sticky md:top-[var(--bar-h)] md:max-h-[calc(100vh-var(--bar-h))] md:overflow-y-auto">
            {panel}
          </div>
        </aside>
      </div>
    </div>
  );
}
