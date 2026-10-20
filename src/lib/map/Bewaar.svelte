<script lang="ts">
	// Kept or not: a framed button in a reader's head, as Citeer beside it (Thijs, 10 Oct: "een
	// kader"). Its glyph is the bookmark of RijActies, open or filled: an action, not a box.
	// "Bewaar lid 3" where it names a place; "Bewaard" as soon as any bundel holds it. Bewaar
	// keeps in Losse markeringen; Bewaard takes it out of the bundels that hold it, which its
	// title names. The caret beside it lists the bundels, a tick at each that holds it: a click
	// puts it in or takes it out (decision 20A: no hidden bundel where Bewaar keeps). Nieuwe
	// bundel asks its name in place.
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import { namesOf, type MapItem } from './map';

	let {
		item,
		wat = ''
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
	} = $props();

	const held = $derived(kaart.holding(item));
	const aan = $derived(held.length > 0);
	const titel = $derived(
		aan
			? `${item.kort}: uit ${namesOf(held)} halen`
			: `${item.kort}: in ${kaart.loose.naam} bewaren`
	);
	/** The field of a new bundel's name, open in the menu, with the focus. */
	let naming = $state(false);
	const focus = (field: HTMLInputElement) => field.focus();
</script>

<span class="splits">
	<button
		type="button"
		class="btn"
		aria-pressed={aan}
		title={titel}
		onclick={() => kaart.wissel(item)}
		><Picto naam={aan ? 'bewaard' : 'bewaar'} />{aan ? 'Bewaard' : 'Bewaar'}{wat
			? ` ${wat}`
			: ''}</button
	>
	<TekstMenu
		klein
		rechts
		label="Bewaar {item.kort} in bundel"
		tekst=""
		onClose={() => (naming = false)}
	>
		<!-- The bundels, Losse markeringen first; a tick at each that holds the item. -->
		{#snippet inhoud()}
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
		{/snippet}
		{#snippet onder(dicht)}
			{#if naming}
				<form
					class="naam"
					onsubmit={(e) => {
						e.preventDefault();
						const field = e.currentTarget.elements.namedItem('naam') as HTMLInputElement;
						if (!field.value.trim()) return;
						kaart.nieuw(field.value, [item]);
						dicht();
					}}
				>
					<input name="naam" placeholder="Naam" aria-label="Naam van de nieuwe bundel" use:focus />
				</form>
			{:else}
				<button
					type="button"
					role="menuitem"
					class="tekstmenu__item"
					onclick={() => (naming = true)}>Nieuwe bundel</button
				>
			{/if}
		{/snippet}
	</TekstMenu>
</span>

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
	/* The framed pair: the box and its word, the caret of the map's choice joined to it. */
	.splits {
		display: inline-flex;
		align-items: stretch;
	}
	.splits > .btn {
		gap: var(--s-2);
	}
	.splits:has(:global(.tekstmenu)) > .btn {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
	.splits :global(.tekstmenu__knop) {
		box-sizing: border-box;
		height: var(--veld-h-klein);
		padding: 0 var(--s-1);
		border: 1px solid var(--rule-strong);
		border-left: 0;
		border-radius: 0 var(--r-1) var(--r-1) 0;
		color: var(--ink-2);
	}
	.splits :global(.tekstmenu__knop:hover) {
		background: var(--paper-2);
		color: var(--ink);
	}
</style>
