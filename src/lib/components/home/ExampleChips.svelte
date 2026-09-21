<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	type ExampleChip = {
		label: string;
		query: string;
	};

	export let examples: ExampleChip[] = [];

	const dispatch = createEventDispatcher<{ select: { query: string } }>();

	function handleSelect(example: ExampleChip) {
		dispatch('select', { query: example.query });
	}
</script>

<section class="examples" aria-labelledby="examples-title">
	<div class="examples-header">
		<h2 id="examples-title">Voorbeelden</h2>
		<p>Klik een voorbeeld om de zoekbalk te vullen.</p>
	</div>
	<div class="chip-row">
		{#each examples as example, i (i)}
			<button type="button" on:click={() => handleSelect(example)}>
				{example.label}
			</button>
		{/each}
	</div>
</section>

<style>
	.examples {
		width: min(1040px, 100%);
		margin: 0 auto;
		padding: var(--space-4) 0 var(--space-3);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-card);
	}

	.examples-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.examples-header p {
		margin: 0;
		color: var(--muted);
	}

	.chip-row {
		margin-top: var(--space-3);
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	button {
		border: 1px solid var(--border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		padding: 0.5rem 1rem;
		font-size: 0.95rem;
		cursor: pointer;
		transition:
			background 150ms ease,
			border-color 150ms ease;
	}

	button:focus-visible {
		outline: 3px solid var(--accent);
		outline-offset: 2px;
	}

	button:hover {
		border-color: var(--accent);
		background: var(--accent-soft);
		color: var(--accent);
	}
</style>
