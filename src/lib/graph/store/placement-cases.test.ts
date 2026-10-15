// Where a verbinding lands on the canvas, for every loader that puts one there: in a hull, on
// a line (to an anchor or not), or nowhere. Each bron kind against each other kind, by each
// relation the rules look at and both directions, through the node response (a focus, a
// netwerk with what joins its chosen bronnen), a neighbourhood, the paths between chosen
// bronnen and the rows Verbonden puts on the canvas; then the real bronnen of the fixtures
// as Verbonden (kern, inhoud, verbonden) and the netwerk show them. What a change to the
// placement rules must leave as it is (code-eenvoud F93).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Schema } from '$lib/api/types';
import { getNodeGraph } from '$lib/api/nodes';
import { fakeApi, fail } from '$lib/test/fakeApi';
import { opname } from '$lib/test/opname';
import { isInhoudGroep, isKernGroep } from '$lib/bron/behoort';
import { createVerbondenSource } from '$lib/verbonden/source';
import { NODE_TYPES, nodeId, type Collection, type Relation } from '$lib/vocabulary';
import type { GraphNode } from '../types';
import { createGraphContext, type GraphContext } from './context';
import { createExpansion } from './expansion';
import { createViewActions } from './view-actions';
import { createCompose } from './compose';
import type { CanvasRow, GraphStore } from './types';

type BaseNode = Schema<'BaseNodeDTO'>;
type Response = Schema<'NodeGraphResponse'>;

const fixture = (name: string): Record<string, unknown> =>
	JSON.parse(
		readFileSync(
			fileURLToPath(new URL(`../../fixtures/verbonden/${name}.json`, import.meta.url)),
			'utf8'
		)
	);
const BLADEREN = JSON.parse(
	readFileSync(fileURLToPath(new URL('../../test/bladeren.json', import.meta.url)), 'utf8')
) as Record<string, { items?: Record<string, unknown>[] } | Record<string, unknown>[]>;

const BRONNEN = [
	{ name: 'artikel', collection: 'articles', key: 'bwbr0005537_8_72' },
	{ name: 'wet', collection: 'instruments', key: 'bwbr0005537' },
	{ name: 'uitspraak', collection: 'judgments', key: 'ecli_nl_hr_2024_1769' },
	{ name: 'dossier', collection: 'dossiers', key: '36764' },
	{ name: 'kamerstuk', collection: 'documents', key: '04739c40_e398_4e5a_a205_654b789b6731' }
] as const;

/** The node response of a fixture bron as the canvas asks it (a few per bucket). */
const responseOf = (name: string, collection: string, key: string): Response =>
	fixture(name)[
		`/api/nodes/{collection}/{key} ${JSON.stringify({ collection, key })} {"limit":5}`
	] as Response;

const RESPONSES = Object.fromEntries(
	BRONNEN.map((b) => [b.name, responseOf(b.name, b.collection, b.key)])
) as Record<(typeof BRONNEN)[number]['name'], Response>;

/** A list item of Bladeren as a node of the graph. */
const asNode = (collection: Collection, item: Record<string, unknown>): BaseNode => ({
	id: nodeId(collection, String(item.key)),
	key: String(item.key),
	collection,
	type: NODE_TYPES[collection],
	display_name: String(item.display_name ?? item.name ?? item.title ?? item.key),
	labels: [],
	props: item,
	path: null
});

const listOf = (name: string) => {
	const v = BLADEREN[name];
	return Array.isArray(v) ? v : (v.items ?? []);
};

