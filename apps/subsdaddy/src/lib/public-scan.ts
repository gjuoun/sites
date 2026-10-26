/**
 * Local identifiers that must never reach committed data or dist/: the two OpenCode subscription
 * account labels and the pre-plan lane ids. Plan ids (e.g. "zai-glm-max") are public and pass.
 */
const LOCAL_IDENTIFIERS = [/(?<![\w-])(?:jun1|jun2)(?![\w-])/g, /(?<![\w-])(?:go-1|go-2|cc|qwen|zai)(?![\w-])/g];

export function findLocalIdentifiers(text: string): string[] {
  const hits: string[] = [];
  for (const re of LOCAL_IDENTIFIERS) {
    for (const m of text.matchAll(re)) hits.push(m[0]);
  }
  return [...new Set(hits)];
}
