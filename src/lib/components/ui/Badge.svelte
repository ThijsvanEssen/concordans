<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    variant = 'default',
    dot = false
  }: {
    children?: Snippet;
    variant?: 'default' | 'accent' | 'citation' | 'success' | 'warning' | 'error' | 'node-article' | 'node-judgment' | 'node-instrument' | 'node-tkstuk';
    dot?: boolean;
  } = $props();
</script>

<span class="badge badge--{variant}">
  {#if dot}<span class="badge__dot"></span>{/if}
  {@render children?.()}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35em;
    font-size: var(--text-xs);
    font-family: var(--font-sans);
    font-weight: 500;
    border-radius: var(--radius-pill);
    padding: 0.15em 0.6em;
    border: 1px solid transparent;
    white-space: nowrap;
    line-height: 1.5;
  }

  .badge__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    flex-shrink: 0;
  }

  .badge--default {
    background: var(--paper-3);
    color: var(--ink-secondary);
    border-color: var(--rule);
  }

  .badge--accent {
    background: var(--accent-soft);
    color: var(--accent);
    border-color: var(--indigo-faint);
  }

  .badge--citation {
    background: var(--citation-bg);
    color: var(--citation-fg);
    border-color: var(--citation-border);
  }

  .badge--success {
    background: var(--moss-faint);
    color: var(--moss);
    border-color: var(--moss-faint);
  }

  .badge--warning {
    background: var(--ochre-faint);
    color: var(--ochre);
    border-color: var(--ochre-faint);
  }

  .badge--error {
    background: var(--error-bg);
    color: var(--error-fg);
    border-color: var(--error-border);
  }

  .badge--node-article {
    background: var(--indigo-faint);
    color: var(--node-article);
    border-color: var(--indigo-faint);
  }

  .badge--node-judgment {
    background: var(--citation-bg);
    color: var(--node-judgment);
    border-color: var(--citation-border);
  }

  .badge--node-instrument {
    background: var(--teal-faint);
    color: var(--node-instrument);
    border-color: var(--teal-faint);
  }

  .badge--node-tkstuk {
    background: var(--plum-faint);
    color: var(--node-tkstuk);
    border-color: var(--plum-faint);
  }
</style>
