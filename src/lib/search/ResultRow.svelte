<script lang="ts">
	// One hit on the page of results: a link to its bron, its title, a line of the text with the
	// words searched for marked, its context at the right. A hit found by a begrip of the curated
	// list says so ("via begrip wanprestatie"). The list's row is SearchOption; this is the page's.
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import { hitName, presentHit } from './present';
	import { conceptOf } from './results';

	let {
		hit,
		q,
		neighbours
	}: {
		hit: Schema<'SearchResultItem'>;
		q: string;
		/** The hits listed with it, which its context tells it from. */
		neighbours: readonly Schema<'SearchResultItem'>[];
	} = $props();

	const shown = $derived(presentHit(hit, q, neighbours));
	const concept = $derived(conceptOf(hit));
</script>

<a class="rij" href={bronHref(hitName(hit), { keepNetwerk: false })}>
	<span class="hoofd">
		<span class="titel">{shown.title}</span>
		{#if shown.snippet}
			<span class="snippet"
				>{#each shown.snippet as part, n (n)}{#if part.mark}<mark>{part.text}</mark
						>{:else}{part.text}{/if}{/each}</span
			>
		{/if}
		{#if concept}<span class="begrip">via begrip {concept}</span>{/if}
	</span>
	{#if shown.chamber || shown.context || shown.expired}
		<span class="context"
			>{#if shown.chamber}<abbr title={CHAMBER_NAME[shown.chamber]}>{shown.chamber}</abbr
				>{/if}{shown.chamber && shown.context
				? ` ${shown.context}`
				: shown.context}{#if shown.expired}{shown.context ? ', ' : ''}<span
					class="vervallen"
					title={shown.expired}>vervallen</span
				>{/if}</span
		>
	{/if}
</a>

<style>
	.rij {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-4);
		padding: var(--s-2) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: 1.35;
		color: var(--ink);
		text-decoration: none;
		border-bottom: none;
	}
	.rij:hover {
		background: var(--paper-2);
	}
	.hoofd {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.titel {
		overflow-wrap: anywhere;
	}
	.snippet,
	.begrip {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.snippet {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.snippet mark {
		background: none;
		color: var(--ink-2);
		font-weight: 600;
	}
	.begrip {
		font-style: italic;
	}
	.context {
		flex: 0 1 auto;
		max-width: 40%;
		font-size: var(--t-micro);
		color: var(--ink-3);
		overflow-wrap: anywhere;
		text-align: right;
	}
	.context abbr {
		text-decoration: none;
	}
	.vervallen {
		color: var(--uitkomst-nee);
	}

	@media (max-width: 640px) {
		.rij {
			flex-direction: column;
			align-items: stretch;
			gap: 0;
		}
		.context {
			max-width: none;
			text-align: left;
		}
	}
</style>
