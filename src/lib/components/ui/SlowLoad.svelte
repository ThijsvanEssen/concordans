<script lang="ts">
	// The status line of a load under way, mounted for as long as it loads: a screen reader
	// hears `label` (seen too with `visible`); after SLOW_AFTER_MS everyone gets the one calm line
	// that it takes longer than usual, instead of a skeleton alone, and no failure before the
	// request's own deadline (api/client SLOW_TIMEOUT_MS).
	import { onMount } from 'svelte';
	import { SLOW_AFTER_MS, SLOW_TEXT } from '$lib/util/slow';

	let {
		label,
		visible = false,
		tag = 'p'
	}: { label: string; visible?: boolean; tag?: 'p' | 'span' } = $props();

	let slow = $state(false);
	onMount(() => {
		const timer = setTimeout(() => (slow = true), SLOW_AFTER_MS);
		return () => clearTimeout(timer);
	});
</script>

<svelte:element
	this={tag}
	class={slow || visible ? 'stil' : 'sr-only'}
	role="status"
	data-slow={slow ? '' : undefined}
>
	{slow ? SLOW_TEXT : label}
</svelte:element>
