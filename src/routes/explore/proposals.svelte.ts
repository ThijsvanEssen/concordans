// The lopende voorstellen of the bronnen on the canvas drawn beside them, each with a light
// Wijziging-lijn. Asked once such a bron is on the canvas (the open-count, in-flux, names them).
// They always stand, without a vinkje: a line and a marker say what they are.
import { untrack } from 'svelte';
import { get } from 'svelte/store';
import { report } from '$lib/api/errors';
import { getInFluxDossiers, type NodeCounts, type NodeDossiers } from '$lib/api/overlays';
import type { GraphStore } from '$lib/graph/store/types';
import { proposalRows } from '$lib/proposals/proposals';

export class Proposals {
	#answers: NodeDossiers = new Map();
	#asked = new Set<string>();

	constructor(store: GraphStore, counts: () => NodeCounts, drawn: () => boolean) {
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

		// Asked as soon as a bron with a voorstel is on the canvas.
		let answered = $state(0);
		$effect(() => {
			const ids = withProposal;
			untrack(() => void this.#ask(ids).then(() => answered++));
		});
		$effect(() => {
			void answered;
			if (!drawn()) return;
			const ids = withProposal;
			untrack(() => this.#place(store, ids));
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
			store.showRows(id, missing);
		}
	}
}
