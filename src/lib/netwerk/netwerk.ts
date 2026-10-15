// A network put together from bronnen chosen one by one, instead of everything
// within a number of steps of one focus. The URL holds it: ?netwerk lists the
// chosen bronnen by the name a link uses (`members/<key>`, `dossiers/37020-XV`),
// ?uit the ones switched off, and ?tussen=0 hides the bronnen that join them. They show by
// default, on a phone too (Thijs, 9 Oct), faint and clustered there as everywhere.
import type { GraphNode } from '$lib/graph/types';
import type { ContainerKind } from '$lib/graph/container-membership';
import type { Neighbor } from '$lib/api/nodes';
import { nodeId, parseNodeId, type Collection } from '$lib/vocabulary';

export type Netwerk = {
	/** The chosen bronnen, in the order they were added. */
	ids: string[];
	/** Chosen bronnen that are switched off: listed, not drawn. */
	uit: ReadonlySet<string>;
	/** Whether the bronnen that join two chosen ones are drawn. */
	tussen: boolean;
};

/** A chosen bron as the panel Netwerk lists it. */
export type NetwerkEntry = {
	/** The name a link uses: `members/<key>`, `dossiers/37020-XV`. */
	id: string;
	label: string;
	/** The full name, where `label` is short (a fractie's abbreviation). */
	titel?: string;
	collection: Collection;
	on: boolean;
	/** On, and tied to no other chosen bron. */
	alone: boolean;
	/** The API does not know it: listed so that it can be removed. */
	missing?: boolean;
	/** The bron itself, so that its name follows bron/naam.ts once law titles load. */
	node?: GraphNode;
	/** On, but hidden with a grouping switched off (a stuk of a dossier with Dossier off). */
	verborgenMet?: ContainerKind;
	/** A group the paths ran through some of its members of: how many of how many. */
	via?: { used: number; total: number };
};

/** The example the panel offers on an empty Verkenner: articles 3:4 and 3:2 of the Awb. */
export const EXAMPLE_NETWERK = ['articles/bwbr0005537_3_4', 'articles/bwbr0005537_3_2'] as const;

/** Only where the API took part of a group's members: then the chip says so. */
export const deelVan = (e: { used: number; total: number } | undefined) =>
	e && e.used < e.total ? e : undefined;

const list = (value: string | null) =>
	(value ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => parseNodeId(s) !== null);

/** `tussenStandaard`: whether the bronnen between are drawn when the URL does not say. */
export function parseNetwerk(params: URLSearchParams, tussenStandaard = true): Netwerk {
	const ids = [...new Set(list(params.get('netwerk')))];
	const uit = new Set(list(params.get('uit')).filter((id) => ids.includes(id)));
	const t = params.get('tussen');
	return { ids, uit, tussen: t === '0' ? false : t === '1' ? true : tussenStandaard };
}

/** The URL of a netwerk; ?tussen only where it differs from `tussenStandaard`. */
export function netwerkParams(n: Netwerk, tussenStandaard = true): Record<string, string | null> {
	const uit = n.ids.filter((id) => n.uit.has(id));
	return {
		netwerk: n.ids.length > 0 ? n.ids.join(',') : null,
		uit: uit.length > 0 ? uit.join(',') : null,
		tussen: n.ids.length > 0 && n.tussen !== tussenStandaard ? (n.tussen ? '1' : '0') : null
	};
}

export const isOn = (n: Netwerk, id: string) => n.ids.includes(id) && !n.uit.has(id);

export function withAdded(n: Netwerk, ...ids: string[]): Netwerk {
	const uit = new Set(n.uit);
	for (const id of ids) uit.delete(id);
	return { ...n, ids: [...new Set([...n.ids, ...ids])], uit };
}

export function withRemoved(n: Netwerk, id: string): Netwerk {
	const uit = new Set(n.uit);
	uit.delete(id);
	return { ...n, ids: n.ids.filter((x) => x !== id), uit };
}

export function withToggled(n: Netwerk, id: string): Netwerk {
	if (!n.ids.includes(id)) return n;
	const uit = new Set(n.uit);
	if (!uit.delete(id)) uit.add(id);
	return { ...n, uit };
}

/** A chosen bron that is on, with the neighbours its node response lists. */
export type Participant = {
	/** Its node id. */
	id: string;
	/** For a wet: the id its articles are grouped under (`BWBR0001854`). */
	lawId: string | null;
	neighbors: Neighbor[];
};

export type Between = {
	/** Per participant, the neighbours to draw: another participant, an article of a
	 *  chosen wet, or a bron it shares with another participant. */
	keep: Map<string, Set<string>>;
	/** Bronnen that are no participant but join two or more of them. */
	joining: Set<string>;
	/** Participants that are tied to no other participant. */
	alone: Set<string>;
};

const idOf = (n: Pick<Neighbor, 'collection' | 'key'>) => nodeId(n.collection, n.key);

/**
 * What ties the chosen bronnen together, from their own node responses: a direct
 * verbinding, one to an article of a chosen wet, or a bron two of them share (two
 * steps). Longer paths are not in these responses.
 */
export function between(
	participants: Participant[],
	lawOf: (n: Neighbor) => string | null,
	withJoining: boolean
): Between {
	const ids = new Set(participants.map((p) => p.id));
	const laws = new Map<string, string>();
	for (const p of participants) if (p.lawId) laws.set(p.lawId.toUpperCase(), p.id);

	// Which participants reach each neighbour.
	const reachedBy = new Map<string, Set<string>>();
	for (const p of participants) {
		for (const n of p.neighbors) {
			const id = idOf(n);
			if (id === p.id) continue;
			let set = reachedBy.get(id);
			if (!set) reachedBy.set(id, (set = new Set()));
			set.add(p.id);
		}
	}

	const keep = new Map<string, Set<string>>();
	const joining = new Set<string>();
	const tied = new Set<string>();
	const tie = (a: string, b: string) => {
		if (a === b) return;
		tied.add(a);
		tied.add(b);
	};
	for (const p of participants) {
		const kept = new Set<string>();
		for (const n of p.neighbors) {
			const id = idOf(n);
			if (id === p.id) continue;
			if (ids.has(id)) {
				kept.add(id);
				tie(p.id, id);
				continue;
			}
			const law = lawOf(n)?.toUpperCase();
			const wet = law ? laws.get(law) : undefined;
			if (wet && wet !== p.id) {
				kept.add(id);
				tie(p.id, wet);
				continue;
			}
			const by = reachedBy.get(id)!;
			if (by.size < 2) continue;
			for (const other of by) tie(p.id, other);
			if (!withJoining) continue;
			kept.add(id);
			joining.add(id);
		}
		keep.set(p.id, kept);
	}

	const alone = new Set(participants.map((p) => p.id).filter((id) => !tied.has(id)));
	return { keep, joining, alone };
}
