import { renderToStaticMarkup } from 'react-dom/server';
import { highlightCode } from '@gjuoun/bigface-highlighter/highlighter';

/**
 * Build-time highlighting. The highlighter returns React nodes, so this renders them to markup
 * once, at build: the page ships static spans and no Shiki ever reaches the client bundle.
 * Each line is a block span, which keeps the result valid inside an inline <code>.
 * Returns an empty string for a language the package does not load.
 */
export async function highlightHtml(code: string, language: string): Promise<string> {
  const lines = await highlightCode(code, language);
  if (!lines) return '';
  return renderToStaticMarkup(
    <>
      {lines.map((line, index) => (
        <span key={index} className="block">
          {line}
        </span>
      ))}
    </>,
  );
}
