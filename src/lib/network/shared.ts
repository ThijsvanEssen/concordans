// The weergave Verband of the werkplek (besluit 39, mockup A197-b): the chosen bronnen at the
// sides, what they share between them, each shared bron with the lines by which it hangs at
// each. From /api/nodes/shared; pure, so the drawing on a wide screen and the ladder on a phone
// read one model. Judgments are counted, not drawn one by one: a much cited pair shares
// hundreds.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { relationWords } from '$lib/verbonden/relation-words';
import { capitalize, joinAnd } from '$lib/text/words';
import type { Collection, Relation } from '$lib/vocabulary';
import type { GraphEdge, GraphNode } from '$lib/graph/types';

type Shared = Schema<'SharedNeighborsResponse'>;
type Neighbor = Schema<'SharedNeighborDTO'>;

export type SharedRow = {
	id: string;
	name: string;
	collection: Collection;
	node: Neighbor;
	/** How it hangs at the chosen bronnen in one line: `Noemt Art. 6:162 BW en Art. 7:658 BW`. */
	line: string;
	/** Per chosen bron, how the shared one hangs at it: `Haalt Art. 6:162 BW aan`. */
	how: { bron: string; text: string; collection: Collection | null }[];
	/** The chosen bronnen it hangs at (their ids). */
	at: string[];
};

export type SharedModel = {
	rows: SharedRow[];
	/** The shared judgments, counted: drawn as one group; null where the count is not known. */
	judgments: number | null;
	/** The shared bronnen of every other kind beyond the rows drawn. */
	rest: number;
	total: number;
};

/** The words that are a preposition after the verb (`verwijst naar`), not a split one (`haalt aan`). */
const PREPOSITIONS = new Set(['naar', 'bij', 'van', 'met', 'voor', 'over', 'door', 'tot', 'op']);

/**
 * A verbinding said of its object: `Haalt Art. 6:162 BW aan`, `Verwijst naar Art. 6:162 BW`.
 * Without `object` the subject comes first: `Art. 6:162 BW verwijst naar deze bron`.
 */
export function sentence(active: string, name: string, side: 'naar' | 'van'): string {
	const [verb, ...rest] = active.split(' ');
	const prepositional = rest.length > 0 && PREPOSITIONS.has(rest[rest.length - 1]);
	if (side === 'naar')
		return capitalize(prepositional ? `${active} ${name}` : [verb, name, ...rest].join(' '));
	return prepositional
		? `${name} ${active} deze bron`
		: [name, verb, 'deze bron', ...rest].join(' ');
}

/**
 * The lines of one shared bron as one: those of one verb (`Noemt Art. 6:162 BW`, `Noemt Art.
 * 7:658 BW`) joined (`Noemt Art. 6:162 BW en Art. 7:658 BW`), the rest after a comma.
 */
function joinLines(
	how: readonly { text: string; name: string; active: string; side: 'naar' | 'van' }[]
): string {
	const per = new Map<string, { active: string; names: string[] }>();
	const los: string[] = [];
	for (const h of how) {
		if (h.side === 'van') {
			los.push(h.text);
			continue;
		}
		const group = per.get(h.active) ?? { active: h.active, names: [] };
		per.set(h.active, group);
		if (!group.names.includes(h.name)) group.names.push(h.name);
	}
	return [
		...[...per.values()].map((g) => sentence(g.active, joinAnd(g.names), 'naar')),
		...los
	].join(', ');
}

/** The name of a shared bron as the API gives it. */
const nameOf = (n: Neighbor) => naamVanId(n.id, n.display_name);

/**
 * The model of what `ids` share, at most `max` rows of bronnen other than judgments, in the
 * API's order (the most cited first). `namen` names a chosen bron by its id.
 */
export function sharedModel(
	shared: Shared,
	names: (id: string) => { name: string; collection: Collection | null },
	max = 8
): SharedModel {
	const rows: SharedRow[] = [];
	let judgments = 0;
	let others = 0;
	for (const bucket of shared.buckets) {
		if (bucket.collection === 'judgments') {
			judgments += bucket.total;
			continue;
		}
		others += bucket.total;
		for (const n of bucket.items) {
			if (rows.length >= max) break;
			const how = n.links.map((l) => {
				const bron = names(l.source);
				const relation = (l.relation ?? 'RELATED_TO') as Relation;
				const van = l.direction === 'outbound' ? bron.collection : (n.collection as Collection);
				const naar = l.direction === 'outbound' ? (n.collection as Collection) : bron.collection;
				const active = relationWords(relation, van, naar).actief;
				const side = l.direction === 'inbound' ? ('naar' as const) : ('van' as const);
				return {
					bron: l.source,
					collection: bron.collection,
					name: bron.name,
					active,
					side,
					text: sentence(active, bron.name, side)
				};
			});
			rows.push({
				id: n.id,
				line: joinLines(how),
				name: nameOf(n),
				collection: n.collection as Collection,
				node: n,
				how,
				at: [...new Set(n.links.map((l) => l.source))]
			});
		}
	}
	return { rows, judgments, rest: Math.max(0, others - rows.length), total: shared.total };
}

/**
 * What the canvas of the netwerk itself holds as shared, where /api/nodes/shared does not
 * answer: the bronnen between the chosen ones (`core`, the paths and the shared neighbours of
 * their nodes), each with its lines to them; those tied to more chosen bronnen first. In the
 * shape the API gives, so `verband` reads it as it reads the API's.
 */
export function sharedFromNetwork(
	chosen: readonly string[],
	core: Iterable<string>,
	nodeOf: (id: string) => GraphNode | undefined,
	edges: readonly GraphEdge[]
): Shared {
	const chosenSet = new Set(chosen);
	const items = [...core]
		.filter((id) => !chosenSet.has(id))
		.flatMap((id) => {
			const node = nodeOf(id);
			if (!node) return [];
			const links = edges
				.filter(
					(e) =>
						(e.source === id && chosenSet.has(e.target)) ||
						(e.target === id && chosenSet.has(e.source))
				)
				.map((e) => ({
					source: chosenSet.has(e.source) ? e.source : e.target,
					edge_id: e.id,
					relation: e.relation,
					direction: chosenSet.has(e.source) ? ('outbound' as const) : ('inbound' as const),
					status: null,
					confidence: null
				}));
			return links.length ? [{ node, links }] : [];
		})
		.sort(
			(a, b) =>
				new Set(b.links.map((l) => l.source)).size - new Set(a.links.map((l) => l.source)).size
		);
	const per = new Map<string, Neighbor[]>();
	for (const { node, links } of items) {
		const list = per.get(node.collection) ?? [];
		per.set(node.collection, list);
		list.push({
			id: node.id,
			key: node.key,
			collection: node.collection,
			type: node.raw?.type ?? node.collection,
			display_name: node.label,
			labels: [],
			props: node.raw?.props ?? null,
			links
		} as unknown as Neighbor);
	}
	return {
		ids: [...chosen],
		total: items.length,
		buckets: [...per].map(([collection, list]) => ({
			collection,
			type: collection,
			total: list.length,
			next_offset: null,
			items: list
		})),
		facets: { collection: [], tier: [], subject_area: [] }
	} as unknown as Shared;
}
