// A fractie or a cabinet named in a row or a text (`D66`, `kabinet-Rutte IV`) as the bron
// it is: its key, from the lists the API gives, asked for once. A name that is not in
// the list stays text; a guessed key would be a link to nothing.
import { api, unwrap } from '$lib/api/client';
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

const lists = $state<{ factions: Named[]; cabinets: Named[] }>({ factions: [], cabinets: [] });
let requested = false;
onForget(() => {
	lists.factions = [];
	lists.cabinets = [];
	requested = false;
});

function request() {
	if (requested || typeof window === 'undefined') return;
	requested = true;
	unwrap(api.GET('/api/factions'))
		.then((items) => {
			lists.factions = items.map((f) => ({ key: f.key, names: [f.abbreviation, f.name] }));
		})
		.catch(() => {});
	getCabinets()
		.then((items) => {
			lists.cabinets = items.map((c) => ({ key: c.key, names: [c.name] }));
		})
		.catch(() => {});
}

/** The key of the fractie a name or abbreviation stands for, once the list is in. */
export function factionKeyOf(name: string | null | undefined): string | null {
	request();
	return keyOfName(lists.factions, name);
}

/** The key of the cabinet a name stands for (`kabinet-Rutte IV`), once the list is in. */
export function cabinetKeyOf(name: string | null | undefined): string | null {
	request();
	return keyOfName(lists.cabinets, name);
}
