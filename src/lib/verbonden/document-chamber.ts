// The chamber of a document or vote, and whether a document is a toelichting. A list of a
// dossier's documents gives `chamber` and `is_explanatory`; a neighbour in a node response
// carries neither in its props, and then the key (`ek_…`) and the kind tell.

import type { Chamber } from '$lib/components/parliamentary/chamber';

export const chamberOfDocument = (document: { key: string; chamber?: string | null }): Chamber =>
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
