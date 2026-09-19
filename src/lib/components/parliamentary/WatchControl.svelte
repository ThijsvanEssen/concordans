<script lang="ts">
  import { addWatch, removeWatch, hasWatch } from '$lib/stores/watches';
  import type { WatchEntityType } from '$lib/api/parliamentary';

  let {
    id,
    entityType,
    label,
    href,
    overdueAt = null,
  }: {
    id: string;
    entityType: WatchEntityType;
    label: string;
    href: string;
    /** ISO date of a statutory deadline — shows overdue badge when past */
    overdueAt?: string | null;
  } = $props();

  let watching = $state(hasWatch(id));

  function toggle() {
    if (watching) {
      removeWatch(id);
      watching = false;
    } else {
      addWatch({ id, entityType, label, href });
      watching = true;
    }
  }

  const isOverdue = $derived(
    overdueAt != null && new Date(overdueAt) < new Date()
  );
</script>

<div class="watch-control">
  <button
    type="button"
    class="watch-btn"
    class:watch-btn--active={watching}
    onclick={toggle}
    aria-label={watching ? `Volgen stoppen: ${label}` : `Volgen: ${label}`}
    title={watching ? 'Niet meer volgen' : 'Volgen'}
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill={watching ? 'currentColor' : 'none'}
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M7.5 1.5a.75.75 0 0 1 .705.488l1.078 2.942 3.1.028a.75.75 0 0 1 .44 1.354l-2.5 1.818.955 2.944a.75.75 0 0 1-1.155.836L7.5 10.023l-2.623 1.887a.75.75 0 0 1-1.155-.836l.955-2.944-2.5-1.818a.75.75 0 0 1 .44-1.354l3.1-.028 1.078-2.942A.75.75 0 0 1 7.5 1.5z"/>
    </svg>
    {watching ? 'Gevolgd' : 'Volgen'}
  </button>

  {#if isOverdue}
    <span class="overdue-badge" title="Wettelijke termijn verlopen">
      Verlopen
    </span>
  {/if}
</div>

<style>
  .watch-control {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
  }

  .watch-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 32px;
    padding: 0 12px;
    background: var(--paper-2);
    border: 1px solid var(--rule-strong);
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: var(--t-meta);
    font-weight: 500;
    color: var(--ink-3);
    cursor: pointer;
    transition: background 80ms, color 80ms, border-color 80ms;
  }

  .watch-btn:hover {
    background: var(--paper-3);
    color: var(--ink-2);
  }

  .watch-btn--active {
    background: var(--spine-faint);
    color: var(--spine);
    border-color: var(--spine-faint);
  }

  .watch-btn--active:hover {
    background: var(--paper-3);
    color: var(--ink-2);
    border-color: var(--rule-strong);
  }

  .overdue-badge {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    background: var(--warn-faint);
    color: var(--warn);
    border: 1px solid #D4C4A0;
    border-radius: var(--r-1);
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: var(--track-caps);
    text-transform: uppercase;
  }
</style>
