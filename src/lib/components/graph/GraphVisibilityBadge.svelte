<script lang="ts">
  let {
    hiddenCount = 0,
    onShowAll,
  }: {
    hiddenCount?: number;
    onShowAll?: () => void;
  } = $props();
</script>

{#if hiddenCount > 0}
  <div class="visibility-badge" role="status" aria-live="polite">
    <span class="vb-hidden">
      <span class="vb-num">{hiddenCount}</span>
      <span class="vb-label">bronnen niet zichtbaar</span>
    </span>
    {#if onShowAll}
      <button
        type="button"
        class="vb-action"
        title="Toon alle bronnen die bij deze expansie zijn opgehaald"
        onclick={() => onShowAll?.()}
      >
        Toon alle →
      </button>
    {/if}
  </div>
{/if}

<style>
  .visibility-badge {
    position: absolute;
    bottom: var(--s-3);
    left: 50%;
    transform: translateX(-50%);
    z-index: 4;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 5px 12px;
    background: var(--paper);
    border: 1px solid var(--rule-strong);
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--ink-3);
    box-shadow: 0 2px 10px rgba(20, 18, 14, 0.06);
    pointer-events: auto;
    white-space: nowrap;
  }

  .vb-hidden {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }

  .vb-num {
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
  }

  .vb-label {
    font-size: 10px;
    letter-spacing: 0.04em;
    color: var(--ink-4);
  }

  .vb-action {
    padding: 2px 8px;
    background: var(--ink);
    color: var(--paper);
    border: none;
    border-radius: 999px;
    font-family: var(--font-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.03em;
    cursor: pointer;
    transition: background var(--dur-1) var(--ease);
  }
  .vb-action:hover { background: var(--accent, #7A1F1A); }
</style>
