import Graph from 'graphology';
import { describe, expect, it } from 'vitest';
import type { ContainerGroup } from '$lib/graph/container-membership';
import {
	anchorWithHull,
	hullLinkOf,
	layoutHulls,
	unstacked,
	type HullGroups,
	type HullScene
} from './hulls';

const group = (
	id: string,
	kind: ContainerGroup['kind'],
	label: string,
	members: string[]
): ContainerGroup => ({
	kind,
	id,
	label,
	fullLabel: `${label} voluit`,
	members: new Set(members),
	parts: new Set(members),
	periods: new Map()
});

/**
 * A small fixed canvas: a dossier of two stukken that change a wet (its anchor and one
 * article), and a judgment outside both that cites the wet.
 */
function scene(over: Partial<HullScene> = {}): HullScene {
	const graph = new Graph();
	const node = (
		id: string,
		x: number,
		y: number,
		collection: string,
		kind: string,
		anchor = false
	) =>
		graph.addNode(id, { x, y, collection, kind, anchor, anchorNaam: anchor ? 'Awb' : undefined });
	node('s1', 0, 0, 'documents', 'document');
	node('s2', 40, 0, 'documents', 'document');
	node('wet', 300, 0, 'instruments', 'instrument', true);
	node('art', 300, 40, 'articles', 'article');
	node('j', 150, 200, 'judgments', 'judgment');
	graph.addDirectedEdgeWithKey('e1', 's1', 'wet', { relation: 'AMENDS', status: 'voorgesteld' });
	graph.addDirectedEdgeWithKey('e2', 's2', 'wet', { relation: 'AMENDS', status: 'voorgesteld' });
	graph.addDirectedEdgeWithKey('e3', 'j', 'wet', { relation: 'REFERS_TO', status: null });
	const groups = new Map([
		['D', group('D', 'dossier', 'Kamerstuk 36000', ['s1', 's2'])],
		['W', group('W', 'instrument', '', ['wet', 'art'])]
	]);
	const groupsOf = new Map<string, Set<string>>();
	for (const g of groups.values())
		for (const id of g.members) groupsOf.set(id, new Set([...(groupsOf.get(id) ?? []), g.id]));
	return {
		graph,
		groups,
		groupsOf,
		drawn: () => true,
		hiddenKinds: new Set(),
		isHidden: () => false,
		toViewport: ({ x, y }) => ({ x: x + 100, y: 300 - y }),
		radiusOf: () => 6,
		namesOf: (g) => ({ short: g.label || 'Awb', full: g.fullLabel }),
		labelWidth: (text) => text.length * 6 + 18,
		width: 800,
		zoomedOut: false,
		avoid: null,
		hoveredHullId: null,
		hoveredId: null,
		hoveredNeighbours: new Set(),
		focusedId: null,
		pinnedIds: new Set(),
		focusName: undefined,
		...over
	};
}

const round = (value: unknown): unknown =>
	JSON.parse(
		JSON.stringify(value, (_k, v) =>
			typeof v === 'number'
				? Math.round(v)
				: typeof v === 'string'
					? v.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))))
					: v
		)
	);

