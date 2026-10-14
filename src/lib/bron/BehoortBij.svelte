<script lang="ts">
	// The band "Behoort bij" above every reader, begun anew for every bron: a group opened or a
	// chain unfolded for one is closed for the next, and the band stands once its lines are in.
	import type { GraphNode } from '$lib/graph/types';
	import BelongsTo from './BelongsTo.svelte';

	let { node }: { node: GraphNode } = $props();
</script>

{#key node.id}<BelongsTo {node} />{/key}
