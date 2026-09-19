<script lang="ts">
  import { goto } from '$app/navigation';
    import { track } from '$lib/analytics';
  import { unifiedSearch, type SearchResultItem, type UnifiedResults } from '$lib/api/search';
  import { judgmentTier, formatEcliLabel } from '$lib/graph/types';
  import { getInstrumentMeta, recordInstrument, ensureInstrumentMeta, instrumentMetaStore } from '$lib/api/instrument-cache';

  let { open, onClose }: { open: boolean; onClose: () => void } = $props();

  let query = $state('');
  let results = $state<UnifiedResults>({ articles: [], judgments: [], instruments: [], dossiers: [], publications: [], commissies: [], leden: [], fracties: [] });
  let loading = $state(false);
  let inputEl = $state<HTMLInputElement | null>(null);
  let modalEl = $state<HTMLDivElement | null>(null);
  let focusedIndex = $state(-1);
  let previousFocus: HTMLElement | null = null;

  // ── Truncation policy ─────────────────────────────────────────────────
  // We fetch a bit more than we render per type so we can decide whether to
  // surface a "+ more →" link to the full /search page. Caps are tuned per
  // domain — articles/publications dominate broad queries and would crowd
  // out smaller categories if uncapped; the link drops the user into the
  // full results page when they want everything.
  // Veelgebruikte ingangen — directe deep-links naar de Verkenner.
  // De query is alleen een fallback wanneer het backend de directe focus
  // niet kan resolven; de href is de primaire actie.
  const SUGGESTIONS = [
    { href: '/explore?focus=instrument_articles%2Fbwbr0005289_6%3A162&from=search', query: 'Art. 6:162 BW', label: 'Art. 6:162 BW', desc: 'Onrechtmatige daad' },
    { href: '/explore?focus=instrument_articles%2Fbwbr0001840_1&from=search', query: 'Art. 1 Grondwet', label: 'Art. 1 Grondwet', desc: 'Gelijkheidsbeginsel' },
    { href: '/explore?focus=judgments%2Fecli%3Anl%3Ahr%3A1992%3Aad1823&from=search', query: 'ECLI:NL:HR:1992:AD1823', label: 'ECLI:NL:HR:1992:AD1823', desc: 'Kelderluik' },
    { href: '/explore?focus=instrument_articles%2Fbwbr0001854_287&from=search', query: 'Art. 287 Sr', label: 'Art. 287 Sr', desc: 'Doodslag' },
    { href: '/explore?focus=dossiers%2F36600&from=search', query: 'Dossier 36600', label: 'Dossier 36600', desc: 'Belastingdienst' },
  ];

  const FETCH_LIMIT = 25;
  const RENDER_CAP: Record<keyof UnifiedResults, number> = {
    articles: 10,
    instruments: 6,
    judgments: 8,
    dossiers: 8,
    commissies: 6,
    fracties: 6,
    leden: 6,
    publications: 8,
  };

  // Sliced view of `results` used by the template + keyboard nav. Anything
  // beyond the cap surfaces only via the "+ more →" link, never silently.
  const vis = $derived<UnifiedResults>({
    articles:     results.articles.slice(0, RENDER_CAP.articles),
    instruments:  results.instruments.slice(0, RENDER_CAP.instruments),
    judgments:    results.judgments.slice(0, RENDER_CAP.judgments),
    dossiers:     results.dossiers.slice(0, RENDER_CAP.dossiers),
    commissies:   (results.commissies ?? []).slice(0, RENDER_CAP.commissies),
    fracties:     (results.fracties ?? []).slice(0, RENDER_CAP.fracties),
    leden:        (results.leden ?? []).slice(0, RENDER_CAP.leden),
    publications: results.publications.slice(0, RENDER_CAP.publications),
  });

  // "More available" per type. True if either we hit the fetch ceiling (more
  // certainly exist server-side) or we trimmed locally to the render cap.
  function moreOf(key: keyof UnifiedResults): number {
    const total = (results[key] ?? []).length;
    const shown = (vis[key] ?? []).length;
    if (total > shown) return total - shown;
    // total === shown but may have hit the fetch ceiling — indicate "more"
    // without a precise count.
    return total >= FETCH_LIMIT ? -1 : 0;
  }
  function moreLabel(n: number): string {
    return n > 0 ? `+ ${n} meer` : '+ meer';
  }

  // Domain visibility chips. Default: all on.
  let showWet   = $state(true);
  let showRecht = $state(true);
  let showTk    = $state(true);

  // ── Grouped views ─────────────────────────────────────────────────────
  // Re-derive whenever the instrument-meta cache updates so article-group
  // headings replace BWB ids with the law's friendly name as soon as the
  // background fetch resolves.
  type ArticleGroup = { bwbId: string; lawName: string; items: SearchResultItem[] };
  const articleGroups = $derived.by<ArticleGroup[]>(() => {
    void $instrumentMetaStore;
    const groups = new Map<string, ArticleGroup>();
    for (const a of vis.articles) {
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
    for (const j of vis.judgments) {
      const ecli = (j.extra?.['ecli'] as string | undefined) ?? j.key;
      const t = judgmentTier(ecli);
      buckets[t].push(j);
    }
    return Object.entries(buckets)
      .filter(([, items]) => items.length > 0)
      .map(([tier, items]) => ({ tier, label: TIER_LABEL[tier], items }));
  });

  const wetCount   = $derived(vis.articles.length + vis.instruments.length);
  const rechtCount = $derived(vis.judgments.length);
  const tkCount    = $derived(
    vis.dossiers.length + vis.publications.length +
    vis.commissies.length + vis.leden.length + vis.fracties.length
  );
  const totalCount = $derived(wetCount + rechtCount + tkCount);

  // Flat ordered list for keyboard navigation (only items in visible domains).
  const flatItems = $derived<SearchResultItem[]>([
    ...(showWet   ? vis.instruments  : []),
    ...(showWet   ? vis.articles     : []),
    ...(showRecht ? vis.judgments    : []),
    ...(showTk    ? vis.dossiers     : []),
    ...(showTk    ? vis.commissies   : []),
    ...(showTk    ? vis.fracties     : []),
    ...(showTk    ? vis.leden        : []),
    ...(showTk    ? vis.publications : []),
  ]);

  const hasResults = $derived(flatItems.length > 0);

  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !modalEl) return;
    const focusable = modalEl.querySelectorAll<HTMLElement>(
      'button, input, a[href], [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  const EMPTY_RESULTS: UnifiedResults = {
    articles: [], judgments: [], instruments: [],
    dossiers: [], publications: [], commissies: [],
    leden: [], fracties: [],
  };

  // BWB-id's voor de zes wetboeken die het meest worden opgezocht. Wordt
  // gebruikt om "Art. X:Y Sr" direct als deep-link bovenaan de resultaten
  // te zetten, zonder af te hangen van de relevance van het search-endpoint.
  const WETBOEK_BWB: Record<string, string> = {
    'bw': 'BWBR0005289',  // BW Boek 6 (Onrechtmatige daad e.v.) — meest geciteerd
    'sr': 'BWBR0001854',
    'sv': 'BWBR0001903',
    'awb': 'BWBR0005537',
    'gw': 'BWBR0001840',
    'awr': 'BWBR0002320',
    'rv':  'BWBR0001827',
  };

  // Parse "Art. 6:162 BW" / "ECLI:NL:HR:1992:AD1823" / "Dossier 36600" en
  // lever een directe focus-URL terug. Frontend-only — het backend hoeft
  // niet te kunnen rangschikken op deze patronen.
  type DirectHit = { href: string; label: string; desc: string };
  function directHitFor(q: string): DirectHit | null {
    const trimmed = q.trim();
    if (!trimmed) return null;

    // Art. <num>:<sub> <wetboek>
    const artMatch = trimmed.match(/^\s*(?:art(?:ikel)?\.?\s*)?(\d+[a-z]?(?::\d+[a-z]?)?)\s+(BW|Sr|Sv|Awb|Gw|AWR|Rv)\b/i);
    if (artMatch) {
      const articleNum = artMatch[1];
      const wetKey = artMatch[2].toLowerCase();
      const bwb = WETBOEK_BWB[wetKey];
      if (bwb) {
        const key = articleNum.includes(':') ? articleNum.replace(':', '%3A') : articleNum;
        return {
          href: `/explore?focus=instrument_articles%2F${bwb.toLowerCase()}_${key}&from=search`,
          label: `Art. ${articleNum} ${artMatch[2].toUpperCase()}`,
          desc: 'Open direct in de Verkenner',
        };
      }
    }

    // ECLI-code
    const ecliMatch = trimmed.match(/^ECLI:NL:[A-Z]+:\d+:\w+$/i);
    if (ecliMatch) {
      return {
        href: `/explore?focus=judgments%2F${encodeURIComponent(trimmed.toLowerCase())}&from=search`,
        label: trimmed.toUpperCase(),
        desc: 'Open arrest direct',
      };
    }

    // Dossier 12345
    const dosMatch = trimmed.match(/^(?:dossier\s+)?(\d{4,6})$/i);
    if (dosMatch) {
      return {
        href: `/explore?focus=dossiers%2F${dosMatch[1]}&from=search`,
        label: `Dossier ${dosMatch[1]}`,
        desc: 'Open dossier direct',
      };
    }

    return null;
  }

  const directHit = $derived<DirectHit | null>(directHitFor(query));

  $effect(() => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement;
      requestAnimationFrame(() => inputEl?.focus());
    } else {
      query = '';
      results = { ...EMPTY_RESULTS };
      focusedIndex = -1;
      previousFocus?.focus();
      previousFocus = null;
    }
  });

  $effect(() => {
    void flatItems;
    focusedIndex = -1;
  });

  // Reactive search:
  //   • short debounce (60ms) — typing barely waits before fetching
  //   • AbortController cancels the previous request the moment the user
  //     types a new character, so stale responses can't overwrite newer
  //     results
  //   • previous results stay on screen while a new request is in flight
  //     (no flash to empty); only `loading` flips to true so we can show
  //     a subtle indicator
  //   • on empty query, clear immediately and abort any in-flight call
  let debounceTimer: ReturnType<typeof setTimeout>;
  let inflightAbort: AbortController | null = null;
  $effect(() => {
    const q = query;
    clearTimeout(debounceTimer);
    inflightAbort?.abort();
    if (!q.trim()) {
      inflightAbort = null;
      loading = false;
      results = { ...EMPTY_RESULTS };
      return;
    }
    debounceTimer = setTimeout(async () => {
      const ctrl = new AbortController();
      inflightAbort = ctrl;
      loading = true;
      try {
        const r = await unifiedSearch(q, { limit: FETCH_LIMIT, signal: ctrl.signal });
        if (!ctrl.signal.aborted) {
          results = r;
          // Seed the instrument cache so article-group headings show full
          // names. Two passes:
          //   1. Instruments in the response carry full metadata — record
          //      them synchronously.
          //   2. Article bwb_ids that aren't in the cache yet get a
          //      background fetch via ensureInstrumentMeta. Once it resolves,
          //      articleGroups re-derives (reads $instrumentMetaStore).
          for (const inst of r.instruments) {
            const bwb = (inst.extra?.['bwb_id'] as string | undefined) ?? inst.key.toUpperCase();
            if (bwb) {
              recordInstrument({
                bwb_id: bwb,
                display_name: inst.display_name,
                title: inst.display_name,
                citation_title: (inst.extra?.['citation_title'] as string | undefined) ?? inst.display_name,
              });
            }
          }
          const seenBwbs = new Set<string>();
          for (const a of r.articles) {
            const bwb = String((a.extra?.['bwb_id'] as string | undefined)
              ?? a.key.match(/^([a-z]+\d+)/i)?.[1]
              ?? '').toUpperCase();
            if (bwb && !seenBwbs.has(bwb)) {
              seenBwbs.add(bwb);
              ensureInstrumentMeta(bwb);
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          if (!ctrl.signal.aborted) {
            results = { ...EMPTY_RESULTS };
          }
        }
      } finally {
        if (inflightAbort === ctrl) {
          inflightAbort = null;
          loading = false;
        }
      }
    }, 60);
    return () => {
      clearTimeout(debounceTimer);
      inflightAbort?.abort();
    };
  });

  function exploreHrefFor(item: SearchResultItem): string {
    // Picking a search result always opens the detail (split) view of that
    // item — the user's intent when they hit Enter on a result is "show me
    // this thing", not "stay in whatever mode I was in". The `from=search`
    // marker tells the explore page to clear the prior canvas before
    // expanding — search is an explicit jump, not an accumulation.
    return `/explore?mode=split&from=search&focus=${encodeURIComponent(`${item.collection}/${item.key}`)}`;
  }
  function itemHref(item: SearchResultItem): string {
    return exploreHrefFor(item);
  }

  function pick(item: SearchResultItem) {
    track('search_resolved', { type: item.collection });
    onClose();
    goto(itemHref(item));
  }

  function ecliLabel(item: SearchResultItem): string {
    const ecli = (item.extra?.['ecli'] as string | undefined) ?? item.display_name ?? item.key;
    try { return formatEcliLabel(ecli); } catch { return ecli; }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (open) trapFocus(e);
    if (e.key === 'Escape' && open) { onClose(); return; }
    if (!open || !hasResults) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusedIndex = Math.min(focusedIndex + 1, flatItems.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusedIndex = Math.max(focusedIndex - 1, -1);
      if (focusedIndex === -1) inputEl?.focus();
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      pick(flatItems[focusedIndex]);
    }
  }

  // Compute global focused-index offsets so keyboard nav works across the
  // grouped sections — must mirror the order in `flatItems` exactly.
  function offsetWet(): number { return 0; }
  function offsetArticles(): number { return showWet ? vis.instruments.length : 0; }
  function offsetRecht(): number { return wetCount * (showWet ? 1 : 0); }
  function offsetDossiers(): number { return offsetRecht() + (showRecht ? vis.judgments.length : 0); }
  function offsetCommissies(): number { return offsetDossiers() + (showTk ? vis.dossiers.length : 0); }
  function offsetFracties(): number { return offsetCommissies() + (showTk ? vis.commissies.length : 0); }
  function offsetLeden(): number { return offsetFracties() + (showTk ? vis.fracties.length : 0); }
  function offsetPublications(): number { return offsetLeden() + (showTk ? vis.leden.length : 0); }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
    <div class="overlay" onclick={onClose}>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Zoeken" onclick={(e) => e.stopPropagation()} bind:this={modalEl}>
      <div class="input-row">
        {#if loading}
          <span class="search-spinner" aria-hidden="true"></span>
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="m20 20-3.5-3.5"/>
          </svg>
        {/if}
        <input
          bind:this={inputEl}
          bind:value={query}
          placeholder="Zoek een artikel, arrest of wet…"
          type="text"
          autocomplete="off"
          spellcheck="false"
        />
        <span class="kbd">esc</span>
      </div>

      {#if query.trim() && totalCount > 0}
        <div class="chip-row">
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
      {/if}

      <span class="sr-only" aria-live="polite" aria-atomic="true">{totalCount > 0 ? `${totalCount} resultaten` : ''}</span>
      <div class="results-list" aria-live="polite" aria-atomic="false">
        {#if !query.trim()}
          <div class="suggestions">
            <p class="suggestions__label">Veelgebruikte ingangen:</p>
            {#each SUGGESTIONS as s, i (i)}
              <a
                class="suggestion-row"
                href={s.href}
                onclick={() => { track('search_suggestion_pick', { query: s.query }); onClose(); }}
              >
                <span class="suggestion__label">{s.label}</span>
                <span class="suggestion__desc">{s.desc}</span>
              </a>
            {/each}
          </div>

        {:else if loading && totalCount === 0}
          {#if directHit}
            <a class="direct-hit" href={directHit.href} onclick={() => { track('search_direct_pick', { query }); onClose(); }}>
              <span class="direct-hit__icon" aria-hidden="true">↳</span>
              <span class="direct-hit__label">{directHit.label}</span>
              <span class="direct-hit__desc">{directHit.desc}</span>
            </a>
          {/if}
          <div class="group-label">Zoeken…</div>
        {:else if totalCount === 0}
          {#if directHit}
            <a class="direct-hit" href={directHit.href} onclick={() => { track('search_direct_pick', { query }); onClose(); }}>
              <span class="direct-hit__icon" aria-hidden="true">↳</span>
              <span class="direct-hit__label">{directHit.label}</span>
              <span class="direct-hit__desc">{directHit.desc}</span>
            </a>
          {:else}
            <div class="empty">Geen resultaten voor <strong>"{query}"</strong>.</div>
            <p class="no-results-hint">Probeer een ECLI-nummer (ECLI:NL:HR:…), BWB-code (BWBR…) of trefwoord. Kamerleden: <a href="/explore?mode=index&kind=leden" onclick={onClose} class="leden-hint-link">index →</a></p>
          {/if}
        {:else}
          {#if directHit}
            <a class="direct-hit" href={directHit.href} onclick={() => { track('search_direct_pick', { query }); onClose(); }}>
              <span class="direct-hit__icon" aria-hidden="true">↳</span>
              <span class="direct-hit__label">{directHit.label}</span>
              <span class="direct-hit__desc">{directHit.desc}</span>
            </a>
          {/if}

          <!-- ── Wetgeving ───────────────────────────────────────────────── -->
          {#if showWet && wetCount > 0}
            <div class="domain domain--wet">
              <div class="domain__head"><span class="domain__glyph">§</span><span class="domain__title">Wetgeving</span></div>

              {#if vis.instruments.length > 0}
                <div class="subgroup-label">Instrumenten</div>
                {#each vis.instruments as item, i (item.id)}
                  {@const idx = offsetWet() + i}
                  <button class="result-row" class:result-row--focused={idx === focusedIndex} onclick={() => pick(item)} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--wet" aria-hidden="true">Wet.</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                    <span class="result-cite mono">{(item.extra?.['bwb_id'] as string | undefined) ?? item.key}</span>
                  </button>
                {/each}
                {#if moreOf('instruments') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#instruments" onclick={onClose}>{moreLabel(moreOf('instruments'))} instrumenten →</a>
                {/if}
              {/if}

              {#if articleGroups.length > 0}
                {#each articleGroups as g (g.bwbId)}
                  <div class="subgroup-label subgroup-label--law">{g.lawName} <span>{g.items.length}</span></div>
                  {#each g.items as item (item.id)}
                    {@const idxAbs = offsetArticles() + vis.articles.indexOf(item)}
                    <button class="result-row" class:result-row--focused={idxAbs === focusedIndex} onclick={() => pick(item)} onmouseenter={() => (focusedIndex = idxAbs)}>
                      <span class="leg-glyph leg-glyph--wet" aria-hidden="true">Art.</span>
                      <span class="result-title">{item.display_name ?? item.key}</span>
                      <span class="result-cite mono">{(item.extra?.['article_number'] as string | undefined) ?? ''}</span>
                    </button>
                  {/each}
                {/each}
                {#if moreOf('articles') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#articles" onclick={onClose}>{moreLabel(moreOf('articles'))} wetsartikelen →</a>
                {/if}
              {/if}
            </div>
          {/if}

          <!-- ── Rechtspraak ─────────────────────────────────────────────── -->
          {#if showRecht && rechtCount > 0}
            <div class="domain domain--recht">
              <div class="domain__head"><span class="domain__glyph">¶</span><span class="domain__title">Rechtspraak</span></div>

              {#each judgmentGroups as g (g.tier)}
                <div class="subgroup-label">{g.label} <span>{g.items.length}</span></div>
                {#each g.items as item (item.id)}
                  {@const idxAbs = offsetRecht() + vis.judgments.indexOf(item)}
                  <button class="result-row" class:result-row--focused={idxAbs === focusedIndex} onclick={() => pick(item)} onmouseenter={() => (focusedIndex = idxAbs)}>
                    <span class="leg-glyph leg-glyph--recht" aria-hidden="true">Arr.</span>
                    <span class="result-title">{ecliLabel(item)}</span>
                    <span class="result-cite mono">{(item.extra?.['ecli'] as string | undefined) ?? ''}</span>
                  </button>
                {/each}
              {/each}
              {#if moreOf('judgments') !== 0}
                <a class="more-row" href="/search?q={encodeURIComponent(query)}#judgments" onclick={onClose}>{moreLabel(moreOf('judgments'))} uitspraken →</a>
              {/if}
            </div>
          {/if}

          <!-- ── Parlementair ────────────────────────────────────────────── -->
          {#if showTk && tkCount > 0}
            <div class="domain domain--tk">
              <div class="domain__head"><span class="domain__glyph">∮</span><span class="domain__title">Parlementair</span></div>

              {#if vis.dossiers.length > 0}
                <div class="subgroup-label">Wetgevingsdossiers</div>
                {#each vis.dossiers as item, i (item.id)}
                  {@const idx = offsetDossiers() + i}
                  {@const num = (item.extra?.['kamerstuknummer'] as string | undefined) ?? item.key}
                  <a href={exploreHrefFor(item)} class="result-row result-row--link" class:result-row--focused={idx === focusedIndex} onclick={onClose} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--tk" aria-hidden="true">Dos.</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                    <span class="result-cite mono">{num}</span>
                  </a>
                {/each}
                {#if moreOf('dossiers') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#dossiers" onclick={onClose}>{moreLabel(moreOf('dossiers'))} dossiers →</a>
                {/if}
              {/if}

              {#if vis.commissies.length > 0}
                <div class="subgroup-label">Commissies</div>
                {#each vis.commissies as item, i (item.id)}
                  {@const idx = offsetCommissies() + i}
                  <a href={exploreHrefFor(item)} class="result-row result-row--link" class:result-row--focused={idx === focusedIndex} onclick={onClose} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--tk" aria-hidden="true">Com.</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                  </a>
                {/each}
                {#if moreOf('commissies') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#commissies" onclick={onClose}>{moreLabel(moreOf('commissies'))} commissies →</a>
                {/if}
              {/if}

              {#if vis.fracties.length > 0}
                <div class="subgroup-label">Fracties</div>
                {#each vis.fracties as item, i (item.id)}
                  {@const idx = offsetFracties() + i}
                  <a href={exploreHrefFor(item)} class="result-row result-row--link" class:result-row--focused={idx === focusedIndex} onclick={onClose} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--tk" aria-hidden="true">Fra.</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                  </a>
                {/each}
                {#if moreOf('fracties') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#fracties" onclick={onClose}>{moreLabel(moreOf('fracties'))} fracties →</a>
                {/if}
              {/if}

              {#if vis.leden.length > 0}
                <div class="subgroup-label">Kamerleden</div>
                {#each vis.leden as item, i (item.id)}
                  {@const idx = offsetLeden() + i}
                  <a href={exploreHrefFor(item)} class="result-row result-row--link" class:result-row--focused={idx === focusedIndex} onclick={onClose} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--tk" aria-hidden="true">Lid</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                    {#if item.extra?.['partij']}
                      <span class="result-cite mono">{item.extra['partij']}</span>
                    {/if}
                  </a>
                {/each}
                {#if moreOf('leden') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#leden" onclick={onClose}>{moreLabel(moreOf('leden'))} kamerleden →</a>
                {/if}
              {/if}

              {#if vis.publications.length > 0}
                <div class="subgroup-label">Publicaties</div>
                {#each vis.publications as item, i (item.id)}
                  {@const idx = offsetPublications() + i}
                  <a href={exploreHrefFor(item)} class="result-row result-row--link" class:result-row--focused={idx === focusedIndex} onclick={onClose} onmouseenter={() => (focusedIndex = idx)}>
                    <span class="leg-glyph leg-glyph--tk" aria-hidden="true">Pub.</span>
                    <span class="result-title">{item.display_name ?? item.key}</span>
                  </a>
                {/each}
                {#if moreOf('publications') !== 0}
                  <a class="more-row" href="/search?q={encodeURIComponent(query)}#publications" onclick={onClose}>{moreLabel(moreOf('publications'))} publicaties →</a>
                {/if}
              {/if}
            </div>
          {/if}

          <div class="results-footer">
            <a href="/search?q={encodeURIComponent(query)}" onclick={onClose} class="more-link">
              Alle resultaten voor "{query}" →
            </a>
            <a href="/explore?mode=index&kind=leden" onclick={onClose} class="more-link">
              Zoek kamerleden →
            </a>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(26, 24, 20, 0.18);
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 96px;
    z-index: var(--z-modal);
  }

  .modal {
    width: 640px;
    max-width: calc(100% - 48px);
    background: var(--paper);
    border: 1px solid var(--rule);
    border-radius: var(--r-2);
    box-shadow: var(--shadow-modal);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 160px);
  }

  .input-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 18px;
    border-bottom: 1px solid var(--rule);
    color: var(--fg-3);
  }
  .input-row input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    font-family: var(--font-serif);
    font-size: 19px;
    color: var(--ink);
  }
  .input-row input::placeholder { color: var(--fg-4); font-style: italic; }
  .kbd {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
    border: 1px solid var(--rule);
    padding: 1px 6px;
    border-radius: var(--r-1);
  }

  /* Inline loading spinner — replaces the search icon while a request is in
     flight. Same footprint, no layout shift; signals "still working" without
     blanking out the previous results below. */
  .search-spinner {
    width: 14px;
    height: 14px;
    border: 1.5px solid var(--rule-strong);
    border-top-color: var(--ink-3);
    border-radius: 50%;
    display: inline-block;
    animation: search-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes search-spin { to { transform: rotate(360deg); } }

  /* ── Domain filter chips ─────────────────────────────────────────────── */
  .chip-row {
    display: flex;
    gap: 6px;
    padding: 8px 18px;
    border-bottom: 1px solid var(--rule);
    flex-wrap: wrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid var(--rule-strong);
    background: var(--paper);
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-2);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease), opacity var(--dur-1) var(--ease);
  }
  .chip__glyph {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 13px;
    line-height: 1;
  }
  .chip__count {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--fg-3);
  }
  .chip:hover { background: var(--paper-3); }
  .chip--wet   .chip__glyph { color: var(--ink); }
  .chip--recht .chip__glyph { color: var(--indigo); }
  .chip--tk    .chip__glyph { color: var(--spine); }
  .chip--off { opacity: 0.45; text-decoration: line-through; }
  .chip--off .chip__glyph { color: var(--ink-4); }

  /* ── Results list ────────────────────────────────────────────────────── */
  .results-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0 0;
  }

  .domain { padding: 6px 0; }
  .domain + .domain { border-top: 1px solid var(--rule); margin-top: 4px; }
  .domain__head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 18px 4px;
  }
  .domain__glyph {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 18px;
    line-height: 1;
  }
  .domain--wet   .domain__glyph { color: var(--ink); }
  .domain--recht .domain__glyph { color: var(--indigo); }
  .domain--tk    .domain__glyph { color: var(--spine); }
  .domain__title {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 14px;
    color: var(--ink);
  }

  .group-label,
  .subgroup-label {
    font-family: var(--font-sans);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--fg-4);
    padding: 8px 18px 4px;
  }
  .subgroup-label--law {
    text-transform: none;
    letter-spacing: 0;
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 12px;
    color: var(--fg-3);
    padding: 6px 18px 2px;
  }
  .subgroup-label span {
    font-family: var(--font-mono);
    font-weight: 400;
    color: var(--fg-4);
    margin-left: 4px;
  }

  .result-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 7px 18px;
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-serif);
    font-size: 15px;
    color: var(--ink);
    transition: background var(--dur-1) var(--ease);
  }
  .result-row--link { text-decoration: none; color: inherit; }
  .result-row:hover,
  .result-row--focused { background: var(--paper-2); }

  .leg-glyph {
    font-family: var(--font-mono);
    font-style: normal;
    font-size: 9px;
    font-weight: 600;
    line-height: 1;
    width: auto;
    min-width: 22px;
    text-align: right;
    flex-shrink: 0;
    letter-spacing: 0.01em;
  }
  .leg-glyph--wet   { color: var(--ink); }
  .leg-glyph--recht { color: var(--indigo); }
  .leg-glyph--tk    { color: var(--spine); }

  .result-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .result-cite {
    font-size: 11px;
    color: var(--fg-3);
    white-space: nowrap;
    flex-shrink: 0;
  }
  .mono { font-family: var(--font-mono); }

  .empty {
    font-family: var(--font-serif);
    font-style: italic;
    color: var(--fg-3);
    padding: 20px 18px;
  }

  .suggestions {
    padding: 14px 18px 8px;
  }

  .suggestions__label {
    margin: 0 0 10px;
    font-family: var(--font-sans);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--fg-3);
  }

  .suggestion-row {
    display: flex;
    align-items: baseline;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    background: none;
    border: none;
    border-radius: var(--r-1, 2px);
    cursor: pointer;
    text-align: left;
    text-decoration: none;
    color: inherit;
    transition: background var(--dur-1) var(--ease);
  }

  /* Direct-hit boven de fuzzy resultaten: bewaakt dat patronen als
     "Art. 6:162 BW" altijd als eerste optie verschijnen, ook al rankt
     het search-endpoint EU-richtlijnen hoger. */
  .direct-hit {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 10px 12px;
    margin: 4px 0 8px;
    background: var(--paper-2);
    border: 1px solid var(--accent);
    border-radius: var(--r-1, 2px);
    text-decoration: none;
    color: inherit;
    transition: background var(--dur-1) var(--ease);
  }
  .direct-hit:hover {
    background: var(--accent);
    color: var(--paper);
  }
  .direct-hit:hover .direct-hit__desc { color: var(--paper-2); }
  .direct-hit__icon {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--accent);
    flex-shrink: 0;
  }
  .direct-hit:hover .direct-hit__icon { color: var(--paper); }
  .direct-hit__label {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--ink);
    flex-shrink: 0;
  }
  .direct-hit:hover .direct-hit__label { color: var(--paper); }
  .direct-hit__desc {
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--fg-2);
    flex: 1;
    text-align: right;
  }

  .suggestion-row:hover {
    background: var(--paper-2);
  }

  .suggestion__label {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--ink);
    flex-shrink: 0;
  }

  .suggestion__desc {
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--fg-3);
    font-style: italic;
  }

  .results-footer {
    border-top: 1px solid var(--rule);
    padding: 10px 18px;
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .more-link {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--fg-3);
    text-decoration: none;
  }
  .more-link:hover { color: var(--ink); text-decoration: underline; }

  /* "+ N more →" row appended to a subgroup that's been capped. Sits flush
     with the result rows so it reads as an extension of the group, not a
     separate section. Click deep-links into /search anchored to the type. */
  .more-row {
    display: block;
    padding: 6px 18px 8px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--fg-3);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .more-row:hover { color: var(--ink); background: var(--paper-2); }

  .no-results-hint {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 12px;
    color: var(--ink-4);
    padding: 0 18px;
    margin: var(--s-2) 0 0;
  }
  .leden-hint-link {
    color: var(--fg-3);
    text-decoration: none;
  }
  .leden-hint-link:hover {
    color: var(--ink);
    text-decoration: underline;
  }
</style>
