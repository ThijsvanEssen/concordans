<script lang="ts">
	// The status line of a load under way, mounted for as long as it loads: a screen reader
	// hears `label` (seen too with `zichtbaar`); after TRAAG_MS everyone gets the one calm line
	// that it takes longer than usual, instead of a skeleton alone, and no failure before the
	// request's own deadline (api/client SLOW_TIMEOUT_MS).
	import { onMount } from 'svelte';
	import { TRAAG_MS, TRAAG_TEKST } from '$lib/util/traag';

	let {
		label,
		zichtbaar = false,
		tag = 'p'
	}: { label: string; zichtbaar?: boolean; tag?: 'p' | 'span' } = $props();

	let traag = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (traag = true), TRAAG_MS);
		return () => clearTimeout(timer);
	});
</script>

<svelte:element
	this={tag}
	class={traag || zichtbaar ? 'stil' : 'sr-only'}
	role="status"
	data-traag={traag ? '' : undefined}
>
	{traag ? TRAAG_TEKST : label}
</svelte:element>
