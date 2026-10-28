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
import { FALLBACK } from './nodeSprites';

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
			    "color": "#cd7127",
			    "dash": "6 4",
			    "dim": false,
			    "id": "D",
			    "label": "Kamerstuk 36000",
			    "labelX": 120,
			    "labelY": 258,
			    "long": false,
			    "path": "M 84 300 A 36 36 0 1 0 156 300 A 36 36 0 1 0 84 300 Z",
			    "top": 264,
			  },
			  {
			    "color": "#00487c",
			    "dim": false,
			    "id": "W",
			    "label": "Awb",
			    "labelX": 400,
			    "labelY": 238,
			    "long": false,
			    "path": "M 384 260 A 16 16 0 1 0 416 260 A 16 16 0 1 0 384 260 Z",
			    "top": 244,
			  },
			]
		`);
		expect(round(links)).toMatchInlineSnapshot(`
			[
			  {
			    "arrow": "M384,262L377,269L374,262Z",
			    "cap": "round",
			    "color": "rgb(112, 152, 180)",
			    "d": "M375 266Q274 306 155 295",
			    "dim": false,
			    "id": "D->W",
			    "label": null,
			    "labelX": 270,
			    "labelY": 279,
			    "width": 3,
			  },
			  {
			    "arrow": "M389,248L382,247L385,242Z",
			    "cap": "round",
			    "color": "rgb(106, 129, 107)",
			    "d": "M384 245Q305 193 256 106",
			    "dim": false,
			    "id": "anker:j->W",
			    "label": null,
			    "labelX": 322,
			    "labelY": 177,
			    "width": 2,
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
	it('draws no hull of a wet whose anchor stands alone: an ordinary bron with its name (Gemw)', () => {
		// Only the anchor of W drawn: no empty circle, the anchor is a bron and carries the name.
		const s = scene({
			pinnedIds: new Set(['s1']),
			zoomedOut: true,
			isHidden: (id) => id === 'art'
		});
		const layout = layoutHulls(s);
		expect(layout.hulls.find((h) => h.id === 'W')).toBeUndefined();
		expect(layout.alone.get('wet')).toBe('Awb');
		// Its lines are sigma's, not the hulls' layer.
		expect(anchorWithHull('wet', { ...s, alone: layout.alone })).toBe(false);
		expect(hullLinkOf('s1', 'wet', { ...s, alone: layout.alone })).toBeNull();
	});

	it('draws a hull as a disc of the members plus 16 and goes round the hull it holds', () => {
		const s = scene();
		const { hulls } = layoutHulls(s);
		const disc = (id: string) => hulls.find((h) => h.id === id)!;
		// Every member inside: the path is a circle (two arcs), not a polygon.
		expect(disc('W').path).toMatch(/^M [\d.-]+ [\d.-]+ A (\S+) \1 0 1 0 [\d.-]+ [\d.-]+ A/);
		const inner = layoutHulls(
			scene({
				groups: new Map([
					['W', group('W', 'instrument', '', ['wet', 'art'])],
					['D', group('D', 'dossier', 'Kamerstuk 36000', ['s1', 's2', 'wet'])]
				])
			})
		);
		const outerTop = inner.hulls.find((h) => h.id === 'D')!;
		const innerTop = inner.hulls.find((h) => h.id === 'W')!;
		// The outer name stands above the inner pill, which stays inside the outer disc.
		expect(outerTop.labelY).toBeLessThan(innerTop.labelY);
	});

	it('keeps a hull’s name off the signs of the bronnen', () => {
		const free = layoutHulls(scene()).hulls.find((h) => h.id === 'D')!;
		// A sign where the name would stand: it steps down into its hull, clear of it.
		const sign = { x: free.labelX - 5, y: free.labelY - 15, w: 10, h: 10 };
		const aside = layoutHulls(scene({ glyphs: [sign] })).hulls.find((h) => h.id === 'D')!;
		expect(aside.labelY).toBeGreaterThan(free.labelY);
	});

	it('says the words of lines that stand on one another once (Gemeentewet, noemt)', () => {
		const link = (id: string, x: number, y: number) => ({
			id,
			d: '',
			arrow: '',
			color: '',
			dash: undefined,
			cap: 'round' as const,
			width: 3,
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

describe('the hulls of the five soorten', () => {
	// A wet, a dossier, a fractie, a commissie and a kabinet, each round three members, far apart.
	const GROUPS = [
		['W', 'instrument', 0, 'wetten', undefined],
		['D', 'dossier', 1, 'kamerstukken', '6 4'],
		['F', 'faction', 2, 'parlement', '1.5 3'],
		['C', 'committee', 3, 'parlement', '8 3 1.5 3'],
		['K', 'cabinet', 4, 'regering', '8 3 1.5 3 1.5 3']
	] as const;

	const five = () => {
		const graph = new Graph();
		const groups = new Map<string, ContainerGroup>();
		const groupsOf = new Map<string, Set<string>>();
		for (const [id, kind, i] of GROUPS) {
			const members = [0, 1, 2].map((m) => `${id}${m}`);
			members.forEach((member, m) => {
				graph.addNode(member, { x: i * 400 + m * 40, y: m % 2 ? 30 : 0, collection: 'members' });
				groupsOf.set(member, new Set([id]));
			});
			groups.set(id, group(id, kind, id, members));
		}
		return scene({ graph, groups, groupsOf });
	};

	const inside = (p: { x: number; y: number }, polygon: { x: number; y: number }[]) =>
		polygon.reduce((odd, a, i) => {
			const b = polygon[(i + 1) % polygon.length];
			const crosses =
				a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
			return crosses ? !odd : odd;
		}, false);

	it('gives each the line and the colour of its soort', () => {
		const { hulls } = layoutHulls(five());
		for (const [id, , , rubriek, dash] of GROUPS) {
			const hull = hulls.find((h) => h.id === id)!;
			expect(hull.dash, id).toBe(dash);
			expect(hull.color, id).toBe(
				FALLBACK[`rubriek${rubriek[0].toUpperCase()}${rubriek.slice(1)}` as keyof typeof FALLBACK]
			);
		}
		// Told apart by line as well as by colour: fractie and commissie share a colour.
		expect(new Set(hulls.map((h) => h.dash)).size).toBe(GROUPS.length);
	});

	it('holds its members', () => {
		const s = five();
		const { hitAreas } = layoutHulls(s);
		for (const [id] of GROUPS) {
			const area = hitAreas.find((a) => a.id === id)!;
			for (const member of s.groups.get(id)!.members) {
				const { x, y } = s.graph.getNodeAttributes(member);
				expect(inside(s.toViewport({ x, y }), area.polygon), member).toBe(true);
			}
		}
	});
});
