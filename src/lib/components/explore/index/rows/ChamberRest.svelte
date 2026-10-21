<script lang="ts">
	// Above the Stemmingen of the Tweede Kamer: the days it does not meet, as Actueel says them.
	import NextSitting from '$lib/components/parliamentary/NextSitting.svelte';
	import type { ViewProps } from '../lists/list';

	let { ctx }: ViewProps<unknown, object> = $props();
</script>

{#if ctx.p.kamer === 'TK'}<NextSitting />{/if}
