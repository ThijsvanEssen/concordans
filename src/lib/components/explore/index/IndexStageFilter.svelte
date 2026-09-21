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
	.stage-filter {
		flex: 1;
		min-width: 0;
		position: relative;
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		padding: 14px 8px 4px;
	}
	.stage-filter::before {
		content: '';
		position: absolute;
		left: 8%;
		right: 8%;
		top: 22px;
		height: 1px;
		background: var(--rule-strong);
		z-index: 0;
	}
	.stage-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		border: 0;
		background: transparent;
		cursor: pointer;
		padding: 0 4px;
		z-index: 1;
		min-width: 0;
	}
	.stage-dot {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--paper);
		border: 1.5px solid var(--rule-strong);
		transition:
			background 120ms,
			border-color 120ms;
	}
	.stage-lbl {
		font-family: var(--font-sans);
		font-size: 10.5px;
		color: var(--fg-3);
		text-align: center;
		line-height: 1.25;
		max-width: 100px;
		transition: color 120ms;
	}
	.stage-step:hover .stage-dot {
		border-color: var(--ink);
	}
	.stage-step:hover .stage-lbl {
		color: var(--ink-2);
	}

	/* Tone-aware rims voor unselected status */
	.tone-spine .stage-dot {
		border-color: var(--spine);
	}
	.tone-moss .stage-dot {
		border-color: var(--moss);
	}
	.tone-olive .stage-dot {
		border-color: var(--olive);
	}
	.tone-ochre .stage-dot {
		border-color: var(--ochre);
	}

	/* Selected: vul met dezelfde toon */
	.stage-step--on .stage-dot {
		background: var(--ink);
		border-color: var(--ink);
	}
	.stage-step--on.tone-spine .stage-dot {
		background: var(--spine);
		border-color: var(--spine);
	}
	.stage-step--on.tone-moss .stage-dot {
		background: var(--moss);
		border-color: var(--moss);
	}
	.stage-step--on.tone-olive .stage-dot {
		background: var(--olive);
		border-color: var(--olive);
	}
	.stage-step--on.tone-ochre .stage-dot {
		background: var(--ochre);
		border-color: var(--ochre);
	}
	.stage-step--on .stage-lbl {
		color: var(--ink);
		font-weight: 500;
	}
</style>
