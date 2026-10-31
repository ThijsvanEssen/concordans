// The addresses the API gives, kept as they come in: every answer passes here, on every
// page, so a link to a bron seen anywhere is the API's address.
import { onAnswer } from '$lib/api/client';
import { onthoudArtikel } from '$lib/api/articles';
import { apiNumber, bookNumber } from '$lib/text/bw';
import { parseNodeId } from '$lib/vocabulary';
import { onthoudTitel } from './titels.svelte';
import { keptPath, padHref, parsePad, remember } from './address';

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
	const { path, key, member_key } = data as Record<string, unknown>;
	// A person is named by the key of the lid beside their address, without an id: a cabinet's
	// bewindspersonen, a stuk's indieners, the lid of a toezegging (UX-toets 0.79.47, #51).
	const lidKey = member_key ?? key;
	const id =
		(data as { id?: unknown }).id ??
		(typeof path === 'string' && path.startsWith('/leden/') && typeof lidKey === 'string'
			? `members/${lidKey}`
			: undefined);
	const address = typeof path === 'string' ? path : articleAddress(data);
	if (typeof id === 'string' && address && keptPath(id) !== address) {
		const target = parseNodeId(id);
		const pad = parsePad(address);
		if (target && pad && target.collection !== 'dossiers') {
			remember(padHref(pad), id);
			// The text of an article named here can stand in the reader before its node.
			if (pad.soort === 'artikel')
				onthoudArtikel(target.key, pad.wet.toUpperCase(), apiNumber(pad.wet, pad.nummer));
		}
	}
	for (const value of Object.values(data)) {
		if (value && typeof value === 'object') keepPaths(value, depth + 1);
	}
}

/**
 * An article's address where an answer names its law and number but has no path (the articles
 * a memorie explains, `explains`): as the app writes it (live-toets peek 5, C1).
 */
function articleAddress(d: object): string | null {
	const { collection, bwb_id: wet, article_number: nummer } = d as Record<string, unknown>;
	const named = collection === 'articles' && !('path' in d);
	if (!named || typeof wet !== 'string' || typeof nummer !== 'string') return null;
	return padHref({ soort: 'artikel', wet, nummer: bookNumber(wet, nummer) });
}

onAnswer((data) => {
	keepPaths(data);
	onthoudTitel(data);
});
