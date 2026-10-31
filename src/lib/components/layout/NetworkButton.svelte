<script lang="ts">
	// Netwerk, the tool beside the search field (besluit 36, 39). On a bron and in its werkplek a
	// wissel Lezer | Netwerk, in the form of a Keuze (B48, Thijs 31 Oct: "Ja, alleen 1440"): the
	// one pressed is where the reader is, the other leads to the text or to the werkplek with that
	// bron. Elsewhere one button, that begins with choosing a bron. Netwerk says how many bronnen
	// the netwerk holds while there is one ("Netwerk 2"): the way back to it stays in view. Only on
	// a wide screen: on a phone the tab bar is the switch.
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
	const here = $derived(`${url.pathname}${url.search}${url.hash}`);
	// The werkplek without a bron has no text to lead back to: Netwerk alone.
	const paired = $derived(onBron || (pressed && state.href !== '/'));
</script>

{#snippet networkLink(className: string)}
	<a
		class="{className} netwerk-knop raakvlak-knop"
		class:is-active={pressed}
		href={pressed && paired ? here : state.href}
		aria-label={aantal ? `Netwerk, ${count(aantal, 'bron', 'bronnen')}` : 'Netwerk'}
		aria-pressed={pressed}
		aria-keyshortcuts={onBron && !pressed ? 'Alt+L' : undefined}
		role="button"
		title={pressed
			? undefined
			: onBron
				? 'Open deze bron in netwerk'
				: 'Kies een bron in het netwerk'}
		><Picto naam="netwerk-o" size={16} /><span>Netwerk</span>{#if aantal}<span
				class="netwerk-knop__aantal">{aantal}</span
			>{/if}</a
	>
{/snippet}

{#if paired}
	<div class="lees-keuze" role="group" aria-label="Lezer of netwerk">
		<a
			class="lees-keuze__knop raakvlak-knop"
			href={pressed ? state.href : here}
			aria-pressed={!pressed}
			aria-keyshortcuts={pressed ? 'Alt+L' : undefined}
			role="button"
			title={pressed ? 'Terug naar de tekst' : undefined}
			><Picto naam="tekst" size={16} /><span>Lezer</span></a
		>{@render networkLink('lees-keuze__knop')}
	</div>
{:else}
	{@render networkLink('btn')}
{/if}

<style>
	/* The canvas is on screen: the button stands pressed, as a chosen segment does. */
	.btn.is-active {
		background: var(--paper-2);
		border-color: var(--ink-3);
	}
	.netwerk-knop__aantal {
		color: var(--ink-3);
	}
	/* The wissel as Keuze draws a choice: one frame, a rule between, the one pressed on paper-2
	   with an ink line under it. Links, for each leads to a page. */
	.lees-keuze {
		box-sizing: border-box;
		display: inline-flex;
		height: var(--veld-h);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
	}
	.lees-keuze__knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: 0 var(--s-3);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
	}
	.lees-keuze__knop:first-child {
		border-radius: var(--r-1) 0 0 var(--r-1);
	}
	.lees-keuze__knop + .lees-keuze__knop {
		border-left: 1px solid var(--rule-strong);
		border-radius: 0 var(--r-1) var(--r-1) 0;
	}
	.lees-keuze__knop:hover:not([aria-pressed='true']) {
		background: var(--paper-2);
	}
	.lees-keuze__knop[aria-pressed='true'] {
		background: var(--paper-2);
		box-shadow: inset 0 -2px 0 var(--ink);
	}
	.lees-keuze__knop:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
