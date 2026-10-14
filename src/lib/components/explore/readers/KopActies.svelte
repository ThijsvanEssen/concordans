<script lang="ts">
	// The two actions in a reader's head, framed, the same on every reader (Thijs, 10 Oct:
	// "misschien hebben ze een kader nodig"): Bewaar, the box that keeps at once with the
	// choice of map joined to it, and Citeer, the forms with Kopieer tekst and the official
	// text under its rule. A reader puts it at the right of its status line.
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import { report } from '$lib/api/errors';
	import type { CiteItem } from '$lib/components/ui/cite';
	import Bewaar from '$lib/map/Bewaar.svelte';
	import type { MapItem } from '$lib/map/map';
	import { createCopier } from '$lib/components/ui/copy.svelte';

	let {
		bewaar = null,
		wat = '',
		cite = [],
		naam = '',
		bron = null,
		tekst
	}: {
		/** What Bewaar keeps; without it no Bewaar. */
		bewaar?: MapItem | null;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
		/** The forms of Citeer; without them no Citeer (a stemming). */
		cite?: CiteItem[];
		/** What is cited, for the menu's label. */
		naam?: string;
		/** The official text, last in Citeer: wetten.overheid.nl, uitspraken.rechtspraak.nl. */
		bron?: { label: string; href: string } | null;
		/** The text Kopieer tekst copies, asked when chosen. */
		tekst?: () => string;
	} = $props();

	const copier = createCopier();
</script>

<span class="kop-acties">
	{#if bewaar}<Bewaar item={bewaar} {wat} metMap knop />{/if}
	{#if cite.length > 0}
		<CiteMenu items={cite} name={naam} align="right" caret>
			{#snippet onder(dicht)}
				{#if tekst}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item"
						onclick={() => {
							copier.copy(tekst(), 'tekst').catch((e) => report('Kopiëren', e));
							dicht();
						}}>{copier.label('tekst', 'Kopieer tekst')}</button
					>
				{/if}
				{#if bron}
					<a role="menuitem" class="tekstmenu__item" href={bron.href} target="_blank" rel="noopener"
						>{bron.label} ↗</a
					>
				{/if}
			{/snippet}
		</CiteMenu>
	{/if}
	<span class="sr-only" aria-live="polite">{copier.announcement}</span>
</span>

<style>
	.kop-acties {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-left: auto;
	}
	/* On a phone the pair starts at the text's edge, on a line of its own. */
	@media (max-width: 768px) {
		.kop-acties {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
