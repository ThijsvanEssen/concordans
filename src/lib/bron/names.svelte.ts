// A fractie or a cabinet named in a row or a text (`D66`, `kabinet-Rutte IV`) as the bron
// it is: its key, from the lists the API gives, asked for once. A name that is not in
// the list stays text; a guessed key would be a link to nothing.
import { api, unwrap } from '$lib/api/client';
import { report } from '$lib/api/errors';
import { getCabinets } from '$lib/components/explore/index/government';
import { onForget } from '$lib/util/forget';

type Named = { key: string; names: (string | null | undefined)[] };

/** `GrKÖ` and `grko`, `GroenLinks-PvdA` and `groenlinks pvda` compare equal. */
export const normalName = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

/** The key of `name` among `items`, matched on any of their names or the key itself. */
export function keyOfName(items: Named[], name: string | null | undefined): string | null {
	if (!name) return null;
	const wanted = normalName(name);
	if (!wanted) return null;
	for (const item of items)
		if ([item.key, ...item.names].some((n) => n && normalName(n) === wanted)) return item.key;
	return null;
}

type List = 'factions' | 'cabinets';

const lists = $state<Record<List, Named[]>>({ factions: [], cabinets: [] });
/** The lists asked or in; one that failed is asked again the next time. */
const requested = new Set<List>();
onForget(() => {
	lists.factions = [];
	lists.cabinets = [];
	requested.clear();
});

const LOAD: Record<List, () => Promise<Named[]>> = {
	factions: () =>
		unwrap(api.GET('/api/factions')).then((items) =>
			items.map((f) => ({ key: f.key, names: [f.abbreviation, f.name] }))
		),
	cabinets: () => getCabinets().then((items) => items.map((c) => ({ key: c.key, names: [c.name] })))
};

/** A name stays text while its list is not in, or failed. */
function keyIn(list: List, name: string | null | undefined): string | null {
	if (!requested.has(list) && typeof window !== 'undefined') {
		requested.add(list);
		LOAD[list]()
			.then((items) => (lists[list] = items))
			.catch((e) => {
				requested.delete(list);
				report(`Namen (${list})`, e);
			});
	}
	return keyOfName(lists[list], name);
}

/** The key of the fractie a name or abbreviation stands for, once the list is in. */
export const factionKeyOf = (name: string | null | undefined) => keyIn('factions', name);

/** The key of the cabinet a name stands for (`kabinet-Rutte IV`), once the list is in. */
export const cabinetKeyOf = (name: string | null | undefined) => keyIn('cabinets', name);
