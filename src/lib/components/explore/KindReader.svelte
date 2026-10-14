<script lang="ts">
	import type { Division } from '$lib/text/division';
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
	import CommitmentReader from './readers/CommitmentReader.svelte';
	import ActivityReader from './readers/ActivityReader.svelte';
	import InstrumentReader from './readers/InstrumentReader.svelte';
	import AnnexReader from './readers/AnnexReader.svelte';
	import FallbackReader from './readers/FallbackReader.svelte';
	import { setContext, type Component } from 'svelte';
	import type { Collection } from '$lib/vocabulary';
	import { BEHOORT_KEY } from '$lib/bron/behoort';

	let {
		selection,
		prevHref,
		nextHref,
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
		prevHref?: string;
		nextHref?: string;
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

	/** The reader of each collection but the article's, which takes the place in its law too. */
	const READERS: Partial<Record<Collection, Component<{ node: GraphNode }>>> = {
		judgments: JudgmentReader,
		documents: DocumentReader,
		dossiers: DossierReader,
		committees: CommitteeReader,
		members: MemberReader,
		factions: FactionReader,
		decisions: DecisionReader,
		activities: ActivityReader,
		cabinets: CabinetReader,
		commitments: CommitmentReader,
		instruments: InstrumentReader,
		annexes: AnnexReader
	};
	const Reader = $derived(READERS[selection.collection] ?? FallbackReader);
</script>

{#if selection.collection === 'articles'}
	<ArticleReader
		node={selection}
		{prevHref}
		{nextHref}
		{place}
		{lidCounts}
		{lidTellend}
		{billCount}
		{filter}
		{proposedRow}
		{onCloseProposed}
	/>
{:else}
	<Reader node={selection} />
{/if}
