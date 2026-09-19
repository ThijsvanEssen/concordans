<script lang="ts">
  import type { ArticleSummary } from '$lib/api/types';
  import Badge from '$lib/components/ui/Badge.svelte';

  let {
    target,
    state: loadState = 'idle',
    article = null,
    depth = 1,
    maxDepth = 3,
    errorMessage,
    onRetry,
    expanded,
    onToggleExpanded
  }: {
    target: { bwb_id: string; article_number: string };
    state?: 'idle' | 'loading' | 'loaded' | 'error';
    article?: ArticleSummary | null;
    depth?: number;
    maxDepth?: number;
    errorMessage?: string;
    onRetry?: () => void;
    expanded?: boolean;
    onToggleExpanded?: () => void;
  } = $props();

  const title = $derived(article?.display_name ?? `Art. ${target.article_number}`);
  const routeHref = $derived(
    `/articles/${encodeURIComponent(target.bwb_id)}/${encodeURIComponent(target.article_number)}`
  );
  const rawText = $derived(article?.text ?? '');
  const SNIPPET = 480;
  const needsToggle = $derived(rawText.length > SNIPPET);

  let localExpanded = $state(false);
  const isExpanded = $derived(expanded ?? localExpanded);
  const displayText = $derived(isExpanded || !needsToggle ? rawText : rawText.slice(0, SNIPPET));

  function toggleExpansion() {
    if (expanded !== undefined) {
      onToggleExpanded?.();
    } else {
      localExpanded = !localExpanded;
    }
  }
</script>

<article class="ref-card" data-state={loadState}>
  <header class="ref-card__header">
    <div class="ref-card__title-group">
      <h3 class="ref-card__title">{title}</h3>
      <p class="ref-card__sub">
        <code class="ref-code">{target.bwb_id}</code>
        <a href={routeHref}>Bekijk artikel</a>
      </p>
    </div>
    <Badge variant="default">
      {depth <= maxDepth ? `Diepte ${depth}` : `Diepte ${maxDepth}+`}
    </Badge>
  </header>

  {#if loadState === 'loading'}
    <div class="ref-card__skeleton" aria-label="Laden…">
      <div class="skeleton-line"></div>
      <div class="skeleton-line skeleton-line--short"></div>
    </div>
  {:else if loadState === 'error'}
    <div class="ref-card__error">
      <p>Kon artikel niet laden.</p>
      {#if errorMessage}<p class="ref-card__error-detail">{errorMessage}</p>{/if}
      {#if onRetry}
        <button type="button" class="retry-btn" onclick={onRetry}>Opnieuw proberen</button>
      {/if}
    </div>
  {:else if loadState === 'loaded'}
    {#if rawText}
      <div class="ref-card__snippet">
        <p class="ref-card__text">{displayText}{!isExpanded && needsToggle ? '…' : ''}</p>
        {#if needsToggle}
          <button type="button" class="toggle-btn" onclick={toggleExpansion}>
            {isExpanded ? 'Toon minder' : 'Toon meer'}
          </button>
        {/if}
      </div>
    {:else}
      <p class="ref-card__empty">Geen tekst beschikbaar.</p>
    {/if}
  {/if}
</article>

<style>
  .ref-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: var(--space-2);
    background: var(--surface);
    box-shadow: var(--shadow-sm);
  }

  .ref-card__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .ref-card__title-group {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
  }

  .ref-card__title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--ink);
    line-height: var(--leading-tight);
  }

  .ref-card__sub {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--muted);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ref-code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--muted);
  }

  .ref-card__skeleton {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: var(--space-1) 0;
  }

  .skeleton-line {
    height: 14px;
    background: linear-gradient(90deg, var(--paper-3) 25%, var(--rule) 50%, var(--paper-3) 75%);
    background-size: 200% 100%;
    border-radius: 4px;
  }

  .skeleton-line--short {
    width: 60%;
  }

  @media (not (prefers-reduced-motion: reduce)) {
    .skeleton-line {
      animation: shimmer 1.4s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  }

  .ref-card__error {
    padding: var(--space-1);
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    color: var(--error-fg);
  }

  .ref-card__error-detail {
    margin: 0.25rem 0 0;
    font-size: var(--text-xs);
  }

  .retry-btn {
    margin-top: var(--space-1);
    background: none;
    border: 1px solid var(--error-border);
    border-radius: var(--radius-sm);
    color: var(--error-fg);
    cursor: pointer;
    font-size: var(--text-sm);
    padding: 0.25rem 0.6rem;
  }

  .ref-card__snippet {
    font-family: var(--font-serif);
    font-size: var(--text-sm);
    line-height: 1.7;
    color: var(--ink-secondary);
  }

  .ref-card__text {
    margin: 0;
  }

  .toggle-btn {
    margin-top: var(--space-1);
    background: none;
    border: none;
    color: var(--accent);
    font-size: var(--text-sm);
    cursor: pointer;
    padding: 0;
    text-decoration: underline;
  }

  .ref-card__empty {
    margin: 0;
    font-style: italic;
    color: var(--muted);
    font-size: var(--text-sm);
  }
</style>
