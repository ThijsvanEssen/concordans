<script lang="ts">
  // CitationRail for lid: commissies (LID_VAN), fractie (LID_VAN_FRACTIE),
  // recent stemgedrag (via fetchLidVotes — lid → publication edges don't
  // exist in the graph, and touched-instruments aggregation returns 0).
  import type { GraphNode } from '$lib/graph/types';
  import { getNodeGraph } from '$lib/api/nodes';
  import { fetchLidVotes } from '$lib/api/parliamentary-client';
  import type { Neighbor } from '$lib/api/types';
  import type { LidStemDTO } from '$lib/api/parliamentary';

  let { node, onNavigate }: {
    node: GraphNode;
    onNavigate?: (collection: string, key: string) => void;
  } = $props();

  let commissies = $state<Neighbor[]>([]);
  let fractie = $state<Neighbor | null>(null);
  let votes = $state<LidStemDTO[]>([]);
  let totalVotes = $state(0);
  let loading = $state(false);
  let token = 0;

  $effect(() => {
    const t = ++token;
    loading = true;
    Promise.all([
      getNodeGraph(node.collection, node.key, { neighborLimit: 50 }),
      fetchLidVotes(node.key, { limit: 8 }).catch(() => null),
    ])
      .then(([r, v]) => {
        if (t !== token) return;
        const all = r.neighbors?.all ?? [];
        commissies = all.filter((n) => n.collection === 'commissies' && n.relation === 'LID_VAN');
        fractie = all.find((n) => n.collection === 'fracties' && n.relation === 'LID_VAN_FRACTIE') ?? null;
        votes = v?.votes ?? [];
        totalVotes = v?.total ?? 0;
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (t === token) loading = false; });
  });

  function stemmingKey(v: LidStemDTO): string {
    return v.stemming_key ?? v.stemming_id.split('/').pop() ?? '';
  }
</script>

<section class="rail-section">
  <h3 class="rail-section-title">Commissies</h3>
  {#if loading && commissies.length === 0}
    <p class="rail-meta">Laden…</p>
  {:else if commissies.length === 0}
    <p class="rail-meta">Geen commissie-lidmaatschap.</p>
  {:else}
    <ul class="rail-list">
      {#each commissies as c (c.id)}
        <li>
          <button type="button" class="rail-row" onclick={() => onNavigate?.(c.collection, c.key)}>
            <span class="rail-name">{c.display_name ?? c.key}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section class="rail-section">
  <h3 class="rail-section-title">Fractie</h3>
  {#if !fractie}
    <p class="rail-meta">Geen fractie geregistreerd.</p>
  {:else}
    <button
      type="button"
      class="rail-row"
      onclick={() => fractie && onNavigate?.(fractie.collection, fractie.key)}
    >
      <span class="rail-name">{fractie.display_name ?? fractie.key}</span>
    </button>
  {/if}
</section>

<section class="rail-section">
  <h3 class="rail-section-title">Recent stemgedrag{#if totalVotes > 0} · {totalVotes}{/if}</h3>
  {#if loading && votes.length === 0}
    <p class="rail-meta">Laden…</p>
  {:else if votes.length === 0}
    <p class="rail-meta">Geen stemmen geregistreerd.</p>
  {:else}
    <ul class="rail-list">
      {#each votes as v (v.stemming_id)}
        <li>
          <button type="button" class="rail-row" onclick={() => onNavigate?.('stemmingen', stemmingKey(v))}>
            <span class="rail-name">{v.onderwerp ?? '—'}</span>
            <span class="rail-rel" class:rail-rel--voor={v.soort === 'Voor'} class:rail-rel--tegen={v.soort === 'Tegen'}>
              {v.soort}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .rail-section { display: flex; flex-direction: column; gap: 4px; padding: 0 var(--s-4); }
  .rail-section-title {
    font-family: var(--font-sans); font-size: 10px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-4);
    margin: var(--s-3) 0 2px;
  }
  .rail-meta { font-family: var(--font-serif); font-style: italic; font-size: 11px; color: var(--ink-4); margin: 0; }
  .rail-list { list-style: none; margin: 0; padding: 0; }
  .rail-row {
    display: flex; gap: 6px; align-items: flex-start;
    width: 100%; padding: 3px 0; border: none; background: none;
    border-bottom: 1px dotted var(--rule); cursor: pointer; text-align: left;
  }
  .rail-row:hover { background: var(--paper-2); }
  .rail-name {
    flex: 1; font-family: var(--font-serif); font-size: 12px; color: var(--ink-2);
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .rail-rel { font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); flex-shrink: 0; }
  .rail-rel--voor { color: var(--green, #16a34a); }
  .rail-rel--tegen { color: var(--red, #dc2626); }
</style>
