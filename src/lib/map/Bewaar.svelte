<script lang="ts">
	// Kept or not: a framed button in a reader's head, as Citeer beside it (Thijs, 10 Oct: "een
	// kader"). Its glyph is the bookmark of RijActies, open or filled: an action, not a box.
	// "Bewaar lid 3" where it names a place; "Bewaard" as soon as any bundel holds it. Bewaar
	// keeps in Losse markeringen. A reader opened from a bundel (Andere bron toevoegen) keeps
	// in that bundel for the session and says so: "Bewaar in <bundel>", with the way back to
	// it and Klaar beside it, until the reader ends it (UX-toets A21 #1). Bewaard takes nothing out: it opens the caret's menu, the bundels with a tick at each
	// that holds it, where a click puts it in or takes it out of that one (BundleChecklist,
	// decision 20A, UX-toets A14).
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import { namesOf, type MapItem } from './map';
	import BundleChecklist from './BundleChecklist.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { bundlePageHref } from './page';

	let {
		item,
		wat = ''
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
	} = $props();

	const keeping = $derived(kaart.keeping);
	const held = $derived(kaart.holding(item));
	/** Kept: in the bundel a reader keeps in, else in any bundel. */
	const aan = $derived(keeping ? held.some((m) => m.id === keeping.id) : held.length > 0);
	const into = $derived(kaart.keepsIn);
	const titel = $derived(
		aan ? `${item.kort}: bewaard in ${namesOf(held)}` : `${item.kort}: in ${into.naam} bewaren`
	);
	let open = $state(false);
	let knop = $state<HTMLButtonElement>();
	/** Klaar ends the keeping in the bundel; the focus goes back to Bewaar, which stays. */
	function klaar() {
		kaart.keepIn(null);
		knop?.focus();
	}
</script>

<span class="splits">
	<button
		bind:this={knop}
		type="button"
		class="btn"
		aria-pressed={aan}
		aria-haspopup={aan ? 'menu' : undefined}
		title={titel}
		onclick={() => (aan ? (open = true) : kaart.keep(item, into.id))}
		><Picto naam={aan ? 'bewaard' : 'bewaar'} />{aan ? 'Bewaard' : 'Bewaar'}{wat
			? ` ${wat}`
			: ''}{keeping ? ` in ${keeping.naam}` : ''}</button
	>
	<TekstMenu klein rechts label="Bewaar {item.kort} in bundel" tekst="" bind:open>
		{#snippet inhoud(close)}<BundleChecklist {item} {close} />{/snippet}
	</TekstMenu>
</span>
{#if keeping}
	{@const k = keeping}
	<span class="keeping">
		<TekstLink href={bundlePageHref(k)}>Naar {k.naam}</TekstLink>
		<TekstLink onclick={klaar} aria-label="Klaar met bewaren in {k.naam}">Klaar</TekstLink>
	</span>
{/if}

<style>
	/* The bundel kept in: its way back and Klaar, beside Bewaar, on a touch screen too. */
	.keeping {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1) var(--s-3);
		font-size: var(--t-meta);
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
	/* The caret is 44 px wide for a finger, never reaching over Bewaar (UX-toets A21 #3). */
	@media (pointer: coarse), (max-width: 768px) {
		.splits :global(.tekstmenu__knop) {
			min-width: var(--veld-h-raak);
		}
	}
	.splits :global(.tekstmenu__knop:hover) {
		background: var(--paper-2);
		color: var(--ink);
	}
</style>
