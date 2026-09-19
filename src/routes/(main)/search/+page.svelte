<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { unifiedSearch, type SearchResultItem, type UnifiedResults } from '$lib/api/search';
  import { judgmentTier, formatEcliLabel } from '$lib/graph/types';
  import { getInstrumentMeta } from '$lib/api/instrument-cache';

  const query = $derived($page.url.searchParams.get('q') ?? '');
  let results = $state<UnifiedResults>({ articles: [], judgments: [], instruments: [], dossiers: [], publications: [], commissies: [], leden: [], fracties: [] });
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchInput = $state('');
  let submitting = $state(false);

  // Domain visibility chips. Default: all on.
  let showWet  = $state(true);
  let showRecht = $state(true);
  let showTk    = $state(true);

  $effect(() => {
    const q = query;
    searchInput = q;
    if (!q) {
      results = { articles: [], judgments: [], instruments: [], dossiers: [], publications: [], commissies: [], leden: [], fracties: [] };
      error = null;
      return;
    }
    loading = true;
    error = null;
    unifiedSearch(q, { limit: 50 })
      .then((r) => { results = r; })
      .catch(() => { error = 'Zoeken mislukt. Controleer de verbinding.'; })
      .finally(() => { loading = false; });
  });

  function handleSearch(e: Event) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    submitting = true;
    goto(`/search?q=${encodeURIComponent(q)}`, { replaceState: true }).finally(() => { submitting = false; });
  }

  // ── Grouping ────────────────────────────────────────────────────────────
  // Wetgeving: instruments + articles (articles sub-grouped by their bwb_id)
  // Rechtspraak: judgments (sub-grouped by court tier)
  // Parlementair: dossiers + publications + commissies

  type ArticleGroup = { bwbId: string; lawName: string; items: SearchResultItem[] };
  const articleGroups = $derived.by<ArticleGroup[]>(() => {
    const groups = new Map<string, ArticleGroup>();
    for (const a of results.articles) {
      const bwb = String((a.extra?.['bwb_id'] as string | undefined)
        ?? a.key.match(/^([a-z]+\d+)/i)?.[1]
        ?? 'unknown').toUpperCase();
      let g = groups.get(bwb);
      if (!g) {
        const meta = getInstrumentMeta(bwb);
        g = {
          bwbId: bwb,
          lawName: meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? bwb,
          items: [],
        };
        groups.set(bwb, g);
      }
      g.items.push(a);
    }
    return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
  });

  const TIER_LABEL: Record<string, string> = {
    cassation: 'Hoge Raad',
    appeal:    'Hoven & RvS',
    first:     'Rechtbanken',
    unknown:   'Overig',
  };
  type JudgmentGroup = { tier: string; label: string; items: SearchResultItem[] };
  const judgmentGroups = $derived.by<JudgmentGroup[]>(() => {
    const buckets: Record<string, SearchResultItem[]> = { cassation: [], appeal: [], first: [], unknown: [] };
    for (const j of results.judgments) {
      const ecli = (j.extra?.['ecli'] as string | undefined) ?? j.key;
      const t = judgmentTier(ecli);
      buckets[t].push(j);
    }
    return Object.entries(buckets)
      .filter(([, items]) => items.length > 0)
      .map(([tier, items]) => ({ tier, label: TIER_LABEL[tier], items }));
  });

  const wetCount   = $derived(results.articles.length + results.instruments.length);
  const rechtCount = $derived(results.judgments.length);
  const tkCount    = $derived(
    results.dossiers.length
    + results.publications.length
    + (results.commissies?.length ?? 0)
    + (results.leden?.length ?? 0)
    + (results.fracties?.length ?? 0)
  );
  const totalCount = $derived(wetCount + rechtCount + tkCount);

  function exploreHref(item: SearchResultItem): string {
    return `/explore?mode=split&focus=${encodeURIComponent(`${item.collection}/${item.key}`)}`;
  }
  function dossierNum(item: SearchResultItem): string {
    return (item.extra?.['kamerstuknummer'] as string | undefined) ?? item.key;
  }
  function ecliLabel(item: SearchResultItem): string {
    const ecli = (item.extra?.['ecli'] as string | undefined) ?? item.display_name ?? item.key;
    try { return formatEcliLabel(ecli); } catch { return ecli; }
  }
