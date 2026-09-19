<script lang="ts">
  // Kind-keyed reader dispatcher. Each node kind gets its own reader
  // component; Article and Judgment own their text rendering, the
  // parlementair kinds (Tkstuk/Dossier/Commissie/Lid/Fractie/Stemming) are
  // standalone readers built on lib/api/parliamentary-client.
  import type { GraphNode } from '$lib/graph/types';
  import ArticleReader from './readers/ArticleReader.svelte';
  import JudgmentReader from './readers/JudgmentReader.svelte';
  import TkstukReader from './readers/TkstukReader.svelte';
  import DossierReader from './readers/DossierReader.svelte';
  import CommissieReader from './readers/CommissieReader.svelte';
  import LidReader from './readers/LidReader.svelte';
  import FractieReader from './readers/FractieReader.svelte';
  import StemmingReader from './readers/StemmingReader.svelte';
  import ActivityReader from './readers/ActivityReader.svelte';
  import InstrumentReader from './readers/InstrumentReader.svelte';
  import FallbackReader from './readers/FallbackReader.svelte';

  let { selection, onNavigate, onPrev, onNext }: {
    selection: GraphNode | null;
    onNavigate?: (collection: string, key: string) => void;
    onPrev?: () => void;
    onNext?: () => void;
  } = $props();
</script>

{#if !selection}
  <ArticleReader {selection} {onNavigate} />
{:else if selection.kind === 'article'}
  <ArticleReader {selection} {onNavigate} {onPrev} {onNext} />
{:else if selection.kind === 'judgment'}
  <JudgmentReader {selection} {onNavigate} />
{:else if selection.kind === 'tkstuk'}
  <TkstukReader node={selection} />
{:else if selection.kind === 'dossier'}
  <DossierReader node={selection} />
{:else if selection.kind === 'commissie'}
  <CommissieReader node={selection} />
{:else if selection.kind === 'lid'}
  <LidReader node={selection} {onNavigate} />
{:else if selection.kind === 'fractie'}
  <FractieReader node={selection} {onNavigate} />
{:else if selection.kind === 'activity'}
  <ActivityReader node={selection} {onNavigate} />
{:else if selection.kind === 'instrument'}
  <InstrumentReader node={selection} {onNavigate} />
{:else if selection.collection === 'stemmingen'}
  <StemmingReader node={selection} />
{:else}
  <FallbackReader node={selection} />
{/if}
