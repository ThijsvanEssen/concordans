// Keten of a bron that is no regulation (Thijs, 23 Oct: "is er niet een keten voor fractie en
// Kamerlid? Of voor een uitspraak in verschillende aanleggen?"), each in layers with titles of
// its own: a judgment through its instances (APPEAL_OF: rechtbank, gerechtshof, Hoge Raad, the
// conclusie of the P-G beside the arrest by ADVISES_ON), a fractie through what it continues and
// what continues it (CONTINUES), a Kamerlid through the fracties, kabinetten and commissies of
// its seats. Read from the nodes' own buckets; pure once they are in, so the drawing on a wide
// screen and the list on a phone read one model.
import type { Schema } from '$lib/api/types';
import { naamVanId } from '$lib/bron/menselijk';
import { isMinister } from '$lib/bron/rubrieken';
import { capitalize, lowerFirst, textOf } from '$lib/text/words';
import { seatWord } from '$lib/text/zetel';
import { shortDatesIn } from '$lib/text/datum';
import { citationRecord } from '$lib/text/citation-record';
import { TIER_LABEL, type Collection, type Relation, type Tier } from '$lib/vocabulary';
import type { ChainLayer, ChainNode } from './chain';
import { PERSON_LAYERS } from './person-layers';

type NodeResponse = Schema<'NodeGraphResponse'>;
type Neighbour = NodeResponse['neighbors']['buckets'][number]['items'][number];

/** The kinds of bron with a keten of their own, and the relations it walks. */
export const LINEAGE: Partial<Record<Collection, readonly Relation[]>> = {
	judgments: ['APPEAL_OF', 'ADVISES_ON'],
	factions: ['CONTINUES'],
	members: ['MEMBER_OF', 'SERVED_IN']
};

/** One step further from a node: where its neighbour stands, before (-1) or after (+1). */
const STEP: Partial<Record<Relation, { outbound: number; inbound: number }>> = {
	// A judgment that appeals another comes after it; the conclusie comes before the arrest.
	APPEAL_OF: { outbound: -1, inbound: 1 },
	ADVISES_ON: { outbound: 0.5, inbound: -0.5 },
	// A fractie that continues another comes after it.
	CONTINUES: { outbound: -1, inbound: 1 }
};

/** A court's own name for its layer: Rechtbank, Gerechtshof, Hoge Raad, Conclusie. */
const COURT_LAYER: Partial<Record<Tier, string>> = {
	rechtbank: 'Rechtbank',
	kantongerecht: 'Kantongerecht',
	gerechtshof: 'Gerechtshof',
	hoge_raad: 'Hoge Raad',
	parket: 'Conclusie P-G'
};
const layerName = (n: { collection: string; props?: Record<string, unknown> | null }) => {
	if (n.collection === 'judgments') {
		const tier = textOf(n.props?.tier) as Tier | null;
		return (tier && (COURT_LAYER[tier] ?? TIER_LABEL[tier])) || 'Uitspraak';
	}
	return n.collection === 'factions'
		? 'Fractie'
		: n.collection === 'ministries'
			? 'Ministerie'
			: n.collection === 'cabinets'
				? 'Kabinet'
				: n.collection === 'committees'
					? 'Commissie'
					: isMinister(n.props)
						? 'Bewindspersoon'
						: 'Kamerlid';
};

/** A judgment as its reader cites it, its day short ("HR 20 dec. 2019"), as the canvas names it. */
const nameOf = (n: Pick<Neighbour, 'id' | 'collection' | 'display_name' | 'props' | 'cite'>) =>
	shortDatesIn(
		(n.collection === 'judgments' && citationRecord({ ...n, kind: 'judgment' })?.short) ||
			naamVanId(n.id, n.display_name)
	);

const chainNode = (
	n: Pick<Neighbour, 'id' | 'collection' | 'display_name' | 'props' | 'cite'>,
	parents: ChainNode['parents']
): ChainNode => ({
	id: n.id,
	name: nameOf(n),
	short: nameOf(n),
	collection: n.collection as ChainNode['collection'],
	kind: null,
	since: textOf(n.props?.date) ?? null,
	grondslag: null,
	mentions: null,
	how: null,
	parents,
	further: []
});

type Meta = Record<string, unknown>;
const year = (d: unknown) => textOf(d)?.slice(0, 4) ?? null;
/** A span of years as the list says it: `2021 – 2023`, `sinds 2025`, `tot en met 2021`. */
function span(from: unknown, to: unknown): string | null {
	const [a, b] = [year(from), year(to)];
	return a && b ? (a === b ? a : `${a} – ${b}`) : a ? `sinds ${a}` : b ? `tot en met ${b}` : null;
}
const joined = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ') || null;