/** Two real bronnen of each kind: the fixture bronnen and their neighbours, then Bladeren. */
function pool(): Map<Collection, BaseNode[]> {
	const out = new Map<Collection, BaseNode[]>();
	const add = (n: BaseNode) => {
		const c = n.collection as Collection;
		const list = out.get(c) ?? [];
		if (!list.some((m) => m.key === n.key)) list.push(n);
		out.set(c, list);
	};
	for (const r of Object.values(RESPONSES)) add(r.node);
	for (const r of Object.values(RESPONSES))
		for (const b of r.neighbors.buckets ?? []) for (const n of b.items) add(n);
	for (const c of ['instruments', 'judgments', 'dossiers', 'documents'] as const)
		for (const item of listOf(c)) add(asNode(c, item));
	for (const c of ['members', 'factions', 'committees', 'cabinets'] as const)
		for (const item of listOf(c)) add(asNode(c, item));
	// One zaak in the fixtures: the second is the same with another key.
	for (const [c, list] of out)
		if (list.length === 1)
			out.set(c, [
				...list,
				{ ...list[0], key: `${list[0].key}_b`, id: nodeId(c, `${list[0].key}_b`) }
			]);
	return out;
}
const POOL = pool();

const KINDS: Collection[] = [
	'instruments',
	'articles',
	'documents',
	'dossiers',
	'cases',
	'judgments',
	'members',
	'factions',
	'committees',
	'cabinets'
];

/** The relations the rules tell apart: part, seat, other membership, change, a semantic one. */
const RELATIONS: Relation[] = ['PART_OF', 'MEMBER_OF', 'SERVED_IN', 'AMENDS', 'REFERS_TO'];
/** Under the semantic threshold: a semantic edge with it stays out where the threshold counts. */
const CONFIDENCE = 0.1;
const SEAT = { from_date: '2020-01-01', to_date: null };

type Direction = 'inbound' | 'outbound';

/** The canvas in words: its nodes (`*` an anchor), its lines and its hulls. */
function describeCanvas(
	ctx: GraphContext,
	alias: (id: string) => string = (id) => id,
	labels = true
): string {
	const nodes = [...ctx.nodes.values()].map((n) => `${alias(n.id)}${n.anchor ? '*' : ''}`).sort();
	const edges = [...ctx.edges.values()]
		.map(
			(e) =>
				`${alias(e.source)} -${e.relation}-> ${alias(e.target)}` +
				(e.status ? ` (${e.status})` : '') +
				(e.meta ? ' +meta' : '')
		)
		.sort();
	const hulls: string[] = [];
	const groups = get(ctx.containers.groups);
	for (const id of [...groups.keys()].sort()) {
		const g = groups.get(id)!;
		const members = [...g.members]
			.map((m) => {
				const p = g.periods.get(m);
				return `${alias(m)}${g.parts.has(m) ? ' part' : ''}${p ? ` ${p.from}..${p.to ?? ''}` : ''}`;
			})
			.sort();
		hulls.push(
			`${alias(id)} ${g.kind}${labels && g.label ? ` "${g.label}"` : ''}${g.lone ? ' lone' : ''} [${members.join(', ')}]`
		);
	}
	return [
		`nodes: ${nodes.join(', ')}`,
		...(edges.length ? [`lines: ${edges.join('; ')}`] : []),
		...(hulls.length ? [`hulls: ${hulls.join('; ')}`] : [])
	].join(' | ');
}

/** A node response, of which the canvas reads the node and its neighbours. */
const asResponse = (r: Pick<Response, 'node' | 'neighbors'>) => r as unknown as Response;

const withoutNeighbours = (node: BaseNode): Response =>
	asResponse({ node, neighbors: { total: 0, buckets: [] } });

/** The response of `centre` with `other` as its one neighbour. */
const responseWith = (
	centre: BaseNode,
	other: BaseNode,
	relation: Relation,
	direction: Direction
): Response =>
	asResponse({
		node: centre,
		neighbors: {
			total: 1,
			buckets: [
				{
					relation,
					collection: other.collection,
					direction,
					type: other.type,
					total: 1,
					next_offset: null,
					items: [
						{
							edge_id: 'e1',
							status: null,
							...other,
							relation,
							direction,
							confidence: CONFIDENCE,
							meta: SEAT
						}
					]
				}
			]
		}
	});

/** A subgraph of `centre` and `other`, one edge between them. */
const subgraphWith = (
	centre: BaseNode,
	other: BaseNode,
	relation: Relation,
	direction: Direction
) => {
	const [source, target] = direction === 'outbound' ? [centre, other] : [other, centre];
	return {
		nodes: [centre, other],
		edges: [
			{
				id: 'e1',
				source: source.id,
				target: target.id,
				relation,
				confidence: CONFIDENCE,
				meta: SEAT
			}
		]
	};
};

