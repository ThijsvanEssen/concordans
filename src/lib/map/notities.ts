// The notes of a map per bron, for the network: what a node's card shows under its lines.
// Its items' own notes, each with its place (`lid 3`, `r.o. 5.7.1`); the note on its group
// (a law, a dossier) under the group's name; the map's own note under the map's name. All
// from this browser, so a hover costs no request.
import { anchorLabel } from '$lib/text/anchor';
import { groepSleutel, type Map } from './map';

export type NodeNotitie = {
	/** Where it belongs: a place in the bron, a group, the map; null for the whole bron. */
	waar: string | null;
	tekst: string;
	soort: 'item' | 'groep' | 'map';
};

/** Per bron of the map (its node id), the notes its card shows, in the map's order. */
export function notitiesPerBron(
	m: Pick<Map, 'naam' | 'items' | 'notitie' | 'groepNotities'>
): globalThis.Map<string, NodeNotitie[]> {
	const uit = new globalThis.Map<string, NodeNotitie[]>();
	const mapNotitie = m.notitie?.trim();
	const ids = [...new Set(m.items.map((i) => i.id))];
	for (const id of ids) {
		const items = m.items.filter((i) => i.id === id);
		const lijst: NodeNotitie[] = items.flatMap((i) => {
			const tekst = i.notitie?.trim();
			return tekst
				? [{ waar: i.at ? anchorLabel(i.at, i.id) : null, tekst, soort: 'item' as const }]
				: [];
		});
		const gezien = new Set<string>();
		for (const i of items) {
			const sleutel = groepSleutel(i);
			const tekst = m.groepNotities?.[sleutel]?.trim();
			if (!tekst || gezien.has(sleutel)) continue;
			gezien.add(sleutel);
			// A judgment is its own group: its note is the bron's, without a name before it.
			lijst.push({ waar: sleutel === id ? null : i.groep, tekst, soort: 'groep' });
		}
		if (mapNotitie) lijst.push({ waar: m.naam, tekst: mapNotitie, soort: 'map' });
		if (lijst.length) uit.set(id, lijst);
	}
	return uit;
}

/** The bronnen whose card holds a note of their own or of their group: these carry a mark. */
export const gemerkt = (per: ReadonlyMap<string, NodeNotitie[]>): Set<string> =>
	new Set([...per].filter(([, n]) => n.some((x) => x.soort !== 'map')).map(([id]) => id));
