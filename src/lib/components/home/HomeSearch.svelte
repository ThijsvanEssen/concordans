<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import { activeProfileId } from '$lib/stores/profile';
  import { getAutocompleteSuggestions, type Suggestion } from '$lib/search/autocomplete';
  import { parseSearchQuery, type SearchTarget } from '$lib/search/parseSearchQuery';

  export let query = '';

  const dispatch = createEventDispatcher<{ search: { target: SearchTarget; rawQuery: string } }>();

  let parsedTarget = parseSearchQuery(query);
  let exploreHint = false;
  let suggestions: Suggestion[] = [];
  let debounceHandle: ReturnType<typeof setTimeout> | null = null;
  let fetchId = 0;

  $: parsedTarget = parseSearchQuery(query);
  $: exploreHint = query.trim() !== '' && parsedTarget.kind === 'explore';
  $: if (query.trim()) {
    // eslint-disable-next-line svelte/infinite-reactive-loop -- writes only happen in a debounced callback
    scheduleSuggestions(query);
  } else {
    suggestions = [];
  }

  function handleSubmit(event: Event) {
    event.preventDefault();
    if (!query.trim()) return;
    dispatch('search', { target: parsedTarget, rawQuery: query });
  }

  function scheduleSuggestions(value: string) {
    if (debounceHandle) {
      clearTimeout(debounceHandle);
    }
    if (!value.trim()) {
      suggestions = [];
      return;
    }

    fetchId += 1;
    const currentId = fetchId;

    debounceHandle = setTimeout(async () => {
      const profileId = $activeProfileId;
      const results = await getAutocompleteSuggestions(value, profileId);
      if (currentId === fetchId) {
        // eslint-disable-next-line svelte/infinite-reactive-loop -- guarded by fetchId, does not re-trigger the `$:` block
        suggestions = results;
      }
    }, 250);
  }

  onDestroy(() => {
    if (debounceHandle) {
      clearTimeout(debounceHandle);
    }
  });
</script>

<div class="search-wrapper">
  <form class="hero-search" on:submit|preventDefault={handleSubmit}>
    <div class="search-input">
      <input
        type="text"
        bind:value={query}
        placeholder="Zoek op artikel, ECLI, onderwerp of begrip..."
        aria-label="Zoek in wetgeving"
      />
      <button type="submit" disabled={query.trim().length === 0}>Zoek</button>
    </div>
    {#if exploreHint}
      <p class="explore-hint">We openen de explorer om dit verder te zoeken.</p>
    {/if}
  </form>
  <a
    href="/explore"
    class="secondary-cta"
    data-sveltekit-preload-data="hover"
  >
    Verken de grafiek
  </a>
</div>

{#if suggestions.length}
  <ul class="suggestions" aria-live="polite">
    {#each suggestions as suggestion, i (i)}
      <li>
        <a href={suggestion.href}>
          <span>{suggestion.label}</span>
          <small>{suggestion.kind}</small>
        </a>
      </li>
    {/each}
  </ul>
{:else if query.trim()}
  <!-- TODO: connect to the backend suggestion endpoint and render a keyboard-navigable dropdown per profile. -->
{/if}

<style>
  .search-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .hero-search {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }

  .search-input {
    display: flex;
    gap: 0.75rem;
  }

  input {
    flex: 1;
    height: 48px;
    border-radius: var(--radius-card);
    border: 1px solid var(--border);
    padding: 0 1.25rem;
    font-size: 1rem;
    background: var(--surface);
    color: var(--ink);
  }

  input:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  button {
    min-width: 120px;
    border: none;
    border-radius: var(--radius-card);
    background: var(--accent);
    color: white;
    font-weight: 600;
    font-size: 1rem;
    padding: 0 1.5rem;
    cursor: pointer;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary-cta {
    width: fit-content;
    align-self: flex-start;
    padding: 0 1.5rem;
    border-radius: var(--radius-card);
    border: 1px solid var(--accent);
    background: var(--accent-soft);
    color: var(--accent);
    font-weight: 600;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .secondary-cta:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }

  .explore-hint {
    margin: 0;
    font-size: 0.9rem;
    color: var(--muted);
  }

  .suggestions {
    list-style: none;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .suggestions li {
    padding: 0 0;
  }

  .suggestions li + li {
    border-top: 1px solid var(--border);
  }

  .suggestions a {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1.25rem;
    text-decoration: none;
    color: var(--ink);
  }

  .suggestions small {
    font-size: 0.75rem;
    color: var(--muted);
    text-transform: uppercase;
  }

  @media (max-width: 720px) {
    .search-input {
      flex-direction: column;
    }

    button {
      width: 100%;
    }

    .secondary-cta {
      width: 100%;
      justify-content: center;
    }
  }
</style>
