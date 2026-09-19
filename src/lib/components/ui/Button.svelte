<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    href,
    type = 'button',
    title,
    onclick
  }: {
    children?: Snippet;
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    title?: string;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

{#if href}
  <a {href} class="btn btn--{variant} btn--{size}" aria-disabled={disabled} {title}>
    {@render children?.()}
  </a>
{:else}
  <button {type} {disabled} class="btn btn--{variant} btn--{size}" {title} {onclick}>
    {@render children?.()}
  </button>
{/if}

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid transparent;
    transition: background 120ms, border-color 120ms, color 120ms, opacity 120ms;
    white-space: nowrap;
  }

  .btn:disabled,
  .btn[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* Sizes */
  .btn--sm {
    font-size: var(--text-sm);
    padding: 0.3rem 0.75rem;
    height: 32px;
  }

  .btn--md {
    font-size: var(--text-base);
    padding: 0.45rem 1rem;
    height: 40px;
  }

  .btn--lg {
    font-size: var(--text-lg);
    padding: 0.6rem 1.4rem;
    height: 48px;
  }

  /* Variants */
  .btn--primary {
    background: var(--accent);
    color: var(--paper);
    border-color: var(--accent);
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }

  .btn--secondary {
    background: var(--surface);
    color: var(--accent);
    border-color: var(--border-strong);
  }

  .btn--secondary:hover:not(:disabled) {
    background: var(--accent-soft);
    border-color: var(--accent);
  }

  .btn--ghost {
    background: transparent;
    color: var(--ink-secondary);
    border-color: transparent;
  }

  .btn--ghost:hover:not(:disabled) {
    background: var(--accent-soft);
    color: var(--accent);
  }

  .btn--danger {
    background: var(--error-bg);
    color: var(--error-fg);
    border-color: var(--error-border);
  }

  .btn--danger:hover:not(:disabled) {
    background: var(--spine-faint);
  }
</style>
