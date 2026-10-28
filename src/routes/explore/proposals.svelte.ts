// The vinkje Voorstellen (besluit 37): the lopende voorstellen of the bronnen on the canvas
// drawn beside them, each with a light Wijziging-lijn. Asked once the vinkje is on, for the
// bronnen the open-count (in-flux) names; what it drew goes again when it goes off.
import { untrack } from 'svelte';
import { get } from 'svelte/store';
import { report } from '$lib/api/errors';
import { getInFluxDossiers, type NodeCounts, type NodeDossiers } from '$lib/api/overlays';
import type { GraphStore } from '$lib/graph/store/types';
import { proposalRows } from '$lib/proposals/proposals';

export class Proposals {
	/** The bronnen on the canvas with an open voorstel: what the vinkje offers. */
	available = $state(0);
	#answers: NodeDossiers = new Map();
	#asked = new Set<string>();
	#drawn = new Set<string>();

	constructor(
		store: GraphStore,
		on: () => boolean,
		counts: () => NodeCounts,
		drawn: () => boolean
	) {
		let nodeIds = $state.raw<string[]>([]);
		$effect(() =>
			store.nodes.subscribe((nodes) => {
				const next = nodes.map((n) => n.id);
				if (
					next.length !== untrack(() => nodeIds).length ||
					next.some((id, i) => id !== nodeIds[i])
				)
					nodeIds = next;
			})
		);
		const withProposal = $derived(nodeIds.filter((id) => (counts().get(id) ?? 0) > 0));
		$effect(() => {
			this.available = withProposal.length;
		});

		$effect(() => {
			if (!on() || !drawn()) return;
			const ids = withProposal;
			untrack(() => this.#draw(store, ids));
		});
		$effect(() => {
			if (on()) return;
			untrack(() => this.#clear(store));
		});
	}

	#draw(store: GraphStore, ids: string[]) {
		const fresh = ids.filter((id) => !this.#asked.has(id));
		const place = () => {
			const before = new Set(get(store.nodes).map((n) => n.id));
			for (const id of ids) {
				const rows = proposalRows(this.#answers.get(id) ?? []);
				if (rows.length === 0 || !before.has(id)) continue;
				const missing = rows.filter((r) => !before.has(`${r.ref.collection}/${r.ref.key}`));
				if (missing.length === 0) continue;
				if (store.showRows(id, missing))
					for (const r of missing) this.#drawn.add(`${r.ref.collection}/${r.ref.key}`);
			}
		};
		if (fresh.length === 0) return place();
		for (const id of fresh) this.#asked.add(id);
		getInFluxDossiers(fresh)
			.then((answer) => {
				for (const [id, dossiers] of answer) this.#answers.set(id, dossiers);
				place();
			})
			.catch((e) => {
				for (const id of fresh) this.#asked.delete(id);
				report('Verkenner voorstellen', e);
			});
	}

	#clear(store: GraphStore) {
		if (this.#drawn.size === 0) return;
		store.hideRows([...this.#drawn]);
		this.#drawn.clear();
	}
}
