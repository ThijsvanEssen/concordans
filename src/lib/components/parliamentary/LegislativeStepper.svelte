<script lang="ts">
	import { PHASE_SHORT, stepState, type Phase } from './stages';
	import { formatDate } from '$lib/components/explore/readers/_shared';

	// The phases of a bill as the API gives them: all eight in order, each done when a paper,
	// an activity or a decision on the bill marks it, with the first date of that. A dossier
	// can loop (amendments after a verslag), so the steps are lit by `done`, not by position,
	// and a phase nothing marks stays open.
	// After them, where the Eerste Kamer has decided on the bill, its decision (from its own
	// site): one more step, passed when adopted, marked in the accent when rejected.
	let {
		phases,
		current,
		ek = null
	}: {
		phases: Phase[];
		current: string | null;
		ek?: { outcome: 'Aangenomen' | 'Verworpen'; date?: string | null } | null;
	} = $props();

	const states = $derived(phases.map((p) => stepState(p, current)));
	const reached = (i: number) => states[i] !== 'open';
	const titleOf = (p: Phase) => (p.done && p.date ? `${p.name}, ${formatDate(p.date)}` : p.name);
	const ekTitle = $derived(
		ek
			? `Eerste Kamer: ${ek.outcome.toLowerCase()}${ek.date ? `, ${formatDate(ek.date)}` : ''}`
			: ''
	);
</script>

<!-- Wide enough, a bar of short words; in a narrow column (the reader, a phone) a list of the
     full names with their dates. The width of the place it stands in decides, not the screen. -->
<div class="stepper-box">
	<!-- Which Kamer each step belongs to: the eight phases in the Tweede Kamer, then the
	     Eerste Kamer's decision. -->
	<div class="chambers" aria-hidden="true">
		<span class="chamber" style:flex={phases.length}>Tweede Kamer</span>
		{#if ek}<span class="chamber chamber--ek" style:flex="1">Eerste Kamer</span>{/if}
	</div>
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
				<span class="step-full" aria-hidden="true"
					>{step.name}{#if done && step.date}<span class="step-date">{formatDate(step.date)}</span
						>{/if}</span
				>
				<span class="sr">{titleOf(step)}{done ? ', doorlopen' : ''}</span>
				{#if i < phases.length - 1 || ek}
					<span
						class="step-connector"
						aria-hidden="true"
						class:step-connector--done={reached(i) &&
							(i < phases.length - 1 ? reached(i + 1) : !!ek)}
					></span>
				{/if}
			</li>
		{/each}
		{#if ek}
			{@const passed = ek.outcome === 'Aangenomen'}
			<li class="step step--done" class:step--rejected={!passed} title={ekTitle}>
				<span class="step-dot" aria-hidden="true">
					<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
						<path
							d={passed ? 'M2 5l2.5 2.5L8 3' : 'M3 3l4 4M7 3l-4 4'}
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<span class="step-label" aria-hidden="true">{ek.outcome}</span>
				<span class="step-full" aria-hidden="true"
					>Eerste Kamer, {ek.outcome.toLowerCase()}{#if ek.date}<span class="step-date"
							>{formatDate(ek.date)}</span
						>{/if}</span
				>
				<span class="sr">{ekTitle}</span>
			</li>
		{/if}
	</ol>
</div>

<style>
	.stepper-box {
		container-type: inline-size;
	}

	.chambers {
		display: flex;
		margin-bottom: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.chamber {
		min-width: 0;
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule);
	}
	.chamber--ek {
		margin-left: var(--s-2);
		text-align: center;
	}

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
		min-width: 0;
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
	/* Rejected by the Eerste Kamer: the one step in the accent. */
	.step--rejected .step-dot {
		background: var(--accent);
		border-color: var(--accent);
	}
	.step--rejected .step-label,
	.step--rejected .step-full {
		color: var(--accent);
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

	/* The full name and date: for the list only. */
	.step-full {
		display: none;
	}
	.step-date {
		margin-left: var(--s-2);
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}

	/* Too narrow for eight short words side by side: a list, the line of the bar running
	   down along the dots, each phase by its full name and the date a record marks. */
	@container (max-width: 520px) {
		/* In the list the Eerste Kamer's step names its Kamer itself. */
		.chamber--ek {
			display: none;
		}
		.stepper {
			flex-direction: column;
			overflow: visible;
		}
		.step {
			flex-direction: row;
			align-items: center;
			gap: var(--s-2);
			padding-bottom: var(--s-2);
		}
		.step:last-child {
			padding-bottom: 0;
		}
		.step-label {
			display: none;
		}
		.step-full {
			display: inline;
			font-family: var(--font-sans);
			font-size: var(--t-meta);
			color: var(--ink-3);
		}
		.step--done .step-full {
			color: var(--ink-2);
		}
		.step--active .step-full {
			color: var(--ink);
			font-weight: 500;
		}
		.step-connector {
			top: 18px;
			bottom: 0;
			left: 8.25px;
			right: auto;
			width: 1.5px;
			height: auto;
		}
	}
</style>
