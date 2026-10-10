<script lang="ts">
	// A section of a reader under one heading: a rule in ink, the title in the serif with
	// the glyph of what it lists, and its count. The one form for every section (Loopbaan,
	// Toezeggingen, Dossiers, Stemgeschiedenis). The heading opens and closes it (Thijs, 10
	// Oct), remembered per kind of section; closed, its content is not drawn, so what it
	// would load is not asked. docs/typografie.md.
	import { formatCount } from '$lib/text/getal';
	import type { Snippet } from 'svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Caret from './Caret.svelte';
	import { isOpen as staatOpen, zetOpen } from './dicht.svelte';
	import type { Collection } from '$lib/vocabulary';

	let {
		titel,
		soort,
		aantal,
		id,
		naast,
		niveau = 3,
		inklapbaar = true,
		sleutel,
		standaardOpen = false,
		children
	}: {
		titel: string;
		/** The glyph before the title: what the section lists. */
		soort?: Collection;
		/** The count beside the heading; a string as given (`25+`). */
		aantal?: number | string | null;
		id?: string;
		/** Beside the title, at the right: a link or a control. */
		naast?: Snippet;
		/** The level of the heading: 3 in a reader under its title, 2 on a page of sections. */
		niveau?: 2 | 3;
		/** Whether the heading opens and closes it; off for a page of sections (Bladeren). */
		inklapbaar?: boolean;
		/** The kind of section whose state it shares; its title where none is given. */
		sleutel?: string;
		/** Open until closed: a page of groups (Gevolgd), not a reader's section, which starts
		 *  closed. */
		standaardOpen?: boolean;
		children: Snippet;
	} = $props();

	const soortSleutel = $derived(sleutel ?? titel);
	/** Drawn from the first paint as it was left: a closed section never draws its content. */
	const isOpen = $derived(!inklapbaar || staatOpen(soortSleutel, standaardOpen));
	const uid = $props.id();
</script>

<section class="sectie" class:is-dicht={!isOpen} {id}>
	<svelte:element this={`h${niveau}`} class="kop">
		{#if inklapbaar}
			<button
				type="button"
				class="kop-knop"
				aria-expanded={isOpen}
				aria-controls="{uid}-inhoud"
				onclick={() => zetOpen(soortSleutel, !isOpen)}
				>{#if soort}<KindGlyph collection={soort} size={14} />{/if}{titel}{#if aantal != null}<span
						class="aantal">{typeof aantal === 'number' ? formatCount(aantal) : aantal}</span
					>{/if}<Caret open={isOpen} side /></button
			>
		{:else}
			{#if soort}<KindGlyph collection={soort} size={14} />{/if}{titel}{#if aantal != null}<span
					class="aantal">{typeof aantal === 'number' ? formatCount(aantal) : aantal}</span
				>{/if}
		{/if}
		{#if naast && isOpen}<span class="naast">{@render naast()}</span>{/if}
	</svelte:element>
	{#if isOpen}<div class="inhoud" id="{uid}-inhoud">{@render children()}</div>{/if}
</section>

<style>
	.sectie {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding-top: var(--s-3);
		border-top: 2px solid var(--ink);
	}
	.kop {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 800;
		color: var(--ink);
	}
	/* The heading itself is the button: the heading's letter, no frame, the caret quiet. */
	.kop-knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.kop-knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.is-dicht {
		padding-bottom: var(--s-1);
	}
	.aantal {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	.naast {
		margin-left: auto;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 400;
	}
</style>
