<script lang="ts">
	// Volg, the same on Actueel, a list and a dossier: the Atom link of exactly this view, to
	// follow it in a feed reader, copied (no account, nothing kept by Concordans). Where the view
	// can also be kept under Gevolgd in this browser, Volg opens a menu with both; else the
	// button copies at once, and says Gekopieerd.
	import type { Snippet } from 'svelte';
	import { report } from '$lib/api/errors';
	import { menu } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import Caret from './Caret.svelte';
	import { createCopier } from './copy.svelte';

	let {
		href,
		label = 'Volg',
		buttonClass = 'btn',
		lokaal
	}: {
		/** The Atom link of the view (`atomHref`). */
		href: string;
		label?: string;
		buttonClass?: string;
		/** The ways to follow in this browser, as menu items; given the function that closes the menu. */
		lokaal?: Snippet<[() => void]>;
	} = $props();

	let open = $state(false);
	let button = $state<HTMLElement | null>(null);
	const copier = createCopier();

	function copy() {
		copier.copy(href, 'atom').catch((e) => report('Volgen', e));
		open = false;
	}
</script>

{#if lokaal}
	<span class="volg" use:menu={{ open, close: () => (open = false) }}>
		<button
			type="button"
			class={buttonClass}
			bind:this={button}
			aria-haspopup="menu"
			aria-expanded={open}
			onclick={() => (open = !open)}>{copier.label('atom', label)}<Caret {open} /></button
		>
		{#if open && button}
			<div
				class="tekstmenu__lijst"
				role="menu"
				aria-label={label}
				use:topLayer={{ anchor: button, close: () => (open = false), align: 'right' }}
			>
				{@render lokaal(() => (open = false))}
				<button type="button" role="menuitem" class="tekstmenu__item" onclick={copy}
					>Kopieer Atom-link</button
				>
			</div>
		{/if}
	</span>
{:else}
	<button
		type="button"
		class={buttonClass}
		title="Kopieer de Atom-link van deze lijst"
		onclick={copy}>{copier.label('atom', label)}</button
	>
{/if}
<span class="sr-only" aria-live="polite">{copier.announcement}</span>

<style>
	.volg {
		position: relative;
		display: inline-flex;
	}
</style>
