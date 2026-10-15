import Graph from 'graphology';
import { describe, expect, it } from 'vitest';
import { countCanvas } from './canvas-count';

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
		hiddenRelations: new Set()
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
