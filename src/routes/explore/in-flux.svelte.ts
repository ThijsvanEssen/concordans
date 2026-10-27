// The open dossiers per bron (in flux): a bron a lopend wetsvoorstel wil wijzigen carries a dot on
// the canvas, always (Netwerkcanvas, Openstaand). Asked once, after the first paint.
import { report } from '$lib/api/errors';
import { getInFlux, type NodeCounts } from '$lib/api/overlays';

export class InFlux {
	counts = $state<NodeCounts>(new Map());

	/** Call in a component's script: asks when the component is there, drops the answer when it goes. */
	constructor() {
		$effect(() => {
			const ctrl = new AbortController();
			getInFlux(ctrl.signal)
				.then((counts) => {
					if (!ctrl.signal.aborted) this.counts = counts;
				})
				.catch((e) => report('Verkenner lopende dossiers', e));
			return () => ctrl.abort();
		});
	}
}
