// Node keys as the API makes them (lawgraph `make_node_key`, `text_fold.ascii_slug`): the
// parts joined by `_`, folded to lower case without accents, every run of other characters
// one `_`, none at the edges. One rule, so a key built here finds the node the API has.

/** Lower case without accents, as the API folds: `Yeşilgöz` is `yesilgoz`, `ĳ` is `ij`. */
export const fold = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** One part of a key: a letter without an accent to take off is left out (`ß`, `°`). */
const part = (s: string | null | undefined): string =>
	fold(s ?? '')
		.replace(/[^\p{ASCII}]/gu, '')
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

/** The key of a node from its parts: `21501-02` is `21501_02`; empty without any. */
export const nodeKey = (...parts: (string | null | undefined)[]): string =>
	parts.map(part).filter(Boolean).join('_');
