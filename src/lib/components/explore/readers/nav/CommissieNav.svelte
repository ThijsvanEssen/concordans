<script lang="ts">
  // Lezen-nav for commissie kind: lopende dossiers (active first).
  import type { GraphNode } from '$lib/graph/types';
  import { fetchCommissie } from '$lib/api/parliamentary-client';
  import type { DossierSummaryDTO } from '$lib/api/parliamentary';
  import { FASE_LABELS, KIND_SHORT } from '../_shared';

  let { node, onNavigate }: {
    node: GraphNode;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  let items = $state<DossierSummaryDTO[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let token = 0;

  $effect(() => {
    const t = ++token;
    loading = true;
    error = null;
    fetchCommissie(node.key)
      .then((c) => {
        if (t !== token) return;
        items = [...c.dossiers].sort((a, b) => {
          if (a.afgedaan !== b.afgedaan) return a.afgedaan ? 1 : -1;
          return (b.geopend_op ?? '').localeCompare(a.geopend_op ?? '');
        });
      })
      .catch(() => { if (t === token) error = 'Dossiers kunnen niet geladen worden.'; })
      .finally(() => { if (t === token) loading = false; });
  });
</script>

<header class="nav-head">
  <span class="nav-kind">COMMISSIE</span>
  <h3 class="nav-title">{node.label}</h3>
  {#if items.length > 0}<span class="nav-count">{items.length} dossiers</span>{/if}
</header>

{#if loading && items.length === 0}
  <p class="nav-empty">Laden…</p>
{:else if error}
  <p class="nav-error">{error}</p>
{:else if items.length === 0}
  <p class="nav-empty">Geen dossiers gekoppeld.</p>
{:else}
  <ol class="nav-list">
    {#each items as d (d.key)}
      <li>
        <button
          type="button"
          class="nav-row"
          class:is-closed={d.afgedaan}
          onclick={() => onNavigate?.('kamerstukdossiers', d.key)}
        >
          <span class="nav-num">{d.kamerstuknummer}</span>
          <span class="nav-titel">{d.titel ?? d.kamerstuknummer}</span>
          {#if d.huidige_fase}
            <span class="nav-fase">{FASE_LABELS[d.huidige_fase] ?? d.huidige_fase}</span>
          {:else if d.traject_kind}
            <span class="nav-fase">{KIND_SHORT[d.traject_kind] ?? d.traject_kind}</span>
          {/if}
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
    display: grid; grid-template-columns: auto 1fr auto; gap: 6px;
    width: 100%; padding: 5px var(--s-4);
    background: none; border: none; border-bottom: 1px dotted var(--rule);
    text-align: left; cursor: pointer; font-family: var(--font-serif);
    align-items: baseline;
  }
  .nav-row:hover { background: var(--paper-2); }
  .nav-row.is-closed { opacity: 0.6; }
  .nav-num { font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); }
  .nav-titel { font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nav-fase { font-family: var(--font-sans); font-size: 9px; color: var(--spine); text-transform: uppercase; letter-spacing: 0.04em; }
</style>
