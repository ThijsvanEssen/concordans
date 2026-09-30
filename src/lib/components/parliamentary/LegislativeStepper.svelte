<script lang="ts">
	import { PHASE_SHORT, stepState, type Phase } from './stages';
	import { formatDate } from '$lib/components/explore/readers/_shared';

	// The phases of a bill as the API gives them: all eight in order, each done when a paper,
	// an activity or a decision on the bill marks it, with the first date of that. A dossier
	// can loop (amendments after a verslag), so the steps are lit by `done`, not by position,
	// and a phase nothing marks stays open.
	let { phases, current }: { phases: Phase[]; current: string | null } = $props();

	const states = $derived(phases.map((p) => stepState(p, current)));
	const reached = (i: number) => states[i] !== 'open';
	const titleOf = (p: Phase) => (p.done && p.date ? `${p.name}, ${formatDate(p.date)}` : p.name);
</script>

<ol class="stepper" aria-label="Fasen van het wetsvoorstel">
	{#each phases as step, i (step.name)}
		{@const done = states[i] === 'done'}
		{@const active = states[i] === 'active'}
		<li
			class="step"
			class:step--done={done}
			class:step--active={active}
			aria-current={active ? 'step' : undefined}
			title={titleOf(step)}
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
			<span class="step-label" aria-hidden="true">{PHASE_SHORT[step.name] ?? step.name}</span>
			<span class="sr">{titleOf(step)}{done ? ', doorlopen' : ''}</span>
			{#if i < phases.length - 1}
				<span
					class="step-connector"
					aria-hidden="true"
					class:step-connector--done={reached(i) && reached(i + 1)}
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

	/* The full name of the stage, for a screen reader; the eye reads the short one. */
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
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
		white-space: nowrap;
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
</style>
