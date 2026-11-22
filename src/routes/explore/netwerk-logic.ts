// The logic of the Netwerk the page needs only when a netwerk is shown (mode graph): the
// composer of chosen bronnen, the keten, the lineage, Verband and its pairs. One chunk, asked
// through netwerk-logic-load.svelte.ts when the address asks for the network, and ahead of that
// once the page has its answers (laad lui, B178).
import type { ChainLayer, ChainNode } from '$lib/network/chain';
import { chain, chainTally, isRegulation } from '$lib/network/chain';
import { chainsModel } from '$lib/network/linkchains';
import { lineage } from '$lib/network/lineage';
import { pairOf, resolveChoice } from '$lib/network/pairs';
import { verbandModel } from '$lib/network/shared';
import { NetwerkComposer } from './netwerk-compose.svelte';

/** Up to `max` bronnen a layer drawn, and `keep`; the rest listed under Alle N. */
function capLayers(layers: ChainLayer[], max: number, keep: string | null) {
	const rest: Record<string, number> = {};
	const more: Record<string, ChainNode[]> = {};
	const drawn = layers.map((l) => {
		const kept = l.nodes.filter((n, i) => i < max || n.id === keep);
		const over = l.nodes.filter((n) => !kept.includes(n));
		if (over.length) {
			rest[l.id] = over.length;
			more[l.id] = over;
		}
		return { ...l, nodes: kept };
	});
	return { layers: drawn, rest, more };
}

export const netwerkLogic = {
	NetwerkComposer,
	capLayers,
	chain,
	chainTally,
	chainsModel,
	isRegulation,
	lineage,
	pairOf,
	resolveChoice,
	verbandModel
};
