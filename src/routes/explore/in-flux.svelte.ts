// The open dossiers per bron (in flux): a bron a lopend wetsvoorstel wil wijzigen carries a dot on
// the canvas, always (Netwerkcanvas, Openstaand). Asked once, when the canvas is shown, after
// the first paint.
import { untrack } from 'svelte';
import { report } from '$lib/api/errors';
import { getInFlux, type NodeCounts } from '$lib/api/overlays';

export class InFlux {
	counts = $state<NodeCounts>(new Map());
	#asked = false;

	/** Call in a component's script: asks once `shown()` holds. */
	constructor(shown: () => boolean) {
		$effect(() => {
			if (!shown() || untrack(() => this.#asked)) return;
			this.#asked = true;
			getInFlux()
				.then((counts) => (this.counts = counts))
				.catch((e) => {
					this.#asked = false;
					report('Verkenner lopende dossiers', e);
				});
		});
	}
}
