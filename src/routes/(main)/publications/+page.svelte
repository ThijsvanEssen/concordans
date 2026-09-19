<script lang="ts">
  import type { PageData } from './$types';
  import { listPublications, type PublicationSummary } from '$lib/api/mvt';

  let { data }: { data: PageData } = $props();

  // Mutable local copy so "Meer laden" can extend the list without a full reload.
  let items = $state<PublicationSummary[]>(data.publications);
  let total = $state<number>(data.total);
  let loadingMore = $state(false);

  $effect(() => {
    items = data.publications;
    total = data.total;
  });

  async function loadMore() {
    if (loadingMore) return;
    loadingMore = true;
    try {
      const next = await listPublications({ limit: 1000, offset: items.length });
      // Backend may not implement offset; if it returns duplicates, dedupe by key.
      const seen = new Set(items.map((p) => p.key));
      const fresh = next.items.filter((p) => !seen.has(p.key));
      items = [...items, ...fresh];
      total = next.total;
    } catch { /* surface silently for now */ }
    finally { loadingMore = false; }
  }

  let query = $state('');
  let activeSoort = $state<string | null>(null);
  let onlyLinked = $state(false);
  let hideTitleless = $state(true);
  let sortCol = $state<'datum' | 'soort' | 'title' | 'links'>('datum');
  let sortDir = $state<'asc' | 'desc'>('desc');

  // Canonical soort groups — keeps the filter surface manageable.
  const SOORT_GROUPS: Record<string, string[]> = {
    'Memorie van toelichting': ['Memorie van toelichting', 'Memorie van toelichting (initiatiefvoorstel)'],
    'Voorstel van wet': ['Voorstel van wet', 'Voorstel van wet (initiatiefvoorstel)'],
    'Nota / verslag': [
      'Nota n.a.v. het (nader/tweede nader/enz.) verslag',
      'Nota van wijziging',
      'Nota van wijziging (initiatiefvoorstel)',
      'Verslag (initiatief)wetsvoorstel (nader)',
      'Verslag van een commissiedebat',
    ],
    'Amendementen': [
      'Amendement',
      'Amendement (gewijzigd/nader/vervangend)',
    ],
    'Moties': ['Motie', 'Motie (gewijzigd/nader)'],
    'Advies RvS': [
      'Advies Afdeling advisering Raad van State',
      'Advies Afdeling advisering Raad van State en Nader rapport',
      'Advies Afdeling advisering Raad van State en Reactie van de initiatiefnemer(s)',
    ],
    'Brief / overig': [
      'Brief regering',
      'Brief lid / fractie',
      'Brief Eerste Kamer',
      'Brief commissie',
      'Brief commissie aan bewindspersoon',
      'Geleidende brief',
      'Koninklijke boodschap',
      'Antwoord schriftelijke vragen',
      'Schriftelijke vragen',
      'Mededeling (uitstel antwoord)',
      'Bijlage',
      'Bijgewerkte tekst',
      'Eindtekst',
      'Stenogram',
      'Convocatie commissieactiviteit',
      'Position paper',
      'Wetenschapstoets',
      'Overig (openbaar)',
    ],
  };

  // Reverse map: soort → group label
  const soortToGroup = new Map<string, string>();
  for (const [group, soorten] of Object.entries(SOORT_GROUPS)) {
    for (const s of soorten) soortToGroup.set(s, group);
  }

  // Count items per group (only non-zero groups)
  const groupCounts = $derived((): [string, number][] => {
    const counts = new Map<string, number>();
    for (const p of items) {
      const g = (p.soort ? soortToGroup.get(p.soort) : null) ?? 'Brief / overig';
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    // Keep defined order
    return Object.keys(SOORT_GROUPS)
      .filter((g) => (counts.get(g) ?? 0) > 0)
      .map((g) => [g, counts.get(g)!]);
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = col === 'links' ? 'desc' : 'asc';
    }
  }

  const filtered = $derived((): PublicationSummary[] => {
    const q = query.trim().toLowerCase();
    const rows = items.filter((p) => {
      if (hideTitleless && !p.title) return false;
      if (onlyLinked && p.linked_articles === 0) return false;
      if (activeSoort) {
        const g = (p.soort ? soortToGroup.get(p.soort) : null) ?? 'Brief / overig';
        if (g !== activeSoort) return false;
      }
      if (!q) return true;
      return (
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.soort ?? '').toLowerCase().includes(q)
      );
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortCol === 'datum') return dir * ((a.datum ?? '').localeCompare(b.datum ?? ''));
      if (sortCol === 'soort') return dir * ((a.soort ?? '').localeCompare(b.soort ?? ''));
      if (sortCol === 'title') return dir * ((a.title ?? '').localeCompare(b.title ?? ''));
      if (sortCol === 'links') return dir * ((a.linked_articles ?? 0) - (b.linked_articles ?? 0));
      return 0;
    });
  });

  const titledCount = $derived(items.filter((p) => !!p.title).length);

  function clearFilters() {
    query = '';
    activeSoort = null;
    onlyLinked = false;
    hideTitleless = true;
  }

  const hasFilter = $derived(query.trim() !== '' || activeSoort !== null || onlyLinked || !hideTitleless);
