<script lang="ts">
	// Reader for instruments: the articles of the whole regulation in natural order.
	import type { GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	const bwbId = $derived(String(node.raw?.props?.bwb_id ?? '') || null);
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
