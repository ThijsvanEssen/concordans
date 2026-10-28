<script lang="ts">
	// Volg, the same on Actueel, a list and a dossier. Not followed: one Knop, Volg. On a list it
	// copies the Atom link of exactly this view, to follow it in a feed reader (no account,
	// nothing kept by Concordans) and says Gekopieerd; where the view can be kept under Gevolgd in
	// this browser (`onFollow`) it does that at once. Followed (`followed`): the Knop says Gevolgd
	// with a tick, and its menu (TekstMenu) leads to Gevolgd, takes the follow back and keeps the Atom link.
	import type { Snippet } from 'svelte';
	import { report } from '$lib/api/errors';
	import TekstMenu from './TekstMenu.svelte';
	import Tick from './Vinkje.svelte';
	import { createCopier } from './copy.svelte';

	let {
		href,
		buttonClass = 'btn',
		followed = false,
		onFollow,
		local
	}: {
		/** The Atom link of the view (`atomHref`). */
		href: string;
		buttonClass?: string;
		/** Followed in this browser: Gevolgd with a tick, and the menu. */
		followed?: boolean;
		/** Not followed: Volg keeps it under Gevolgd at once, in place of copying the Atom link. */
		onFollow?: () => void;
		/** Followed: the ways on in this browser, as menu items; given the function that closes the menu. */
		local?: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	const copier = createCopier();

	function copy() {
		copier.copy(href, 'atom', 'Atom-link').catch((e) => report('Volgen', e));
		open = false;
	}
</script>

{#if followed}
	<span class="volg">
		<TekstMenu
			label={copier.label('atom', 'Gevolgd')}
			rechts
			buttonClass="{buttonClass} tekstmenu__knop"
			bind:open
		>
			{#snippet knop()}<Tick aan />{copier.label('atom', 'Gevolgd')}{/snippet}
			{#snippet inhoud(close)}
				{@render local?.(close)}
				<button type="button" role="menuitem" class="tekstmenu__item" onclick={copy}
					>Kopieer Atom-link</button
				>
			{/snippet}
		</TekstMenu>
	</span>
{:else if onFollow}
	<button type="button" class={buttonClass} onclick={onFollow}>Volg</button>
{:else}
	<button
		type="button"
		class={buttonClass}
		title="Kopieer de Atom-link van deze lijst"
		onclick={copy}>{copier.label('atom', 'Volg')}</button
	>
{/if}

<style>
	.volg {
		position: relative;
		display: inline-flex;
	}
</style>
