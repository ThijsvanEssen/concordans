<script lang="ts">
	// Reader for instrument (wet) nodes. Delegates to WholeLawReader which
	// already knows how to load and render an entire law with article TOC,
	// breadcrumbs, and click-through. The bwbId/celex comes from the node key
	// (instrument nodes use `bwb:BWBR…` or `celex:32010L0064` patterns).
	import type { GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	// Extract the BWB id from the instrument node. Different ingestion paths
	// store it in different fields; try the props first, fall back to the key.
	const bwbId = $derived.by(() => {
		const p = (node.raw?.props ?? {}) as Record<string, unknown>;
		const fromProps = (p['bwb_id'] as string | null) ?? (p['celex'] as string | null);
		if (fromProps) return fromProps;
		// Keys like "bwb:BWBR0001854" or just "BWBR0001854".
		if (node.key.startsWith('bwb:')) return node.key.slice(4);
		if (node.key.startsWith('celex:')) return node.key.slice(6);
		return node.key;
	});
</script>

<div class="r-instrument">
	<WholeLawReader {bwbId} {onNavigate} />
</div>

<style>
	.r-instrument {
		height: 100%;
		overflow-y: auto;
	}
</style>
