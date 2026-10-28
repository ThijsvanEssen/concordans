import Graph from 'graphology';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import GraphCanvas from './GraphCanvas.svelte';
import { NAME_BELOW } from './fit-box';

// A sigma that keeps the box a fit frames (`setCustomBBox`).
const sigma = vi.hoisted(() => ({
	renders: 0,
	pending: false,
	made: false,
	box: null as { x: [number, number]; y: [number, number] } | null
}));
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
		setCustomBBox(box: { x: [number, number]; y: [number, number] } | null) {
			sigma.box = box;
		}
		resize() {}
		kill() {}
	}
}));
vi.mock('@sigma/node-image', () => ({ createNodeImageProgram: () => class {} }));
vi.mock('./DashedEdgeProgram', () => ({
	stippelProgrammas: () => ({
		arrow: class {},
		submitter: class {},
		dashed: class {},
		dotted: class {},
		dashdot: class {},
		lid: class {},
		arrowDraad: class {},
		submitterDraad: class {},
		dashedDraad: class {},
		dottedDraad: class {},
		dashdotDraad: class {}
	})
}));

/** Three bronnen in a square of 100: the box a fit frames grows beyond it. */
function canvas() {
	const graph = new Graph();
	graph.addNode('f', { x: 0, y: 0, filterGroup: 'stukken' });
	graph.addNode('a', { x: 100, y: 0, filterGroup: 'stukken' });
	graph.addNode('b', { x: 0, y: 100, filterGroup: 'stukken' });
	graph.addDirectedEdge('a', 'f', { relation: 'CITES' });
	graph.addDirectedEdge('b', 'f', { relation: 'CITES' });
	return graph;
}

const box = (left: number, top: number, width: number, height: number) => () =>
	({
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height,
		toJSON() {}
	}) as DOMRect;

/** The canvas of 800 × 600 in the stage, with `over` beside it (a zoom, a strip at the foot). */
async function fitWith(over: { left: number; top: number; width: number; height: number }[]) {
	const stage = document.createElement('div');
	document.body.append(stage);
	for (const r of over) {
		const el = document.createElement('div');
		el.setAttribute('data-over-doek', '');
		el.getBoundingClientRect = box(r.left, r.top, r.width, r.height);
		stage.append(el);
	}
	let api: { fit: () => void } | null = null;
	render(GraphCanvas, {
		target: stage,
		props: { graph: canvas(), focusedId: 'f', onReady: (a: { fit: () => void }) => (api = a) }
	});
	await vi.waitFor(() => expect(api).not.toBeNull());
	const wrap = stage.querySelector<HTMLElement>('.canvas-wrap')!;
	wrap.getBoundingClientRect = box(0, 0, 800, 600);
	api!.fit();
	stage.remove();
	return sigma.box!;
}

describe('GraphCanvas, the camera after a fit (UX review N8)', () => {
	it('keeps a name of room under the lowest bron, a hull’s name above the highest', async () => {
		const b = await fitWith([]);
		// Graph y points up: the low end grows for the foot, the high end for the top.
		expect(b.y[0]).toBeLessThan(0);
		expect(b.y[1]).toBeGreaterThan(100);
		expect(b.x).toEqual([0, 100]);
		expect(NAME_BELOW).toBeGreaterThan(0);
	});

	it('counts a strip over the foot of the canvas (a tijdstrook) and the zoom at its side', async () => {
		const without = await fitWith([]);
		const strip = await fitWith([{ left: 0, top: 540, width: 800, height: 60 }]);
		expect(strip.y[0]).toBeLessThan(without.y[0]);
		const zoom = await fitWith([{ left: 764, top: 500, width: 24, height: 80 }]);
		expect(zoom.x[1]).toBeGreaterThan(100);
		expect(zoom.x[0]).toBe(0);
	});
});
