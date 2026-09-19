<script lang="ts">
  import type { LegislativeStage } from '$lib/api/parliamentary';

  // Two ways to drive the stepper:
  //   1. `stage` (legacy) — single stage, lights up that step + everything before.
  //      Loses information when a dossier has looped (e.g. amendementen after
  //      verslag, then nota again).
  //   2. `stages` + `current` (preferred) — explicit set of stages that have
  //      fired, plus the current one for the "you are here" marker. Honest
  //      about loops; unlit steps clearly haven't fired.
  // Both forms are accepted so existing callers don't break.
  let {
    stage,
    stages,
    current,
  }: {
    stage?: LegislativeStage;
    stages?: LegislativeStage[];
    current?: LegislativeStage | null;
  } = $props();

  const STEPS: { id: LegislativeStage; label: string }[] = [
    { id: 'wetsvoorstel',  label: 'Wetsvoorstel' },
    { id: 'mvt',           label: 'MvT' },
    { id: 'advies_rvs',    label: 'Advies RvS' },
    { id: 'nota',          label: "Nota's" },
    { id: 'verslag',       label: 'Verslag' },
    { id: 'amendementen',  label: 'Amendementen' },
    { id: 'stemming',      label: 'Stemming' },
    { id: 'afgehandeld',   label: 'Afgehandeld' },
  ];

  // Resolve the active stage in either input form.
  const activeStage = $derived<LegislativeStage | null>(current ?? stage ?? null);
  const stageSet = $derived(new Set<string>(stages ?? []));
  const useExplicitSet = $derived(Array.isArray(stages));

  // Legacy fallback: when only `stage` is provided, light up that step + all
  // earlier ones. With explicit `stages`, only stages in the set are lit.
  const currentIndex = $derived(activeStage ? STEPS.findIndex((s) => s.id === activeStage) : -1);
</script>

<ol class="stepper" aria-label="Wetgevingsstatus">
  {#each STEPS as step, i (step.id)}
    {@const done = useExplicitSet
      ? (stageSet.has(step.id) && step.id !== activeStage)
      : (i < currentIndex)}
    {@const active = step.id === activeStage}
    <li
      class="step"
      class:step--done={done}
      class:step--active={active}
      aria-current={active ? 'step' : undefined}
    >
      <span class="step-dot" aria-hidden="true">
        {#if done}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </span>
      <span class="step-label">{step.label}</span>
      {#if i < STEPS.length - 1}
        <span class="step-connector" aria-hidden="true"
          class:step-connector--done={useExplicitSet
            ? (stageSet.has(step.id) && stageSet.has(STEPS[i + 1]?.id))
            : (i < currentIndex)}
        ></span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .stepper {
    display: flex;
    align-items: flex-start;
    gap: 0;
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .stepper::-webkit-scrollbar { display: none; }

  .step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--s-1);
    flex: 1;
    min-width: 56px;
    position: relative;
  }

  .step-dot {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid var(--rule-strong);
    background: var(--paper);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--paper);
    position: relative;
    z-index: 1;
    transition: background 120ms, border-color 120ms;
  }

  .step--done .step-dot {
    background: var(--ink-3);
    border-color: var(--ink-3);
  }

  .step--active .step-dot {
    background: var(--spine);
    border-color: var(--spine);
    box-shadow: 0 0 0 3px var(--spine-faint);
  }

  .step-label {
    font-family: var(--font-sans);
    font-size: 10px;
    letter-spacing: 0.02em;
    color: var(--ink-4);
    text-align: center;
    line-height: 1.2;
    white-space: nowrap;
  }

  .step--done .step-label { color: var(--ink-3); }
  .step--active .step-label { color: var(--spine); font-weight: 600; }

  .step-connector {
    position: absolute;
    top: 9px;
    left: calc(50% + 10px);
    right: calc(-50% + 10px);
    height: 1.5px;
    background: var(--rule-strong);
    z-index: 0;
  }

  .step--done .step-connector,
  .step-connector--done {
    background: var(--ink-3);
  }
</style>
