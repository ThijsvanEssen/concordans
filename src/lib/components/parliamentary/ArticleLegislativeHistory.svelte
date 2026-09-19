<script lang="ts">
  import { fetchArticleLegislativeHistory } from '$lib/api/parliamentary-client';
  import type { LegislativeHistoryEntry } from '$lib/api/parliamentary';

  let {
    bwbId,
    articleNumber,
  }: {
    bwbId: string;
    articleNumber: string;
  } = $props();

  type LoadState =
    | { kind: 'idle' }
    | { kind: 'loading' }
    | { kind: 'loaded'; entries: LegislativeHistoryEntry[] }
    | { kind: 'error' }
    | { kind: 'empty' };

  let loadState = $state<LoadState>({ kind: 'idle' });
  let open = $state(false);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }


  async function load() {
    if (loadState.kind === 'loaded' || loadState.kind === 'loading') return;
    loadState = { kind: 'loading' };
    try {
      const res = await fetchArticleLegislativeHistory(bwbId, articleNumber);
      loadState = res.entries.length > 0
        ? { kind: 'loaded', entries: res.entries }
        : { kind: 'empty' };
    } catch {
      loadState = { kind: 'error' };
    }
  }

  function toggle() {
    open = !open;
    if (open && loadState.kind === 'idle') load();
  }
</script>

<div class="leg-history">
  <button
    type="button"
    class="leg-history-toggle"
    class:leg-history-toggle--open={open}
    onclick={toggle}
    aria-expanded={open}
  >
    <span class="toggle-label">Wetgevingsgeschiedenis</span>
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      class="toggle-chevron"
      aria-hidden="true"
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  {#if open}
    <div class="leg-history-body">
      {#if loadState.kind === 'loading'}
        <div class="lh-skeleton">
          <div class="sk-line"></div>
          <div class="sk-line sk-line--short"></div>
        </div>
      {:else if loadState.kind === 'error'}
        <p class="lh-empty">Kon geschiedenis niet laden.</p>
      {:else if loadState.kind === 'empty'}
        <p class="lh-empty">Geen wetgevingsgeschiedenis beschikbaar.</p>
      {:else if loadState.kind === 'loaded'}
        <ul class="lh-list">
          {#each loadState.entries as entry, i (entry.document_id ?? entry.dossier_id ?? i)}
            <li class="lh-item">
              <div class="lh-item-main">
                {#if entry.dossier_nummer}
                  <a href="/explore?focus=kamerstukdossiers/{entry.dossier_nummer}" class="lh-link">
                    <span class="lh-num">{entry.dossier_nummer}</span>
                    <span class="lh-title">{entry.dossier_titel ?? entry.samenvatting ?? entry.dossier_nummer}</span>
                  </a>
                {:else if entry.samenvatting}
                  <span class="lh-title lh-title--plain">{entry.samenvatting}</span>
                {/if}
              </div>
              <div class="lh-item-meta">
                {#if entry.datum}
                  <span class="lh-date">{formatDate(entry.datum)}</span>
                {/if}
                {#if entry.soort}
                  <span class="lh-soort">{entry.soort}</span>
                {/if}
                {#if entry.status === 'voorgesteld'}
                  <span class="lh-badge lh-badge--voorgesteld">Voorgesteld</span>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</div>

<style>
  .leg-history {
    border-top: 1px solid var(--rule);
  }

  .leg-history-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--s-3) var(--s-5);
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: background 80ms;
  }

  .leg-history-toggle:hover {
    background: var(--paper-2);
  }

  .toggle-label {
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    color: var(--ink-4);
  }

  .toggle-chevron {
    color: var(--ink-4);
    transition: transform 150ms;
  }

  .leg-history-toggle--open .toggle-chevron {
    transform: rotate(180deg);
  }

  .leg-history-body {
    padding: 0 var(--s-5) var(--s-4);
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .lh-empty {
    font-family: var(--font-serif);
    font-style: italic;
    font-size: var(--t-meta);
    color: var(--ink-4);
    margin: 0;
  }

  .lh-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
  }

  .lh-item {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .lh-item-main {
    display: flex;
    min-width: 0;
  }

  .lh-link {
    display: flex;
    align-items: flex-start;
    gap: var(--s-2);
    text-decoration: none;
    color: inherit;
    min-width: 0;
  }

  .lh-num {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--ink-3);
    flex-shrink: 0;
  }

  .lh-title {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-2);
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 80ms;
  }

  .lh-title--plain {
    color: var(--ink-3);
  }

  .lh-link:hover .lh-title {
    color: var(--spine);
  }

  .lh-item-meta {
    display: flex;
    align-items: center;
    gap: var(--s-2);
    flex-wrap: wrap;
  }

  .lh-date {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-4);
  }

  .lh-soort {
    font-family: var(--font-sans);
    font-size: 10px;
    color: var(--ink-4);
    font-style: italic;
  }

  .lh-badge {
    font-family: var(--font-sans);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
    padding: 1px 5px;
    border-radius: var(--r-1);
  }

  .lh-badge--voorgesteld {
    background: var(--spine-faint);
    color: var(--spine);
  }

  /* Skeleton */
  .lh-skeleton {
    display: flex;
    flex-direction: column;
    gap: var(--s-2);
    padding: var(--s-2) 0;
  }

  .sk-line {
    height: 10px;
    background: var(--rule);
    border-radius: 2px;
    animation: shimmer 1.2s infinite;
  }

  .sk-line--short { width: 60%; }

  @keyframes shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
</style>