</script>

<svelte:head>
  <title>Parlementaire documenten. Concordans.</title>
</svelte:head>

<div class="pubs-shell">
  {#if data.error}
    <div class="pubs-error">
      <p class="pubs-error-title">Niet beschikbaar</p>
      <p class="pubs-error-msg">{data.error}</p>
    </div>
  {/if}

  <header class="pubs-header">
    <div class="pubs-top">
      <a href="/" class="pubs-back">← Terug</a>
      <div class="pubs-top-right">
        <h1 class="pubs-title">
          <span class="pubs-sigil" aria-hidden="true">‡</span>
          Parlementaire documenten
        </h1>
        <p class="pubs-subtitle">
          {#if total > items.length}
            {items.length.toLocaleString('nl-NL')} van {total.toLocaleString('nl-NL')} documenten geladen · Tweede Kamer
          {:else}
            {items.length.toLocaleString('nl-NL')} documenten · Tweede Kamer
          {/if}
        </p>
      </div>
    </div>

    <div class="pubs-controls">
      <input
        type="search"
        class="pubs-search"
        placeholder="Zoek op titel…"
        bind:value={query}
        autocomplete="off"
        spellcheck="false"
      />

      <label class="pubs-toggle">
        <input type="checkbox" bind:checked={hideTitleless} />
        <span>Alleen met titel <span class="pubs-toggle-count">({titledCount})</span></span>
      </label>

      <label class="pubs-toggle">
        <input type="checkbox" bind:checked={onlyLinked} />
        <span>Gekoppeld aan artikelen</span>
      </label>
    </div>

    <nav class="pubs-tabs" aria-label="Documenttype">
      <button
        type="button"
        class="pubs-tab"
        class:active={activeSoort === null}
        onclick={() => (activeSoort = null)}
      >Alle</button>
      {#each groupCounts() as [group, count], i (i)}
        <button
          type="button"
          class="pubs-tab"
          class:active={activeSoort === group}
          onclick={() => (activeSoort = activeSoort === group ? null : group)}
        >{group} <span class="pubs-tab-count">{count}</span></button>
      {/each}
    </nav>
  </header>

  <!-- Results -->
  <div class="pubs-table-wrap">
    {#if hasFilter || items.length - filtered().length > 0}
      {@const hiddenByFilter = items.length - filtered().length}
      <div class="pubs-result-bar">
        <span>
          {filtered().length.toLocaleString('nl-NL')} van {items.length.toLocaleString('nl-NL')}
          getoond{#if hiddenByFilter > 0} · {hiddenByFilter.toLocaleString('nl-NL')} verborgen door filter{/if}
        </span>
        <div class="pubs-result-actions">
          {#if hideTitleless && hiddenByFilter > 0}
            <button type="button" class="pubs-inline-action" onclick={() => (hideTitleless = false)}>
              Toon ook documenten zonder titel
            </button>
          {/if}
          {#if hasFilter}
            <button type="button" class="pubs-clear" onclick={clearFilters}>Wis filters ×</button>
          {/if}
        </div>
      </div>
    {/if}

    <table class="pubs-table">
      <thead>
        <tr>
          <th class="col-datum col-sortable" onclick={() => toggleSort('datum')}>
            Datum{sortCol === 'datum' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </th>
          <th class="col-soort col-sortable" onclick={() => toggleSort('soort')}>
            Soort{sortCol === 'soort' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </th>
          <th class="col-title col-sortable" onclick={() => toggleSort('title')}>
            Titel{sortCol === 'title' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </th>
          <th class="col-links col-sortable" title="Gekoppelde artikelen in het netwerk" onclick={() => toggleSort('links')}>
            Art.{sortCol === 'links' ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
          </th>
        </tr>
      </thead>
      <tbody>
        {#each filtered() as pub (pub.key)}
          <tr class="pubs-row" class:has-text={pub.has_text}>
            <td class="col-datum">
              <span class="datum-val">{pub.datum ?? '—'}</span>
            </td>
            <td class="col-soort">
              <span class="soort-label">{pub.soort ?? '—'}</span>
            </td>
            <td class="col-title">
              <a href="/publications/{pub.key}" class="pub-title-link">
                {pub.title || '(zonder titel)'}
              </a>
            </td>
            <td class="col-links">
              {#if pub.linked_articles > 0}
                <span class="linked-count">{pub.linked_articles}</span>
              {:else}
                <span class="linked-none">—</span>
              {/if}
            </td>
          </tr>
        {:else}
          <tr>
            <td colspan="4" class="pubs-empty">Geen documenten gevonden.</td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if total > items.length}
      <div class="pubs-loadmore">
        <button type="button" class="pubs-loadmore-btn" onclick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Laden…' : `Meer laden (${(total - items.length).toLocaleString('nl-NL')} resterend)`}
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .pubs-shell {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--s-6) var(--s-6) var(--s-9);
    box-sizing: border-box;
  }

  .pubs-error {
    padding: var(--s-5) var(--s-5);
    margin-bottom: var(--s-5);
    background: var(--paper-2);
    border: 1px solid var(--rule);
    border-radius: var(--r-2);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .pubs-error-title {
    font-family: var(--font-serif);
    font-size: var(--t-h3);
    color: var(--ink);
    margin: 0;
  }

  .pubs-error-msg {
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--ink-3);
    margin: 0;
  }

  /* Header */
  .pubs-header {
    margin-bottom: var(--s-5);
  }

  .pubs-top {
    display: flex;
    align-items: flex-start;
    gap: var(--s-4);
    margin-bottom: var(--s-5);
  }

  .pubs-back {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-3);
    text-decoration: none;
    margin-top: 6px;
    flex-shrink: 0;
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
  }

  .pubs-back:hover {
    color: var(--accent);
  }

  .pubs-top-right {
    flex: 1;
  }

  .pubs-title {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 26px;
    margin: 0 0 4px;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .pubs-sigil {
    font-style: italic;
    color: var(--ink-3);
  }

  .pubs-subtitle {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--fg-3);
    margin: 0;
  }

  /* Controls */
  .pubs-controls {
    display: flex;
    align-items: center;
    gap: var(--s-5);
    margin-bottom: var(--s-4);
  }

  .pubs-search {
    flex: 1;
    max-width: 480px;
    padding: 8px var(--s-4);
    font-family: var(--font-sans);
    font-size: 13px;
    color: var(--ink);
    background: var(--paper-2);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    outline: none;
    appearance: none;
  }

  .pubs-search:focus {
    border-color: var(--ink-3);
    background: var(--paper);
  }

  .pubs-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-3);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  .pubs-toggle input {
    cursor: pointer;
    accent-color: var(--ink);
  }

  .pubs-toggle-count {
    opacity: 0.55;
  }

  /* Tabs */
  .pubs-tabs {
    display: flex;
    flex-wrap: nowrap;
    gap: 2px;
    border-bottom: 1px solid var(--rule);
    padding-bottom: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .pubs-tabs::-webkit-scrollbar { display: none; }

  .pubs-tab {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-3);
    background: none;
    border: 0;
    border-bottom: 2px solid transparent;
    padding: 6px 12px 8px;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: -1px;
    transition: color var(--dur-1) var(--ease);
  }

  .pubs-tab:hover {
    color: var(--ink);
  }

  .pubs-tab.active {
    color: var(--ink);
    border-bottom-color: var(--ink);
    font-weight: 500;
  }

  .pubs-tab-count {
    font-size: 10px;
    opacity: 0.55;
  }

  .pubs-tab.active .pubs-tab-count {
    opacity: 0.65;
  }

  /* Result bar */
  .pubs-result-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
    flex-wrap: wrap;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--fg-3);
    padding: var(--s-2) 0 var(--s-3);
  }
  .pubs-result-actions {
    display: flex;
    align-items: center;
    gap: var(--s-3);
    flex-wrap: wrap;
  }
  .pubs-inline-action {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-2);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
    border-bottom: 1px solid var(--rule-strong);
  }
  .pubs-inline-action:hover {
    color: var(--accent, var(--spine));
    border-bottom-color: var(--accent, var(--spine));
  }

  .pubs-loadmore {
    display: flex;
    justify-content: center;
    padding: var(--s-5) 0 var(--s-3);
  }
  .pubs-loadmore-btn {
    height: 36px;
    padding: 0 18px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-2);
    cursor: pointer;
    transition: background 80ms, color 80ms, border-color 80ms;
  }
  .pubs-loadmore-btn:hover:not(:disabled) {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }
  .pubs-loadmore-btn:disabled { opacity: 0.6; cursor: wait; }

  .pubs-clear {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-3);
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
    border-bottom: 1px solid var(--rule-strong);
  }

  .pubs-clear:hover {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  /* Table */
  .pubs-table-wrap {
    overflow-x: auto;
  }

  .pubs-table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--font-sans);
    font-size: 13px;
  }

  .pubs-table thead th {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
    font-weight: 500;
    text-align: left;
    padding: var(--s-2) var(--s-3) var(--s-2) 0;
    border-bottom: 1px solid var(--rule-strong);
    white-space: nowrap;
  }

  .col-sortable {
    cursor: pointer;
    user-select: none;
  }

  .col-sortable:hover {
    color: var(--ink-2);
  }

  .col-datum { width: 90px; }
  .col-soort { width: 200px; }
  .col-links { width: 44px; text-align: right; }

  .pubs-table thead .col-links {
    text-align: right;
  }

  .pubs-row td {
    padding: 9px var(--s-3) 9px 0;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
    line-height: 1.4;
  }

  .pubs-row:hover td {
    background: var(--paper-2);
  }

  .datum-val {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-3);
    white-space: nowrap;
  }

  .soort-label {
    font-size: 11px;
    color: var(--ink-3);
    line-height: 1.4;
  }

  .pub-title-link {
    font-family: var(--font-serif);
    font-size: 15px;
    color: var(--ink);
    text-decoration: none;
    line-height: 1.4;
  }

  .pub-title-link:hover {
    color: var(--accent);
  }

  .linked-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 600;
    display: block;
    text-align: right;
  }

  .linked-none {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-4);
    display: block;
    text-align: right;
  }

  .pubs-empty {
    padding: var(--s-6) 0;
    color: var(--fg-3);
    font-style: italic;
  }
</style>
