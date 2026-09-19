import type { ArticleCitationSpan, ArticleCitationTarget } from '$lib/api/types';

export type ArticleFragment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; target: ArticleCitationTarget };

export function buildArticleFragments(
  text: string,
  citations: ArticleCitationSpan[] = []
): ArticleFragment[] {
  const safeText = text ?? '';
  const isRenderableSpan = (
    citation: ArticleCitationSpan
  ): citation is ArticleCitationSpan & { start: number; end: number } => {
    return (
      typeof citation.start === 'number' &&
      typeof citation.end === 'number' &&
      citation.start >= 0 &&
      citation.end >= citation.start &&
      citation.start < safeText.length &&
      citation.end <= safeText.length
    );
  };

  const spans = citations.filter(isRenderableSpan)
    .sort((a, b) => a.start - b.start);

  const fragments: ArticleFragment[] = [];
  let cursor = 0;

  for (const citation of spans) {
    if (citation.start > cursor) {
      fragments.push({
        kind: 'text',
        text: safeText.slice(cursor, citation.start)
      });
    }

    fragments.push({
      kind: 'link',
      text: safeText.slice(citation.start, citation.end),
      target: citation.target
    });

    cursor = citation.end;
  }

  if (cursor < safeText.length) {
    fragments.push({ kind: 'text', text: safeText.slice(cursor) });
  }

  return fragments;
}
