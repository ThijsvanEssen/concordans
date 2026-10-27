<script lang="ts">
	// Mijn at the right of the top bar: a menu of Bundels and Gevolgd, what the reader keeps
	// and follows. A sign on it (NewMark) until the reader has been at the item that has one.
	// A TekstMenu with the button of the bar: a word beside the links, not a framed Knop.
	import { page } from '$app/state';
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { sign } from '$lib/bevestig/bevestig.svelte';
	import { MINE, mineAt } from '$lib/nav/mine';

	let open = $state(false);
	const current = $derived(mineAt(page.url.pathname));
</script>

<span class="mijn">
	<TekstMenu
		label="Mijn"
		tekst="Mijn"
		rechts
		klasse="mijn__knop"
		gekozen={current !== null}
		bind:open
	>
		{#snippet knop()}Mijn{#if !open && (sign.has('bundels') || sign.has('gevolgd'))}<NewMark
				/>{/if}{/snippet}
		{#snippet inhoud(close)}
			{#each MINE as m (m.id)}
				<a
					href={m.href}
					role="menuitem"
					class="tekstmenu__item"
					aria-current={current === m.id ? 'page' : undefined}
					onclick={close}
					>{m.label}{#if sign.has(m.id)}<NewMark />{/if}</a
				>
			{/each}
		{/snippet}
	</TekstMenu>
</span>

<style>
	.mijn {
		display: inline-flex;
	}
	/* Beside the links of the bar, in their sans: a menu that reads as one of them. */
	.mijn :global(.mijn__knop) {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink-3);
		cursor: pointer;
	}
	.mijn :global(.mijn__knop:hover),
	.mijn :global(.mijn__knop:focus-visible),
	.mijn :global(.mijn__knop.is-active),
	.mijn :global(.mijn__knop[aria-expanded='true']) {
		color: var(--ink);
	}
</style>
