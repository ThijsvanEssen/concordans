<script lang="ts">
	// The name of a person, a fractie or a cabinet, as a link to its bron wherever it stands
	// (K-3): by the key where the row has it, else by the name as the API lists it. A name
	// the lists do not hold stays text. In a line of a list it is a row of a finger's 44 px
	// (.raak-rij); in a running sentence (`inText`) the target that moves nothing (.raakvlak).
	import BronLink from './BronLink.svelte';
	import { cabinetKeyOf, factionKeyOf } from './names.svelte';

	let {
		collection,
		name,
		key = null,
		class: className = '',
		inText = false
	}: {
		collection: 'members' | 'factions' | 'cabinets';
		name: string;
		/** The key, where the data gives it; a fractie or cabinet is otherwise found by name. */
		key?: string | null;
		class?: string;
		/** The name stands in a sentence, which keeps its line height. */
		inText?: boolean;
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

{#if resolved}<BronLink
		ref={`${collection}/${resolved}`}
		class="{inText ? 'raakvlak' : 'raak-rij'} {className}">{name}</BronLink
	>{:else}<span class={className}>{name}</span>{/if}
