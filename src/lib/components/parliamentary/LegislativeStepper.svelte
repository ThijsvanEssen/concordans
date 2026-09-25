<script lang="ts">
	import { STAGES, STAGE_LABEL, stepState, type Stage } from './stages';

	// `stages` are the stages the dossier has passed, `current` the latest one.
	// A dossier can loop (amendments after a report, then a nota again), so
	// the steps are lit by membership, not by position. Where the API says the record
	// is incomplete, a stage before the furthest one is drawn as passed but not shown.
	let {
		stages,
		current,
		complete = null
	}: {
		stages: Stage[];
		current: Stage | null;
		/** `stages_complete`: false when the data lacks papers of a stage that was passed. */
		complete?: boolean | null;
	} = $props();

	const states = $derived(STAGES.map((step) => stepState(step, stages, current, complete)));
	const reached = (i: number) => states[i] !== 'open';
	const anyUnknown = $derived(states.includes('unknown'));
</script>

<ol class="stepper" aria-label="Wetgevingsstatus">
	{#each STAGES as step, i (step)}
		{@const done = states[i] === 'done'}
		{@const active = states[i] === 'active'}
		{@const unknown = states[i] === 'unknown'}
		<li
			class="step"
			class:step--done={done}
			class:step--active={active}
			class:step--unknown={unknown}
			aria-current={active ? 'step' : undefined}
			title={unknown ? 'Niet in de gegevens' : undefined}
		>
			<span class="step-dot" aria-hidden="true">
				{#if done}
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
						<path
							d="M2 5l2.5 2.5L8 3"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				{/if}
			</span>
			<span class="step-label">{STAGE_LABEL[step]}</span>
			{#if i < STAGES.length - 1}
				<span
					class="step-connector"
					aria-hidden="true"
					class:step-connector--done={reached(i) && reached(i + 1)}
					class:step-connector--unknown={states[i] === 'unknown' || states[i + 1] === 'unknown'}
				></span>
			{/if}
		</li>
	{/each}
</ol>
{#if anyUnknown}
	<p class="stepper-note">
		<span class="stepper-note__dot" aria-hidden="true"></span> Doorlopen, niet in de gegevens
	</p>
{/if}

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

	.stepper::-webkit-scrollbar {
		display: none;
	}

	.step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--s-1);
		flex: 1;
		min-width: 64px;
		position: relative;
	}

	/* The current stage in ink, passed stages in ink-2, the rest outlined. */
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
		transition:
			background var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}

	.step--done .step-dot {
		background: var(--ink-2);
		border-color: var(--ink-2);
	}

	.step--active .step-dot {
		background: var(--ink);
		border-color: var(--ink);
		box-shadow: 0 0 0 3px var(--paper-2);
	}

	.step-label {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-align: center;
		line-height: 1.2;
		/* A label wraps inside its step rather than run into the next one. */
		max-width: 100%;
		padding: 0 2px;
		hyphens: auto;
	}

	.step--done .step-label {
		color: var(--ink-2);
	}
	.step--active .step-label {
		color: var(--ink);
		font-weight: 500;
	}

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
		background: var(--ink-2);
	}

	/* Passed, but the data does not record it: an outline in ink-2, dashed on the way in. */
	.step--unknown .step-dot,
	.stepper-note__dot {
		border-style: dashed;
		border-color: var(--ink-2);
	}

	.step--unknown .step-label {
		color: var(--ink-2);
	}

	.step-connector--unknown {
		background: none;
		border-top: 1.5px dashed var(--ink-2);
		height: 0;
	}

	.stepper-note {
		display: flex;
		align-items: center;
		gap: var(--s-1);
		margin: var(--s-2) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.stepper-note__dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border-width: 1.5px;
	}
</style>
