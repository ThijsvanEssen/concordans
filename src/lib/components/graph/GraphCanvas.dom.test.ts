import Graph from 'graphology';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import GraphCanvas from './GraphCanvas.svelte';

// No WebGL in jsdom: sigma never arrives, what the canvas draws is decided without it.
vi.mock('sigma', () => new Promise(() => {}));
vi.mock('sigma/rendering', () => new Promise(() => {}));
vi.mock('@sigma/node-image', () => new Promise(() => {}));
vi.mock('./DashedEdgeProgram', () => new Promise(() => {}));

/** A focus with a stuk in the chosen years and one before them. */
function canvas() {
	const graph = new Graph();
	graph.addNode('f', { x: 0, y: 0, filterGroup: 'stukken', date: '2024-03-01' });
	graph.addNode('in', { x: 1, y: 0, filterGroup: 'stukken', date: '2024-05-01' });
	graph.addNode('voor', { x: 0, y: 1, filterGroup: 'stukken', date: '2019-05-01' });
	graph.addDirectedEdge('in', 'f', { relation: 'CITES' });
	graph.addDirectedEdge('voor', 'f', { relation: 'CITES' });
	return graph;
}

describe('GraphCanvas', () => {
	it('says what it draws: a bron outside the years of the filter is not', async () => {
		const onDrawn = vi.fn();
		render(GraphCanvas, {
			graph: canvas(),
			focusedId: 'f',
			yearPeriod: { from: '2023-01-01', to: null },
			onDrawn
		});
		await tick();
		expect([...onDrawn.mock.lastCall![0]].sort()).toEqual(['f', 'in']);
	});
});