</script>

<svelte:head>
  <title>{query ? `"${query}" — Zoekresultaten` : 'Zoeken'} — Concordans</title>
</svelte:head>

<div class="search-page">
  <header class="search-header">
    <form class="search-form" onsubmit={handleSearch} role="search">
      <input
        type="search"
        bind:value={searchInput}
        placeholder="Zoek op artikel, ECLI, kamerstuk of begrip…"
        class="search-form__input"
        aria-label="Zoeken"
        autofocus
      />
      <button type="submit" class="search-form__btn" disabled={submitting || !searchInput.trim()} aria-busy={submitting}>
        {submitting ? 'Zoeken…' : 'Zoeken'}
      </button>
    </form>
  </header>

  <div class="search-results">
    {#if loading}
      <div class="search-status">Zoeken…</div>
    {:else if error}
      <div class="search-status search-status--error">{error}</div>
    {:else if !query}
      <div class="search-status">Zoek in artikelen, uitspraken en dossiers.</div>
    {:else if totalCount === 0}
      <div class="search-status">Geen resultaten voor <strong>"{query}"</strong>.</div>
      <p class="no-results-hint">Probeer een ECLI-nummer (ECLI:NL:HR:…), BWB-code (BWBR…) of trefwoord.</p>
    {:else}
      <div class="results-header">
        <p class="results-meta">{totalCount} resultaten voor <strong>"{query}"</strong></p>
        <div class="domain-chips" role="group" aria-label="Filter op domein">
          <button type="button" class="chip chip--wet"   class:chip--off={!showWet}   aria-pressed={showWet}   onclick={() => (showWet = !showWet)}>
            <span class="chip__glyph">§</span> Wetgeving <span class="chip__count">{wetCount}</span>
          </button>
          <button type="button" class="chip chip--recht" class:chip--off={!showRecht} aria-pressed={showRecht} onclick={() => (showRecht = !showRecht)}>
            <span class="chip__glyph">¶</span> Rechtspraak <span class="chip__count">{rechtCount}</span>
          </button>
          <button type="button" class="chip chip--tk"    class:chip--off={!showTk}    aria-pressed={showTk}    onclick={() => (showTk = !showTk)}>
            <span class="chip__glyph">∮</span> Parlementair <span class="chip__count">{tkCount}</span>
          </button>
        </div>
      </div>

      <!-- ── Wetgeving ──────────────────────────────────────────────────── -->
      {#if showWet && wetCount > 0}
        <section class="domain domain--wet">
          <header class="domain__head">
            <span class="domain__glyph">§</span>
            <h2 class="domain__title">Wetgeving</h2>
            <span class="domain__count">{wetCount}</span>
          </header>

          {#if results.instruments.length > 0}
            <div class="subgroup" id="instruments">
              <h3 class="subgroup__title">Instrumenten <span>{results.instruments.length}</span></h3>
              <ul class="result-list">
                {#each results.instruments as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--wet" aria-hidden="true">§</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                      <span class="result-item__cite mono">{(item.extra?.['bwb_id'] as string | undefined) ?? item.key}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if articleGroups.length > 0}
            <div class="subgroup" id="articles">
              <h3 class="subgroup__title">Artikelen <span>{results.articles.length}</span></h3>
              {#each articleGroups as g (g.bwbId)}
                <div class="article-group">
                  <h4 class="article-group__law">
                    {g.lawName}
                    <span class="article-group__count">{g.items.length}</span>
                  </h4>
                  <ul class="result-list">
                    {#each g.items as item (item.id)}
                      <li class="result-item">
                        <a href={exploreHref(item)} class="result-item__link">
                          <span class="leg-glyph leg-glyph--wet" aria-hidden="true">❡</span>
                          <span class="result-item__body">
                            <span class="result-item__title">{item.display_name ?? item.key}</span>
                            {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                          </span>
                          <span class="result-item__cite mono">{(item.extra?.['article_number'] as string | undefined) ?? ''}</span>
                        </a>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      <!-- ── Rechtspraak ────────────────────────────────────────────────── -->
      {#if showRecht && rechtCount > 0}
        <section class="domain domain--recht">
          <header class="domain__head">
            <span class="domain__glyph">¶</span>
            <h2 class="domain__title">Rechtspraak</h2>
            <span class="domain__count">{rechtCount}</span>
          </header>

          {#each judgmentGroups as g, gi (g.tier)}
            <div class="subgroup" id={gi === 0 ? 'judgments' : undefined}>
              <h3 class="subgroup__title">{g.label} <span>{g.items.length}</span></h3>
              <ul class="result-list">
                {#each g.items as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--recht" aria-hidden="true">¶</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{ecliLabel(item)}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                      <span class="result-item__cite mono">{(item.extra?.['ecli'] as string | undefined) ?? item.display_name ?? ''}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </section>
      {/if}

      <!-- ── Parlementair ───────────────────────────────────────────────── -->
      {#if showTk && tkCount > 0}
        <section class="domain domain--tk">
          <header class="domain__head">
            <span class="domain__glyph">∮</span>
            <h2 class="domain__title">Parlementair</h2>
            <span class="domain__count">{tkCount}</span>
          </header>

          {#if results.dossiers.length > 0}
            <div class="subgroup" id="dossiers">
              <h3 class="subgroup__title">Wetgevingsdossiers <span>{results.dossiers.length}</span></h3>
              <ul class="result-list">
                {#each results.dossiers as item (item.id)}
                  {@const num = dossierNum(item)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--tk" aria-hidden="true">∮</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                      <span class="result-item__cite mono">{num}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if (results.commissies?.length ?? 0) > 0}
            <div class="subgroup" id="commissies">
              <h3 class="subgroup__title">Commissies <span>{results.commissies?.length ?? 0}</span></h3>
              <ul class="result-list">
                {#each (results.commissies ?? []) as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--tk" aria-hidden="true">‡</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if (results.fracties?.length ?? 0) > 0}
            <div class="subgroup" id="fracties">
              <h3 class="subgroup__title">Fracties <span>{results.fracties?.length ?? 0}</span></h3>
              <ul class="result-list">
                {#each (results.fracties ?? []) as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--tk" aria-hidden="true">※</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                      <span class="result-item__cite mono">{(item.extra?.['afkorting'] as string | undefined) ?? ''}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if (results.leden?.length ?? 0) > 0}
            <div class="subgroup" id="leden">
              <h3 class="subgroup__title">Kamerleden <span>{results.leden?.length ?? 0}</span></h3>
              <ul class="result-list">
                {#each (results.leden ?? []) as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--tk" aria-hidden="true">◉</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                      <span class="result-item__cite mono">{(item.extra?.['partij'] as string | undefined) ?? ''}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}

          {#if results.publications.length > 0}
            <div class="subgroup" id="publications">
              <h3 class="subgroup__title">Publicaties <span>{results.publications.length}</span></h3>
              <ul class="result-list">
                {#each results.publications as item (item.id)}
                  <li class="result-item">
                    <a href={exploreHref(item)} class="result-item__link">
                      <span class="leg-glyph leg-glyph--tk" aria-hidden="true">▤</span>
                      <span class="result-item__body">
                        <span class="result-item__title">{item.display_name ?? item.key}</span>
                        {#if item.snippet}<p class="result-item__snippet">{item.snippet}</p>{/if}
                      </span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </section>
      {/if}

    {/if}
  </div>
</div>

<style>
  .search-page {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    padding: var(--s-6) var(--s-5) var(--s-8);
    display: flex;
    flex-direction: column;
    gap: var(--s-5);
  }

  /* ── Search form ─────────────────────────────────────────────────────── */
  .search-form {
    display: flex;
    gap: var(--s-2);
    border-bottom: 1px solid var(--rule);
    padding-bottom: var(--s-4);
  }
  .search-form__input {
    flex: 1;
    height: 40px;
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    padding: 0 var(--s-4);
    font-family: var(--font-serif);
    font-size: 18px;
    background: var(--paper);
    color: var(--ink);
  }
  .search-form__input:focus {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  .search-form__btn {
    height: 40px;
    padding: 0 var(--s-4);
    border: none;
    border-radius: var(--r-1);
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--dur-1) var(--ease);
  }
  .search-form__btn:hover:not(:disabled) { background: var(--ink-2); }
  .search-form__btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Status / header row ─────────────────────────────────────────────── */
  .search-results { display: flex; flex-direction: column; gap: var(--s-6); }
  .search-status {
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--fg-3);
    font-size: 18px;
    padding: var(--s-6) 0;
    text-align: center;
  }
  .search-status--error { color: var(--accent); font-style: normal; }
  .no-results-hint {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 13px;
    color: var(--ink-4);
    text-align: center;
    margin: 0 0 var(--s-4);
  }

  .results-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--s-3);
  }
  .results-meta {
    margin: 0;
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    color: var(--fg-3);
  }

  /* ── Domain chips ────────────────────────────────────────────────────── */
  .domain-chips { display: flex; gap: var(--s-2); flex-wrap: wrap; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid var(--rule-strong);
    background: var(--paper);
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-2);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease), color var(--dur-1) var(--ease), opacity var(--dur-1) var(--ease);
  }
  .chip__glyph {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 14px;
    line-height: 1;
  }
  .chip__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-3);
  }
  .chip:hover { background: var(--paper-3); }
  .chip--wet            .chip__glyph { color: var(--ink); }
  .chip--recht          .chip__glyph { color: var(--indigo); }
  .chip--tk             .chip__glyph { color: var(--spine); }
  .chip--off { opacity: 0.45; text-decoration: line-through; }
  .chip--off .chip__glyph { color: var(--ink-4); }

  /* ── Domain section ──────────────────────────────────────────────────── */
  .domain {
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }
  .domain__head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding-bottom: var(--s-2);
    border-bottom: 1px solid var(--rule-strong);
  }
  .domain__glyph {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 22px;
    line-height: 1;
  }
  .domain--wet   .domain__glyph { color: var(--ink); }
  .domain--recht .domain__glyph { color: var(--indigo); }
  .domain--tk    .domain__glyph { color: var(--spine); }
  .domain__title {
    margin: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 18px;
    color: var(--ink);
  }
  .domain__count {
    margin-left: auto;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--fg-3);
  }

  /* ── Sub-group (Instrumenten, Artikelen, Hoge Raad, Dossiers, ...) ───── */
  .subgroup {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }
  .subgroup + .subgroup { margin-top: var(--s-3); }
  .subgroup__title {
    margin: 0;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-3);
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .subgroup__title span {
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--fg-4);
  }

  /* ── Article group within Wetgeving ──────────────────────────────────── */
  .article-group { margin-top: var(--s-2); }
  .article-group + .article-group { margin-top: var(--s-3); }
  .article-group__law {
    margin: 0 0 4px;
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--fg-2);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .article-group__count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--fg-4);
  }

  /* ── Result list ─────────────────────────────────────────────────────── */
  .result-list {
    list-style: none;
    padding: 0;
    margin: 0;
    border-top: 1px solid var(--rule);
  }
  .result-item { border-bottom: 1px solid var(--rule); }
  .result-item__link {
    display: flex;
    align-items: baseline;
    gap: var(--s-3);
    padding: var(--s-3) 0;
    text-decoration: none;
    color: inherit;
    transition: background var(--dur-1) var(--ease);
  }
  .result-item__link:hover { background: var(--paper-3); }

  .leg-glyph {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 16px;
    line-height: 1;
    width: 14px;
    text-align: center;
    flex-shrink: 0;
    margin-top: 2px;
  }
  .leg-glyph--wet   { color: var(--ink); }
  .leg-glyph--recht { color: var(--indigo); }
  .leg-glyph--tk    { color: var(--spine); }

  .result-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .result-item__title {
    font-family: var(--font-serif);
    font-size: 16px;
    color: var(--ink);
    line-height: 1.25;
  }
  .result-item__snippet {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--fg-3);
    line-height: 1.5;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .result-item__cite {
    font-size: 11px;
    color: var(--fg-3);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .mono { font-family: var(--font-mono); }
</style>
