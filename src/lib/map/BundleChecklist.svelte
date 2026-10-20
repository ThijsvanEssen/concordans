<script lang="ts">
	// The bundels a bron is in, as a menu's items, the one form wherever a bron is kept: the
	// caret and Bewaard of a reader's Bewaar, the bookmark of a row, a place's menu (decision
	// 20A, UX-toets A14). Every bundel in its own order, Losse markeringen first, a tick at
	// each that holds the bron: a click puts it in or takes it out of that one bundel, so
	// nothing is taken out of all at once. Nieuwe bundel asks its name in place.
	import Picto from '$lib/components/ui/Picto.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let { item, close }: { item: MapItem; close: () => void } = $props();

	const held = $derived(kaart.holding(item));
	/** The field of a new bundel's name, with the focus. */
	let naming = $state(false);
	const focus = (field: HTMLInputElement) => field.focus();
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
			<input name="naam" placeholder="Naam" aria-label="Naam van de nieuwe bundel" use:focus />
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
	/* The field at 16px: below that a phone zooms in on focus. */
	.naam input {
		box-sizing: border-box;
		width: 100%;
		padding: var(--s-1) var(--s-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-input);
		color: var(--ink);
	}
</style>
