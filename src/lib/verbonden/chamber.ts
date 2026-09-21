// TODO(backend B2): a document carries no chamber. The Eerste Kamer documents are
// recognisable by their key only. When `chamber` is a field, this reads it.

export type Chamber = 'TK' | 'EK';

export const chamberOf = (document: { key: string }): Chamber =>
	document.key.toLowerCase().startsWith('ek_') ? 'EK' : 'TK';

/** Kind values are the source's Dutch strings: "Memorie van toelichting", "Nota van toelichting". */
export const isExplanatory = (kind: string | null | undefined): boolean =>
	/\b(memorie|nota) van toelichting\b/i.test(kind ?? '');
