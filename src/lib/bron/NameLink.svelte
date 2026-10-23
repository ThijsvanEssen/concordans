<script lang="ts">
	// The name of a person, a fractie or a cabinet, as a link to its bron wherever it stands
	// (K-3): by the key where the row has it, else by the name as the API lists it. A name
	// the lists do not hold stays text.
	import BronLink from './BronLink.svelte';
	import { cabinetKeyOf, factionKeyOf } from './names.svelte';

	let {
		collection,
		name,
		key = null,
		class: className = ''
	}: {
		collection: 'members' | 'factions' | 'cabinets';
		name: string;
		/** The key, where the data gives it; a fractie or cabinet is otherwise found by name. */
		key?: string | null;
		class?: string;
	} = $props();

	const resolved = $derived(
		key ??
			(collection === 'factions'
				? factionKeyOf(name)
				: collection === 'cabinets'
					? cabinetKeyOf(name)
					: null)
	);
</script>

{#if resolved}<BronLink ref={`${collection}/${resolved}`} class="raak-rij {className}"
		>{name}</BronLink
	>{:else}<span class={className}>{name}</span>{/if}
