<script lang="ts">
	import { opsomming } from '$lib/text/opsomming';
	import ReaderHead from './ReaderHead.svelte';
	// Reader for an activity: a committee debate, plenary debate or procedural
	// meeting. There is no endpoint for one activity; the node's own props are shown.
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate } from './_shared';
	import { activityLine } from '$lib/verbonden/rows';

	let { node }: { node: GraphNode } = $props();

	// The schema leaves node props untyped.
	const attrs = $derived(
		(node.raw?.props ?? {}) as {
			kind?: string;
			date?: string;
			status?: string;
			agenda_title?: string;
			tk_url?: string;
		}
	);
	const titel = $derived(attrs.agenda_title || node.label);
</script>

<ReaderFrame>
	<div class="r-activity">
		<ReaderHead
			collection="activities"
			title={titel}
			acties={{
				bewaar: {
					id: node.id,
					at: '',
					kort: titel,
					voluit: [attrs.kind, attrs.date ? formatLongDate(attrs.date) : null, titel]
						.filter(Boolean)
						.join(', '),
					groep: attrs.kind ?? bronLabel('activities')
				}
			}}
		>
			{#snippet soort()}
				<KindGlyph collection="activities" />
				<!-- One still to come says so, as its row in Verbonden does (#59). -->
				{opsomming([
					activityLine({
						kind: attrs.kind ?? bronLabel('activities'),
						status: attrs.status,
						date: attrs.date
					}),
					attrs.date ? formatLongDate(attrs.date) : null
				])}
			{/snippet}
		</ReaderHead>

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
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	/* A comma against the word before it: the kicker's gap only after it. */

	.foot {
		display: flex;
	}
	.full-link {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
	}
	.full-link:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>
