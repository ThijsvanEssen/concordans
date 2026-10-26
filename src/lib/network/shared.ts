// The weergave Verband of the werkplek (besluit 39, mockup A197-b): the chosen bronnen in a
// column, the verbindingen between them, and what they share, pair by pair, each shared bron
// with the lines by which it hangs at each. From /api/nodes/shared per pair; pure, so the
// drawing on a wide screen and the ladder on a phone read one model. Judgments are counted, not
// drawn one by one: a much cited pair shares hundreds.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { relationWords } from '$lib/verbonden/relation-words';
import { capitalize, joinAnd } from '$lib/text/words';
import type { Collection, Relation } from '$lib/vocabulary';

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
	/** The relations of its lines, for the filter Relatie. */
	relations: Relation[];
	/** The chosen bronnen it hangs at (their ids). */
	at: string[];
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

/** A verbinding between two chosen bronnen themselves: `Dilan Yeşilgöz lid van VVD`. */
export type DirectLink = { from: string; to: string; relation: Relation };

/**
 * How far Verband looks: a verbinding between two chosen bronnen, or one bron both are tied to
 * (/api/nodes/shared). The paths of Omgeving go further (four steps); Verband does not.
 */
export const SHARED_STEPS = 2;

export type VerbandModel = {
	/** What chosen bronnen share, each once with every chosen bron it hangs at. */
	rows: SharedRow[];
	/** Per pair, the judgments that cite both: counted, drawn as one group each. */
	judgments: { at: [string, string]; total: number }[];
	/** The verbindingen between the chosen bronnen themselves, said in words. */
	direct: { at: [string, string]; text: string; relation: Relation }[];
	/** The chosen bronnen with no verbinding to any other: said, not left floating. */
	alone: string[];
	/** The shared bronnen beyond the rows drawn. */
	rest: number;
};

/**
 * Verband of the chosen bronnen, pair by pair (Thijs, 23 Oct: a bron added never takes a
 * verband away): `answers` is /api/nodes/shared per pair, `direct` the verbindingen between
 * them. A shared bron stands once, at every chosen bron it hangs at; those that more of them
 * share first, then by pair, then in the API's order (the most cited first), then by id, so the
 * same bronnen in another order give the same Verband.
 */
export function verbandModel(
	ends: readonly string[],
	answers: readonly Shared[],
	direct: readonly DirectLink[],
	names: (id: string) => { name: string; collection: Collection | null },
	max = 12
): VerbandModel {
	const merged = new Map<string, { node: Neighbor; links: Neighbor['links']; rank: number }>();
	const judgments: VerbandModel['judgments'] = [];
	for (const shared of answers) {
		const [a, b] = [...shared.ids].sort();
		for (const bucket of shared.buckets) {
			if (bucket.collection === 'judgments') {
				if (bucket.total) judgments.push({ at: [a, b], total: bucket.total });
				continue;
			}
			bucket.items.forEach((n, rank) => {
				const known = merged.get(n.id);
				if (!known) {
					merged.set(n.id, { node: n, links: [...n.links], rank });
					return;
				}
				known.rank = Math.min(known.rank, rank);
				for (const l of n.links)
					if (!known.links.some((k) => k.edge_id === l.edge_id)) known.links.push(l);
			});
		}
	}
	const rows = [...merged.values()]
		.map(({ node, links, rank }) => ({ row: rowOf({ ...node, links }, names), rank }))
		.sort(
			(x, y) =>
				y.row.at.length - x.row.at.length ||
				x.row.at.join().localeCompare(y.row.at.join()) ||
				x.rank - y.rank ||
				x.row.id.localeCompare(y.row.id)
		)
		.map((x) => x.row);
	const said = direct.map((d) => {
		const from = names(d.from);
		const to = names(d.to);
		const w = relationWords(d.relation, from.collection, to.collection);
		return {
			at: [d.from, d.to].sort() as [string, string],
			relation: d.relation,
			text: `${from.name} ${w.actief} ${to.name}`
		};
	});
	const tied = new Set([
		...rows.flatMap((r) => r.at),
		...judgments.flatMap((j) => j.at),
		...said.flatMap((d) => d.at)
	]);
	judgments.sort((x, y) => y.total - x.total || x.at.join().localeCompare(y.at.join()));
	said.sort((x, y) => x.at.join().localeCompare(y.at.join()) || x.text.localeCompare(y.text));
	return {
		rows: rows.slice(0, max),
		judgments,
		direct: said,
		alone: ends.filter((e) => !tied.has(e)),
		rest: Math.max(0, rows.length - max)
	};
}

/** One shared bron as a row: its lines to the chosen bronnen, said and joined. */
function rowOf(
	n: Neighbor,
	names: (id: string) => { name: string; collection: Collection | null }
): SharedRow {
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
	return {
		id: n.id,
		line: joinLines(how),
		name: nameOf(n),
		collection: n.collection as Collection,
		node: n,
		how,
		at: [...new Set(n.links.map((l) => l.source))].sort(),
		relations: [...new Set(n.links.map((l) => (l.relation ?? 'RELATED_TO') as Relation))]
	};
}
