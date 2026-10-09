<script lang="ts" generics="T extends string">
	// One choice among many, or a setting: the word of its value with a quiet caret, without a
	// frame (docs/bediening.md, Thijs, 10 Oct: "alle dingen versimpelen is akkoord"). It opens a
	// list under itself; the chosen option in weight. The one form for every select in
	// Concordans: Alle bronnen, Per soort, Nieuwste eerst, Alle jaren. A menu that holds more
	// than a list (two lists side by side) passes its own `inhoud`.
	import type { Snippet } from 'svelte';
	import { menu } from '$lib/actions/menu';
	import Caret from './Caret.svelte';

	type Optie = { waarde: T; label: string; titel?: string };

	let {
		label,
		opties = [],
		waarde = null,
		onKies,
		tekst,
		klein = false,
		rechts = false,
		inhoud,
		onder,
		knop
	}: {
		/** What the menu sets, for a screen reader: `Bronnen`, `Volgorde`. */
		label: string;
		opties?: Optie[];
		waarde?: T | null;
		onKies?: (w: T) => void;
		/** The words on the button where they are not one option's label (`Alle jaren, alle rechters`). */
		tekst?: string;
		/** In a panel or a group: the panel's height (24 px) instead of the page's (32 px). */
		klein?: boolean;
		/** The list opens to the left, from the right edge of the button. */
		rechts?: boolean;
		/** In place of the options: what the menu holds, with the function that closes it. */
		inhoud?: Snippet<[() => void]>;
		/** Under the options, after a rule: a step out of the menu (`Kies bronnen en verbindingen`). */
		onder?: Snippet<[() => void]>;
		/** What the button shows where it is more than words (a badge and two dates). */
		knop?: Snippet;
	} = $props();

	let open = $state(false);
	const sluit = () => (open = false);
	const gekozen = $derived(opties.find((o) => o.waarde === waarde));
	const woorden = $derived(tekst ?? gekozen?.label ?? label);
</script>

<div class="tekstmenu" class:klein use:menu={{ open, close: sluit }}>
	<button
		type="button"
		class="tekstmenu__knop"
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label="{label}: {woorden}"
		onclick={() => (open = !open)}
		>{#if knop}{@render knop()}{:else}{woorden}{/if}<Caret {open} /></button
	>
	{#if open}
		<div class="tekstmenu__lijst" class:rechts role="menu" aria-label={label}>
			{#if inhoud}
				{@render inhoud(sluit)}
			{:else}
				{#each opties as o (o.waarde)}
					<button
						type="button"
						role="menuitemradio"
						class="tekstmenu__item"
						aria-checked={o.waarde === waarde}
						title={o.titel}
						onclick={() => {
							sluit();
							if (o.waarde !== waarde) onKies?.(o.waarde);
						}}>{o.label}</button
					>
				{/each}
			{/if}
			{#if onder}
				<div class="tekstmenu__onder">{@render onder(sluit)}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.tekstmenu {
		position: relative;
		display: inline-flex;
	}
	.tekstmenu__knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		height: var(--veld-h);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		white-space: nowrap;
		cursor: pointer;
	}
	.klein .tekstmenu__knop {
		height: var(--veld-h-klein);
		font-size: var(--t-ui-micro);
	}
	.tekstmenu__knop:hover,
	.tekstmenu__knop:focus-visible {
		color: var(--accent);
	}
	.tekstmenu__lijst {
		position: absolute;
		top: calc(100% + var(--s-1));
		left: 0;
		z-index: var(--z-float);
		min-width: 200px;
		padding: var(--s-1) 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}
	.tekstmenu__lijst.rechts {
		left: auto;
		right: 0;
	}
	.tekstmenu__item {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.tekstmenu__item:hover,
	.tekstmenu__item:focus-visible {
		background: var(--paper-2);
		outline: none;
	}
	.tekstmenu__item[aria-checked='true'] {
		font-weight: 600;
	}
	.tekstmenu__onder {
		margin-top: var(--s-1);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
	}
</style>
