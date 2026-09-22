<script lang="ts">
	// Reader for instruments: the articles of the whole regulation in natural order.
	import type { GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';

	import { getLawIdFromProps } from '$lib/util/law-id';

	let { node }: { node: GraphNode } = $props();

	const bwbId = $derived(getLawIdFromProps(node.raw?.props ?? undefined) ?? node.key.toUpperCase());
</script>

<div class="r-instrument">
	<WholeLawReader {bwbId} />
</div>

<style>
	.r-instrument {
		height: 100%;
		overflow-y: auto;
	}
</style>
