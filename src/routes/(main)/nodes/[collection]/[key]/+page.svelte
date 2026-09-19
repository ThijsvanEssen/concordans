<script lang="ts">
  import type { ComponentProps } from 'svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { detectNodeKind } from '$lib/graph/types';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const node = $derived(data.nodeGraph.node);
  const neighbors = $derived(data.nodeGraph.neighbors);
  const kind = $derived(detectNodeKind(node));

  const exploreHref = $derived(
    `/explore?focus=${encodeURIComponent(`${node.collection}/${node.key}`)}`
  );

  const kindLabel: Record<string, string> = {
    article: 'Artikel',
    judgment: 'Uitspraak',
    instrument: 'Instrument',
    tkstuk: 'TK-stuk',
    other: 'Overig'
  };

  const collectionLabel: Record<string, string> = {
    instrument_articles: 'Wetgeving',
    judgments: 'Jurisprudentie',
    instruments: 'Instrument',
    tkstukken: 'Kamerstuk',
  };

  type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>;
  const kindVariant: Record<string, BadgeVariant> = {
    article: 'node-article',
    judgment: 'node-judgment',
    instrument: 'node-instrument',
    tkstuk: 'node-tkstuk',
    other: 'default'
  };
</script>

<svelte:head>
  <title>{node.display_name ?? node.key} — Concordans</title>
</svelte:head>

<div class="node-shell">
  <header class="node-header">
    <a href="/" class="back-link">← Terug</a>
    <div class="node-header__badges">
      <Badge variant={kindVariant[kind]}>{kindLabel[kind]}</Badge>
      <span class="node-collection">{collectionLabel[node.collection] ?? node.collection}</span>
    </div>
    <h1 class="node-title">{node.display_name ?? node.key}</h1>
    <a href={exploreHref} class="explore-link">Verken in grafiek →</a>
  </header>

  <div class="node-relations">
    {#if (neighbors.strict ?? []).length > 0}
      <section class="relation-section">
        <h2 class="relation-section__title">Strikte relaties</h2>
        <ul class="relation-list">
          {#each neighbors.strict ?? [] as n, i (i)}
            <li class="relation-item">
              <span class="relation-direction">{n.direction === 'outbound' ? '→' : '←'}</span>
              <span class="relation-type">{n.relation}</span>
              <span class="relation-label">{n.display_name ?? n.key}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if (neighbors.semantic ?? []).length > 0}
      <section class="relation-section">
        <h2 class="relation-section__title">Semantische relaties</h2>
        <ul class="relation-list">
          {#each neighbors.semantic ?? [] as n, i (i)}
            <li class="relation-item">
              <span class="relation-direction">{n.direction === 'outbound' ? '→' : '←'}</span>
              <span class="relation-label">{n.display_name ?? n.key}</span>
              {#if n.confidence != null}
                <span class="relation-confidence">{(n.confidence * 100).toFixed(0)}%</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    {#if (neighbors.strict ?? []).length === 0 && (neighbors.semantic ?? []).length === 0}
      <p class="no-relations">Geen verbindingen gevonden voor deze bron.</p>
    {/if}
  </div>
</div>

<style>
  .node-shell {
    max-width: 1040px;
    margin: 0 auto;
    padding: var(--space-3) var(--space-3) var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .node-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border);
  }

  .back-link {
    font-size: var(--text-sm);
    color: var(--muted);
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--accent);
  }

  .node-header__badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .node-collection {
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .node-title {
    font-family: var(--font-serif);
    font-size: clamp(var(--text-2xl), 3vw, var(--text-4xl));
    font-weight: 500;
    margin: 0;
    line-height: var(--leading-tight);
  }

  .explore-link {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--accent);
    text-decoration: none;
    align-self: flex-start;
  }

  .explore-link:hover {
    text-decoration: underline;
  }

  .node-relations {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .relation-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .relation-section__title {
    font-size: var(--text-base);
    font-weight: 600;
    margin: 0;
  }

  .relation-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .relation-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: var(--text-sm);
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--border);
  }

  .relation-direction {
    color: var(--muted);
    font-weight: 700;
    flex-shrink: 0;
  }

  .relation-type {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--accent);
    background: var(--accent-soft);
    padding: 0.1em 0.4em;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }

  .relation-label {
    flex: 1;
    color: var(--ink-secondary);
    font-family: var(--font-serif);
  }

  .relation-confidence {
    font-size: var(--text-xs);
    color: var(--muted);
    flex-shrink: 0;
  }

  .no-relations {
    color: var(--muted);
    font-style: italic;
    font-size: var(--text-sm);
    margin: 0;
  }

</style>