/** A fresh canvas with every loader on it. */
function canvas() {
	const ctx = createGraphContext();
	return {
		ctx,
		...createExpansion(ctx),
		...createViewActions(ctx),
		...createCompose(ctx)
	};
}
type Canvas = ReturnType<typeof canvas>;

/** Lets the paths' dossiers and the hulls' batching settle. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** The neighbourhood the fake API answers next. */
let neighbourhood: Schema<'NodeNeighborhoodResponse'> | null = null;

type Mode = 'node' | 'joins' | 'neighbourhood' | 'path' | 'rows';

const MODES: Record<
	Mode,
	(c: Canvas, centre: BaseNode, other: BaseNode, r: Relation, d: Direction) => Promise<void>
> = {
	node: async ({ ctx }, centre, other, r, d) => {
		ctx.mergeResponse(responseWith(centre, other, r, d));
	},
	joins: async ({ ctx }, centre, other, r, d) => {
		ctx.mergeInto(
			responseWith(centre, other, r, d),
			Number.POSITIVE_INFINITY,
			undefined,
			() => true
		);
		ctx.emit();
	},
	neighbourhood: async (c, centre, other, r, d) => {
		neighbourhood = { focal_id: centre.id, ...subgraphWith(centre, other, r, d) } as never;
		await c.expandNeighborhood(centre.collection as Collection, centre.key);
	},
	path: async (c, centre, other, r, d) => {
		const sub = subgraphWith(centre, other, r, d);
		await c.mergePaths({
			ids: [centre.id, other.id],
			paths: [
				{
					source: centre.id,
					target: other.id,
					node_ids: [centre.id, other.id],
					edge_ids: ['e1']
				}
			],
			...sub
		} as never);
	},
	rows: async (c, centre, other, r, d) => {
		c.ctx.mergeResponse(withoutNeighbours(centre));
		const row: CanvasRow = {
			ref: { collection: other.collection as Collection, key: other.key },
			title: other.display_name ?? other.key,
			relation: r,
			direction: d,
			props: other.props ?? {},
			period: { from: SEAT.from_date, to: null }
		};
		c.showRows(centre.id, [row]);
	}
};

describe('a verbinding between two bronnen', () => {
	beforeEach(() => {
		neighbourhood = null;
		fakeApi({
			'/api/instruments': { items: [], total: 0 },
			'/api/nodes/{collection}/{key}': fail(404),
			'/api/nodes/{collection}/{key}/neighborhood': () => neighbourhood
		});
	});

	describe.each(Object.keys(MODES) as Mode[])('through %s', (mode) => {
		it('lands where it landed', async () => {
			const out: string[] = [];
			for (const a of KINDS) {
				for (const b of KINDS) {
					const centre = POOL.get(a)![0];
					const other = POOL.get(b)![a === b ? 1 : 0];
					const alias = (id: string) => (id === centre.id ? 'C' : id === other.id ? 'N' : id);
					for (const d of ['outbound', 'inbound'] as const) {
						// The relations that land alike, on one line.
						const alike = new Map<string, Relation[]>();
						for (const r of RELATIONS) {
							const c = canvas();
							await MODES[mode](c, centre, other, r, d);
							await settle();
							const landed = describeCanvas(c.ctx, alias, false);
							alike.set(landed, [...(alike.get(landed) ?? []), r]);
						}
						for (const [landed, rs] of alike)
							out.push(`${a} ${d === 'outbound' ? '->' : '<-'} ${b} ${rs.join(', ')}: ${landed}`);
					}
				}
			}
			expect(out).toMatchSnapshot();
		});
	});
});

