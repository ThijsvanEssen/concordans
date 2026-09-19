<script lang="ts">
  import { profiles, activeProfileId } from '$lib/stores/profile';

  type ProfileId = Parameters<typeof activeProfileId.set>[0];

  function onChange(e: Event) {
    activeProfileId.set((e.currentTarget as HTMLSelectElement).value as ProfileId);
  }
</script>

<div class="profile-switcher">
  <label class="sr-only" for="profile-select">Kies een profiel</label>
  <div class="profile-pill">
    <select id="profile-select" value={$activeProfileId} onchange={onChange}>
      {#each $profiles as profile, i (i)}
        <option value={profile.id}>{profile.label}</option>
      {/each}
    </select>
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <polyline points="2,3.5 5,6.5 8,3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </div>
</div>

<style>
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .profile-switcher {
    display: flex;
    align-items: center;
  }

  .profile-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-pill);
    padding: 0.2rem 0.75rem;
    background: var(--surface);
    cursor: pointer;
  }

  select {
    border: none;
    background: transparent;
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--ink);
    appearance: none;
    -webkit-appearance: none;
    cursor: pointer;
    font-family: var(--font-sans);
  }

  select:focus { outline: none; }
  select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  .profile-pill svg {
    color: var(--ink-3);
    pointer-events: none;
    flex-shrink: 0;
  }
</style>
