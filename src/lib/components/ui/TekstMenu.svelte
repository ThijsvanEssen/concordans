<script lang="ts" generics="T extends string">
	// One choice among many, or a setting: the word of its value with a quiet caret, without a
	// frame (docs/bediening.md, Thijs, 10 Oct: "alle dingen versimpelen is akkoord"). It opens a
	// list under itself; the chosen option in weight. The one form for every select in
	// Concordans: Alle bronnen, Per soort, Nieuwste eerst, Alle jaren. A menu that holds more
	// than a list (two lists side by side) passes its own `inhoud`.
	import type { Snippet } from 'svelte';
	import { menu } from '$lib/actions/menu';
	import Caret from './Caret.svelte';

	/** `uit`: shown, not to be chosen now (its reason in `titel`). */
	type Optie = { waarde: T; label: string; titel?: string; uit?: boolean };

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

	/**
	 * The list in the top layer (the popover API, as BronLink's card), so that no column that
	 * scrolls on its own (the facets of Bladeren, the Overzicht) cuts it off: fixed under its
	 * button, at its left edge or (`rechts`) its right, kept there while the page scrolls, and
	 * inside the window. It stays in the menu's element, so its keys and clicks are as before.
	 * Without the popover API it stands under the button as it did.
	 */
	function toplaag(lijst: HTMLElement, rechtsUit: boolean) {
		const knop = lijst.parentElement?.querySelector<HTMLElement>('.tekstmenu__knop');
		if (!knop || typeof lijst.showPopover !== 'function') return;
		lijst.setAttribute('popover', 'manual');
		lijst.showPopover();
		const RAND = 8;
		const zet = () => {
			const r = knop.getBoundingClientRect();
			const top = r.bottom + 4;
			lijst.style.top = `${top}px`;
			lijst.style.maxHeight = `${Math.max(120, Math.min(innerHeight * 0.6, innerHeight - top - RAND))}px`;
			const breed = lijst.offsetWidth;
			const links = rechtsUit ? r.right - breed : r.left;
			lijst.style.left = `${Math.max(RAND, Math.min(links, innerWidth - breed - RAND))}px`;
		};
		zet();
		addEventListener('scroll', zet, true);
		addEventListener('resize', zet);
		return {
			destroy() {
				removeEventListener('scroll', zet, true);
				removeEventListener('resize', zet);
			}
		};
	}
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
		<div class="tekstmenu__lijst" class:rechts role="menu" aria-label={label} use:toplaag={rechts}>
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
	/* Red on a hover only: the button has the focus back after a choice, and would stay red
	   at rest (the Legenda's Bronnen, Thijs, 10 Oct). The focus is underlined in ink. */
	.tekstmenu__knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.tekstmenu__knop:focus-visible {
		outline: none;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.tekstmenu__lijst {
		position: absolute;
		top: calc(100% + var(--s-1));
		left: 0;
		z-index: var(--z-float);
		min-width: 200px;
		max-height: 60vh;
		overflow-y: auto;
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
	/* In the top layer: fixed where toplaag puts it, not the popover's centre of the window. */
	.tekstmenu__lijst:popover-open {
		position: fixed;
		inset: auto;
		margin: 0;
		color: inherit;
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
		font-size: var(--t-ui-micro);
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
	/* A finger's row on a touch screen. */
	@media (pointer: coarse) {
		:global(.tekstmenu__item) {
			padding-block: var(--s-2);
		}
	}
	:global(.tekstmenu__item:disabled) {
		color: var(--rule-strong);
		cursor: default;
	}
	:global(.tekstmenu__item[aria-checked='true']) {
		font-weight: 600;
	}
	.tekstmenu__onder {
		margin-top: var(--s-1);
		padding-top: var(--s-1);
		border-top: 1px solid var(--rule);
	}
	/* A menu of actions alone (no options): no rule above its first. */
	.tekstmenu__onder:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}
</style>
