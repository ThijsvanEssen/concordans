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
