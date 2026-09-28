<script lang="ts">
	// Reader dispatcher, by collection. Article and judgment readers own their text; the
	// parliamentary readers load their own data. A toezegging and a zaak have no text of
	// their own and get the plain reader.
	import type { GraphNode } from '$lib/graph/types';
	import type { VerbondenFilter } from '$lib/verbonden/filter';
	import type { Row } from '$lib/verbonden/rows';
	import ArticleReader from './readers/ArticleReader.svelte';
	import JudgmentReader from './readers/JudgmentReader.svelte';
	import DocumentReader from './readers/DocumentReader.svelte';
	import DossierReader from './readers/DossierReader.svelte';
	import CommitteeReader from './readers/CommitteeReader.svelte';
	import MemberReader from './readers/MemberReader.svelte';
	import FactionReader from './readers/FactionReader.svelte';
	import DecisionReader from './readers/DecisionReader.svelte';
	import CabinetReader from './readers/CabinetReader.svelte';
	import ActivityReader from './readers/ActivityReader.svelte';
	import InstrumentReader from './readers/InstrumentReader.svelte';
	import FallbackReader from './readers/FallbackReader.svelte';

	let {
		selection,
		prevHref,
		nextHref,
		place = [],
		lidCounts = new Map(),
		billCount = 0,
		filter,
		proposedRow = null,
		onCloseProposed
	}: {
		selection: GraphNode;
		/** The article before and after the selected one, in Lezen. */
		prevHref?: string;
		nextHref?: string;
		/** The place of an article in its law: book, title. */
		place?: string[];
		/** Verbindingen per lid of the article, under the bronfilter. */
		lidCounts?: Map<string, number>;
		billCount?: number;
		filter?: VerbondenFilter;
		/** A wetsvoorstel whose proposed text is shown next to the current one. */
		proposedRow?: Row | null;
		onCloseProposed?: () => void;
	} = $props();
</script>

{#if selection.collection === 'articles'}
	<ArticleReader
		{selection}
		{prevHref}
		{nextHref}
		{place}
		{lidCounts}
		{billCount}
		{filter}
		{proposedRow}
		{onCloseProposed}
	/>
{:else if selection.collection === 'judgments'}
	<JudgmentReader {selection} />
{:else if selection.collection === 'documents'}
	<DocumentReader node={selection} />
{:else if selection.collection === 'dossiers'}
	<DossierReader node={selection} />
{:else if selection.collection === 'committees'}
	<CommitteeReader node={selection} />
{:else if selection.collection === 'members'}
	<MemberReader node={selection} />
{:else if selection.collection === 'factions'}
	<FactionReader node={selection} />
{:else if selection.collection === 'decisions'}
	<DecisionReader node={selection} />
{:else if selection.collection === 'activities'}
	<ActivityReader node={selection} />
{:else if selection.collection === 'cabinets'}
	<CabinetReader node={selection} />
{:else if selection.collection === 'instruments'}
	<InstrumentReader node={selection} />
{:else}
	<FallbackReader node={selection} />
{/if}
