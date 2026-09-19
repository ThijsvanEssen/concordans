<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>{$page.status}. Concordans.</title>
</svelte:head>

<div class="error-shell">
  <div class="error-inner">
    <span class="error-code">{$page.status}</span>
    <h1 class="error-title">
      {#if $page.status === 404}Pagina niet gevonden{:else}Er ging iets mis{/if}
    </h1>
    <p class="error-body">
      {#if $page.status === 404}
        Deze pagina bestaat niet of is verplaatst.
      {:else}
        {$page.error?.message ?? 'Probeer het later opnieuw.'}
      {/if}
    </p>
    <div class="error-actions">
      <a href="/" class="error-btn error-btn--primary">Terug naar home</a>
      <a href="/explore" class="error-btn">Open het netwerk</a>
    </div>
  </div>
</div>

<style>
  .error-shell {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--s-8) var(--s-5);
  }

  .error-inner {
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: var(--s-3);
  }

  .error-code {
    font-family: var(--font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    color: var(--ink-4);
    text-transform: uppercase;
  }

  .error-title {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: clamp(22px, 4vw, 32px);
    line-height: 1.15;
    margin: 0;
    color: var(--ink);
  }

  .error-body {
    font-family: var(--font-serif);
    font-size: 17px;
    line-height: 1.6;
    color: var(--ink-3);
    margin: 0;
  }

  .error-actions {
    display: flex;
    gap: var(--s-3);
    margin-top: var(--s-2);
    flex-wrap: wrap;
  }

  .error-btn {
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    padding: 7px 16px;
    border-radius: var(--r-1);
    text-decoration: none;
    border: 1px solid var(--rule-strong);
    color: var(--ink-2);
    transition: background var(--dur-1) var(--ease), color var(--dur-1) var(--ease);
  }

  .error-btn:hover {
    background: var(--paper-2);
    color: var(--ink);
    border-bottom: 1px solid var(--rule-strong);
  }

  .error-btn--primary {
    background: var(--ink);
    color: var(--paper);
    border-color: var(--ink);
  }

  .error-btn--primary:hover {
    background: var(--ink-2);
    color: var(--paper);
    border-color: var(--ink-2);
  }
</style>
