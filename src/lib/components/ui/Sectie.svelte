<script lang="ts">
	// A section of a reader under one heading: a rule in ink, the title in the serif with
	// the glyph of what it lists, and its count. The one form for every section (Loopbaan,
	// Toezeggingen, Dossiers, Stemgeschiedenis). The heading opens and closes it (Thijs, 10
	// Oct), remembered per kind of section; closed, its content is not drawn, so what it
	// would load is not asked. docs/typografie.md.
	import { formatCount } from '$lib/text/getal';
	import type { Snippet } from 'svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import FoldButton from './FoldButton.svelte';
	import { isOpen as staatOpen } from './dicht.svelte';
	import type { Collection } from '$lib/vocabulary';

	let {
		title,
		collection,
		aantal,
		id,
		naast,
		niveau = 3,
		inklapbaar = true,
		sleutel,
		standaardOpen = false,
		children
	}: {
		title: string;
		/** The glyph before the title: what the section lists. */
		collection?: Collection;
		/** The count beside the heading; a string as given (`25+`). */
		aantal?: number | string | null;
		id?: string;
		/** Beside the title, at the right: a link or a control. */
		naast?: Snippet;
		/** The level of the heading: 3 in a reader under its title, 2 on a page of sections. */
		niveau?: 2 | 3;
		/** Whether the heading opens and closes it; off for a page of sections (Bladeren). */
		inklapbaar?: boolean;
		/** The kind of section whose state it shares; its title where none is given. A section
		 *  that something else opens has its key in FOLD (dicht.svelte.ts). */
		sleutel?: string;
		/** Open until closed: a page of groups (Gevolgd), not a reader's section, which starts
		 *  closed. */
		standaardOpen?: boolean;
		children: Snippet;
	} = $props();

	const foldKey = $derived(sleutel ?? title);
	/** Drawn from the first paint as it was left: a closed section never draws its content. */
	const isOpen = $derived(!inklapbaar || staatOpen(foldKey, standaardOpen));
	const uid = $props.id();
</script>

{#snippet kop()}
	{#if collection}<KindGlyph {collection} size={14} />{/if}{title}{#if aantal != null}<span
			class="aantal">{typeof aantal === 'number' ? formatCount(aantal) : aantal}</span
		>{/if}
{/snippet}

<section class="sectie section-block" class:is-dicht={!isOpen} {id}>
	<svelte:element this={`h${niveau}`} class="kop">
		{#if inklapbaar}
			<FoldButton sleutel={foldKey} open={isOpen} controls="{uid}-inhoud"
				>{@render kop()}</FoldButton
			>
		{:else}
			{@render kop()}
		{/if}
		{#if naast && isOpen}<span class="naast">{@render naast()}</span>{/if}
	</svelte:element>
	{#if isOpen}<div class="inhoud" id="{uid}-inhoud">{@render children()}</div>{/if}
</section>

<style>
	/* Air under the title and between sections, so each reads as a block of its own, open or
	   closed (Thijs, 20 Oct: the seats of TK and EK stood too close). The step between two
	   sections is --s-5 in all; a parent that spaces its column by a gap names it
	   (--lezer-stap), and the margin makes up the rest. */
	.sectie {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding-top: var(--s-3);
		border-top: 2px solid var(--ink);
	}
	/* Global: the section before is another instance, which this one cannot see. */
	:global(.section-block + .section-block) {
		margin-top: max(0px, calc(var(--s-5) - var(--lezer-stap, 0px)));
	}
	.kop {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	/* Under a folding heading another one may follow at once (a group of a timeline): the two
	   targets of a finger (.raakvlak, up to 12 px past each) meet instead of overlapping. */
	@media (pointer: coarse), (max-width: 768px) {
		.sectie {
			gap: var(--s-5);
		}
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
