<script lang="ts">
	// Kept or not: a framed button in a reader's head, as Citeer beside it (Thijs, 10 Oct: "een
	// kader"). Its glyph is the bookmark of RijActies, open or filled: an action, not a box.
	// "Bewaar lid 3" where it names a place; "Bewaard" as soon as any bundel holds it. Bewaar
	// keeps in Losse markeringen, or in the bundel the reader was opened from (`?bundel=`).
	// Bewaard takes nothing out: it opens the caret's menu, the bundels with a tick at each
	// that holds it, where a click puts it in or takes it out of that one (BundleChecklist,
	// decision 20A, UX-toets A14).
	import { page } from '$app/state';
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import { namesOf, type MapItem } from './map';
	import BundleChecklist from './BundleChecklist.svelte';

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
	const into = $derived(kaart.keepsIn(page.url));
	const titel = $derived(
		aan ? `${item.kort}: bewaard in ${namesOf(held)}` : `${item.kort}: in ${into.naam} bewaren`
	);
	let open = $state(false);
</script>

<span class="splits">
	<button
		type="button"
		class="btn"
		aria-pressed={aan}
		aria-haspopup={aan ? 'menu' : undefined}
		title={titel}
		onclick={() => (aan ? (open = true) : kaart.keep(item, into.id))}
		><Picto naam={aan ? 'bewaard' : 'bewaar'} />{aan ? 'Bewaard' : 'Bewaar'}{wat
			? ` ${wat}`
			: ''}</button
	>
	<TekstMenu klein rechts label="Bewaar {item.kort} in bundel" tekst="" bind:open>
		{#snippet inhoud(close)}<BundleChecklist {item} {close} />{/snippet}
	</TekstMenu>
</span>

<style>
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
