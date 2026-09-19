<script lang="ts">
  // Lezen-nav for dossier kind: chronological list of publications in the
  // dossier (MvT, Verslag, Nota, Amendementen, Stemmingen). Mirrors the
  // article-TOC role for a dossier.
  import type { GraphNode } from '$lib/graph/types';
  import { fetchDossierDocuments } from '$lib/api/parliamentary-client';
  import type { DossierDocumentDTO } from '$lib/api/parliamentary';
  import { formatDate } from '../_shared';

  let { node, onNavigate }: {
    node: GraphNode;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  let items = $state<DossierDocumentDTO[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let token = 0;

  $effect(() => {
    const t = ++token;
    loading = true;
    error = null;
    fetchDossierDocuments(node.key)
      .then((r) => {
        if (t !== token) return;
        items = [...r.items].sort((a, b) =>
          (b.datum ?? '').localeCompare(a.datum ?? ''),
        );
      })
      .catch(() => { if (t === token) error = 'Documenten kunnen niet geladen worden.'; })
      .finally(() => { if (t === token) loading = false; });
  });
</script>

<header class="nav-head">
  <span class="nav-kind">DOSSIER</span>
  <h3 class="nav-title">{node.label}</h3>
  {#if items.length > 0}<span class="nav-count">{items.length} publicaties</span>{/if}
</header>

{#if loading && items.length === 0}
  <p class="nav-empty">Laden…</p>
{:else if error}
  <p class="nav-error">{error}</p>
{:else if items.length === 0}
  <p class="nav-empty">Geen publicaties in dit dossier.</p>
{:else}
  <ol class="nav-list">
    {#each items as it (it.key)}
      <li>
        <button
          type="button"
          class="nav-row"
          onclick={() => onNavigate?.('publications', it.key)}
        >
          {#if it.soort}<span class="nav-soort">{it.soort}</span>{/if}
          <span class="nav-titel">{it.display_name ?? it.titel ?? it.key}</span>
          {#if it.datum}<span class="nav-date">{formatDate(it.datum)}</span>{/if}
        </button>
      </li>
    {/each}
  </ol>
{/if}

<style>
  .nav-head { display: flex; flex-direction: column; gap: 2px; padding: 8px var(--s-4) 4px; }
  .nav-kind { font-family: var(--font-sans); font-size: 9px; font-weight: 600; letter-spacing: 0.08em; color: var(--ink-4); }
  .nav-title { font-family: var(--font-serif); font-size: 14px; font-weight: 500; color: var(--ink); margin: 0; line-height: 1.3; }
  .nav-count { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); margin-top: 2px; }
  .nav-empty, .nav-error { font-family: var(--font-serif); font-style: italic; font-size: 12px; color: var(--ink-4); margin: 6px var(--s-4); }
  .nav-list { list-style: none; margin: 0; padding: 0; }
  .nav-row {
    display: grid; grid-template-columns: minmax(60px, auto) 1fr; gap: 4px 8px;
    width: 100%; padding: 5px var(--s-4);
    background: none; border: none; border-bottom: 1px dotted var(--rule);
    text-align: left; cursor: pointer; font-family: var(--font-serif);
  }
  .nav-row:hover { background: var(--paper-2); }
  .nav-soort {
    grid-column: 1; grid-row: 1;
    font-family: var(--font-sans); font-size: 9px; font-weight: 500;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-4);
  }
  .nav-titel { grid-column: 1 / -1; grid-row: 2; font-size: 12px; color: var(--ink-2); line-height: 1.35; }
  .nav-date { grid-column: 2; grid-row: 1; font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); justify-self: end; }
</style>
