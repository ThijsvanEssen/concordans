import Graph from 'graphology';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import GraphCanvas from './GraphCanvas.svelte';

// A sigma that counts what it draws: a refresh draws at once, a scheduled one in the next
// frame, once however often it is asked (sigma 3: `refresh({ schedule: true })`).
const sigma = vi.hoisted(() => ({ renders: 0, pending: false, made: false }));
vi.mock('sigma', () => ({
	default: class {
		#after: (() => void)[] = [];
		constructor() {
			sigma.made = true;
		}
		on(event: string, f: () => void) {
			if (event === 'afterRender') this.#after.push(f);
		}
		refresh(opts?: { schedule?: boolean }) {
			if (opts?.schedule) sigma.pending = true;
			else this.#render();
		}
		frame() {
			if (!sigma.pending) return;
			sigma.pending = false;
			this.#render();
		}
		#render() {
			sigma.renders++;
			this.#after.forEach((f) => f());
		}
		getCamera() {
			return {
				ratio: 1,
				on() {},
				getState: () => ({ x: 0.5, y: 0.5, ratio: 1, angle: 0 }),
				setState() {},
				animatedReset() {}
			};
		}
		getDimensions = () => ({ width: 800, height: 600 });
		getNodeDisplayData = () => ({ x: 0, y: 0, size: 4 });
		getSetting = () => 1;
		graphToViewport = () => ({ x: 0, y: 0 });
		framedGraphToViewport = () => ({ x: 0, y: 0 });
		scaleSize = (s: number) => s;
		setCustomBBox() {}
		resize() {}
		kill() {}
	}
}));
vi.mock('sigma/rendering', () => ({ createEdgeArrowProgram: () => class {} }));
vi.mock('@sigma/node-image', () => ({ createNodeImageProgram: () => class {} }));
vi.mock('./DashedEdgeProgram', () => ({
	stippelProgrammas: () => ({
		dashed: class {},
		dotted: class {},
		dashdot: class {},
		lid: class {}
	})
}));

/** A focus with two neighbours. */
function canvas() {
	const graph = new Graph();
	graph.addNode('f', { x: 0, y: 0, filterGroup: 'stukken' });
	graph.addNode('a', { x: 1, y: 0, filterGroup: 'stukken' });
	graph.addNode('b', { x: 0, y: 1, filterGroup: 'stukken' });
	graph.addDirectedEdge('a', 'f', { relation: 'CITES' });
	graph.addDirectedEdge('b', 'f', { relation: 'CITES' });
	return graph;
}

describe('GraphCanvas, a step of the focus', () => {
	it('draws once, in the next frame', async () => {
		let api: { refresh: () => void } | null = null;
		const { rerender } = render(GraphCanvas, {
			graph: canvas(),
			focusedId: 'f',
			onReady: (a: { refresh: () => void }) => (api = a)
		});
		await vi.waitFor(() => expect(api).not.toBeNull());
		sigma.renders = 0;
		sigma.pending = false;
		await rerender({ focusedId: 'a' });
		await tick();
		expect(sigma.renders).toBe(0);
		expect(sigma.pending).toBe(true);
	});
});
