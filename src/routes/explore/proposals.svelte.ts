// The vinkje Voorstellen (besluit 37): the lopende voorstellen of the bronnen on the canvas
// drawn beside them, each with a light Wijziging-lijn. Asked once such a bron is on the canvas
// (the open-count, in-flux, names them), so the vinkje counts them; drawn while it is on, gone
// again when it goes off.
import { untrack } from 'svelte';
import { get } from 'svelte/store';
import { report } from '$lib/api/errors';
import { getInFluxDossiers, type NodeCounts, type NodeDossiers } from '$lib/api/overlays';
import type { GraphStore } from '$lib/graph/store/types';
import { proposalRows } from '$lib/proposals/proposals';

export class Proposals {
	/** The bronnen on the canvas with an open voorstel: whether the vinkje is offered. */
	available = $state(0);
	/** The voorstellen the vinkje draws, each bill once (live-toets B3); null until asked. */
	count = $state<number | null>(null);
	/** Asked and not yet in, or on and not yet drawn: the dot of a count that comes. */
	loading = $state(false);
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

		// Asked as soon as a bron with a voorstel is on the canvas, so the vinkje can say how many.
		let answered = $state(0);
		$effect(() => {
			const ids = withProposal;
			untrack(() => this.#ask(ids).then(() => answered++));
		});
		$effect(() => {
			void answered;
			const ids = withProposal;
			const bills = new Set(
				ids.flatMap((id) => proposalRows(this.#answers.get(id) ?? []).map((r) => r.ref.key))
			);
			const known = ids.every((id) => this.#answers.has(id));
			this.count = known ? bills.size : null;
			this.loading = !known && ids.length > 0;
		});

		$effect(() => {
			void answered;
			if (!on() || !drawn()) return;
			const ids = withProposal;
			untrack(() => this.#place(store, ids));
		});
		$effect(() => {
			if (on()) return;
			untrack(() => this.#clear(store));
		});
	}

	/** The open dossiers of the bronnen not asked before. */
	async #ask(ids: string[]): Promise<void> {
		const fresh = ids.filter((id) => !this.#asked.has(id));
		if (fresh.length === 0) return;
		for (const id of fresh) this.#asked.add(id);
		try {
			const answer = await getInFluxDossiers(fresh);
			for (const id of fresh) this.#answers.set(id, answer.get(id) ?? []);
		} catch (e) {
			for (const id of fresh) this.#asked.delete(id);
			report('Verkenner voorstellen', e);
		}
	}

	#place(store: GraphStore, ids: string[]) {
		const before = new Set(get(store.nodes).map((n) => n.id));
		for (const id of ids) {
			const rows = proposalRows(this.#answers.get(id) ?? []);
			if (rows.length === 0 || !before.has(id)) continue;
			const missing = rows.filter((r) => !before.has(`${r.ref.collection}/${r.ref.key}`));
			if (missing.length === 0) continue;
			if (store.showRows(id, missing))
				for (const r of missing) this.#drawn.add(`${r.ref.collection}/${r.ref.key}`);
		}
	}

	#clear(store: GraphStore) {
		if (this.#drawn.size === 0) return;
		store.hideRows([...this.#drawn]);
		this.#drawn.clear();
	}
}
