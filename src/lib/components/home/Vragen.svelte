<script lang="ts">
	// "Wat kun je ermee?": three questions Concordans answers, each a tile with a way in, in a
	// narrow column, and beside them the living example of the day (a snippet, the law network)
	// as a larger sheet; on a phone the tiles first, then the sheet. The server's HTML of `/`
	// writes the same section (start.json, home.py); app.html sets it alike.
	import type { Snippet } from 'svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { START } from './start';

	let { voorbeeld }: { voorbeeld?: Snippet } = $props();
	const { questions } = START;
</script>

<section class="vragen" aria-labelledby="vragen-kop">
	<h2 id="vragen-kop">{questions.heading}</h2>
	<div class="vragen__lijst">
		{@render voorbeeld?.()}
		{#each questions.items as item (item.title)}
			<section class="vraag">
				<h3>{item.title}</h3>
				<p>{item.text}</p>
				<p><TekstLink href={item.href}>{item.linkLabel}</TekstLink></p>
			</section>
		{/each}
	</div>
</section>

<style>
	h2 {
		margin: 0 0 var(--s-3);
		font-size: var(--t-h2);
		font-weight: 600;
		line-height: var(--lh-snug);
	}
	.vragen__lijst {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-4);
	}
	.vraag {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-4);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	h3 {
		margin: 0;
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	p {
		margin: 0;
	}
	/* The way in at the foot of the tile, whatever the text above it. */
	p:last-child {
		margin-top: auto;
		padding-top: var(--s-1);
	}
	/* With the example: the tiles a column at the left, the sheet at the right (app.html has it
	   for the server's page). */
	.vragen__lijst:has(:global(.voorbeeld)) {
		grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
	}
	.vragen__lijst > :global(.voorbeeld) {
		grid-column: 2;
		grid-row: 1 / span 3;
	}
	@media (max-width: 768px) {
		.vragen__lijst,
		.vragen__lijst:has(:global(.voorbeeld)) {
			grid-template-columns: minmax(0, 1fr);
		}
		.vragen__lijst > :global(.voorbeeld) {
			grid-column: 1;
			grid-row: auto;
			order: 1;
		}
	}
</style>