describe.each(BRONNEN)('the $name in the netwerk', ({ name }) => {
	beforeEach(() => {
		neighbourhood = null;
		fakeApi({
			'/api/instruments': { items: [], total: 0 },
			'/api/nodes/{collection}/{key}': fail(404),
			'/api/nodes/{collection}/{key}/neighborhood': () => neighbourhood
		});
	});
	const response = () => RESPONSES[name];
	/** The response as a neighbourhood: the bron, its neighbours and an edge to each. */
	const asSubgraph = () => {
		const r = response();
		const items = (r.neighbors.buckets ?? []).flatMap((b) => b.items);
		return {
			nodes: [r.node, ...items],
			edges: items.map((n, i) => ({
				id: `e${i}`,
				source: n.direction === 'outbound' ? r.node.id : n.id,
				target: n.direction === 'outbound' ? n.id : r.node.id,
				relation: n.relation,
				confidence: n.confidence,
				status: n.status
			}))
		};
	};

	it('as the focus, with what joins it, around it and on paths', async () => {
		const focus = canvas();
		focus.ctx.mergeResponse(response());
		const joins = canvas();
		joins.ctx.mergeInto(response(), Number.POSITIVE_INFINITY, undefined, () => true);
		joins.ctx.emit();
		const around = canvas();
		neighbourhood = { focal_id: response().node.id, ...asSubgraph() } as never;
		await around.expandNeighborhood(response().node.collection as Collection, response().node.key);
		const paths = canvas();
		const sub = asSubgraph();
		await paths.mergePaths({
			ids: [response().node.id],
			paths: sub.edges.map((e) => ({
				source: e.source,
				target: e.target,
				node_ids: [e.source, e.target],
				edge_ids: [e.id]
			})),
			...sub
		} as never);
		await settle();
		expect({
			focus: describeCanvas(focus.ctx).split(' | '),
			joins: describeCanvas(joins.ctx).split(' | '),
			neighbourhood: describeCanvas(around.ctx).split(' | '),
			paths: describeCanvas(paths.ctx).split(' | ')
		}).toMatchSnapshot();
	});
});

describe('two fixture bronnen marked in one netwerk', () => {
	beforeEach(() => {
		fakeApi({ '/api/instruments': { items: [], total: 0 } });
	});
	const PAIRS = [
		['artikel', 'uitspraak'],
		['artikel', 'wet'],
		['dossier', 'kamerstuk'],
		['wet', 'kamerstuk'],
		['uitspraak', 'dossier']
	] as const;
	it.each(PAIRS)('%s and %s', async (a, b) => {
		const c = canvas();
		c.compose({
			participants: [{ response: RESPONSES[a] }, { response: RESPONSES[b] }],
			withJoining: true,
			fresh: true
		});
		await settle();
		expect(describeCanvas(c.ctx).split(' | ')).toMatchSnapshot();
	});
});

describe.each(BRONNEN)('the rows of Verbonden of the $name', ({ name, collection, key }) => {
	it('land on the canvas per group', { timeout: 10_000 }, async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		opname(fileURLToPath(new URL(`../../fixtures/verbonden/${name}.json`, import.meta.url)));
		const store = {
			nodeResponse: (c: Collection, k: string) => getNodeGraph(c, k)
		} as unknown as GraphStore;
		const source = createVerbondenSource(store);
		source.load({ id: `${collection}/${key}`, collection, key } as GraphNode);
		await vi.waitFor(() => {
			const st = get(source);
			expect(st.groups.length).toBeGreaterThan(0);
			expect(st.loading).toBe(false);
		});
		const st = get(source);
		source.destroy();
		const node = RESPONSES[name].node;
		const props = (node.props ?? {}) as Record<string, unknown>;
		const out: Record<string, string[]> = {};
		for (const g of st.groups) {
			const rows = g.rows.filter((r) => r.relation && r.direction) as CanvasRow[];
			if (!rows.length) continue;
			const c = canvas();
			c.ctx.mergeResponse(withoutNeighbours(node));
			c.showRows(node.id, rows);
			await settle();
			const place = isKernGroep(collection, g)
				? 'kern'
				: isInhoudGroep(collection, g, props)
					? 'inhoud'
					: 'verbonden';
			out[`${g.id} (${place})`] = describeCanvas(c.ctx).split(' | ');
		}
		expect(out).toMatchSnapshot();
	});
});
