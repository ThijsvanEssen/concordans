const BWB_REGEX = /^BW[A-Z0-9]+$/i;
const ARTICLE_NUMBER_REGEX = /^[0-9]+[A-Za-z0-9-]*$/i;
const SKIP_ARTICLE_TOKENS = new Set(['art', 'artikel']);

type BaseArticleTarget = {
  kind: 'article';
  bwb_id: string;
  article_number: string;
};

type BaseJudgmentTarget = {
  kind: 'judgment';
  ecli: string;
};

type BaseNodeTarget = {
  kind: 'node';
  collection: string;
  key: string;
};

type ExploreTarget = {
  kind: 'explore';
  q: string;
};

export type SearchTarget =
  | BaseArticleTarget
  | BaseJudgmentTarget
  | BaseNodeTarget
  | ExploreTarget;

function normalizeInput(rawInput: string): string {
  let normalized = rawInput.trim();

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      normalized = url.pathname + url.search;
    } catch {
      normalized = normalized.replace(/^https?:\/\//i, '');
    }
  }

  return normalized.replace(/[;,]+/g, ' ').trim();
}

function splitSegments(value: string): string[] {
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractTokens(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.replace(/\.$/, ''))
    .filter(Boolean);
}

export function parseSearchQuery(input: string): SearchTarget {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: 'explore', q: trimmed };
  }

  const normalized = normalizeInput(trimmed);
  const segments = splitSegments(normalized);
  const firstSegment = segments[0]?.toLowerCase();

  if (firstSegment === 'articles' && segments.length >= 3) {
    return {
      kind: 'article',
      bwb_id: segments[1],
      article_number: segments[2]
    };
  }

  if (firstSegment === 'judgments' && segments.length >= 2) {
    return {
      kind: 'judgment',
      ecli: segments.slice(1).join('/')
    };
  }

  if (firstSegment === 'nodes' && segments.length >= 3) {
    return {
      kind: 'node',
      collection: segments[1],
      key: segments[2]
    };
  }

  if (
    segments.length === 2 &&
    firstSegment &&
    !['articles', 'judgments', 'nodes'].includes(firstSegment)
  ) {
    return {
      kind: 'node',
      collection: segments[0],
      key: segments[1]
    };
  }

  const ecliMatch = normalized.match(/ecli:\s*[^\s]+/i);
  if (ecliMatch) {
    return {
      kind: 'judgment',
      ecli: ecliMatch[0].replace(/\s+/g, '').toUpperCase()
    };
  }

  const tokens = extractTokens(normalized);
  const bwbToken = tokens.find((token) => BWB_REGEX.test(token));
  const articleToken = tokens.find((token) => {
    const lower = token.toLowerCase();
    if (SKIP_ARTICLE_TOKENS.has(lower)) {
      return false;
    }
    if (token.includes(':')) {
      return false;
    }

    return ARTICLE_NUMBER_REGEX.test(token);
  });

  if (bwbToken && articleToken) {
    return {
      kind: 'article',
      bwb_id: bwbToken.toUpperCase(),
      article_number: articleToken
    };
  }

  return { kind: 'explore', q: trimmed };
}
