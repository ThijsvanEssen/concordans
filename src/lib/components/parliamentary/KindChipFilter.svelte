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

	/* Filter buttons; the active one is ink on paper. */
	.chip {
		display: inline-flex;
		align-items: center;
		padding: var(--s-1) var(--s-2);
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		line-height: 16px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
		white-space: nowrap;
	}

	.chip:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.chip--active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.chip--active:hover {
		background: var(--ink-2);
		border-color: var(--ink-2);
		color: var(--paper);
	}

	/* A text button: no border, the hover as a paper-2 field. */
	.chip-clear {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: none;
		border: 0;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		cursor: pointer;
		transition:
			color var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}

	.chip-clear:hover {
		color: var(--ink);
		background: var(--paper-2);
	}
</style>
