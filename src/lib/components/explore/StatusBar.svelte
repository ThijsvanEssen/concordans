<script lang="ts">
  import type { GraphNode } from '$lib/graph/types';
  import { instrumentMetaStore, type InstrumentMeta } from '$lib/api/instrument-cache';

  let {
    node,
    focusError = null,
    loadingCommissies = false,
    canGoBack = false,
    canGoForward = false,
    mode = 'graph',
    indexCategory = null,
    indexResultCount = null,
    shareCopied = false,
    onGoBack,
    onGoForward,
    onLoadCommissies,
    onModeChange,
    onShareView,
  }: {
    node: GraphNode | null;
    focusError?: string | null;
    loadingCommissies?: boolean;
    canGoBack?: boolean;
    canGoForward?: boolean;
    mode?: string;
    /** When mode === 'index', the active category key (dossiers, wetten, …).
     *  Used to drive the breadcrumb tail. */
    indexCategory?: string | null;
    /** When mode === 'index', the filtered count / total. Rendered as
     *  "100 van 448" in the breadcrumb area. */
    indexResultCount?: { filtered: number; total: number } | null;
    shareCopied?: boolean;
    onGoBack?: () => void;
    onGoForward?: () => void;
    onLoadCommissies?: () => void;
    onModeChange?: (mode: string) => void;
    onShareView?: () => void;
  } = $props();

  const INDEX_CAT_LABEL: Record<string, string> = {
    wetten: 'Wetten',
    arresten: 'Arresten',
    dossiers: 'Dossiers',
    commissies: 'Commissies',
    leden: 'Kamerleden',
    fracties: 'Fracties',
    stemmingen: 'Stemmingen',
  };

  // §28 — overflow menu state. Closes on Escape and on outside-click via the
  // window listeners below.
  let overflowOpen = $state(false);
  function handleWindowClick(e: MouseEvent) {
    if (!overflowOpen) return;
    const target = e.target as Node | null;
    const root = (document.querySelector('.status-overflow') as HTMLElement | null) ?? null;
    if (root && target && !root.contains(target)) overflowOpen = false;
  }
  function handleWindowKey(e: KeyboardEvent) {
    if (overflowOpen && e.key === 'Escape') overflowOpen = false;
  }

  // Citation copy: build a Dutch-style citation string for the current node.
  let citeCopied = $state(false);
  async function copyCitation() {
    if (!node) return;
    const segs = breadcrumbSegs.map((s) => s.text);
    let text = segs.join(' › ');
    if (node.collection === 'judgments') {
      const ecli = String((node.raw?.props as Record<string, unknown> | undefined)?.['ecli'] ?? node.key);
      text = `${segs.join(', ')} (${ecli})`;
    } else if (node.collection === 'instrument_articles') {
      // "Artikel N <Wet>" — flip last seg first.
      if (segs.length >= 2) {
        const art = segs[segs.length - 1];
        const wet = segs.slice(0, -1).join(' › ');
        text = `${art} ${wet}`;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      citeCopied = true;
      setTimeout(() => { citeCopied = false; }, 1600);
    } catch { /* ignore */ }
  }

  const nodeProps = $derived((node?.raw?.props ?? {}) as Record<string, unknown>);

  const bwbId = $derived(
    node?.collection === 'instrument_articles'
      ? (String(nodeProps['bwb_id'] ?? '') || null)
      : null
  );

  // Full path breadcrumb: {Citation title} > Boek > Titeldeel > ... > Art. N.
  // Reads the friendly law name from the shared instrument cache (filled
  // anywhere we touch /api/instruments/.../graph or .../reader). Falls back
  // gracefully when the cache hasn't seen the law yet.
  type BreadcrumbSeg = { type?: string; label?: string };
  const meta = $derived<InstrumentMeta | null>(
    bwbId ? ($instrumentMetaStore.get(bwbId) ?? null) : null
  );
  const breadcrumbSegs = $derived.by<{ kind: 'meta' | 'art'; text: string }[]>(() => {
    if (!node) return [];

    const segs: { kind: 'meta' | 'art'; text: string }[] = [];
    if (node.collection === 'instrument_articles') {
      const lawName =
        meta?.citationTitle ??
        meta?.title ??
        meta?.shortTitle ??
        (typeof nodeProps['instrument_citation_title'] === 'string' ? (nodeProps['instrument_citation_title'] as string) : null) ??
        (typeof nodeProps['instrument_title'] === 'string' ? (nodeProps['instrument_title'] as string) : null) ??
        bwbId;
      if (lawName) segs.push({ kind: 'meta', text: lawName });

      const bc = (nodeProps['breadcrumb'] as BreadcrumbSeg[] | undefined) ?? [];
      for (const seg of bc) {
        if (seg?.label) segs.push({ kind: 'meta', text: seg.label });
      }

      const art = String(nodeProps['article_number'] ?? '');
      if (art) segs.push({ kind: 'art', text: `Art. ${art}` });
      return segs;
    }

    if (node.collection === 'judgments') {
      const meta = nodeProps['judgment_metadata'] as Record<string, string> | undefined;
      const court = meta?.['court'] ?? null;
      const dateRaw = meta?.['date'] ?? null;

      if (court) {
        segs.push({ kind: 'meta', text: court });
      } else {
        // Fall back to court code extracted from ECLI
        const ecli = String(nodeProps['ecli'] ?? node.key ?? '');
        const m = ecli.match(/(?:ECLI:)?(?:NL:)?([^:]+):(\d{4})/);
        if (m) segs.push({ kind: 'meta', text: m[1] });
      }

      if (dateRaw) {
        // Format "2014-09-09" → "9 sep 2014"
        const d = new Date(dateRaw);
        const formatted = d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
        segs.push({ kind: 'art', text: formatted });
      }

      return segs;
    }

    if (node.collection === 'dossiers') {
      segs.push({ kind: 'meta', text: 'Dossier' });
      const nummer = String(nodeProps['kamerstuknummer'] ?? node.key);
      segs.push({ kind: 'art', text: nummer });
      return segs;
    }

    if (node.collection === 'commissies') {
      segs.push({ kind: 'meta', text: 'Commissie' });
      const naam = String(nodeProps['naam'] ?? nodeProps['afkorting'] ?? node.label ?? node.key);
      segs.push({ kind: 'art', text: naam });
      return segs;
    }

    if (node.collection === 'leden' || node.collection === 'kamerleden') {
      const partij = nodeProps['partij'] as string | null | undefined;
      segs.push({ kind: 'meta', text: partij ? `Kamerlid · ${partij}` : 'Kamerlid' });
      const naam = String(nodeProps['naam'] ?? node.label ?? node.key);
      segs.push({ kind: 'art', text: naam });
      return segs;
    }

    if (node.collection === 'fracties') {
      segs.push({ kind: 'meta', text: 'Fractie' });
      const label = String(nodeProps['afkorting'] ?? nodeProps['naam'] ?? node.label ?? node.key);
      segs.push({ kind: 'art', text: label });
      return segs;
    }

    return [];
  });

  // Title only when it adds something the breadcrumb path doesn't already say.
  const title = $derived.by(() => {
    const t = node?.label ?? null;
    if (!t) return null;
    const lastSeg = breadcrumbSegs.at(-1)?.text ?? '';
    if (lastSeg === t || lastSeg.endsWith(t)) return null;
    return t;
  });

  const validFrom = $derived.by(() => {
    const v = nodeProps['valid_from'] ?? nodeProps['geldig_vanaf'] ?? nodeProps['date'] ?? nodeProps['datum'];
    if (!v) return null;
    const s = String(v);
    if (!s.match(/^\d{4}-\d{2}-\d{2}/)) return s;
    const d = new Date(s.slice(0, 10));
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  });
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKey} />

