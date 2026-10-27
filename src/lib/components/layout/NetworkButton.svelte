<script lang="ts">
	// Netwerk, the tool beside the search field (besluit 36, 39), a switch: on a bron it opens the
	// werkplek with that bron, elsewhere it begins with choosing one; in the werkplek it stands
	// pressed and leads back to the text. The word, the icon and how many
	// bronnen the netwerk holds while there is one ("Netwerk 2"): the way back to it stays in
	// view. On a phone the icon with its count, 44 px, the word for a screen reader.
	import { page } from '$app/state';
	import { hasFocus } from '$lib/bron/href';
	import Picto from '$lib/components/ui/Picto.svelte';
	import { count } from '$lib/text/words';
	import { networkState } from '$lib/nav/network';

	const url = $derived(page.url);
	const onBron = $derived(hasFocus(url));
	const state = $derived(networkState(url));
	const pressed = $derived(state.pressed);
	const aantal = $derived(state.count);
</script>

<a
	class="btn netwerk-knop raakvlak-knop"
	class:is-active={pressed}
	href={state.href}
	aria-label={aantal ? `Netwerk, ${count(aantal, 'bron', 'bronnen')}` : 'Netwerk'}
	aria-pressed={pressed}
	role="button"
	title={pressed
		? 'Terug naar de tekst'
		: onBron
			? 'Open deze bron in netwerk'
			: 'Kies een bron in het netwerk'}
	><Picto naam="netwerk-o" size={16} /><span class="netwerk-knop__woord">Netwerk</span
	>{#if aantal}<span class="netwerk-knop__aantal">{aantal}</span>{/if}</a
>

<style>
	/* The canvas is on screen: the button stands pressed, as a chosen segment does. */
	.netwerk-knop.is-active {
		background: var(--paper-2);
		border-color: var(--ink-3);
	}
	.netwerk-knop__aantal {
		color: var(--ink-3);
	}
	@media (max-width: 768px) {
		.netwerk-knop {
			position: relative;
			justify-content: center;
			width: var(--veld-h-raak);
			height: var(--veld-h-raak);
			padding: 0;
		}
		.netwerk-knop__woord {
			display: none;
		}
		/* The count as an index at the icon's upper right. */
		.netwerk-knop__aantal {
			position: absolute;
			top: var(--s-1);
			right: var(--s-1);
			font-size: var(--t-micro);
			line-height: 1;
		}
	}
</style>
