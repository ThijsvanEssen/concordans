<script lang="ts">
	// The contents of the bron as a Blad, below 1100 px: there three columns and a panel do
	// not fit beside the text, so Inhoud opens the same contents (LezenNav, DocumentToc,
	// JudgmentToc) over the page. Above it the sheet is not shown; the column stands there.
	import { MediaQuery } from 'svelte/reactivity';
	import type { Snippet } from 'svelte';
	import Blad from '$lib/components/ui/Blad.svelte';

	let {
		onClose,
		always = false,
		children
	}: {
		onClose: () => void;
		/** Also above 1100 px, as a drawer at the left: beside the network the contents have no column. */
		always?: boolean;
		children: Snippet;
	} = $props();

	const narrow = new MediaQuery('max-width: 1100px');

	// Picking a bron or a division (its link) closes the sheet; opening or closing a
	// Boek/Titel group (a <summary>) must not, or the tree could never be opened inside it.
	function onBodyClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('summary') && !target.closest('a')) return;
		onClose();
	}
</script>

{#if always || narrow.current}
	<Blad title="Inhoud" place="links" upTo="tablet" {onClose}>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<div class="body" onclick={onBodyClick}>
			{@render children()}
		</div>
	</Blad>
{/if}

<style>
	/* The Blad is called Inhoud already: the column's own caption would say it twice. */
	.body :global(.nav-kolom__label) {
		display: none;
	}
</style>
