<script lang="ts">
	// Netwerk, the tool beside the search field (besluit 36): on a bron it opens that bron big
	// in the network, elsewhere it begins with choosing one. The word and the icon; on a phone
	// the icon alone, 44 px, with the word for a screen reader.
	import { page } from '$app/state';
	import { hasFocus } from '$lib/bron/href';
	import Picto from '$lib/components/ui/Picto.svelte';
	import { networkHref, onNetwork } from '$lib/nav/network';

	const url = $derived(page.url);
	const onBron = $derived(hasFocus(url));
	const pressed = $derived(onNetwork(url));
</script>

<a
	class="btn netwerk-knop raakvlak-knop"
	class:is-active={pressed}
	href={networkHref(url)}
	aria-label="Netwerk"
	aria-current={pressed ? 'page' : undefined}
	title={onBron ? 'Deze bron groot in het netwerk' : 'Kies een bron in het netwerk'}
	><Picto naam="netwerk-o" size={16} /><span class="netwerk-knop__woord">Netwerk</span></a
>

<style>
	/* The canvas is on screen: the button stands pressed, as a chosen segment does. */
	.netwerk-knop.is-active {
		background: var(--paper-2);
		border-color: var(--ink-3);
	}
	@media (max-width: 768px) {
		.netwerk-knop {
			justify-content: center;
			width: var(--veld-h-raak);
			height: var(--veld-h-raak);
			padding: 0;
		}
		.netwerk-knop__woord {
			display: none;
		}
	}
</style>
