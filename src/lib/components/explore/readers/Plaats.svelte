<script lang="ts">
	// A place of a text that can be kept and cited (a lid, an onderdeel, an overweging), at
	// any depth: lid › onderdeel › sub, r.o. 5 › 5.7 › 5.7.1. It carries the hover area of
	// its words (PlaatsActies) and, while it is kept, the thin ink bar in the margin.
	import type { Snippet } from 'svelte';
	import type { MapItem } from '$lib/map/map';
	import { kaart } from '$lib/map/map.svelte';

	let {
		item = null,
		id,
		open = false,
		class: extra = '',
		children
	}: {
		/** What Bewaar keeps for this place; the bar follows it. */
		item?: MapItem | null;
		/** The anchor of the place: `lid-2`, `lid-2-onder-a`, `rov-5.7.1`. */
		id?: string;
		/** Raised while its Citeer is open. */
		open?: boolean;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<div
	class="plaats {extra}"
	class:is-open={open}
	class:plaats-bewaard={!!item && kaart.heeft(item)}
	{id}
>
	{@render children()}
</div>

<style>
	.plaats {
		position: relative;
		scroll-margin: 20vh;
	}
</style>
