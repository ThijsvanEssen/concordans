// The headings in a text (`headings`: a tussenkop, the title of a table, the heading of a
// division of a bijlage), as spans of it on a line of their own. ArticleText sets them apart
// from the paragraphs around them.
import type { Schema } from '$lib/api/types';

export type Heading = Schema<'ArticleHeadingDTO'>;

type Block = { start: number; end: number };

/**
 * A block of `text` cut at the headings in it: the heading a block of its own (`heading`
 * true), the text before and after it trimmed, none empty. A heading across the block's
 * edge is no heading of it.
 */
export function withHeadings<B extends Block>(
	text: string,
	block: B,
	headings: readonly Heading[]
): (B & { heading: boolean })[] {
	const inside = headings
		.filter((h) => h.start >= block.start && h.end <= block.end && h.end > h.start)
		.sort((a, b) => a.start - b.start);
	if (!inside.length) return [{ ...block, heading: false }];
	const out: (B & { heading: boolean })[] = [];
	const plain = (start: number, end: number) => {
		const raw = text.slice(start, end);
		const s = start + raw.length - raw.trimStart().length;
		const e = s + raw.trim().length;
		if (e > s) out.push({ ...block, start: s, end: e, heading: false });
	};
	let at = block.start;
	for (const h of inside) {
		if (h.start < at) continue;
		plain(at, h.start);
		out.push({ ...block, start: h.start, end: h.end, heading: true });
		at = h.end;
	}
	plain(at, block.end);
	return out;
}
