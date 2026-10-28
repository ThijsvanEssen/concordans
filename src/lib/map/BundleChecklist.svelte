<script lang="ts">
	// The bundels a bron is in, as a menu's items, the one form wherever a bron is kept: the
	// caret and Bewaard of a reader's Bewaar, the bookmark of a row, a place's menu (decision
	// 20A, UX-toets A14). Every bundel in its own order, Mijn markeringen first, a tick at
	// each that holds the bron: a click puts it in or takes it out of that one bundel, so
	// nothing is taken out of all at once. Nieuwe bundel asks its name in place.
	import Picto from '$lib/components/ui/Picto.svelte';
	import Tekstveld from '$lib/components/ui/Tekstveld.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let { item, close }: { item: MapItem; close: () => void } = $props();

	const held = $derived(kaart.holding(item));
	/** The field of a new bundel's name, with the focus. */
	let naming = $state(false);
</script>

<!-- In their own order, which a tick does not change while the menu is open. -->
{#each kaart.mappen as m (m.id)}
	{@const here = held.some((h) => h.id === m.id)}
	<button
		type="button"
		role="menuitemcheckbox"
		class="tekstmenu__item tekstmenu__item--paar"
		aria-checked={here}
		onclick={() => kaart.toggleIn(m.id, item)}
		><span>{m.naam}</span><span class="vink"
			>{#if here}<Picto naam="tick" size={12} />{/if}</span
		></button
	>
{/each}
<div class="tekstmenu__onder">
	{#if naming}
		<form
			class="naam"
			onsubmit={(e) => {
				e.preventDefault();
				const field = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
				if (!field.value.trim()) return;
				kaart.nieuw(field.value, [item]);
				close();
			}}
		>
			<Tekstveld
				name="naam"
				placeholder="Naam van de bundel"
				label="Naam van de nieuwe bundel"
				focus
			/>
		</form>
	{:else}
		<button type="button" role="menuitem" class="tekstmenu__item" onclick={() => (naming = true)}
			>Nieuwe bundel</button
		>
	{/if}
</div>

<style>
	.vink {
		display: inline-flex;
		align-items: center;
		color: var(--ink);
	}
	.naam {
		margin: 0;
		padding: var(--s-1) var(--s-3);
	}
</style>
