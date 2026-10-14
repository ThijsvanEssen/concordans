// API 0.5 gives a document its `chamber` and `is_explanatory`. Before that, the Eerste
// Kamer documents are recognisable by their key only and the kind is read.
// TODO(backend B2): the fallbacks go when every document carries the fields.

import type { Chamber } from '$lib/components/parliamentary/chamber';

export const chamberOf = (document: { key: string; chamber?: string | null }): Chamber =>
	document.chamber === 'EK' || document.chamber === 'TK'
		? document.chamber
		: document.key.toLowerCase().startsWith('ek_')
			? 'EK'
			: 'TK';

/** Kind values are the source's Dutch strings: "Memorie van toelichting", "Nota van toelichting". */
export const isExplanatory = (document: {
	kind?: string | null;
	is_explanatory?: boolean | null;
}): boolean =>
	typeof document.is_explanatory === 'boolean'
		? document.is_explanatory
		: /\b(memorie|nota) van toelichting\b/i.test(document.kind ?? '');
