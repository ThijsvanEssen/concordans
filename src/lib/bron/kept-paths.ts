// The addresses the API gives, kept as they come in: every answer passes here, on every
// page, so a link to a bron seen anywhere is the API's address.
import { onAnswer } from '$lib/api/client';
import { onthoudArtikel } from '$lib/api/articles';
import { apiNumber, bookNumber } from '$lib/text/bw';
import { parseNodeId, type Collection } from '$lib/vocabulary';
import { onthoudTitel } from './titels.svelte';
import { keptPath, padHref, parsePad, remember, type Pad } from './address';

/**
 * The addresses the API gives (`path` beside `id`, on every bron it returns), kept as if
 * seen: a link to that bron is the API's address, not one built here. A dossier is left
 * out, since the front end names it by its number, not its key.
 */
export function keepPaths(data: unknown, depth = 0) {
	if (!data || typeof data !== 'object' || depth > 8) return;
	if (Array.isArray(data)) {
		for (const item of data) keepPaths(item, depth + 1);
		return;
	}
	const { path, key, member_key, collection } = data as Record<string, unknown>;
	const address = typeof path === 'string' ? path : articleAddress(data);
	const pad = address ? parsePad(address) : null;
	const id = (data as { id?: unknown }).id ?? idFrom(pad, collection, member_key ?? key);
	if (typeof id === 'string' && address && pad && keptPath(id) !== address) {
		const target = parseNodeId(id);
		if (target && target.collection !== 'dossiers') {
			remember(padHref(pad), id);
			// The text of an article named here can stand in the reader before its node.
			if (pad.kind === 'artikel')
				onthoudArtikel(target.key, pad.law.toUpperCase(), apiNumber(pad.law, pad.number));
		}
	}
	for (const value of Object.values(data)) {
		if (value && typeof value === 'object') keepPaths(value, depth + 1);
	}
}

/** The collection of a bron that a list gives by its key and `path` only, by what its address is. */
function collectionOfAddress(pad: Pad): Collection | null {
	switch (pad.kind) {
		case 'lid':
			return 'members';
		case 'toezegging':
			return 'commitments';
		case 'activiteit':
			return 'activities';
		case 'commissie':
			return 'committees';
		case 'zaak':
			return 'cases';
		default:
			return null;
	}
}

/**
 * The id of a bron an answer gives without one: its `collection` and key (a stuk of a list), or
 * the key of a row that is only its `path` and key (a toezegging, an activiteit, a person
 * beside their address: a cabinet's bewindspersonen, a stuk's indieners, UX-toets 0.79.47, #51).
 */
function idFrom(pad: Pad | null, collection: unknown, key: unknown): string | undefined {
	if (typeof key !== 'string') return undefined;
	if (typeof collection === 'string') return `${collection}/${key}`;
	const own = pad && collectionOfAddress(pad);
	return own ? `${own}/${key}` : undefined;
}

/**
 * An article's address where an answer names its law and number but has no path (the articles
 * a memorie explains, `explains`): as the app writes it (live-toets peek 5, C1).
 */
function articleAddress(d: object): string | null {
	const { collection, bwb_id: wet, article_number: nummer } = d as Record<string, unknown>;
	const named = collection === 'articles' && !('path' in d);
	if (!named || typeof wet !== 'string' || typeof nummer !== 'string') return null;
	return padHref({ kind: 'artikel', law: wet, number: bookNumber(wet, nummer) });
}

onAnswer((data) => {
	keepPaths(data);
	onthoudTitel(data);
});
