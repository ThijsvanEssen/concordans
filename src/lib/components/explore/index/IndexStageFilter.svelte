<script lang="ts">
	import { STAGES, type Stage } from '$lib/components/parliamentary/stages';

	// The stages of a bill as a row of buttons; the selected one is the
	// dossier's current stage (`stage` in the API and the URL).
	let { selected, onSelect }: { selected: Stage | null; onSelect: (stage: Stage) => void } =
		$props();
</script>

<div class="stage-filter" role="group" aria-label="Filter op fase">
	{#each STAGES as s (s.id)}
		{@const on = selected === s.id}
		<button
			type="button"
			class="stage-step tone-{s.tone}"
			class:stage-step--on={on}
			onclick={() => onSelect(s.id)}
			title={s.label}
			aria-pressed={on}
		>
			<span class="stage-dot" aria-hidden="true"></span>
			<span class="stage-lbl">{s.label}</span>
		</button>
	{/each}
</div>

<style>
	/* The stages as a row of buttons; the selected one is ink on paper. */
	.stage-filter {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 6px 0 2px;
	}
	.stage-step {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: transparent;
		cursor: pointer;
		min-width: 0;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}
	.stage-dot {
		display: none;
	}
	.stage-lbl {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		line-height: 16px;
		color: var(--ink-2);
		white-space: nowrap;
		transition: color var(--dur-1) var(--ease);
	}
	.stage-step:hover {
		background: var(--paper-2);
	}
	.stage-step:hover .stage-lbl {
		color: var(--ink);
	}

	.stage-step--on {
		background: var(--ink);
		border-color: var(--ink);
	}
	.stage-step--on:hover {
		background: var(--ink-2);
		border-color: var(--ink-2);
	}
	.stage-step--on .stage-lbl {
		color: var(--paper);
	}
</style>
