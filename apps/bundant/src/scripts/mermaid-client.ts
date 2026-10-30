/**
 * Client-side renderer for fenced mermaid blocks.
 *
 * rehype-mermaid (strategy: 'pre-mermaid') leaves the source as
 * <pre class="mermaid"> at build time, so the page is readable with JavaScript
 * off. This module is loaded only on docs pages; it imports Mermaid lazily,
 * reads the theme's palette from the resolved custom properties, and re-renders
 * the diagrams when the reader flips the mode.
 */
import type { MermaidConfig } from 'mermaid';

/** The package's palette names, read from the document, never hardcoded. */
const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--theme-${name}`).trim();

function config(): MermaidConfig {
  const panel = token('panel');
  const bg = token('bg');
  const fg = token('fg');
  const border = token('border');
  const highlight = token('highlight');
  const blue = token('blue');
  const lightBlue = token('lightBlue');
  const paleBlue = token('paleBlue');
  const cyan = token('cyan');
  const green = token('green');

  return {
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: bg,
      primaryColor: panel,
      primaryTextColor: fg,
      primaryBorderColor: border,
      secondaryColor: panel,
      tertiaryColor: bg,
      mainBkg: panel,
      nodeBorder: border,
      nodeTextColor: fg,
      textColor: fg,
      lineColor: blue,
      defaultLinkColor: blue,
      edgeLabelBackground: panel,
      clusterBkg: panel,
      clusterBorder: border,
      titleColor: fg,
      actorBkg: panel,
      actorBorder: border,
      actorTextColor: fg,
      actorLineColor: border,
      signalColor: fg,
      signalTextColor: fg,
      labelBoxBkgColor: panel,
      labelBoxBorderColor: border,
      labelTextColor: fg,
      loopTextColor: fg,
      noteBkgColor: panel,
      noteBorderColor: border,
      noteTextColor: fg,
      activationBkgColor: panel,
      activationBorderColor: blue,
      sequenceNumberColor: bg,
      cScale0: panel,
      cScale1: bg,
      cScale2: panel,
      cScale3: border,
      cScale4: border,
      cScale5: highlight,
      cScale6: cyan,
      cScale7: highlight,
      cScale8: lightBlue,
      cScale9: paleBlue,
      cScale10: cyan,
      cScale11: green,
      fontFamily: 'var(--font-sans, ui-sans-serif, system-ui, sans-serif)',
      fontSize: '15px',
    },
    flowchart: { htmlLabels: true, curve: 'basis', useMaxWidth: true },
    mindmap: { useMaxWidth: true },
    timeline: { useMaxWidth: true },
    sequence: { useMaxWidth: true },
  };
}

const FIGURE = 'my-6 rounded-xl border border-border bg-card px-3 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3';
const CANVAS = 'mx-auto overflow-x-auto text-center [&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full';
const SOURCE = 'mt-2 border-t border-border/60 pt-2 text-xs text-muted-foreground';
const SUMMARY = 'flex min-h-11 w-fit cursor-pointer items-center hover:text-foreground';
const SOURCE_PRE = 'mt-2 mb-2 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-xs leading-[1.6] text-foreground';

type Rendered = { source: string; canvas: HTMLElement };

const rendered: Rendered[] = [];
let renderIndex = 0;

function sourceOf(node: HTMLElement): string {
  return (node.textContent ?? '').trim();
}

async function renderAll(): Promise<void> {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('pre.mermaid'));
  if (nodes.length === 0) return;

  try {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize(config());

    for (const node of nodes) {
      const source = sourceOf(node);
      if (!source) continue;
      try {
        const index = renderIndex++;
        const { svg } = await mermaid.render('bundant-mermaid-' + index, source);
        const figure = document.createElement('figure');
        figure.className = FIGURE;
        figure.setAttribute('role', 'group');
        figure.setAttribute('aria-label', 'Diagram');

        const canvas = document.createElement('div');
        canvas.className = CANVAS;
        canvas.innerHTML = svg;

        const details = document.createElement('details');
        details.className = SOURCE;
        const summary = document.createElement('summary');
        summary.className = SUMMARY;
        summary.textContent = 'Diagram source';
        const pre = document.createElement('pre');
        pre.className = SOURCE_PRE;
        pre.textContent = source;
        details.append(summary, pre);

        figure.append(canvas, details);
        node.replaceWith(figure);
        rendered.push({ source, canvas });
      } catch (error) {
        node.style.borderColor = 'var(--destructive)';
        node.hidden = false;
        console.error('mermaid: could not render diagram', error);
      }
    }
    document.documentElement.classList.add('mermaid-done');
  } catch (error) {
    document.documentElement.classList.add('mermaid-failed');
    console.error('mermaid: renderer failed to load', error);
  }
}

/** The diagrams are palette-driven, so a mode flip re-renders them in place. */
let rerendering = false;
async function rerender(): Promise<void> {
  if (rerendering || rendered.length === 0) return;
  rerendering = true;
  try {
    const { default: mermaid } = await import('mermaid');
    mermaid.initialize(config());
    for (const entry of rendered) {
      const { svg } = await mermaid.render('bundant-mermaid-' + renderIndex++, entry.source);
      entry.canvas.innerHTML = svg;
    }
  } catch (error) {
    console.error('mermaid: could not re-render diagram', error);
  } finally {
    rerendering = false;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderAll, { once: true });
} else {
  void renderAll();
}

new MutationObserver(() => {
  void rerender();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