/** The posts of a bewindspersoon in a kabinet (`key`) or at a ministerie, from an edge's meta. */
const postsOf = (meta: Meta, pick: (post: Meta) => boolean): Meta[] =>
	(Array.isArray(meta.posts) ? (meta.posts as Meta[]) : []).filter((p) => p && pick(p));

/** The functions and span of some posts: `Minister van Financiën, 2024`. */
function postsSaid(posts: readonly Meta[]): string | null {
	const functions = [
		...new Set(posts.map((p) => textOf(p.function)).filter((f): f is string => !!f))
	];
	const froms = posts.map((p) => textOf(p.from_date));
	const tos = posts.map((p) => textOf(p.to_date));
	return joined(
		functions.length ? capitalize(functions.join(' en ')) : null,
		span(
			froms.includes(null) ? null : [...froms].sort()[0],
			tos.includes(null) ? null : [...tos].sort().at(-1)
		)
	);
}

/**
 * How a seat of a person hangs, in the words of the list on a phone: a commissie "Plaatsvervangend
 * lid, 2024 – 2025", a fractie its memberships over the years ("Fractievoorzitter, 2018 – 2026" where
 * one role held throughout), a kabinet the posts held in it, a ministerie the kabinet it sits under.
 */
function seatHow(
	item: Pick<Neighbour, 'id' | 'collection' | 'meta'>,
	start: NodeResponse
): string | null {
	const meta = (item.meta ?? {}) as Meta;
	if (item.collection === 'cabinets')
		return postsSaid(postsOf(meta, (p) => `cabinets/${textOf(p.cabinet_key)}` === item.id));
	if (item.collection === 'ministries') {
		const byCabinet = new Map<string, Meta[]>();
		for (const p of postsOf(meta, () => true))
			byCabinet.set(textOf(p.cabinet) ?? '', [
				...(byCabinet.get(textOf(p.cabinet) ?? '') ?? []),
				p
			]);
		const said = [...byCabinet].map(([cabinet, posts]) =>
			joined(cabinet ? `Onder ${cabinet}` : null, lowerFirst(postsSaid(posts) ?? ''))
		);
		return said.filter(Boolean).join('; ') || null;
	}
	const stints = Array.isArray(start.node.props?.faction_memberships)
		? (start.node.props.faction_memberships as Meta[]).filter((m) => m.faction_id === item.id)
		: [];
	if (item.collection === 'factions' && stints.length) {
		const roles = new Set(stints.map((m) => textOf(m.role)));
		const froms = stints.map((m) => textOf(m.from_date));
		const tos = stints.map((m) => textOf(m.to_date));
		return joined(
			roles.size === 1 ? capitalize(seatWord([...roles][0]) ?? '') : null,
			span(
				froms.includes(null) ? null : [...froms].sort()[0],
				tos.includes(null) ? null : [...tos].sort().at(-1)
			)
		);
	}
	return joined(
		capitalize(seatWord(textOf(meta.role), meta.substitute === true) ?? ''),
		span(meta.from_date, meta.to_date)
	);
}

/** The words of a line between two judgments or two fracties, said of the one that hangs under. */
const LINK_WORD: Partial<Record<Relation, string>> = {
	APPEAL_OF: 'Hoger beroep van',
	ADVISES_ON: 'Conclusie van',
	CONTINUES: 'Voortzetting van'
};

/**
 * The kabinetten of a bewindspersoon in which it held a post at each ministerie, from its
 * `government_functions`: `ministries/fin` becomes `['cabinets/rutte_iv']`. A post without
 * ministerie or cabinet_key says nothing; pure.
 */
export function cabinetsOfMinistries(props: Record<string, unknown> | null | undefined) {
	const out = new Map<string, Set<string>>();
	const posts = props?.government_functions;
	for (const post of Array.isArray(posts) ? posts : []) {
		const ministry = textOf(post?.ministry);
		const cabinet = textOf(post?.cabinet_key);
		if (!ministry || !cabinet) continue;
		const set = out.get(`ministries/${ministry}`) ?? new Set<string>();
		out.set(`ministries/${ministry}`, set.add(`cabinets/${cabinet}`));
	}
	return out;
}

/** A ministerie hangs under the kabinetten of its posts that stand in the keten, else the person. */
function ministriesUnderCabinets(start: NodeResponse, nodes: Map<string, { node: ChainNode }>) {
	const cabinets = cabinetsOfMinistries(start.node.props);
	for (const [id, { node }] of nodes) {
		const under = [...(cabinets.get(id) ?? [])].filter((c) => nodes.has(c));
		if (!id.startsWith('ministries/') || !under.length) continue;
		node.parents = under.map((c) => ({ id: c, way: 'delegates', relation: 'SERVED_IN' }));
	}
}

