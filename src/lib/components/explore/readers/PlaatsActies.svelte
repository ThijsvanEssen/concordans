<script lang="ts">
	// A place's quiet words (a lid, an onderdeel, an overweging): "1 verbinding, Citeer,
	// Bewaar", plain words, no frames (Thijs, 10 Oct: "druk met al de mogelijke klikken").
	// Citeer holds Kopieer tekst. The words show on hover and focus of the place around them
	// (Plaats, `.plaats`), always on a touch screen; the count of verbindingen always.
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import type { CiteItem } from '$lib/components/ui/cite';
	import Bewaar from '$lib/map/Bewaar.svelte';
	import type { MapItem } from '$lib/map/map';
	import { formatCount } from '$lib/verbonden/filter';
	import { createCopier } from '$lib/components/ui/copy.svelte';

	let {
		verbindingen = null,
		cite = [],
		naam = '',
		bewaar = null,
		tekst,
		onToggle
	}: {
		/** Its verbindingen and where they are listed. */
		verbindingen?: { n: number; href: string } | null;
		cite?: CiteItem[];
		naam?: string;
		bewaar?: MapItem | null;
		/** The text Kopieer tekst copies; the word itself where there is no Citeer. */
		tekst?: () => string;
		/** Told when Citeer opens or closes: the place can stay raised. */
		onToggle?: (open: boolean) => void;
	} = $props();

	const copier = createCopier();
</script>

<span class="plaats-acties">
	{#if verbindingen}
		<a class="plaats-woord plaats-acties__tel" href={verbindingen.href} data-sveltekit-noscroll
			>{formatCount(verbindingen.n)}
			{verbindingen.n === 1 ? 'verbinding' : 'verbindingen'}</a
		><span class="sep plaats-acties__woorden">,</span>
	{/if}
	<span class="plaats-acties__woorden">
		{#if cite.length > 0}
			<CiteMenu items={cite} name={naam} buttonClass="plaats-woord" {onToggle}>
				{#snippet onder(dicht)}
					{#if tekst}
						<button
							type="button"
							role="menuitem"
							onclick={() => {
								void copier.copy(tekst(), 'tekst');
								dicht();
							}}>{copier.label('tekst', 'Kopieer tekst')}</button
						>
					{/if}
				{/snippet}
			</CiteMenu>
		{:else if tekst}
			<button type="button" class="plaats-woord" onclick={() => copier.copy(tekst(), 'tekst')}
				>{copier.label('tekst', 'Kopieer tekst')}</button
			>
		{/if}
		{#if bewaar}<span class="sep">,</span><Bewaar item={bewaar} tekst />{/if}
	</span>
	<span class="sr-only" aria-live="polite">{copier.announcement}</span>
</span>

<style>
	.plaats-acties {
		position: relative;
		z-index: 2;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.plaats-acties__tel {
		text-decoration: none;
	}
	.plaats-acties__woorden {
		display: inline-flex;
		align-items: baseline;
	}
	/* A comma after a word, its space after it. */
	.sep {
		margin-right: var(--s-1);
		color: var(--ink-3);
	}
	/* Hidden by opacity, not visibility: Tab still reaches the words, and shows them. */
	.plaats-acties__woorden {
		opacity: 0;
	}
	:global(.plaats:hover) .plaats-acties__woorden,
	:global(.plaats:focus-within) .plaats-acties__woorden,
	:global(.plaats.is-open) .plaats-acties__woorden {
		opacity: 1;
	}
	@media (hover: none) {
		.plaats-acties__woorden {
			opacity: 1;
		}
	}
</style>
