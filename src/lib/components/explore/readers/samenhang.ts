// The connected cases of a judgment (API 0.78, `related_to`): those its inhoudsindicatie
// names and those whose inhoudsindicatie names it. The node response carries the sentence
// that says so on each RELATED_TO edge (`meta.text`), as the judge wrote it.
import { keyEcli } from '$lib/bron/leesbaar';
import type { Neighbor } from '$lib/api/nodes';

export type Zin = {
	text: string;
	/** Whose inhoudsindicatie: this judgment's (outbound) or the other's (inbound). */
	van: 'deze' | 'die';
};

export type Samenhang = {
	key: string;
	/** The name it is known by, else its ECLI. */
	titel: string;
	instantie: string | null;
	datum: string | null;
	zinnen: Zin[];
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** One row per connected case, in the order of the edges, with every sentence that ties it. */
export function samenhangVan(
	neighbors: readonly Neighbor[],
	related: readonly { key: string; ecli?: string | null }[]
): Samenhang[] {
	const rows = new Map<string, Samenhang>();
	for (const r of related)
		rows.set(r.key, {
			key: r.key,
			titel: r.ecli ?? keyEcli(r.key) ?? 'Uitspraak',
			instantie: null,
			datum: null,
			zinnen: []
		});
	for (const n of neighbors) {
		if (n.relation !== 'RELATED_TO' || n.collection !== 'judgments') continue;
		const props = (n.props ?? {}) as Record<string, unknown>;
		const names = Array.isArray(props.names)
			? props.names.filter((x): x is string => typeof x === 'string')
			: [];
		const row = rows.get(n.key) ?? {
			key: n.key,
			titel: '',
			instantie: null,
			datum: null,
			zinnen: []
		};
		row.titel = names.length
			? names.join(', ')
			: (text(props.ecli) ?? (row.titel || keyEcli(n.key) || 'Uitspraak'));
		row.instantie = text(props.court) ?? row.instantie;
		row.datum = text(props.date) ?? row.datum;
		const meta = (n.meta ?? {}) as Record<string, unknown>;
		const zin = text(meta.text);
		if (zin && !row.zinnen.some((z) => z.text === zin))
			row.zinnen.push({ text: zin, van: n.direction === 'inbound' ? 'die' : 'deze' });
		rows.set(n.key, row);
	}
	// This judgment's own sentence first, then the other's.
	for (const row of rows.values())
		row.zinnen.sort((a, b) => (a.van === b.van ? 0 : a.van === 'deze' ? -1 : 1));
	return [...rows.values()];
}
