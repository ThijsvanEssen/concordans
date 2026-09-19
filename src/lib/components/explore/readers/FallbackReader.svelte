<script lang="ts">
  // Last-resort reader for kinds the dispatcher doesn't recognise.
  // Surfaces enough metadata that the user can still see what they clicked.
  import type { GraphNode } from '$lib/graph/types';

  let { node }: { node: GraphNode } = $props();

  const propEntries = $derived(
    Object.entries((node.raw?.props ?? {}) as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .slice(0, 12),
  );
</script>

<div class="fallback">
  <header class="fallback__head">
    <span class="fallback__kind">{node.collection}</span>
    <h2 class="fallback__title">{node.label}</h2>
    <p class="fallback__notice">Geen leesweergave beschikbaar voor dit type bron.</p>
  </header>

  {#if propEntries.length > 0}
    <dl class="fallback__props">
      {#each propEntries as [k, v], i (i)}
        <dt>{k}</dt>
        <dd>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
      {/each}
    </dl>
  {:else}
    <p class="fallback__empty">Geen aanvullende metadata beschikbaar.</p>
  {/if}
</div>

<style>
  .fallback {
    padding: var(--s-4);
    font-family: var(--font-serif);
    color: var(--ink-2);
  }
  .fallback__head { margin-bottom: var(--s-3); }
  .fallback__kind {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ink-4);
  }
  .fallback__title { font-size: 18px; margin: 4px 0 6px; font-weight: 400; }
  .fallback__notice {
    font-family: var(--font-serif); font-style: italic; font-size: 13px;
    color: var(--ink-4); margin: 0;
  }
  .fallback__props {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 14px;
    font-size: 13px;
    margin: 0;
  }
  .fallback__props dt { font-family: var(--font-sans); font-size: 11px; color: var(--ink-4); text-transform: uppercase; letter-spacing: 0.04em; }
  .fallback__props dd { margin: 0; word-break: break-word; }
  .fallback__empty { color: var(--ink-4); font-style: italic; font-size: 13px; }
</style>
