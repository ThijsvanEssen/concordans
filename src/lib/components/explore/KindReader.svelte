<script lang="ts">
	// Reader dispatcher. Article and judgment readers own their text; the
	// parliamentary readers load their own data. A decision is a `GraphNodeKind`
	// of 'activity' like a case or a commitment, so those are told apart by collection.
	import type { GraphNode } from '$lib/graph/types';
	import ArticleReader from './readers/ArticleReader.svelte';
	import JudgmentReader from './readers/JudgmentReader.svelte';
	import DocumentReader from './readers/DocumentReader.svelte';
	import DossierReader from './readers/DossierReader.svelte';
	import CommitteeReader from './readers/CommitteeReader.svelte';
	import MemberReader from './readers/MemberReader.svelte';
	import FactionReader from './readers/FactionReader.svelte';
	import DecisionReader from './readers/DecisionReader.svelte';
	import ActivityReader from './readers/ActivityReader.svelte';
	import InstrumentReader from './readers/InstrumentReader.svelte';
	import FallbackReader from './readers/FallbackReader.svelte';

	let {
		selection,
		onNavigate,
		onPrev,
		onNext
	}: {
		selection: GraphNode | null;
		onNavigate?: (collection: string, key: string) => void;
		onPrev?: () => void;
		onNext?: () => void;
	} = $props();
</script>

{#if !selection}
	<ArticleReader {selection} {onNavigate} />
{:else if selection.collection === 'decisions'}
	<DecisionReader node={selection} />
{:else if selection.kind === 'article'}
	<ArticleReader {selection} {onNavigate} {onPrev} {onNext} />
{:else if selection.kind === 'judgment'}
	<JudgmentReader {selection} {onNavigate} />
{:else if selection.kind === 'document'}
	<DocumentReader node={selection} />
{:else if selection.kind === 'dossier'}
	<DossierReader node={selection} />
{:else if selection.kind === 'committee'}
	<CommitteeReader node={selection} />
{:else if selection.kind === 'member'}
	<MemberReader node={selection} {onNavigate} />
{:else if selection.kind === 'faction'}
	<FactionReader node={selection} {onNavigate} />
{:else if selection.collection === 'activities'}
	<ActivityReader node={selection} {onNavigate} />
{:else if selection.kind === 'instrument'}
	<InstrumentReader node={selection} {onNavigate} />
{:else}
	<FallbackReader node={selection} />
{/if}
