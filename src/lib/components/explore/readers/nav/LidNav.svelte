<script lang="ts">
  // Lezen-nav for lid kind: the lid's recorded stemgedrag.
  // Individual lid → publication edges don't exist; fetchLidVotes is the
  // only endpoint that gives concrete, lid-specific activity.
  import type { GraphNode } from '$lib/graph/types';
  import { fetchLidVotes } from '$lib/api/parliamentary-client';
  import type { LidStemDTO } from '$lib/api/parliamentary';

  let { node, onNavigate }: {
    node: GraphNode;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  let items = $state<LidStemDTO[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let token = 0;

  $effect(() => {
    const t = ++token;
    loading = true;
    error = null;
    fetchLidVotes(node.key, { limit: 50 })
      .then((r) => {
        if (t !== token) return;
        items = r.votes;
        total = r.total;
      })
      .catch(() => { if (t === token) error = 'Stemgedrag kan niet geladen worden.'; })
      .finally(() => { if (t === token) loading = false; });
  });

  function stemmingKey(v: LidStemDTO): string {
    return v.stemming_key ?? v.stemming_id.split('/').pop() ?? '';
  }
</script>

<header class="nav-head">
  <span class="nav-kind">KAMERLID</span>
  <h3 class="nav-title">{node.label}</h3>
  {#if total > 0}<span class="nav-count">{total} geregistreerde stem{total === 1 ? '' : 'men'}</span>{/if}
</header>

{#if loading && items.length === 0}
  <p class="nav-empty">Laden…</p>
{:else if error}
  <p class="nav-error">{error}</p>
{:else if items.length === 0}
  <p class="nav-empty">Geen stemmen geregistreerd voor dit lid.</p>
{:else}
  <ol class="nav-list">
    {#each items as v (v.stemming_id)}
      <li>
        <button
          type="button"
          class="nav-row"
          onclick={() => onNavigate?.('stemmingen', stemmingKey(v))}
        >
          <span class="nav-soort" class:nav-soort--voor={v.soort === 'Voor'} class:nav-soort--tegen={v.soort === 'Tegen'}>
            {v.soort}
          </span>
          <span class="nav-titel">{v.onderwerp ?? '—'}</span>
          {#if v.datum}<span class="nav-date">{v.datum.slice(0, 10)}</span>{/if}
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
    display: grid; grid-template-columns: minmax(60px, auto) 1fr auto; gap: 4px 8px;
    width: 100%; padding: 5px var(--s-4);
    background: none; border: none; border-bottom: 1px dotted var(--rule);
    text-align: left; cursor: pointer; font-family: var(--font-serif);
    align-items: baseline;
  }
  .nav-row:hover { background: var(--paper-2); }
  .nav-soort {
    font-family: var(--font-sans); font-size: 9px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-4);
  }
  .nav-soort--voor { color: #2e6f3a; }
  .nav-soort--tegen { color: #8a2a2a; }
  .nav-titel { font-size: 12px; color: var(--ink-2); line-height: 1.35; }
  .nav-date { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); justify-self: end; }
</style>
