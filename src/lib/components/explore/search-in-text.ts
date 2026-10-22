// Searching the text of a bron on the page ("Zoek in dit stuk"): the text the reader shows,
// found as the reader sees it. Pure parts here; SearchInText draws the bar and the marks.

/** The shortest search: one letter finds all of them and says nothing. */
export const MIN_QUERY = 2;

/** Where the hits of `query` lie in `text`, apart from case. */
export function findHits(text: string, query: string): { start: number; end: number }[] {
	const q = query.trim().toLocaleLowerCase('nl');
	if (q.length < MIN_QUERY) return [];
	const haystack = text.toLocaleLowerCase('nl');
	const hits: { start: number; end: number }[] = [];
	for (let at = haystack.indexOf(q); at !== -1; at = haystack.indexOf(q, at + q.length))
		hits.push({ start: at, end: at + q.length });
	return hits;
}

type Part = { node: Text; start: number };

/** What is not read on the screen: no hit there. */
const SKIP = 'script, style, [hidden], [aria-hidden="true"], .sr-only, [data-search-ui]';
/** The elements that end a line: a hit does not run from one to the next. */
const BLOCK =
	'p, li, h1, h2, h3, h4, h5, h6, div, td, th, tr, section, article, blockquote, dd, dt';

/**
 * The text of `root` as one string, and where each text node of it begins in it. A break
 * stands between the text of two blocks, so a hit never spans them.
 */
export function collectText(root: Element): { text: string; parts: Part[] } {
	const parts: Part[] = [];
	let text = '';
	let previousBlock: Element | null = null;
	const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode: (n) =>
			n.parentElement?.closest(SKIP) || !n.nodeValue
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT
	});
	for (let n = walker.nextNode(); n; n = walker.nextNode()) {
		const block = n.parentElement?.closest(BLOCK) ?? null;
		if (previousBlock && block !== previousBlock) text += '\n';
		previousBlock = block;
		parts.push({ node: n as Text, start: text.length });
		text += n.nodeValue;
	}
	return { text, parts };
}

/** The ranges of the hits in the nodes that hold them (a hit across an element is one range). */
export function hitsAsRanges(
	parts: Part[],
	hits: { start: number; end: number }[],
	doc: Document
): Range[] {
	const at = (offset: number, end: boolean): [Text, number] | null => {
		for (let i = parts.length - 1; i >= 0; i--) {
			const d = parts[i];
			if (offset > d.start || (offset === d.start && !end)) {
				const local = offset - d.start;
				if (local <= d.node.length) return [d.node, local];
				if (end) return [d.node, d.node.length];
			}
		}
		return null;
	};
	const ranges: Range[] = [];
	for (const h of hits) {
		const from = at(h.start, false);
		const to = at(h.end, true);
		if (!from || !to) continue;
		const r = doc.createRange();
		r.setStart(...from);
		r.setEnd(...to);
		ranges.push(r);
	}
	return ranges;
}
