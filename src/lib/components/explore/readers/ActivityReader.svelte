<script lang="ts">
	// Reader for an activity: a committee debate, plenary debate or procedural
	// meeting. There is no endpoint for one activity; the node's own props are shown.
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	// The schema leaves node props untyped.
	const attrs = $derived(
		(node.raw?.props ?? {}) as {
			kind?: string;
			date?: string;
			agenda_title?: string;
			tk_url?: string;
		}
	);
</script>

<ReaderFrame>
	<div class="r-activity">
		<header class="head">
			<span class="kicker">
				<KindGlyph collection="activities" />
				{attrs.kind ?? bronLabel('activities')}
				{#if attrs.date}<span class="komma">,</span>{formatLongDate(attrs.date)}{/if}
			</span>
			<h2 class="title">{attrs.agenda_title || node.label}</h2>
		</header>

		{#if attrs.tk_url}
			<footer class="foot">
				<a href={attrs.tk_url} target="_blank" rel="noopener noreferrer" class="full-link">
					Open op tweedekamer.nl →
				</a>
			</footer>
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-activity {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		color: var(--ink-2);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		display: flex;
		gap: 5px;
		align-items: baseline;
	}
	/* A comma against the word before it: the kicker's gap only after it. */
	.komma {
		margin-left: calc(-1 * 5px);
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}

	.foot {
		display: flex;
	}
	.full-link {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.full-link:hover {
		color: var(--accent);
	}
</style>
