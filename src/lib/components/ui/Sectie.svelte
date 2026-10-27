<script lang="ts">
	// A section of a reader under one heading: a hairline, the title in the serif and its
	// count. The one form for every section (Loopbaan, Toezeggingen, Dossiers,
	// Stemgeschiedenis) and, a level lower, for the groups in it (the years of a timeline, a
	// law in the changed articles). Open until the reader closes it (Thijs, 10 Oct), kept per
	// kind of section; closed, its content is not drawn, so what it would load is not asked.
	// The DS: Sectie en Tijdlijn. docs/typografie.md.
	import { formatCount } from '$lib/text/getal';
	import type { Snippet } from 'svelte';
	import FoldButton from './FoldButton.svelte';
	import { isOpen as staatOpen } from './dicht.svelte';

	let {
		title,
		aantal,
		id,
		naast,
		mark,
		niveau = 2,
		inklapbaar = true,
		sleutel,
		children
	}: {
		title: string;
		/** The count beside the heading; a string as given (`25+`, `2019–2022`). */
		aantal?: number | string | null;
		id?: string;
		/** Beside the title, at the right: a link or a control. Only while it stands open. */
		naast?: Snippet;
		/** After the title, in the heading: a mark such as NewMark, or the button it opens. */
		mark?: Snippet;
		/** The level of the heading. 2: a section of a reader or a page, under a hairline.
		 *  3: a group in a section (a year), 4: a group in that (a law), both without a line. */
		niveau?: 2 | 3 | 4;
		/** Whether the heading opens and closes it; off for a page of sections (Bladeren). */
		inklapbaar?: boolean;
		/** The kind of section whose state it shares; its title where none is given. A group
		 *  inside a section keeps its own: `subKey(name)` (dicht.svelte.ts). A section that
		 *  something else opens has its key in FOLD. */
		sleutel?: string;
		children: Snippet;
	} = $props();

	const foldKey = $derived(sleutel ?? title);
	/** Drawn from the first paint as it was left: a closed section never draws its content. */
	const isOpen = $derived(!inklapbaar || staatOpen(foldKey, true));
	const uid = $props.id();
</script>

{#snippet kop()}
	{title}{#if aantal != null}<span class="aantal"
			>{typeof aantal === 'number' ? formatCount(aantal) : aantal}</span
		>{/if}
{/snippet}

<section
	class="sectie niveau-{niveau}"
	class:section-block={niveau === 2}
	class:is-dicht={!isOpen}
	{id}
>
	<svelte:element this={`h${niveau}`} class="kop">
		{#if inklapbaar}
			<FoldButton sleutel={foldKey} open={isOpen} controls="{uid}-inhoud"
				>{@render kop()}</FoldButton
			>
		{:else}
			{@render kop()}
		{/if}{#if mark}{@render mark()}{/if}{#if naast && isOpen}<span class="naast"
				>{@render naast()}</span
			>{/if}
	</svelte:element>
	{#if isOpen}<div class="inhoud" id="{uid}-inhoud">{@render children()}</div>{/if}
</section>

<style>
	/* Air under the title and between sections, so each reads as a block of its own, open or
	   closed (Thijs, 20 Oct: the seats of TK and EK stood too close). The step between two
	   sections is --s-5 in all; a parent that spaces its column by a gap names it
	   (--lezer-stap), and the margin makes up the rest. */
	.sectie {
		/* A jump to a section lands under the sticky bar. */
		scroll-margin-top: calc(var(--balk-h) + var(--s-4));
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}
	.niveau-2 {
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}
	/* A group inside a section: no line, the next one follows at the step of its parent. */
	.niveau-3,
	.niveau-4 {
		gap: var(--s-2);
	}
	:global(.sectie.niveau-4 + .sectie.niveau-4) {
		margin-top: var(--s-3);
	}
	/* Global: the section before is another instance, which this one cannot see. */
	:global(.section-block + .section-block) {
		margin-top: max(0px, calc(var(--s-5) - var(--lezer-stap, 0px)));
	}
	.kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		/* The heading is a --tik-h high (a finger's height on a phone): the words stand in the
		   middle of it. */
		--kop-h: var(--tik-h);
		--kop-lh: 28px;
		padding-block: max(0px, calc((var(--kop-h) - var(--kop-lh)) / 2));
		margin: 0;
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	.niveau-3 .kop {
		--kop-lh: 20px;
		font-size: var(--t-meta);
		line-height: var(--kop-lh);
	}
	.niveau-4 .kop {
		--kop-lh: 22px;
		font-size: var(--t-body-2);
		line-height: var(--kop-lh);
	}
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	/* A phone: the heading is a finger high, and a step of --s-5 under a section's. Under a
	   folding heading another one may follow at once (a group of a timeline): the two
	   targets of a finger (.raakvlak, up to 12 px past each) meet instead of overlapping. */
	@media (pointer: coarse), (max-width: 768px) {
		.kop {
			--kop-h: var(--veld-h-raak);
		}
		.niveau-2 {
			gap: var(--s-5);
		}
	}
	.is-dicht {
		padding-bottom: var(--s-1);
	}
	.aantal {
		line-height: 1;
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
