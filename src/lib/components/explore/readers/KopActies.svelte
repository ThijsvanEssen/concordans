<script lang="ts">
	// The two actions in a reader's head, framed, the same on every reader (Thijs, 10 Oct:
	// "misschien hebben ze een kader nodig"): Bewaar, the box that keeps at once with the
	// choice of map joined to it, and Citeer, the forms with Kopieer tekst and the official
	// text under its rule. A reader puts it at the right of its status line.
	import CiteMenu from '$lib/components/ui/CiteMenu.svelte';
	import { report } from '$lib/api/errors';
	import type { CiteItem } from '$lib/components/ui/cite-items';
	import Bewaar from '$lib/map/Bewaar.svelte';
	import type { MapItem } from '$lib/map/map';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import FollowDossier from '$lib/components/parliamentary/FollowDossier.svelte';
	import type { FollowedDossier } from '$lib/onderwerpen/onderwerpen';

	let {
		bewaar = null,
		wat = '',
		cite = [],
		naam = '',
		bron = null,
		tekst,
		follow = null
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
		/** What Volg follows under Gevolgd (a dossier); without it no Volg. */
		follow?: FollowedDossier | null;
	} = $props();

	const copier = createCopier();
</script>

<span class="kop-acties">
	{#if follow}<FollowDossier dossier={follow} />{/if}
	{#if bewaar}<Bewaar item={bewaar} {wat} />{/if}
	{#if cite.length > 0}
		<CiteMenu items={cite} name={naam} align="right" caret>
			{#snippet onder(close)}
				{#if tekst}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item"
						onclick={() => {
							copier.copy(tekst(), 'tekst').catch((e) => report('Kopiëren', e));
							close();
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
	/* A finger's 44 px of Bewaar in … and of Naar … on the line below do not overlap. */
	@media (pointer: coarse) {
		.kop-acties {
			row-gap: var(--s-5);
		}
	}
	/* On a phone the pair starts at the text's edge, on a line of its own. */
	@media (max-width: 768px) {
		.kop-acties {
			margin-left: 0;
			flex-basis: 100%;
		}
	}
</style>
