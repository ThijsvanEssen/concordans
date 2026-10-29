// The aanhef of a regulation (`preamble` of /api/instruments, API 0.80.23): who makes it, its
// Gelet op and Besluit:, a paragraph a line, its references links as in the text of an
// article. Variant B of the study (docs/claude/studie-aanhef.html in lawgraph): in the head,
// folded, in place of the line of its grondslag when open.
import type { Schema } from '$lib/api/types';
import type { Span } from './segments';

export type Preamble = Schema<'InstrumentPreambleDTO'>;

type PreambleParagraph = {
	text: string;
	/** Its references, offsets relative to `text`. */
	citations: Span[];
	/** The afkondiging, "Besluit:". */
	enacting: boolean;
};

/** The reference as a span of CitedText, where it names a bron the data holds. */
function spanOf(ref: Preamble['references'][number], shift: number): Span | null {
	const t = ref.target;
	if (!t || !t.exists) return null;
	return {
		...ref,
		start: ref.start - shift,
		end: ref.end - shift,
		target: {
			id: t.id,
			key: t.key,
			collection: t.collection,
			bwb_id: ref.bwb_id,
			official_id: null,
			article_number: ref.article,
			display_name: null
		},
		kind: t.collection === 'articles' ? 'article' : 'instrument',
		reference_kind: ref.kind,
		confidence: null,
		definition_ref: null
	};
}

/** The paragraphs of the aanhef; none for an empty one. */
export function preambleParagraphs(preamble: Preamble | null | undefined): PreambleParagraph[] {
	const text = preamble?.text ?? '';
	if (!text.trim()) return [];
	const enacting = preamble!.parts.filter((p) => p.kind === 'afkondiging');
	const out: PreambleParagraph[] = [];
	let start = 0;
	for (const line of text.split('\n')) {
		const end = start + line.length;
		if (line.trim())
			out.push({
				text: line,
				citations: preamble!.references
					.filter((r) => r.start >= start && r.end <= end)
					.flatMap((r) => spanOf(r, start) ?? []),
				enacting: enacting.some((p) => p.start <= start && end <= p.end)
			});
		start = end + 1;
	}
	return out;
}

/** "Aanhef en considerans" of a law, whose aanhef weighs; "Aanhef" of every other regulation. */
export const preambleLabel = (kind: string | null | undefined): string =>
	kind === 'wet' ? 'Aanhef en considerans' : 'Aanhef';