/**
 * The lineage of `start` along `relations`: every node reached from it in at most `depth` steps
 * (asked with `ask`), in layers by where it stands, the earliest on top; each tied to the one it
 * came from. A Kamerlid stands on top, its fracties, kabinetten and commissies in layers under it.
 */
export async function lineage(
	start: NodeResponse,
	relations: readonly Relation[],
	ask: (id: string) => Promise<NodeResponse | null>,
	depth = 4
): Promise<ChainLayer[]> {
	const startId = `${start.node.collection}/${start.node.key}`;
	const nodes = new Map<string, { node: ChainNode; at: number; layer: string }>();
	nodes.set(startId, {
		node: chainNode({ ...start.node, id: startId }, []),
		at: 0,
		layer: layerName(start.node)
	});
	if (start.node.collection === 'members') {
		// A Kamerlid: what it sat in, per kind, in the order of its seats.
		const order: readonly string[] = PERSON_LAYERS;
		for (const b of start.neighbors?.buckets ?? []) {
			if (!relations.includes(b.relation as Relation) || b.direction !== 'outbound') continue;
			for (const item of b.items)
				if (!nodes.has(item.id))
					nodes.set(item.id, {
						node: {
							...chainNode(item, [
								{ id: startId, way: 'delegates', relation: b.relation as Relation }
							]),
							how: seatHow(item, start)
						},
						at: 1 + Math.max(0, order.indexOf(item.collection)),
						layer: layerName(item)
					});
		}
		ministriesUnderCabinets(start, nodes);
	} else {
		let edge: { id: string; response: NodeResponse; at: number }[] = [
			{ id: startId, response: start, at: 0 }
		];
		for (let step = 0; step < depth && edge.length; step++) {
			const next: typeof edge = [];
			for (const { id, response, at } of edge)
				for (const b of response.neighbors?.buckets ?? []) {
					const move = STEP[b.relation as Relation];
					if (!move || !relations.includes(b.relation as Relation)) continue;
					const by = b.direction === 'inbound' ? move.inbound : move.outbound;
					for (const item of b.items) {
						if (nodes.has(item.id)) continue;
						// The later one hangs under the earlier: a line from above to below.
						const here = nodes.get(id)!;
						const later = by > 0;
						const node = chainNode(
							item,
							later ? [{ id, way: 'delegates', relation: b.relation as Relation }] : []
						);
						if (!later)
							here.node.parents.push({
								id: item.id,
								way: 'delegates',
								relation: b.relation as Relation
							});
						nodes.set(item.id, {
							node,
							at: at + by,
							layer:
								item.collection === 'factions'
									? at + by < 0
										? 'Voorganger'
										: 'Opvolger'
									: layerName(item)
						});
						const response = await ask(item.id);
						if (response) next.push({ id: item.id, response, at: at + by });
					}
				}
			edge = next;
		}
	}
	// A judgment or fractie says what it hangs under: "Hoger beroep van Rb. Gelderland 7 mrt. 2017".
	if (start.node.collection !== 'members')
		for (const { node, layer } of nodes.values()) {
			const said = node.parents.flatMap((p) => {
				const word = LINK_WORD[p.relation as Relation];
				const above = nodes.get(p.id);
				const lead = p.relation === 'APPEAL_OF' && layer === 'Hoge Raad' ? 'Cassatie van' : word;
				return lead && above ? [`${lead} ${above.node.name}`] : [];
			});
			node.how = said.join('; ') || null;
		}
	const byLayer = new Map<string, { at: number; nodes: ChainNode[] }>();
	for (const { node, at, layer } of nodes.values()) {
		const key = `${at}|${layer}`;
		const l = byLayer.get(key) ?? { at, nodes: [] };
		byLayer.set(key, l);
		l.nodes.push(node);
	}
	const byDate = (x: ChainNode, y: ChainNode) =>
		(x.since ?? '').localeCompare(y.since ?? '') || x.name.localeCompare(y.name);
	// A ministerie stands under its kabinet: the ministeries in the order of their kabinetten.
	const cabinets = [...nodes.values()]
		.filter((n) => n.node.collection === 'cabinets')
		.sort((x, y) => byDate(x.node, y.node))
		.map((n) => n.node.id);
	const cabinetRank = (n: ChainNode) =>
		n.id.startsWith('ministries/')
			? Math.min(...n.parents.map((p) => cabinets.indexOf(p.id)).filter((i) => i >= 0), 99)
			: 0;
	return [...byLayer.entries()]
		.sort((a, b) => a[1].at - b[1].at || a[0].localeCompare(b[0]))
		.map(([key, l]) => ({
			id: key as ChainLayer['id'],
			label: key.split('|')[1],
			nodes: l.nodes.sort((x, y) => cabinetRank(x) - cabinetRank(y) || byDate(x, y))
		}));
}
