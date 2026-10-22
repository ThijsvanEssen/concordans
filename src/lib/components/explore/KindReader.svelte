<script lang="ts">
	import type { Division } from '$lib/text/division';
	// Reader dispatcher, by collection. Article and judgment readers own their text; the
	// parliamentary readers load their own data. A toezegging and a zaak have no text of
	// their own and get the plain reader.
	import type { GraphNode } from '$lib/graph/types';
	import type { VerbondenFilter } from '$lib/verbonden/filter';
	import type { Row } from '$lib/verbonden/rows';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { articleReader, readerOf } from './readers';
	import { setContext } from 'svelte';
	import { BEHOORT_KEY } from '$lib/bron/behoort';
	import type { Step } from '$lib/bron/step.svelte';

	let {
		selection,
		prev,
		next,
		place = [],
		lidCounts = new Map(),
		lidTellend = false,
		billCount = 0,
		filter,
		proposedRow = null,
		onCloseProposed
	}: {
		selection: GraphNode;
		/** The article before and after the selected one, in Lezen. */
		prev?: Step;
		next?: Step;
		/** The layers of an article's place in its law: hoofdstuk, afdeling. */
		place?: Division[];
		/** Verbindingen per lid of the article, under the bronfilter. */
		lidCounts?: Map<string, number>;
		lidTellend?: boolean;
		billCount?: number;
		filter?: VerbondenFilter;
		/** A wetsvoorstel whose proposed text is shown next to the current one. */
		proposedRow?: Row | null;
		onCloseProposed?: () => void;
	} = $props();

	// Every reader's frame shows where this bron stands, from the same place (BehoortBij).
	setContext(BEHOORT_KEY, () => selection);

	// Each reader is a chunk of its own (readers.ts), the article's apart: it takes the place in
	// its law too.
	const isArticle = $derived(selection.collection === 'articles');
	const other = $derived(isArticle ? null : readerOf(selection.collection));
	const chosen = $derived(other ?? articleReader);
	$effect(() => chosen.load());
</script>

{#if isArticle && articleReader.component}
	{@const ArticleReader = articleReader.component}
	<ArticleReader
		node={selection}
		{prev}
		{next}
		{place}
		{lidCounts}
		{lidTellend}
		{billCount}
		{filter}
		{proposedRow}
		{onCloseProposed}
	/>
{:else if other?.component}
	{@const Reader = other.component}
	<Reader node={selection} />
{:else if chosen.error}
	<LoadState
		state={{ status: 'error', error: chosen.error }}
		what="De bron"
		retry={chosen.retry}
		form="block"
	/>
{/if}
