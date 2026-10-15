// The counts an overlay colours the canvas by: the open dossiers per bron (in flux), or the
// citations per period (heat). Heat counts what is drawn: each bron once per period, asked
// when it comes on the canvas; a change of period or overlay starts anew, a growing canvas
// asks only for what is new.
import { untrack } from 'svelte';
import { report } from '$lib/api/errors';
import { getHeat, getInFlux, type NodeCounts } from '$lib/api/overlays';
import { overlayParam, parseOverlay, type Overlay } from '$lib/selection/overlay';

export class OverlayCounts {
	inFlux = $state<NodeCounts>(new Map());
	heat = $state<NodeCounts>(new Map());

	#asked = new Set<string>();
	#heatFor: string | null = null;
	#heatAbort: AbortController | null = null;

	/**
	 * Follow the overlay and the bronnen on the canvas; call in a component's script. Keyed on
	 * the overlay's parameter: a step that keeps the overlay keeps its counts.
	 */
	constructor(overlay: () => Overlay, canvasIds: () => string[]) {
		const param = $derived(overlayParam(overlay()));
		$effect(() => {
			const o = parseOverlay(param);
			this.inFlux = new Map();
			this.heat = new Map();
			if (o.kind !== 'open') return;
			const ctrl = new AbortController();
			getInFlux(ctrl.signal)
				.then((counts) => {
					if (!ctrl.signal.aborted) this.inFlux = counts;
				})
				.catch((e) => report('Verkenner lopende dossiers', e));
			return () => ctrl.abort();
		});
		$effect(() => this.#followHeat(parseOverlay(param), canvasIds()));
	}

	#followHeat(o: Overlay, ids: string[]) {
		const key = o.kind === 'heat' ? `heat:${o.months}` : null;
		if (key !== this.#heatFor) {
			this.#heatAbort?.abort();
			this.#heatAbort = key ? new AbortController() : null;
			this.#heatFor = key;
			this.#asked = new Set();
		}
		if (o.kind !== 'heat' || !this.#heatAbort) return;
		const todo = ids.filter((id) => !this.#asked.has(id));
		if (todo.length === 0) return;
		for (const id of todo) this.#asked.add(id);
		const ctrl = this.#heatAbort;
		getHeat(o.months, todo, ctrl.signal)
			.then((counts) => {
				if (ctrl.signal.aborted || counts.size === 0) return;
				this.heat = new Map([...untrack(() => this.heat), ...counts]);
			})
			.catch((e) => {
				// Asked again when the canvas next changes.
				for (const id of todo) this.#asked.delete(id);
				report('Verkenner aanhalingen per periode', e);
			});
	}
}
