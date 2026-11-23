<script lang="ts">
	// The concept block a query is a term of ("bezwaar maken"), as the best hit on the page of
	// results: framed and labelled as Concordans' own list, with the source that ties the term
	// to it. The block is one step on, on the page of the begrip.
	import type { Schema } from '$lib/api/types';
	import { BEGRIP_KOP, BEGRIP_METHODE, BEGRIP_VIA, begripPath } from '$lib/vocabulary';

	let { block }: { block: Schema<'BestBlockDTO'> } = $props();
</script>

<section class="kader" aria-label={BEGRIP_KOP}>
	<p class="kop"><a href={BEGRIP_METHODE}>{BEGRIP_KOP}</a></p>
	<a class="naam" href={begripPath(block.key)}>{block.name}</a>
	<p class="via">{BEGRIP_VIA} {block.concept}</p>
	{#if block.concept_why}<p class="bron">
			<span class="etiket">Bron</span>
			{block.concept_why}
		</p>{/if}
</section>

<style>
	.kader {
		margin-bottom: var(--s-5);
		padding: var(--s-3) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
	}
	p {
		margin: 0;
	}
	.kop {
		font-size: var(--t-micro);
	}
	.kop a {
		color: var(--ink-3);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.naam {
		display: inline-block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.naam:hover,
	.naam:focus-visible {
		text-decoration-color: currentColor;
	}
	.via,
	.bron {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.etiket {
		color: var(--ink-3);
	}
</style>
