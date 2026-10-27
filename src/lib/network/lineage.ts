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
import { textOf } from '$lib/text/words';
import { shortDatesIn } from '$lib/text/datum';
import { citationRecord } from '$lib/text/citation-record';
import { TIER_LABEL, type Collection, type Relation, type Tier } from '$lib/vocabulary';
import type { ChainLayer, ChainNode } from './chain';

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
	parents,
	further: []
});

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
		const order = ['factions', 'ministries', 'cabinets', 'committees'];
		for (const b of start.neighbors?.buckets ?? []) {
			if (!relations.includes(b.relation as Relation) || b.direction !== 'outbound') continue;
			for (const item of b.items)
				if (!nodes.has(item.id))
					nodes.set(item.id, {
						node: chainNode(item, [
							{ id: startId, way: 'delegates', relation: b.relation as Relation }
						]),
						at: 1 + Math.max(0, order.indexOf(item.collection)),
						layer: layerName(item)
					});
		}
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
	const byLayer = new Map<string, { at: number; nodes: ChainNode[] }>();
	for (const { node, at, layer } of nodes.values()) {
		const key = `${at}|${layer}`;
		const l = byLayer.get(key) ?? { at, nodes: [] };
		byLayer.set(key, l);
		l.nodes.push(node);
	}
	return [...byLayer.entries()]
		.sort((a, b) => a[1].at - b[1].at || a[0].localeCompare(b[0]))
		.map(([key, l]) => ({
			id: key as ChainLayer['id'],
			label: key.split('|')[1],
			nodes: l.nodes.sort(
				(x, y) => (x.since ?? '').localeCompare(y.since ?? '') || x.name.localeCompare(y.name)
			)
		}));
}