describe('the hulls of a small canvas', () => {
	it('draws each group, one line hull to hull and one from the judgment to the wet', () => {
		const { hulls, links } = layoutHulls(scene());
		expect(round(hulls)).toMatchInlineSnapshot(`
			[
			  {
			    "color": "#d3762d",
			    "dash": "6 4",
			    "dim": false,
			    "id": "D",
			    "label": "Kamerstuk 36000",
			    "labelX": 100,
			    "labelY": 276,
			    "long": false,
			    "path": "M 100 316 A 16 16 0 0 1 100 284 L 140 284 A 16 16 0 0 1 140 316 Z",
			  },
			  {
			    "color": "#00487c",
			    "dim": false,
			    "id": "W",
			    "label": "Awb",
			    "labelX": 400,
			    "labelY": 236,
			    "long": false,
			    "path": "M 384 260 A 16 16 0 1 0 416 260 A 16 16 0 1 0 384 260 Z",
			  },
			]
		`);
		expect(round(links)).toMatchInlineSnapshot(`
			[
			  {
			    "arrow": "M 384 262 L 378 267 L 377 260 Z",
			    "color": "#00487c",
			    "d": "M 140 297 L 377 263",
			    "dashed": true,
			    "dim": false,
			    "id": "D->W",
			    "label": null,
			    "labelX": 262,
			    "labelY": 280,
			  },
			  {
			    "arrow": "M 389 248 L 382 246 L 387 241 Z",
			    "color": "#4b5563",
			    "d": "M 255 106 L 384 243",
			    "dashed": false,
			    "dim": false,
			    "id": "anker:j->W",
			    "label": null,
			    "labelX": 322,
			    "labelY": 177,
			  },
			]
		`);
	});

	it('names the hovered hull in full and lights its lines; the rest steps back', () => {
		const { hulls, links } = layoutHulls(scene({ hoveredHullId: 'D' }));
		expect(hulls.map((h) => [h.id, h.label, h.dim])).toEqual([
			['D', 'Kamerstuk 36000 voluit', false],
			['W', 'Awb', false]
		]);
		expect(links.map((l) => [l.id, l.label, l.dim])).toEqual([
			['D->W', 'wijzigt, voorgesteld', false],
			['anker:j->W', null, false]
		]);
	});

	it('steps back from a hull a hovered bron is not in nor tied to', () => {
		const { hulls } = layoutHulls(scene({ hoveredId: 'art', hoveredNeighbours: new Set(['wet']) }));
		expect(hulls.map((h) => [h.id, h.dim])).toEqual([
			['D', false],
			['W', false]
		]);
		const alone = layoutHulls(scene({ hoveredId: 'j', hoveredNeighbours: new Set() }));
		expect(alone.hulls.map((h) => [h.id, h.dim])).toEqual([
			['D', true],
			['W', true]
		]);
	});

	it('draws no hull of a grouping switched off, and no hull of one stuk', () => {
		expect(
			layoutHulls(scene({ hiddenKinds: new Set(['dossier']) })).hulls.map((h) => h.id)
		).toEqual(['W']);
		expect(layoutHulls(scene({ isHidden: (id) => id === 's2' })).hulls.map((h) => h.id)).toEqual([
			'W'
		]);
	});

	it('finds a hull by its shape or its name', () => {
		const { hitAreas } = layoutHulls(scene());
		expect(hitAreas.map((a) => a.id)).toEqual(['D', 'W']);
		expect(hitAreas[0].label.h).toBe(22);
	});
});

describe('the lines to an anchor', () => {
	const h = (): HullGroups => scene();
	it('joins the hull of a stuk to the hull of the wet it changes', () => {
		expect(hullLinkOf('s1', 'wet', h())).toEqual({ from: 'D', to: 'W' });
		expect(hullLinkOf('j', 'wet', h())).toBeNull();
		expect(hullLinkOf('s1', 's2', h())).toBeNull();
	});
	it('says an anchor is drawn as its hull while that hull is drawn', () => {
		expect(anchorWithHull('wet', h())).toBe(true);
		expect(anchorWithHull('wet', { ...h(), hiddenKinds: new Set(['instrument']) })).toBe(false);
		expect(anchorWithHull('j', h())).toBe(false);
	});
});

describe('the names of the hulls (UX review N4, N8)', () => {
	it('names a wet whose anchor stands alone, in a netwerk zoomed out (Gemw, tussen=0)', () => {
		// Only the anchor of W drawn; a chosen bron elsewhere and zoomed out: still named.
		const s = scene({
			pinnedIds: new Set(['s1']),
			zoomedOut: true,
			isHidden: (id) => id === 'art'
		});
		const w = layoutHulls(s).hulls.find((h) => h.id === 'W');
		expect(w?.label).toBe('Awb');
	});

	it('keeps a hull’s name off the signs of the bronnen', () => {
		const vrij = layoutHulls(scene()).hulls.find((h) => h.id === 'D')!;
		// A sign where the name would stand: it steps down into its hull, clear of it.
		const sign = { x: vrij.labelX - 5, y: vrij.labelY - 15, w: 10, h: 10 };
		const opzij = layoutHulls(scene({ glyphs: [sign] })).hulls.find((h) => h.id === 'D')!;
		expect(opzij.labelY).toBeGreaterThan(vrij.labelY);
	});

	it('says the words of lines that stand on one another once (Gemeentewet, noemt)', () => {
		const link = (id: string, x: number, y: number) => ({
			id,
			d: '',
			arrow: '',
			color: '',
			dashed: false,
			dim: false,
			label: 'noemt',
			labelX: x,
			labelY: y
		});
		const links = [link('a', 100, 100), link('b', 104, 106), link('c', 400, 100)];
		unstacked(links, (t) => t.length * 6 + 18);
		expect(links.map((l) => l.label)).toEqual(['noemt', null, 'noemt']);
	});
});
