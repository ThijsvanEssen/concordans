<script lang="ts" generics="T extends string">
	// One choice among many, or a setting: a framed Knop (basis.css, besluit 33: a menu is
	// framed) with the word of its value and a caret. It opens a list under itself; the chosen
	// option in weight. The one form for every select in
	// Concordans: Alle bronnen, Per soort, Nieuwste eerst, Alle jaren. A menu that holds more
	// than a list (two lists side by side) passes its own `inhoud`.
	import type { Option } from './option';
	import type { Snippet } from 'svelte';
	import { menu } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import Caret from './Caret.svelte';

	/** `uit`: shown, not to be chosen now (its reason in `titel`). */

	let {
		label,
		opties = [],
		waarde = null,
		onSelect,
		tekst,
		rechts = false,
		inhoud,
		onder,
		knop,
		onClose,
		open = $bindable(false)
	}: {
		/** What the menu sets, for a screen reader: `Bronnen`, `Volgorde`. */
		label: string;
		opties?: Option<T>[];
		waarde?: T | null;
		onSelect?: (w: T) => void;
		/** The words on the button where they are not one option's label (`Alle jaren, alle rechters`). */
		tekst?: string;
		/** The list opens to the left, from the right edge of the button. */
		rechts?: boolean;
		/** In place of the options: what the menu holds, with the function that closes it. */
		inhoud?: Snippet<[() => void]>;
		/** Under the options, after a rule: a step out of the menu (`Kies bronnen en verbindingen`). */
		onder?: Snippet<[() => void]>;
		/** What the button shows where it is more than words (a badge and two dates). */
		knop?: Snippet;
		/** After it closes, however (a choice, Escape, Tab, a click outside): a menu that changed
		 *  what it shows (a list of bundels in place of its items) goes back. */
		onClose?: () => void;
		/** Open; bound, so another control opens the menu too (Bewaard beside Bewaar's caret). */
		open?: boolean;
	} = $props();

	let button = $state<HTMLElement | null>(null);
	const sluit = () => {
		open = false;
		onClose?.();
	};
	const gekozen = $derived(opties.find((o) => o.waarde === waarde));
	const woorden = $derived(tekst ?? gekozen?.label ?? label);
</script>

<div class="tekstmenu" use:menu={{ open, close: sluit }}>
	<button
		type="button"
		class="btn tekstmenu__knop"
		bind:this={button}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={!woorden || label.includes(woorden) ? label : `${label}: ${woorden}`}
		onclick={() => (open ? sluit() : (open = true))}
		>{#if knop}{@render knop()}{:else}{woorden}{/if}<Caret {open} /></button
	>
	{#if open && button}
		<!-- In the top layer (actions/top-layer.ts), so no column that scrolls on its own (the
		     facets of Bladeren, the Overzicht) cuts it off; its keys and clicks stay the menu's. -->
		<div
			class="tekstmenu__lijst"
			role="menu"
			aria-label={label}
			use:topLayer={{ anchor: button, close: sluit, align: rechts ? 'right' : 'left' }}
		>
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
						disabled={o.uit}
						onclick={() => {
							sluit();
							if (o.waarde !== waarde) onSelect?.(o.waarde);
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
	/* The button is a Knop (basis.css); only the gap to its caret is the menu's own. The
	   button has the focus back after a choice and stays in ink at rest (Thijs, 10 Oct). */
	.tekstmenu__knop {
		gap: var(--s-1);
	}
	/* Global: the one item of every menu, a step under the rule (`onder`) and the items of a
	   menu with its own `inhoud` or of a menu of its own (a ⋯, the versions of an article). A
	   menu that lays an item out otherwise (a count at the right) adds a class for that only. */
	:global(.tekstmenu__item) {
		display: block;
		width: 100%;
		padding: var(--s-1) var(--s-3);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	/* A link as an item (an official site), and an item with a value at its right: the form
	   of a citation and its kind ("kort", "link"). */
	:global(a.tekstmenu__item) {
		text-decoration: none;
	}
	:global(.tekstmenu__item--paar) {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
	}
	:global(.tekstmenu__item:hover:not(:disabled)),
	:global(.tekstmenu__item:focus-visible),
	:global(.tekstmenu__item:focus-within) {
		background: var(--paper-2);
		outline: none;
	}
	/* A finger's row on a touch screen and below 768: a line of text 44 px high (--veld-h-raak), as every
	   other target there; a mouse keeps the denser row. */
	@media (pointer: coarse), (max-width: 768px) {
		:global(.tekstmenu__item) {
			padding-block: calc((var(--veld-h-raak) - 1lh) / 2);
			min-height: var(--veld-h-raak);
		}
	}
	:global(.tekstmenu__item:disabled) {
		color: var(--rule-strong);
		cursor: default;
	}
	:global(.tekstmenu__item[aria-checked='true']) {
		font-weight: 600;
	}
</style>
