// The filters that more than one page has, each under one name in the address: Bronnen,
// Actueel, Onderwerpen and Verbonden read and write a period, a fractie or a search under the
// same word, so a filter reads the same on every page. The address is Dutch, as the readable
// paths are; the key is the word of the API the filter asks.

/** The address name of each shared filter, by the API word it asks. */
export const PARAM = {
	q: 'q',
	since: 'van',
	until: 'tot',
	party: 'fractie',
	cabinet: 'kabinet',
	ministry: 'ministerie',
	member: 'persoon',
	coalition: 'coalitie',
	outcome: 'uitkomst',
	kind: 'soort',
	chamber: 'kamer',
	dossier: 'dossier'
} as const;

export type SharedParam = (typeof PARAM)[keyof typeof PARAM];

/**
 * A list in one param, `?soort=a,b`: its parts trimmed, each once, in their order; an old
 * name read as its new one, and what `accept` does not know left out (audit dubbele helpers).
 */
export function listParam<T extends string = string>(
	value: string | null | undefined,
	accept: (part: string) => part is T = (part): part is T => part !== '',
	renamed: Readonly<Record<string, string>> = {}
): T[] {
	const parts = (value ?? '').split(',').map((s) => renamed[s.trim()] ?? s.trim());
	return [...new Set(parts.filter(accept))];
}