<div class="status-bar" class:has-node={!!node}>
  <div class="status-history">
    <button
      type="button"
      class="status-hist-btn"
      disabled={!canGoBack}
      onclick={onGoBack}
      title="Vorige bron (←)"
      aria-label="Vorige bron"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.5 2L3.5 6l4 4"/>
      </svg>
    </button>
    <button
      type="button"
      class="status-hist-btn"
      disabled={!canGoForward}
      onclick={onGoForward}
      title="Volgende bron (→)"
      aria-label="Volgende bron"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4.5 2l4 4-4 4"/>
      </svg>
    </button>
  </div>

  {#if mode === 'index'}
    <div class="status-path">
      <span class="status-meta">Index</span>
      {#if indexCategory && INDEX_CAT_LABEL[indexCategory]}
        <span class="status-sep" aria-hidden="true">›</span>
        <span class="status-art">{INDEX_CAT_LABEL[indexCategory]}</span>
      {/if}
    </div>
    {#if indexResultCount}
      <div class="status-right">
        <span class="status-count">
          {indexResultCount.filtered.toLocaleString('nl-NL')}
          <span class="status-count-of">van {indexResultCount.total.toLocaleString('nl-NL')}</span>
        </span>
      </div>
    {/if}
  {:else if node}
    <div class="status-path">
      {#each breadcrumbSegs as seg, i (i)}
        {#if i > 0}
          <span class="status-sep" aria-hidden="true">›</span>
        {/if}
        <span class="status-{seg.kind}" title={seg.text}>{seg.text}</span>
      {/each}
      {#if title}
        <span class="status-sep" aria-hidden="true">·</span>
        <span class="status-title" title={title}>{title}</span>
      {/if}
    </div>

    <div class="status-right">
      {#if node.collection === 'commissies' && onLoadCommissies}
        <button
          type="button"
          class="status-action"
          class:status-action--loading={loadingCommissies}
          disabled={loadingCommissies}
          onclick={onLoadCommissies}
          title="Terug naar overzicht alle commissies"
        >{loadingCommissies ? 'Laden…' : '← Alle commissies'}</button>
      {/if}
      {#if validFrom}
        <span class="status-valid">
          <span class="status-valid-bar" aria-hidden="true"></span>
          Geldig {validFrom}
        </span>
      {:else if node.collection === 'instrument_articles'}
        <span class="status-kind">Artikel</span>
      {:else if node.collection === 'judgments'}
        <span class="status-kind">Arrest</span>
      {:else if node.collection === 'dossiers'}
        <span class="status-kind">Dossier</span>
      {:else if node.collection === 'commissies'}
        <span class="status-kind">Commissie</span>
      {:else if node.collection === 'leden' || node.collection === 'kamerleden'}
        <span class="status-kind">Kamerlid</span>
      {:else if node.collection === 'fracties'}
        <span class="status-kind">Fractie</span>
      {/if}
    </div>
  {:else if focusError}
    <div class="status-error">
      <span class="status-error-icon" aria-hidden="true">⚠</span>
      {focusError}
    </div>
  {/if}

  <!-- §28 — Share: always visible. Citation: in … overflow. -->
  {#if onShareView}
    <button
      type="button"
      class="status-share-btn"
      onclick={onShareView}
      title="Kopieer link naar deze weergave"
    >{shareCopied ? '✓ Link gekopieerd' : '↗ Deel'}</button>
  {/if}
  {#if node}
    <div class="status-overflow" class:is-open={overflowOpen}>
      <button
        type="button"
        class="status-overflow-btn"
        aria-haspopup="menu"
        aria-expanded={overflowOpen}
        aria-label="Meer acties"
        title="Meer acties (kopieer citatie, …)"
        onclick={() => (overflowOpen = !overflowOpen)}
      >⋯</button>
      {#if overflowOpen}
        <div class="status-overflow-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            class="status-overflow-item"
            onclick={() => { copyCitation(); overflowOpen = false; }}
          >{citeCopied ? '✓ Gekopieerd' : 'Kopieer citatie'}</button>
        </div>
      {/if}
    </div>
  {/if}

  {#if mode !== 'index'}
  <div class="mode-toggle" role="tablist" aria-label="Weergavemodus">
    <button
      role="tab"
      aria-selected={mode === 'graph'}
      class="mode-btn"
      class:active={mode === 'graph'}
      onclick={() => onModeChange?.('graph')}
      title="Ontdekken (toets 1) — verken verbindingen in het netwerk"
    >Ontdekken<kbd class="mode-kbd">1</kbd></button>
    {#if node}
      <button
        role="tab"
        aria-selected={mode === 'split'}
        class="mode-btn"
        class:active={mode === 'split'}
        title="Verdiepen (toets 2) — netwerk naast de volledige tekst"
        onclick={() => onModeChange?.('split')}
      >Verdiepen<kbd class="mode-kbd">2</kbd></button>
      <button
        role="tab"
        aria-selected={mode === 'read'}
        class="mode-btn"
        class:active={mode === 'read'}
        title="Lezen (toets 3) — volledig document met citaat-rail"
        onclick={() => onModeChange?.('read')}
      >Lezen<kbd class="mode-kbd">3</kbd></button>
    {/if}
  </div>
  {/if}
</div>

<style>
  .status-bar {
    height: 36px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--s-4) 0 var(--s-3);
    background: var(--paper-2);
    border-bottom: 1px solid var(--rule);
    /* No overflow:hidden — that would clip the … overflow menu behind
       the canvas. Inner spans handle their own ellipsis. */
    gap: var(--s-2);
    position: relative;
    z-index: var(--z-topbar, 100);
  }

  .status-history {
    display: flex;
    gap: 0;
    flex-shrink: 0;
  }

  .status-hist-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-3);
    cursor: pointer;
    padding: 0;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease);
  }

  .status-hist-btn:hover:not(:disabled) {
    background: var(--paper-3);
    color: var(--ink);
    border-color: var(--ink-3);
  }

  .status-hist-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .status-share-btn {
    flex-shrink: 0;
    font-family: var(--font-sans);
    font-size: 11px;
    padding: 3px 9px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-2);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }
  .status-share-btn:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .status-path {
    display: flex;
    align-items: baseline;
    gap: 8px;
    overflow: hidden;
    min-width: 0;
    flex: 1;
  }

  .status-meta {
    font-family: var(--font-serif);
    font-size: 13px;
    color: var(--ink-3);
    white-space: nowrap;
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 40px;
  }

  .status-art {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink);
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .status-sep {
    color: var(--ink-4);
    font-size: 12px;
    flex-shrink: 0;
  }

  .status-title {
    font-family: var(--font-serif);
    font-size: 14px;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 48px;
  }

  .status-right {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: var(--s-3);
  }

  /* Index-modus: gefilterde/totaal in de subbar. */
  .status-count {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--ink-2);
  }
  .status-count-of {
    color: var(--fg-4);
  }

  .status-action {
    font-family: var(--font-sans);
    font-size: 11px;
    letter-spacing: 0.04em;
    padding: 3px 10px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-2);
    cursor: pointer;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }

  .status-action:hover {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .status-valid {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--positive);
    white-space: nowrap;
  }

  .status-valid-bar {
    width: 3px;
    height: 12px;
    border-radius: 2px;
    background: var(--positive);
    flex-shrink: 0;
  }

  .status-kind {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-4);
    white-space: nowrap;
  }

  .status-action--loading {
    opacity: 0.7;
    cursor: wait;
  }

  .status-overflow {
    position: relative;
    margin-left: auto;
    flex-shrink: 0;
  }
  .status-overflow-btn {
    width: 24px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    color: var(--ink-3);
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }
  .status-overflow.is-open .status-overflow-btn,
  .status-overflow-btn:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }

  .status-overflow-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 1000;
    min-width: 140px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    box-shadow: 0 4px 16px rgba(20, 18, 14, 0.08);
    display: flex;
    flex-direction: column;
    padding: 4px;
    gap: 2px;
  }
  .status-overflow-item {
    text-align: left;
    padding: 5px 10px;
    background: none;
    border: none;
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--ink-2);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }
  .status-overflow-item:hover { background: var(--ink); color: var(--paper); }

  .status-empty-hint {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-4);
    font-style: italic;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mode-toggle {
    display: flex;
    gap: 0;
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    overflow: hidden;
    flex-shrink: 0;
    margin-left: var(--s-3);
    border-left-width: 1px;
  }

  .mode-btn {
    font-family: var(--font-sans);
    font-size: 11px;
    padding: 3px 8px;
    background: var(--paper);
    color: var(--ink-3);
    border: none;
    border-right: 1px solid var(--rule-strong);
    cursor: pointer;
    line-height: 1.4;
  }

  .mode-btn:last-child { border-right: none; }

  .mode-btn.active {
    background: var(--ink);
    color: var(--paper);
    font-weight: 500;
  }

  .mode-btn:hover:not(.active):not(:disabled) {
    background: var(--paper-2);
    color: var(--ink);
  }
  .mode-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .mode-kbd {
    font-family: var(--font-mono);
    font-size: 9px;
    margin-left: 6px;
    padding: 1px 4px;
    border-radius: 2px;
    background: color-mix(in srgb, currentColor 12%, transparent);
    color: inherit;
    opacity: 0.7;
  }
  .mode-btn.active .mode-kbd { opacity: 0.85; }

  .status-error {
    display: flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--accent);
  }

  .status-error-icon {
    font-size: 13px;
    flex-shrink: 0;
  }

</style>
