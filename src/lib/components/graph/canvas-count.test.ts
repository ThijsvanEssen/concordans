import Graph from 'graphology';
import { describe, expect, it } from 'vitest';
import { countCanvas, sameIds } from './canvas-count';

/** A focus, a stuk in the chosen years, one before them, and one in a dossier switched off. */
function canvas() {
	const graph = new Graph();
	graph.addNode('f', { filterGroup: 'stukken', vorm: 'stuk' });
	graph.addNode('in', { filterGroup: 'stukken', vorm: 'stuk' });
	graph.addNode('voor', { filterGroup: 'stukken', vorm: 'stuk' });
	graph.addNode('dossier', { filterGroup: 'stukken', vorm: 'stuk' });
	graph.addDirectedEdge('in', 'f', { relation: 'CITES' });
	graph.addDirectedEdge('voor', 'f', { relation: 'CITES' });
	graph.addUndirectedEdge('in', 'dossier', { layoutOnly: true });
	return graph;
}

const count = (drawn: string[]) =>
	countCanvas({
		graph: canvas(),
		drawn: new Set(drawn),
		selectionId: 'f',
		hiddenKinds: new Set(),
		rechter: null,
		verborgen: new Map([['dossier', 'dossier' as const]]),
		hiddenLines: new Set()
	});

describe('countCanvas', () => {
	it('counts what the canvas draws: a bron outside the years is not in the Legenda', () => {
		const { counts, drawnIds } = count(['f', 'in']);
		expect(counts.nodes).toBe(2);
		expect(counts.edges).toBe(1);
		expect(counts.vormen).toEqual({ stuk: 2 });
		expect(drawnIds).toEqual(['f', 'in']);
	});

	it('counts every kind before the filter, and what a grouping switched off hides', () => {
		const { counts } = count(['f', 'in']);
		expect(counts.kinds).toEqual({ stukken: 4 });
		expect(counts.metGroep).toEqual({ stukken: { count: 1, van: 4, groepen: ['dossier'] } });
	});
});

describe('sameIds', () => {
	it('tells the same drawn bronnen in another order from a change', () => {
		expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
		expect(sameIds(['a', 'b'], ['a', 'c'])).toBe(false);
		expect(sameIds(['a'], ['a', 'b'])).toBe(false);
	});
});

describe('countCanvas, the period', () => {
	it('counts per kind what stands inside the years, and every bron without a date', () => {
		const graph = new Graph();
		graph.addNode('a', { filterGroup: 'uitspraken', date: '2012-05-01' });
		graph.addNode('b', { filterGroup: 'uitspraken', date: '2020-05-01' });
		graph.addNode('c', { filterGroup: 'artikelen' });
		const { counts } = countCanvas({
			graph,
			drawn: new Set(['a', 'b', 'c']),
			selectionId: null,
			hiddenKinds: new Set(),
			rechter: null,
			period: { from: '2011-01-01', to: '2016-12-31' },
			verborgen: new Map(),
			hiddenLines: new Set()
		});
		expect(counts.kinds).toEqual({ uitspraken: 1, artikelen: 1 });
	});
	it('counts of a group the members inside the years, as the strip does', () => {
		const graph = new Graph();
		graph.addNode('g', {
			filterGroup: 'stukken',
			members: 4,
			memberDates: ['2012-05-01', '2020-05-01', '2013-01-01', null]
		});
		const { counts } = countCanvas({
			graph,
			drawn: new Set(['g']),
			selectionId: null,
			hiddenKinds: new Set(),
			rechter: null,
			period: { from: '2011-01-01', to: '2016-12-31' },
			verborgen: new Map(),
			hiddenLines: new Set()
		});
		expect(counts.kinds).toEqual({ stukken: 3 });
	});
});

describe('a commissie drawn as a ring (B41)', () => {
	it('is one bron of its soort, with no point of its own', () => {
		const { counts } = countCanvas({
			graph: canvas(),
			drawn: new Set(['f', 'in']),
			selectionId: 'f',
			hiddenKinds: new Set(),
			rechter: null,
			verborgen: new Map(),
			hiddenLines: new Set(),
			rings: [{ filterGroup: 'commissies' }]
		});
		expect(counts.kinds).toEqual({ stukken: 4, commissies: 1 });
	});
});
