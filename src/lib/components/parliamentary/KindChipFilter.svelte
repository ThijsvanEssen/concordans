<script lang="ts">
	// Toggleable chips, one per kind. The order of `kinds` is the order shown.
	let {
		kinds,
		selected,
		onChange
	}: {
		kinds: string[];
		selected: Set<string>;
		onChange: (next: Set<string>) => void;
	} = $props();

	function toggle(kind: string) {
		const next = new Set(selected);
		if (!next.delete(kind)) next.add(kind);
		onChange(next);
	}
</script>

{#if kinds.length > 0}
	<div class="chip-row" role="group" aria-label="Filter op documenttype">
		{#each kinds as kind (kind)}
			<button
				type="button"
				class="chip"
				class:chip--active={selected.has(kind)}
				onclick={() => toggle(kind)}
				aria-pressed={selected.has(kind)}
			>
				{kind}
			</button>
		{/each}

		{#if selected.size > 0}
			<button
				type="button"
				class="chip-clear"
				onclick={() => onChange(new Set())}
				aria-label="Wis filters"
			>
				✕
			</button>
		{/if}
	</div>
{/if}

<style>
	.chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		align-items: center;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		height: 24px;
		padding: 0 10px;
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--radius-pill);
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background 80ms,
			color 80ms,
			border-color 80ms;
		white-space: nowrap;
	}

	.chip:hover {
		background: var(--paper-3);
		color: var(--ink-2);
		border-color: var(--rule-strong);
	}

	.chip--active {
		background: var(--spine);
		color: var(--paper);
		border-color: var(--spine);
	}

	.chip--active:hover {
		background: var(--spine-2);
		border-color: var(--spine-2);
		color: var(--paper);
	}

	.chip-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		padding: 0;
		background: none;
		border: 1px solid var(--rule);
		border-radius: 50%;
		font-size: 10px;
		color: var(--ink-4);
		cursor: pointer;
		transition:
			color 80ms,
			border-color 80ms;
	}

	.chip-clear:hover {
		color: var(--spine);
		border-color: var(--spine-faint);
	}
</style>
